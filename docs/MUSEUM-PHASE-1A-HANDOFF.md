# Phase 1A Foundation — Complete (stopped before 1B)

**Commit:** `ba28de2` (`ba28de2acd58f8b5d8e73231bf9dca45fbbfb262`)  
**Branch:** `main` (ahead of origin by 1 — not pushed)  
**Museum events generated:** **zero** (generator disabled)

---

## Action required from you

Run this in **Supabase → SQL Editor** (Notepad-paste the full file):

1. `supabase/museum-phase1a-foundation.sql`  
2. Optional comments only: `supabase/museum-phase1a-reset-note.sql`

Until the migration runs, publish/score soft-skip Museum RPCs (`migration_pending`) and **do not** break scoring or cards.

---

## Migration files

| File | Purpose |
|------|---------|
| `supabase/museum-phase1a-foundation.sql` | Tables, RLS, uniqueness, security-definer RPCs |
| `supabase/museum-phase1a-reset-note.sql` | Documents that Museum permanence is not wiped by season reset |

---

## Tables / columns created

### `museum_events`

Permanent event store. Phase 1 type: `fan_favorite_rivalry`.

Facts, dual plaques, template key/version, tags, scores, OT nullable, `game_identity_key`, provider id, canonical + name snapshots.

**No FK to `leagues` with CASCADE.**  
**No rows inserted in Phase 1A.**

### `museum_event_participants`

Event participants with `user_id ON DELETE SET NULL`, required `display_name_snapshot`, favorite/pick/confidence/BB/outcome.

**No rows in Phase 1A.**

### `museum_allegiance_snapshots`

Publish-time allegiance. Status:

- **`prelock`** — published, before first kickoff (rebuildable on legal republish)
- **`frozen`** — immutable after first kickoff

Stores card favorite/spread/underdog, ranks + `rank_source` for later (no ranked-upset conclusions).

### `game_final_scores` (durable score design)

**Chosen over extending `game_results` alone** because:

- `week_results` / `game_results` are **wiped on season reset**
- Museum retry needs provider + team identity independent of `card_games.id` churn
- ATS `winner` behavior stays on `game_results` unchanged

Also adds **nullable** convenience columns on `game_results`: `away_score`, `home_score`, `overtime`, `score_source`, `finalized_at` (older rows remain null; no backfill).

---

## Snapshot lifecycle

1. **Publish** (`publishWeekCard` + auto-publish) → `museum_rebuild_allegiance_snapshots`
2. **Pre-lock republish** → delete all `prelock` for that league/week → rebuild
3. **First kickoff** (or late publish already past kickoff) → status → `frozen`
4. **Frozen week** → rebuild is no-op (`already_frozen`)
5. **Who is included:** active humans, real favorites for card sport, confident canonical match on a side, not bots / no-team / other sports

One-sided interest creates snapshots only for that side; **both-side candidacy** is for Phase 1B generation (not run now).

---

## Freeze enforcement

- RPC: `museum_freeze_allegiance_snapshots`
- Rebuild auto-freezes when `p_first_kickoff_at <= now()`
- Scoring path calls freeze with ops-verified lock
- Post-lock favorite/name/membership changes **do not** rewrite frozen rows

---

## Durable scores

- Written from `saveResultsAndScoreWeek` **after** ATS `game_results` insert
- Only when `finalBoxes` present
- Production-gated
- Idempotent upsert on `(league_id, week_number, game_identity_key)`
- OT defaults to **`null`** (unknown)
- Failure of Museum path **cannot** fail scoring

---

## RLS policies

| Table | SELECT | INSERT/UPDATE/DELETE by client |
|-------|--------|--------------------------------|
| `museum_events` | League members | **Denied** |
| `museum_event_participants` | Via readable events | **Denied** |
| `museum_allegiance_snapshots` | League members | **Denied** |
| `game_final_scores` | League members | **Denied** |

Writes only via security-definer RPCs (ops or `service_role` for auto-publish).

---

## Security-definer functions

| Function | Role |
|----------|------|
| `museum_rebuild_allegiance_snapshots` | Publish / pre-lock refresh |
| `museum_freeze_allegiance_snapshots` | First-kickoff freeze |
| `museum_upsert_game_final_scores` | Durable numeric finals |
| `museum_league_event_count` | Delete guard + verification |
| `museum_is_league_ops` / `museum_is_league_member` / `museum_league_is_production` | Internal gates |

All use `set search_path = public`.

---

## Idempotency constraints

- Rivalry event: unique on `(league_id, event_type, source_provider_game_id)` when provider present
- Fallback: unique on `(league_id, event_type, season, week_number, game_identity_key)`
- Participant: unique `(event_id, user_id)` when user present
- Snapshot: unique prelock + unique frozen per `(league_id, week_number, game_identity_key, user_id)`
- Final scores: unique `(league_id, week_number, game_identity_key)`

---

## Season reset / deletion

| Action | Behavior |
|--------|----------|
| Season reset | **Must not** delete Museum tables / `game_final_scores` (documented; existing reset SQL does not touch them) |
| Member leave | Snapshots/events remain; names snapshotted |
| Account delete | `user_id SET NULL`; display-name snapshot kept |
| League hard-delete | Blocked when `museum_events` count > 0 (`league-delete-guard.ts`) |
| Privacy of names after account delete | **Flagged for legal/privacy review** — not invented here |

---

## Code wired

| Path | Change |
|------|--------|
| `src/lib/cloud.ts` | Snapshots after publish; durable scores + freeze + stub after score |
| `src/lib/auto-publish-card.ts` | Snapshots via service-role RPC |
| `src/lib/league-delete-guard.ts` | Museum events block hard-delete |
| `src/lib/museum/*` | Types, identity, gates, snapshots, final-scores, read, **disabled generator** |

**Not implemented:** rivalry generation, Rivalry Wing UI, humor templates in prod, AI, other wings.

`MUSEUM_EVENT_GENERATION_ENABLED = false` in `generator-stub.ts`.

---

## Verification results

| Check | Result |
|-------|--------|
| `npm run verify:museum-1a` | **PASS** |
| ESLint (museum + touched files) | **PASS** |
| `tsc --noEmit` | Pre-existing only: `reset-password/page.tsx` PASSWORD_RECOVERY (unrelated) |
| `npm run build` | **PASS** |
| Production Museum events | **0 by design** |

---

## Product rules preserved for 1B

- **Spread upset:** underdog on published card wins **outright** (helper ready; not used to generate)
- **Ranked upset:** ranks stored; humor **deferred**
- **OT:** nullable; default null

---

## Unresolved risks

1. Migration must be applied before snapshots/scores land in prod DB.
2. `reset_league_season` has multiple SQL copies in repo history — any future edit must keep skipping Museum tables.
3. Pre-migration publish windows won’t have snapshots unless re-published after migration (pre-lock only).
4. Account-deletion name anonymization policy still open.
5. NFL confident catalog not in Phase 1A — CFB matching only for snapshots.
6. Scoring without `finalBoxes` still won’t store numeric scores (by design).

---

## Phase 1B gate

**Do not enable permanent event generation without separate approval.**

Next approval would cover: both-side detection → read durable scores → one deterministic template → insert event + participants → Rivalry Wing UI (1C).

---

## Commit hash to record

`ba28de2`  
Full: `ba28de2acd58f8b5d8e73231bf9dca45fbbfb262`
