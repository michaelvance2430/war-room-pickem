# E1 — Saturday Situation Room: SELECT-only blast radius & repair plan

**Status:** AUDIT ONLY — **no mutations executed**  
**League:** Saturday Situation Room  
**UUID:** `76730ee3-d440-4a91-9616-a768ffc03189`  
**Related:** E0 quarantine still **ACTIVE** (`FOUNDRY_EMERGENCY_QUARANTINE = true`)  
**SELECT pack:** `scripts/sql/e1-saturday-situation-room-SELECT-ONLY.sql`

---

## Access note (agent)

| Probe | Result |
|-------|--------|
| Anon Supabase REST on this league | **0 rows** (RLS) — live inventory **not** available to this agent |
| Service role in local env | **Absent** |
| Live classification of every row | **REQUIRES Mike to run SELECT-only SQL and paste results** |

Everything below is:

1. **Confirmed from product/incident facts**  
2. **Confirmed from code-path analysis** of Foundry sim  
3. **Hypothesis / pending** until SELECT results  

Do **not** treat pending items as proven contamination.

---

## 1. Executive blast-radius verdict

| Claim | Confidence |
|-------|------------|
| Foundry ran the **real Host pipeline** on this production league and left Home asking for **Build Week 8 Card** | **High** (operator report + code path) |
| `leagues.current_week` is almost certainly **8** (or was at incident) | **High** from report; **verify** with SELECT §A |
| `sport_id` should still be **cfb** (sport immutability + no Foundry sport change) | **High** expected; **verify** §A |
| Weeks **2–7** (and possibly rescores of 0–1) may contain Foundry publish/score artifacts | **Medium–High** pending SELECT |
| Weeks **0–1** cards must be treated as **possibly legitimate**; class only with timestamps + demo markers | **Binding rule** |
| Baseline roster **27 humans / 0 bots** — any `is_bot=true` is **sim contamination candidate** | **High** if bots present |
| Permanent hardware/trophies for this room: likely **unchanged** unless ceremony/auto-engrave ran | **Medium** pending §G |
| **Exact row-level contamination list** | **PENDING live SELECT** |

**Bottom line:** Contamination is **league-scoped competitive state** (week, cards, picks, results, points) until proven otherwise. **Do not mass-delete Weeks 0–1.** Do not repair until SELECT results fill the ID lists.

---

## 2. Incident timeline (reconstructed)

**Certainty: logical sequence from code, not measured timestamps.**

| Step | Event | Mechanism |
|------|--------|-----------|
| 0 | Pre-incident | `sport_id=cfb`, `current_week=0`, 27 humans, 0 bots, **legitimate W0 + W1 cards** |
| 1 | Foundry armed | Creator sticky / lab tools on Host Dashboard for this session’s league |
| 2 | Per-week loop (typical auto-score / randomize path) | Demo or re-publish → bots → bot picks → randomize results → **score** → **`advanceLeagueAfterScore`** → `setLeagueActiveWeek(N+1)` |
| 3 | Weeks 0…7 scored (or subset) | Real `week_results` / `game_results` / membership stat updates |
| 4 | After scoring week 7 | `current_week` → **8** |
| 5 | Exit Foundry | Production Home: **Build Week 8 Card** (trusted live week = 8) |
| 6 | E0 quarantine | Lab tools disabled app-side (does not roll back DB) |

**If exact timestamps unavailable after SELECT:** keep this as **uncertain order**; use `published_at` / `scored_at` clusters to refine.

---

## 3. League-row findings

| Field | Pre-incident authority | Expected after sim | Verify |
|-------|------------------------|--------------------|--------|
| `id` | `76730ee3-d440-4a91-9616-a768ffc03189` | same | §A |
| `name` | Saturday Situation Room | same | §A |
| `sport_id` | **cfb** | **cfb** (immutability) | §A |
| `current_week` | **0** | **8** (incident) | §A |
| `commissioner_id` | unchanged expected | same | §A |
| Other settings | unknown | unlikely Foundry target | §A column list |

**Only `current_week` is the known progression field Foundry auto-advance writes.** Other columns should be compared to Mike’s memory/export if available.

---

## 4. Roster findings

| Baseline | Incident risk |
|----------|----------------|
| 27 humans | Points/streaks/weekly_points may be **sim-scored** |
| 0 bots | Any bot rows = **NEW SIMULATION BOT** candidates |

**Classification rules (apply after SELECT §B):**

| Class | Rule |
|-------|------|
| PRE-EXISTING HUMAN | `is_bot=false` and user_id in pre-incident 27 (Mike confirm roster) |
| NEW SIMULATION BOT/FIXTURE | `is_bot=true` |
| SUSPICIOUS | human with `weeks_played` / points inconsistent with “only W0 started” |
| UNKNOWN | cannot match |

**Do not delete humans.** Bot removal is repair-plan only after ID list.

---

## 5. Card / game findings by week

### Classification rules (code-backed markers)

Foundry **demo slate** generates game ids:

- CFB: `demo-w{week}-g{i}`  
- NFL: `demo-nfl-w{week}-g{i}`  

(see `src/lib/demo-slate.ts`)

| Week | Pre-incident | After sim risk | Classification guidance |
|------|--------------|----------------|-------------------------|
| 0 | Legitimate card existed | May be **untouched**, **republished**, or **replaced** | Compare `published_at`, game ids, team set. Demo-prefixed games ⇒ Foundry touch. Real odds ids / non-demo ⇒ likely legitimate core |
| 1 | Legitimate card existed | Same as W0 | Same |
| 2–7 | Not asserted pre-existing | Likely **Foundry-created** if demo ids or batch timestamps | CONFIRMED FOUNDRY if demo markers; else SUSPICIOUS |
| 8 | Home wants Build Card | Card may be **absent** (current_week advanced past scored 7) | If no card: progression only; if card exists: inspect |

**Never auto-label W0/W1 as contamination or as safe without evidence.**

---

## 6. Picks findings

| Source | Marker |
|--------|--------|
| Real human | `is_bot=false`, picks before incident window (if timestamps cluster with real play) |
| Bot picks | `is_bot=true` + RPC `seed_bot_picks_for_week` |
| Self-sim lock for creator | Possible human pick filled by sim helper during lab |

**Overwrite risk:** `picks` unique `(league_id, user_id, week_number)` — re-score/re-lock can **update** same row. Without pre-incident export, human W0/W1 picks are **UNCERTAIN** if `updated_at` moves into incident window.

Summarize in report by **counts per week**, not full PII.

---

## 7. Results / scoring findings

| Object | Role |
|--------|------|
| `week_results` | One row per scored week |
| `game_results` | Per game outcome under week_result |
| Membership stats | Updated by scoring pipeline |

**How `current_week` reached 8 (code-true):**

```text
score week N → advanceLeagueAfterScore(N) → setLeagueActiveWeek(N+1)
```

If weeks 0–7 all scored once: after scoring 7, `current_week = 8`.

**Verify:** max(`week_results.week_number`) = 7 and `current_week` = 8.

---

## 8. Derived-state findings

Likely contaminated if sim scored:

- `total_points`, `weekly_points[]`, streaks, ATS, best bet, prop stats, `weeks_played`  
- Standings order / division leaders  
- Fair-entry / cut math inputs (if any cloud)  

**Not automatically contaminated:** division **assignments** (Auto Balance not part of Foundry week sim).

---

## 9. Permanent / cultural findings

| Surface | Likely |
|---------|--------|
| `league_trophies` | UNCHANGED unless closeout/ceremony |
| Profile UUID hardware seeds | UNCHANGED (not league score path) |
| Gazette | CONFIRMED FOUNDRY MUTATION **if** editions for weeks 2–7 or incident timestamps |
| Achievements | SUSPICIOUS if league-scoped awards in window |
| Locker bot talk | SUSPICIOUS if seeded |
| Crystal Ball | Usually UNCHANGED unless seed_bot_crystal_ball ran |
| Museum snapshots | UNKNOWN / REVIEW-ONLY tables |

---

## 10. Confirmed contamination list (pre-SELECT)

Only what is **confirmed without DB**:

| Item | Status |
|------|--------|
| Operator ran Foundry sim through Week 8 on this league | **CONFIRMED** |
| Production Home showed Build Week 8 | **CONFIRMED** |
| Real pipeline can set `current_week` and score weeks | **CONFIRMED** (code) |
| Specific row UUIDs for cards/results/bots | **NOT CONFIRMED** — need SELECT |

After Mike runs SQL, promote rows to confirmed using:

- `is_bot = true` memberships  
- `card_games.id` matching `demo-w%` / `demo-nfl-w%`  
- `week_results` for weeks **proven** only created in incident window  
- `current_week = 8` if still set  

---

## 11. Uncertain list

- Whether W0/W1 cards were overwritten vs left intact  
- Whether real human picks on W0/W1 were updated  
- Exact scored week set (0–7 full vs partial)  
- Gazette/achievement/locker side effects  
- Whether any trophy/ceremony ran  
- Bot count and IDs  
- Whether `current_week` still 8 now  

---

## 12. Guarded repair plan — **NOT EXECUTED**

### Principles

1. **UUID-scoped:** every mutation `WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'`.  
2. **ID-scoped:** delete/update only listed primary keys.  
3. **Preserve W0/W1** unless SELECT proves replacement demo cards.  
4. **Backup SELECT dumps first** (script bottom section).  
5. **One stage → verify → next.**  
6. Prefer **recalc from remaining legitimate results** over inventing points.

### Stage 0 — Freeze & export (no write)

- Keep Foundry quarantine ON  
- Run full SELECT pack; save CSVs  
- Mike confirms: bot list, W0/W1 card ids to **keep**, week results to **drop**

### Stage 1 — Restore league progression

**Restore:**

```sql
-- DO NOT RUN IN E1 — plan only
-- Preconditions: backup taken; Mike confirms intended week = 0
-- UPDATE public.leagues
-- SET current_week = 0
-- WHERE id = '76730ee3-d440-4a91-9616-a768ffc03189'
--   AND sport_id = 'cfb'
--   AND current_week = 8;   -- guard: only if still 8
```

**Verify:**

```sql
-- SELECT ONLY after repair
SELECT id, sport_id, current_week FROM public.leagues
WHERE id = '76730ee3-d440-4a91-9616-a768ffc03189';
-- expect current_week = 0, sport_id = cfb
```

### Stage 2 — Remove Foundry bots (only proven bots)

```sql
-- PLAN ONLY — after bot user_ids listed from SELECT
-- DELETE FROM public.picks
-- WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
--   AND user_id IN ( /* bot uuids */ );
-- DELETE FROM public.memberships
-- WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
--   AND is_bot = true
--   AND user_id IN ( /* same bot uuids */ );
```

**Never** `DELETE` humans by week range.

### Stage 3 — Results for Foundry-only weeks

After listing `week_result_id`s for weeks **confirmed Foundry-only** (likely 2–7; **not** 0–1 unless proven):

```sql
-- PLAN ONLY
-- DELETE game_results WHERE week_result_id IN ( /* ids */ );
-- DELETE week_results WHERE id IN ( /* ids */ )
--   AND league_id = '76730ee3-d440-4a91-9616-a768ffc03189';
```

### Stage 4 — Cards for Foundry-only weeks

Only `week_card_id`s with demo games / incident-only weeks:

```sql
-- PLAN ONLY
-- DELETE card_games WHERE week_card_id IN ( /* foundry card ids */ );
-- DELETE week_cards WHERE id IN ( /* same */ )
--   AND league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
--   AND week_number NOT IN (0, 1);  -- extra belt: never 0/1 without Mike override
```

**W0/W1:** if demo games **replaced** legitimate card, Mike may authorize **surgical** `card_games` replace from backup — not blind week delete.

### Stage 5 — Picks for Foundry-only weeks / bots

```sql
-- PLAN ONLY
-- DELETE pick_games WHERE pick_id IN (
--   SELECT id FROM picks WHERE league_id = '…' AND week_number IN (/* foundry weeks */)
--     AND user_id IN (/* bots or all if week is pure sim */)
-- );
-- DELETE picks WHERE … explicit ids
```

Human picks on W0/W1: **Mike confirmation** if `updated_at` in incident window.

### Stage 6 — Recalculate membership stats

If legitimate W0/W1 scores remain:

- Re-run **official** score path only for kept weeks, **or**  
- Manual restore of pre-incident membership stat columns from backup CSV  

If no legitimate scores should remain:

```sql
-- PLAN ONLY — zero stats for this league humans after wiping all sim results
-- UPDATE memberships SET
--   total_points = 0, weekly_points = '{}', ats_correct = 0, ats_total = 0,
--   current_streak = 0, best_week = 0, worst_week = 0, perfect_weeks = 0,
--   best_bet_hits = 0, best_bet_total = 0, prop_hits = 0, prop_total = 0,
--   weeks_played = 0
-- WHERE league_id = '76730ee3-d440-4a91-9616-a768ffc03189'
--   AND coalesce(is_bot,false) = false;
```

Only after results/picks decisions.

### Stage 7 — Cultural cleanup

- Delete `gazette_editions` for weeks proven sim-only (by id)  
- Review `achievements` / locker / crystal ball only if SELECT shows incident rows  

### Transaction boundaries

- Prefer **one stage per transaction**  
- Commit only after verification SELECT for that stage  
- Stop if any guard `WHERE` matches 0 rows unexpectedly or > expected  

### Rollback

- Restore from Stage 0 CSV exports / Supabase backup / PITR if available  
- Do not reverse without export  

### Mike confirmation required before any DELETE

| Question | Default |
|----------|---------|
| Keep week_card ids for W0 and W1? | **Yes** unless demo-replaced |
| Drop week_results for weeks 2–7? | Yes if Foundry-only |
| Drop week_results for 0–1? | **No** unless overwrite proven |
| Remove all `is_bot` memberships? | Yes if count>0 and all trial bots |
| Zero all human points? | Only if no legitimate scored weeks remain |

---

## 13. Verification & rollback (post-repair, not now)

| Check | Expect |
|-------|--------|
| `current_week` | 0 |
| `sport_id` | cfb |
| humans / bots | 27 / 0 |
| week_cards | W0 + W1 present; no orphan demo 2–7 |
| week_results | empty or only legitimate kept weeks |
| Home mission | not Build Week 8; CFB week 0 / wait-for-card as appropriate |
| Foundry quarantine | still ON |

---

## 14. Database prevention (later — not E1)

1. **Hard block:** lab tools / randomize / auto-score refuse `resolveLeagueMode() === 'production'`.  
2. **Simulation marker:** `week_cards.source = 'foundry_demo'` + DB CHECK rejecting foundry source on production leagues.  
3. **Service/RPC:** no seed_bot / score without production gate.  
4. **Separate Foundry Supabase project** (env isolation).  
5. Keep E0 quarantine until (1)–(2) land.

---

## Explicit confirmation

| | |
|--|--|
| Production data mutated by E1 | **No** |
| Repair executed | **No** |
| Foundry re-run | **No** |
| RLS migration | **No** |
| Quarantine lifted | **No** |
| Live row inventory complete | **No — awaiting Mike SELECT results** |

---

## What Mike should do next

1. Open Supabase SQL Editor (production).  
2. Run `scripts/sql/e1-saturday-situation-room-SELECT-ONLY.sql` (all SELECT).  
3. Paste or attach key result sets (league row, membership counts, cards 0–8, results, demo game counts).  
4. Authorize **E2 repair** with explicit keep/drop ID lists.

**E1 stops here.**
