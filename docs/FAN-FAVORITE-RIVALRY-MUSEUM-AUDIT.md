# Fan Favorite Rivalry — Architecture Audit & Phase 1 Plan

**Status:** Audit only. No migrations, no generation, no UI writes.  
**Scope:** Rivalry Wing · Fan Favorite Rivalry exhibits only.  
**Product line:** Museum permanently engraves exceptional history; Gazette reports the week.  
**Date:** 2026-08-04

---

## 1. Executive finding

**Current Museum is not a permanent event store.** It is mostly **derived at read time** from:

| Source | What it feeds | Permanence |
|--------|----------------|------------|
| `league_trophies` | Championship / Toilet / Nerd / division plaques | **Permanent** (survives season reset) |
| `loadLeaguePlayers()` live stats | Perfect weeks, streaks, point hauls | **Season-ephemeral** (stripped if no scored weeks) |
| Prior-season seed / Excel merge | Last-season hardware wall | Client + upsert into trophies |
| Local crew chapters | Crew wing teaser | Local/crew store, not Museum events |

There is **no** `museum_events` (or equivalent) table. Fan Favorite Rivalry **cannot** ship by extending the current timeline builder alone. Phase 1 needs a **new permanent event model**, allegiance snapshots, and **server-side idempotent generation** after real finals.

Your product architecture is correct:

1. Capture allegiance at lock  
2. Wait for a real final score  
3. Create one permanent, factual Museum event  
4. Add War Room humor as a separate plaque layer  
5. Make generation idempotent  

Phase 1 should use **deterministic templates**, not live AI.

---

## 2. Audit answers (required 1–18)

### 1–3. How Museum is built / stored / routes

| Item | Finding |
|------|---------|
| **Route** | `/museum` → `src/app/museum/page.tsx` |
| **Timeline builder** | `buildMuseumTimeline()` in `src/lib/player-history.ts` |
| **Client `MuseumEvent` type** | In-memory only: `id, year, sortKey, emoji, title, body, userId, userName, kind` — kinds: trophy \| milestone \| season \| streak \| badge |
| **Storage** | Trophies: `league_trophies`. Everything else: computed from roster + live season stats |
| **Read-time derive?** | **Yes** for timeline/records/streaks. **No** for trophies (DB rows) |
| **Related permanent tables** | `league_trophies` (keep), `gazette_editions` (weekly, **wiped on season reset** — wrong model for Museum) |
| **No** | `museum_events`, rivalry exhibits, allegiance snapshots |

**UI today:** Living History header → Last Season Hardware Wall → Crew wing strip → tabs (Timeline / League records / Season history). Rivalry Wing should be **additive**, not a rewrite of that stack.

### 4–5. Score finalization & cron

| Path | Role |
|------|------|
| **Authoritative write** | `saveResultsAndScoreWeek()` in `src/lib/cloud.ts` |
| **Who can score** | Ops (commissioner/deputy); Eyes blocked; bored-practice exception |
| **What is stored** | `week_results` + `game_results` with **ATS cover only**: `winner ∈ {home, away, push}` |
| **Box scores** | `finalBoxes` optional in-memory for Six-Seven cheevo + prop settle — **not persisted** |
| **Client score sync** | Commissioner/Week Ops: Odds API → `buildResultsFromScores()` → optional auto-score |
| **Crons** | `auto-publish-card`, `nudge-picks` only — **no score-finalization cron** |

**Implication:** Permanent rivalry facts that need real scores **cannot** be reconstructed later from `game_results` alone. Phase 1 must **persist box scores (and related facts) on the Museum event** at generation time, or extend a durable score store first.

### 6. Published card / provider / team IDs

| Field | Status |
|-------|--------|
| `card_games.id` | Stable UUID for the card line |
| `away_team` / `home_team` | **Display name strings**, not catalog IDs |
| `spread` / `favorite` | On card at publish |
| `away_rank` / `home_rank` | Optional ints (`card-game-ranks.sql`) |
| `odds_event_id` | Optional (`card-game-odds-id.sql`); best-effort at publish |
| Canonical team IDs on card | **Missing** — resolved at runtime via `matchCfbTeamConfident(rawName)` |

**Risk:** Name matching is good for commissioner interest UI; for permanent history, Phase 1 should **snapshot canonical team IDs at allegiance freeze** so rename/odds-string drift cannot rewrite history.

**Re-publish hazard:** `publishWeekCard` **deletes and re-inserts** all `card_games` for a week. Snapshots and uniqueness keys must use a strategy that survives re-publish (prefer `source_provider_game_id` + league/season/week, or re-bind snapshots on re-publish before lock).

### 7. Favorite-team snapshots

| Item | Status |
|------|--------|
| Live table | `profile_favorite_teams` (mutable, PK `user_id, sport_id`) |
| Catalog IDs | Stable CFB ids (e.g. `georgia`); `no-team` sentinel |
| At-lock snapshot | **Does not exist** |
| League interest | Live RPC counts only (`get_league_favorite_team_counts`) — ops, anonymous |

**Do not** freeze history by overwriting `profile_favorite_teams`. Need a **new snapshot table** written at authoritative card lock.

### 8. Picks / confidence / Best Bet after finalization

| Item | Status |
|------|--------|
| `pick_games` | `side`, `confidence` (1–5), `is_best_bet`, `locked_spread`, `locked_favorite` |
| Retention | Available after scoring until **season reset** (cascade delete with picks) |
| Player re-save | After first lock, re-saves **replace** `pick_games` (original `locked_at` kept) |

So picks are available at score time **if** the season has not been reset. They are **not** safe long-term history by themselves. Copy into Museum participant rows at event creation.

### 9. Final scores & overtime

| Fact | Available today? |
|------|------------------|
| ATS winner | Yes — `game_results.winner` |
| Numeric home/away scores | Transient in `finalBoxes` / Odds API — **not in DB** |
| Margin | Computable only while boxes exist |
| Overtime | **Not reliable** — Odds scores API does not expose OT; prop preset OT is manual |

**Phase 1 rule:** Omit OT plaque/tag unless a **trustworthy** source is added later. Do not invent OT.

### 10. Rankings & spreads

| Fact | Source |
|------|--------|
| Pregame ranks | `card_games.away_rank` / `home_rank` at publish (if present) |
| Spread | `card_games.spread` + pick-level `locked_spread` |
| Ranked upset | Calculable only if ranks were non-null **and** final straight-up winner is known |
| Spread upset | Needs final margin vs card spread (requires persisted scores) |

### 11. Best location for idempotent generation

| Option | Verdict |
|--------|---------|
| Client `/museum` load | **Forbidden** — must only read |
| Score reconciliation inside `saveResultsAndScoreWeek` | **Good hook**, but today it only has cover winners + optional `finalBoxes` |
| Dedicated function called **after** successful score write when boxes present | **Recommended primary** |
| Standalone cron | **Optional backfill/retry** only (no score cron exists yet) |
| Foundry / demo / eyes | **Hard gate off** via `canWritePermanentCareer` / `isProductionMode` |

**Recommended lifecycle location:**

```
publishWeekCard (or lock_time freeze)
  → write card_game_allegiance_snapshots (both-side candidates optional)
saveResultsAndScoreWeek succeeds + finalBoxes for game G
  → tryGenerateFanFavoriteRivalryExhibit({ league, cardGame, boxes, … })
  → production gate + unique constraint + insert museum_events + participants
```

Generation must not require anyone opening Museum.

### 12. Proposed schema (evaluate existing first)

**Cannot safely reuse** `league_trophies` (wrong grain: season trophy types) or `gazette_editions` (reset-wiped, weekly prose blob).

**Recommended new tables** (conceptual — names can match product draft):

#### `museum_events` (permanent)

- `id` uuid PK  
- `league_id` uuid **not** cascading destroy of history on leave (FK strategy below)  
- `sport_id` text  
- `season` int  
- `week_number` int  
- `event_type` text — Phase 1: `'fan_favorite_rivalry'` only  
- `source_card_id` uuid nullable  
- `source_card_game_id` uuid nullable  
- `source_provider_game_id` text nullable  
- `occurred_at` timestamptz (game start or finalization)  
- `finalized_at` timestamptz  
- `away_team_id` / `home_team_id` text (canonical)  
- `away_team_name_snapshot` / `home_team_name_snapshot` text  
- `winning_team_id` / `losing_team_id` text nullable  
- `away_score` / `home_score` int  
- `margin` int  
- `overtime` boolean nullable (null = unknown)  
- `fact_payload` jsonb (ranks, spread, upset flags, score_source, etc.)  
- `headline` text  
- `plaque` text (factual layer only)  
- `humor_plaque` text (War Room layer — separate column)  
- `template_key` / `template_version` text/int  
- `tags` text[] or jsonb compact tags  
- `created_at`  

**Uniqueness (idempotency):**

```text
unique (league_id, event_type, source_provider_game_id)
-- fallback when provider id missing:
unique (league_id, event_type, season, week_number, source_card_game_id)
```

Prefer provider game id when present; always store both.

#### `museum_event_participants`

- `event_id` → museum_events  
- `user_id` uuid **nullable** (`ON DELETE SET NULL`)  
- `display_name_snapshot` text **required**  
- `favorite_team_id_snapshot` text  
- `represented_team_id` text  
- `pick_team_id` nullable  
- `confidence` nullable  
- `is_best_bet` boolean  
- `outcome` text (`won` \| `lost` \| `push` \| `no_pick`)  
- Queryable indexes on `(event_id)`, `(user_id)`, `(represented_team_id)`

#### `card_game_allegiance_snapshots` (or `museum_allegiance_snapshots`)

Written at **authoritative card lock**, not at score time:

- league_id, sport_id, season, week_number  
- week_card_id, card_game_id, provider_game_id  
- away_team_id, home_team_id (+ name snapshots)  
- user_id, display_name_snapshot, favorite_team_id_snapshot, side (`away`\|`home`)  
- snapshot_at  
- **Unique:** `(card_game_id, user_id)` or `(league_id, provider_game_id, user_id)`  

Picks optional on this row (may be null until locked); at generation, merge latest `pick_games` **once** into the permanent participant row.

### 13. Proposed RLS

| Actor | museum_events | participants | allegiance snapshots |
|-------|---------------|-------------|----------------------|
| Authenticated league member | **SELECT** own league only | SELECT via event league | SELECT own league |
| Client insert/update/delete | **Deny** | Deny | Deny |
| Production finalization | **Service role / security definer RPC** only | same | same |
| Foundry / eyes / demo | No production writes (`canWritePermanentCareer`) | same | same |
| Cross-league | Deny | Deny | Deny |

Pattern: mirror trophies for **read**; **writes only via `security definer` functions** (not broad commissioner `FOR ALL`), so clients cannot manufacture exhibits even if compromised UI is used.

### 14. Uniqueness / idempotency

1. DB unique constraint on event identity (above)  
2. Generator: `INSERT … ON CONFLICT DO NOTHING` (or update-only-if-null never for facts)  
3. Never delete+recreate on refresh  
4. Re-score of week: if event exists, **do not** rewrite facts/headline/humor unless an explicit “repair incomplete event” path with versioning  
5. Page load: SELECT only  

### 15. Account deletion & leave

| Scenario | Rule |
|----------|------|
| Leave league | Membership gone; **Museum events stay**; participants keep `display_name_snapshot`; `user_id` may remain for link if profile exists |
| Profile rename | Exhibit uses snapshot names only |
| Account deletion | **`user_id` ON DELETE SET NULL**; never cascade-delete shared `museum_events` |
| Season reset | **Must not** wipe `museum_events` (unlike gazette/picks/cards) — document in `reset_league_season` |
| League hard-delete | Today many tables cascade from `leagues`; production history policy should **block** delete with Museum events present (align with `league-delete-guard`) or archive first |

**Explicit decision required before migrations:** hard FK from `museum_events.league_id` → `leagues(id) ON DELETE CASCADE` would destroy history with the room. Prefer **restrict** or soft-retire leagues.

### 16. Exact files / migrations (when approved — not now)

| Layer | Likely artifacts |
|-------|------------------|
| SQL | `supabase/museum-events.sql` (tables, indexes, RLS, unique, reset_season exception, definer RPCs) |
| Snapshot write | Hook near `publishWeekCard` and/or lock_time freeze in `src/lib/cloud.ts` + possibly auto-publish |
| Generation | New `src/lib/museum/fan-favorite-rivalry.ts` + call from end of `saveResultsAndScoreWeek` when production + finalBoxes |
| Templates | `src/lib/museum/rivalry-templates.ts` (versioned keys) |
| Load | `loadMuseumRivalryEvents(leagueId)` in cloud or museum lib |
| UI | `src/app/museum/page.tsx` + small components for Rivalry Wing |
| Gates | Reuse `career-integrity.ts` / `league-mode.ts` |
| Tests | Unit: template priority, both-side qualification, idempotent insert; no fake prod exhibits |

### 17. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Re-publish deletes `card_games` → orphan snapshots | High | Snapshot provider id + rebind; freeze after first lock_time |
| Scores not in DB → lost if score without boxes | High | Require numeric finals for rivalry generation; optional durable `game_box_scores` later |
| OT / ranked upset invented | High | Omit when unknown |
| Name-only team match false positive | Medium | Confident CFB match only; require both sides matched |
| Season reset wipes evidence trail | Medium | Museum rows independent of picks/cards |
| Client regeneration duplicates | High | DB unique + no client writes |
| Foundry/demo engrave | High | `isProductionMode` + definer checks |
| Re-score rewrites history | High | Immutable after insert |
| One-sided “rivalry” | Spec | Require both sides ≥1 active supporter at snapshot |
| Profile favorite change rewrites past | Spec | Snapshot only |
| Cost / AI drift | Spec | Deterministic templates Phase 1 |

### 18. Staged plan (narrow Phase 1)

See §7 below.

---

## 3. Event lifecycle (recommended)

```
[A] Card published (5 real games on published week_card)
      optional: precompute “both sides supported?” for UI only

[B] Authoritative card lock (lock_time / first kickoff freeze — product pick one)
      → For each card_game with both-side real favorites among active humans:
         INSERT allegiance snapshots (immutable)
      → Do NOT create museum_events yet

[C] Players lock picks (existing path)
      → pick_games remain source of truth until [D]

[D] Game reliably final + week scoring path has numeric finalBoxes for that game
      → Server: qualify Fan Favorite Rivalry
      → Load snapshots + picks + card ranks/spread
      → Production gate
      → Choose template (priority) → headline + factual plaque + humor plaque
      → INSERT museum_event + participants ON CONFLICT DO NOTHING

[E] Museum UI
      → SELECT rivalry events chronologically
      → Expand for participants/facts
      → Empty state if none
```

**Does not qualify:** one-sided support, non-card game, non-final, canceled/uncertain, Foundry/demo/eyes, duplicate key, missing both-side snapshot.

---

## 4. Qualification checklist (implementation map)

| Rule | Data today |
|------|------------|
| Real published card game | `week_cards` + `card_games` |
| League current sport | `leagues.sport_id` vs favorites sport |
| Both sides ≥1 active human favorite | Snapshot at lock from memberships ∩ profile_favorite_teams ∩ confident team match |
| Allegiance at lock | **New snapshot** |
| Trustworthy final | Odds `completed` + scores; generation only with numeric boxes |
| Not canceled/uncertain | Only `completed === true` from scores API; no partial |
| Production league | `canWritePermanentCareer` / `isProductionMode` |
| No duplicate | Unique constraint |
| Not one-sided | Enforce both sides in snapshot |

**Active human:** mirror interest RPC — membership, `is_bot = false`, real team id ≠ `no-team`.

---

## 5. Template system (deterministic Phase 1)

### Calculable conditions

| Condition | Reliable? | Threshold / rule |
|-----------|-----------|------------------|
| Close game | Yes if scores stored | margin ≤ 3 |
| Blowout | Yes if scores | margin ≥ 21 |
| Overtime | **No** today | omit tag/joke unless future source |
| Ranked upset | Partial | underdog (no rank or worse rank) beats ranked; only if ranks present |
| Spread upset | Yes if scores + card spread | dog covers or straight-up dog win vs card favorite — **define one rule and store in fact_payload** |
| Confidence 5 loss | Yes from pick_games at gen | losing-side supporter confidence = 5 |
| Best Bet loss | Yes | losing-side supporter `is_best_bet` on that game |
| Best Bet win | Yes | winning-side BB |
| Picked against own team | Yes | pick side ≠ favorite side snapshot |
| Favorite still won after abandon | Yes | pick against favorite + favorite won |
| Multiple supporters | Yes | count snapshots per side |

### Priority (pick one headline + one primary humor; optional tags)

1. **Best Bet disaster** (losing supporter BB)  
2. **Confidence 5 disaster** (losing conf 5)  
3. **Picked against own team** (esp. if favorite won)  
4. **Ranked upset** (if ranks reliable)  
5. **Overtime** (only if known)  
6. **Blowout** (margin ≥ 21)  
7. **Close game** (margin ≤ 3)  
8. **Multiple supporters** framing (if both sides multi and nothing above)  
9. **Default rivalry** (simple “A defeated B in a Fan Favorite Rivalry”)

Tags (compact, not stacked jokes): subset of  
`BLOWOUT` · `CLOSE` · `OVERTIME` · `UPSET` · `CONFIDENCE 5` · `BEST BET DISASTER` · `PICKED AGAINST OWN TEAM` — max ~3, priority-aligned.

### Two layers (always)

**Factual plaque (first):**  
`Georgia 38, Auburn 14` · `Mike defeated Rob in a Fan Favorite Rivalry` · date  

**War Room plaque (second, visually distinct):**  
one template line only.

Preserve `headline`, `plaque`, `humor_plaque`, `template_key`, `template_version` so wording does not drift on re-render.

---

## 6. Rivalry Wing UI (Phase 1C proposal)

**Do not** delete Timeline / Records / History / Hardware / Crew.

**Add** a clearly labeled **Rivalry Wing** section (above or between Crew and tabs — recommend **after Hardware, before or after Crew**):

- Chronological list of stored rivalry events only  
- Compact card: teams, score, date, season/week, factual line first  
- Expand: participants (sides, conf, BB, outcome), tags, humor  
- 1v1 and group-vs-group from participant lists  
- Phone-first, no sample exhibits in production  
- Empty:  
  **No rivalry exhibits yet.**  
  *Everyone is still pretending this is friendly.*  

Visibility: whenever Museum is accessible (no “after Week 1” gate). Empty is truthful until first generated event.

---

## 7. Phase plan (evaluate / approve)

### Phase 1A — Foundation *(approve first)*

- `museum_events` + `museum_event_participants`  
- Allegiance snapshot table + write path at authoritative lock  
- Production / RLS / security definer write path  
- Idempotent insert framework (no UI exhibits)  
- Season-reset **exclusion** for Museum events  
- Account-deletion FK policy decision  

### Phase 1B — Generation

- Both-side detection from snapshots  
- Hook after real finals + numeric scores  
- One event per league/game  
- Immutable facts + one template humor  
- Duplicate prevention  

### Phase 1C — UI

- Rivalry Wing on `/museum`  
- Read-only load  
- Expandable cards + empty state  

### Later — not now

Hall of Infamy, Record Vault, aggregates (ensure schema can answer Mike vs Rob / team-side records later via participants + fact_payload), AI plaques, Gazette nominations, commissioner curation.

---

## 8. Aggregate rivalry records (Phase 1 readiness only)

Do **not** precompute. Queryable later from:

- Participants + outcomes → Mike vs Rob  
- `represented_team_id` groups → Georgia supporters vs Auburn  
- `margin` / tags → largest blowout, closest finish  
- Confidence / BB flags on losers → disaster leaderboards  

---

## 9. Recommendation summary

| Decision | Recommendation |
|----------|----------------|
| Reuse existing Museum table? | **No** for rivalry permanence |
| Snapshot favorites? | **Yes** — new table at card lock |
| Persist scores on event? | **Yes** — required for plaques |
| Generation site | Post-`saveResultsAndScoreWeek` dedicated idempotent function; optional retry job later |
| Writing | Deterministic versioned templates |
| Client role | Read only |
| AI | Not Phase 1 |
| Other wings | Not Phase 1 |

---

## 10. Approval gate

**Nothing has been implemented.**  

Next step after approval:

1. Lock product choices: **exact “authoritative card lock” moment** (publish vs `lock_time` vs first kickoff), **spread-upset definition**, **league FK on delete**  
2. Ship **Phase 1A** migrations + snapshot + gated generator stub (no production exhibits until 1B flags)  
3. Then 1B generation, then 1C UI  

Wait for approval (and any overrides on lock moment / upset rules / FK delete) before any migration or production-behavior change.
