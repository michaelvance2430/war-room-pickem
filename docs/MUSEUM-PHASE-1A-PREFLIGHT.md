# Museum Phase 1A — Migration Preflight Report

**Verdict: PASS** (after required migration repairs; see §8)  
**Date:** 2026-08-04  
**Original commit under review:** `ba28de2` (still **unpushed**)  
**Generator:** disabled (`MUSEUM_EVENT_GENERATION_ENABLED = false`)  
**Migration file after preflight repairs:** `supabase/museum-phase1a-foundation.sql` (working tree may be ahead of `ba28de2` — commit the repaired SQL before deploy)

---

## 1. Verdict

### PASS

Repairs applied to the foundation migration before approval:

1. Wrap entire script in `BEGIN` … `COMMIT`
2. `museum_events.league_id` → `leagues(id) ON DELETE RESTRICT`
3. `museum_allegiance_snapshots.league_id` / `game_final_scores.league_id` → `ON DELETE CASCADE` (empty-league cleanup; permanent events still block delete)
4. Dependency fail-fast for required tables/columns
5. Rebuild validates `week_card` ownership; optional `card_game` ownership
6. Freeze prefers DB kickoff from `card_games.start_time` (not client-forged early freeze)
7. Final-score upsert validates `week_result` / `week_card` / `card_game` ownership; production gate
8. Explicit `REVOKE … FROM anon` on all Museum RPCs

---

## 2. Destructive-scope findings

### Files inspected

- `supabase/museum-phase1a-foundation.sql` (repaired)
- `supabase/museum-phase1a-reset-note.sql` (comments only)

### Every occurrence class

| Kind | Where | What it does at **apply** time |
|------|--------|--------------------------------|
| **DROP** | `DROP POLICY IF EXISTS` ×4 | Drops only named Museum policies if re-running; not competitive policies |
| **DELETE** | **Inside** `museum_rebuild_allegiance_snapshots` only | Deletes `status = 'prelock'` snapshots for one league/week when RPC is later invoked — **not at migration apply** |
| **TRUNCATE** | none | — |
| **UPDATE** | **Inside** freeze/rebuild (status) and score upsert (durable + optional `game_results` score columns) | Not run at apply; later runtime only |
| **ALTER TABLE** | `game_results` add nullable columns; enable RLS ×4; optional FK attach DO block | Adds null columns only — **no row rewrites** |
| **CASCADE** | FKs: participants→events CASCADE; snapshots/scores→leagues CASCADE; events→leagues **RESTRICT** | Schema definition only at apply |
| **REPLACE** | `CREATE OR REPLACE FUNCTION` × helpers/RPCs | Replaces function definitions only |
| **Function replacement** | All Museum helpers/RPCs | Additive / replace definitions |
| **Policy replacement** | Drop+create 4 SELECT policies on Museum tables only | — |
| **Grants/revokes** | REVOKE ALL FROM public/anon; GRANT EXECUTE to authenticated; GRANT SELECT on 4 tables | — |
| **Trigger creation** | **none** | — |

### Explicit confirmations (migration apply)

| Claim | Status |
|-------|--------|
| Deletes zero production rows at apply | **Yes** (no top-level DELETE/TRUNCATE) |
| Updates zero existing profile/league/card/pick/score/trophy/achievement/Gazette/Museum **data rows** at apply | **Yes** |
| No backfill | **Yes** |
| Creates zero Museum events | **Yes** (DDL only) |
| Creates zero Museum participants | **Yes** |
| Leaves existing ATS scoring behavior unchanged | **Yes** (`winner` path untouched; optional null score columns only) |
| Can run inside a transaction | **Yes** — wrapped in `BEGIN`…`COMMIT` |
| Rolls back completely if any statement fails | **Yes** (single transaction) |
| Safe to run only once | **Yes** (intended) |
| Safe to **rerun** | **Mostly yes** — `IF NOT EXISTS` tables/indexes, `OR REPLACE` functions, `DROP POLICY IF EXISTS`, `ADD COLUMN IF NOT EXISTS`, FK attach guarded. Re-run does not wipe competitive data. |

### DELETE hidden in functions (runtime, not apply)

```sql
-- museum_rebuild_allegiance_snapshots ONLY:
delete from public.museum_allegiance_snapshots
where league_id = p_league_id
  and week_number = p_week_number
  and status = 'prelock';
```

Frozen rows are never deleted by this path. No DELETE targets competitive tables.

### UPDATE hidden in functions (runtime)

- Freeze/rebuild: `status` prelock → frozen on snapshots only  
- Score upsert: `game_final_scores` upsert; optional update of `game_results.away_score/home_score/overtime/score_source/finalized_at` — **never** `winner`

---

## 3. Foreign-key / delete behavior

| Table | `league_id` / parent FK | On delete |
|-------|-------------------------|-----------|
| **`museum_events`** | `references leagues(id)` | **`ON DELETE RESTRICT`** |
| **`museum_event_participants`** | `event_id → museum_events(id)` | **`ON DELETE CASCADE`** |
| **`museum_allegiance_snapshots`** | `references leagues(id)` | **`ON DELETE CASCADE`** |
| **`game_final_scores`** | `references leagues(id)` | **`ON DELETE CASCADE`** |
| Snapshot/participant `user_id` | `profiles(id)` | **`ON DELETE SET NULL`** |

### Desired behaviors

| Scenario | Behavior |
|----------|----------|
| League with ≥1 Museum event | Hard delete **blocked by PostgreSQL** (RESTRICT) |
| League with 0 Museum events | App guard + CASCADE can remove snapshots/scores with empty test league |
| Member leave | Membership only; Museum rows untouched |
| Season reset | Does not touch Museum tables (existing reset SQL; comments reinforce) |
| Direct SQL delete of league with Museum events | **Fails** with FK violation |

App `league-delete-guard.ts` remains a UX belt; DB RESTRICT is the hard stop.

---

## 4. Security-definer grant matrix

| Function | EXECUTE | PUBLIC revoked | anon revoked | authenticated | service_role |
|----------|---------|----------------|--------------|---------------|--------------|
| `museum_is_league_ops(uuid)` | authenticated | yes | yes | yes | Superuser/service typically bypasses grants |
| `museum_is_league_member(uuid)` | authenticated | yes | yes | yes | same |
| `museum_league_is_production(uuid)` | authenticated | yes | yes | yes | same |
| `museum_card_first_kickoff(uuid,int)` | authenticated | yes | yes | yes | same |
| `museum_rebuild_allegiance_snapshots(...)` | authenticated | yes | yes | yes | Explicit branch allows `auth.role() = service_role` |
| `museum_freeze_allegiance_snapshots(...)` | authenticated | yes | yes | yes | Member path or service |
| `museum_upsert_game_final_scores(...)` | authenticated | yes | yes | yes | Explicit service_role branch |
| `museum_league_event_count(uuid)` | authenticated | yes | yes | yes | Count if service_role |

All use `security definer` + `set search_path = public`.

---

## 5. Caller-input trust analysis

### What DB revalidates independently

| Input | Rebuild | Freeze | Score upsert |
|-------|---------|--------|--------------|
| Caller identity | `auth.uid()` / `auth.role()` | yes | yes |
| Ops role | `memberships.role` / `is_deputy` | member or ops | ops |
| Production mode | `museum_league_is_production` from `leagues` | — | yes (non-service) |
| League membership | via ops helper | member check | ops |
| Week card identity | **must** match `week_cards` league+week | — | if provided |
| Card game id | if provided, must sit on that week_card | — | if provided, must match league week |
| Week result id | — | — | must match league+week |
| Supporters / favorites | **from DB** join only | — | — |
| Display names | **from `profiles`** | — | — |
| User ids for snapshots | **from memberships** | — | — |
| Kickoff / lock | **`museum_card_first_kickoff`** from `card_games.start_time` | same | — |

### Residual TypeScript trust (catalog not in PostgreSQL)

| Client-supplied | Residual risk | Mitigation |
|-----------------|---------------|------------|
| Canonical `away_team_id` / `home_team_id` | Client chooses which team IDs filter favorites | Snapshots only attach real members whose **DB** favorite equals those IDs; wrong IDs → empty or wrong filter, not invented users |
| Team display names | Cosmetic on snapshot | Not identity keys |
| `game_identity_key` / provider id | Client can choose key for prelock | Scoped to league+week; frozen after kickoff; score path ties `card_game_id` to real card when present |
| Card favorite / spread / ranks | Metadata for Phase 1B | Not used to mint events in 1A |
| Numeric scores | Ops can upsert any scores for **their** league after score path | Cross-league blocked; `week_result`/`card_game` ownership checked; no client insert policy |

**Not trusted alone:** production claims, role claims, lock claims, invented user lists, invented display names.

**Cannot manufacture Museum events via RPC in Phase 1A** — no event-write function exists.

---

## 6. Snapshot idempotency analysis

### Lifecycle

1. Publish → rebuild → insert **`prelock`** rows (supporters from DB).  
2. Legal pre-lock republish → **DELETE only `prelock`** for that league+week → re-insert.  
3. First kickoff (DB `start_time`) → **UPDATE same rows** to **`frozen`** (not a second set).  
4. Further publish → `already_frozen` skip; frozen rows untouched.  
5. Freeze again → updates 0 prelock rows; idempotent.

### Indexes

| Index | Definition |
|-------|------------|
| `museum_allegiance_prelock_uidx` | UNIQUE `(league_id, week_number, game_identity_key, user_id)` WHERE `status = 'prelock' AND user_id IS NOT NULL` |
| `museum_allegiance_frozen_uidx` | UNIQUE `(league_id, week_number, game_identity_key, user_id)` WHERE `status = 'frozen' AND user_id IS NOT NULL` |
| `museum_events_provider_uidx` | UNIQUE `(league_id, event_type, source_provider_game_id)` WHERE provider not null |
| `museum_events_identity_uidx` | UNIQUE `(league_id, event_type, season, week_number, game_identity_key)` |
| `museum_event_participants_user_uidx` | UNIQUE `(event_id, user_id)` WHERE `user_id IS NOT NULL` |
| `game_final_scores_identity_unique` | UNIQUE `(league_id, week_number, game_identity_key)` |

### Account deletion + uniqueness

Partial uniques require `user_id IS NOT NULL`. After `ON DELETE SET NULL`, multiple rows may share `user_id IS NULL` — **no unique collision**, no collapse of distinct historical people (names remain on `display_name_snapshot`).

### Cross-league isolation

All unique keys include `league_id`. Same provider game in two leagues → two independent rows.

### Missing provider ID

Fallback identity: `away_team_id|home_team_id` (or client `game_identity_key` rebuilt to that).

---

## 7. Durable-score correction behavior

| Topic | Behavior |
|-------|----------|
| Written when | **After** ATS `game_results` insert succeeds in `saveResultsAndScoreWeek`; try/catch so Museum failure **never** rolls back weekly scoring |
| Missing `finalBoxes` | No durable numeric rows (no invent) |
| Duplicate scoring | `ON CONFLICT (league_id, week_number, game_identity_key) DO UPDATE` — one row |
| Corrected re-score | **Updates** durable numeric fields on conflict (latest authorized ops write wins for scores) |
| ATS `winner` | Unchanged; separate insert/delete path for covers |
| Season reset | `game_final_scores` **not** in reset deletes → survives |
| Empty league hard delete | CASCADE removes final scores when **no** museum_events (RESTRICT would block if events exist) |
| **Phase 1B repair policy (explicit, not implemented)** | Durable scores may update on re-score; **Museum events once created must be immutable** — generation uses insert-on-conflict-do-nothing; re-score must **not** rewrite existing `museum_events` plaques/facts. Repair = new versioned event type or explicit admin RPC only, never silent overwrite. Phase 1A creates **zero** events so this is forward policy only. |

---

## 8. Migration changes required (done in preflight)

All applied to `supabase/museum-phase1a-foundation.sql` before you paste:

- Transaction wrap  
- RESTRICT / CASCADE FKs  
- Dependency guards  
- Stronger RPC validation  
- anon revoke  

**Do not paste the old pre-repair content from commit `ba28de2` alone if the working tree has the repaired file.** Prefer the current file on disk.

---

## 9. SQL files to run (order)

1. **`supabase/museum-phase1a-foundation.sql`** (repaired, transactional)  
2. Optional: **`supabase/museum-phase1a-reset-note.sql`** (comments only)  
3. **Read-only verification SQL** (below)  
4. Confirm museum event count = 0  
5. Then commit repaired SQL if needed, **then** push (not yet)  
6. Vercel deploy  
7. Isolated production-mode test league publish  
8. Confirm snapshots  
9. Confirm normal scoring  
10. **Stop before Phase 1B** — generator stays off  

### Prerequisites (must already exist)

- `profile_favorite_teams` (`profile-favorite-teams.sql`)  
- `memberships.is_bot`, `memberships.is_deputy`  
- Core schema: leagues, memberships, week_cards, card_games, week_results, game_results  

Optional but recommended for provider keys: `card_games.odds_event_id` (`card-game-odds-id.sql`) — missing column only weakens identity quality; migration still applies.

---

## 10. Read-only verification SQL

```sql
-- ============================================================
-- Museum Phase 1A — READ-ONLY verification (no inserts/updates)
-- Run after museum-phase1a-foundation.sql
-- ============================================================

-- A) Tables exist
select
  to_regclass('public.museum_events') is not null as museum_events,
  to_regclass('public.museum_event_participants') is not null as museum_event_participants,
  to_regclass('public.museum_allegiance_snapshots') is not null as museum_allegiance_snapshots,
  to_regclass('public.game_final_scores') is not null as game_final_scores;

-- B) Expected columns (sample critical set)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by table_name, ordinal_position;

-- C) game_results optional columns present
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'game_results'
  and column_name in ('away_score', 'home_score', 'overtime', 'score_source', 'finalized_at')
order by column_name;

-- D) RLS enabled
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by 1;

-- E) Policies
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by tablename, policyname;

-- F) Functions exist
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'museum_is_league_ops',
    'museum_is_league_member',
    'museum_league_is_production',
    'museum_card_first_kickoff',
    'museum_rebuild_allegiance_snapshots',
    'museum_freeze_allegiance_snapshots',
    'museum_upsert_game_final_scores',
    'museum_league_event_count'
  )
order by 1;

-- G) Function ACLs including PUBLIC (pseudo-role; not a pg_roles row)
-- Prefer scripts/museum-1a-step3-verify.sql section F / F2 (aclexplode).
-- Do NOT use: r.rolname in (..., 'public') against pg_roles.

-- H) Foreign keys + delete actions
select
  con.conname,
  rel.relname as table_name,
  conf.relname as ref_table,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
left join pg_class conf on conf.oid = con.confrelid
where n.nspname = 'public'
  and con.contype = 'f'
  and rel.relname in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by rel.relname, con.conname;

-- Expected:
-- museum_events.league_id → leagues RESTRICT
-- museum_event_participants.event_id → museum_events CASCADE
-- museum_allegiance_snapshots.league_id → leagues CASCADE
-- game_final_scores.league_id → leagues CASCADE
-- user_id → profiles SET NULL (snapshots + participants)

-- I) Unique indexes
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'museum_events',
    'museum_event_participants',
    'museum_allegiance_snapshots',
    'game_final_scores'
  )
order by tablename, indexname;

-- J) Zero Museum history / foundation rows before first publish/score
select
  (select count(*) from public.museum_events) as museum_events_count,
  (select count(*) from public.museum_event_participants) as museum_participants_count,
  (select count(*) from public.museum_allegiance_snapshots) as allegiance_snapshots_count,
  (select count(*) from public.game_final_scores) as game_final_scores_count;

-- Expect all 0 immediately after migration (before any new publish/score).

-- K) Competitive table row counts (sanity — compare to pre-migration notes if you saved them)
select 'leagues' as tbl, count(*) from public.leagues
union all select 'memberships', count(*) from public.memberships
union all select 'week_cards', count(*) from public.week_cards
union all select 'card_games', count(*) from public.card_games
union all select 'picks', count(*) from public.picks
union all select 'week_results', count(*) from public.week_results
union all select 'game_results', count(*) from public.game_results
union all select 'league_trophies', count(*) from public.league_trophies
union all select 'gazette_editions', count(*) from public.gazette_editions
order by 1;
```

Optional: save section K counts **before** migration as well for side-by-side comparison.

---

## 11. Commit push status

| Item | Status |
|------|--------|
| Commit `ba28de2` | Exists locally |
| Pushed to origin | **No** (`main` ahead by ≥1; do not push yet) |
| Preflight SQL repairs | In working tree on `museum-phase1a-foundation.sql` — **commit before push** if file differs from `ba28de2` |

---

## 12. Generation remains disabled

```ts
// src/lib/museum/generator-stub.ts
export const MUSEUM_EVENT_GENERATION_ENABLED = false as const;
```

No production event write path. Phase 1B requires separate approval.

---

## Deployment order (confirmed)

1. Apply repaired `museum-phase1a-foundation.sql` in Supabase  
2. Optionally apply comments-only reset note  
3. Run read-only verification SQL  
4. Confirm Museum event/participant counts = 0  
5. Commit any preflight SQL fixes; **then** push (not now unless you choose)  
6. Vercel deploy  
7. Disposable production-mode test league: publish card  
8. Confirm snapshots  
9. Confirm cards/scoring still work  
10. **Stop before Phase 1B**
