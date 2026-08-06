# Structural Hardening D0 — Live RLS Correction Design

**Status:** DESIGN + REVIEW-ONLY SQL PROPOSAL — **not applied to production**  
**Date:** 2026-08-06  
**Scope:** Policy design, catalog evidence checklist, migration proposal, regression & deploy plans  
**Out of scope:** Executing SQL · mutating production · app runtime changes · Foundry rebuild · trophy/profile discovery narrowing · full write inventory  

### Explicit non-actions

| Action | Status |
|--------|--------|
| Execute migration on production | **No** |
| Mutation probes on production | **No** |
| Alter `league_trophies` visibility | **No (D0)** |
| Narrow broad profile/league SELECTs | **No (D0)** |
| Foundry rebuild / lift quarantine | **No** |
| Application code changes | **No** |

---

## 0. Confirmed live defects (Mike-supplied)

| # | Defect | Risk |
|---|--------|------|
| 1 | `public.leagues` has DELETE policy `commissioner_id = auth.uid()` | Commissioner can destroy entire league + CASCADE children via PostgREST |
| 2 | Live policies contain tautology `m.league_id = m.league_id` (unqualified `league_id` bound to memberships alias) | Membership gate becomes always-true for any membership row → **cross-league read/write inflation** |
| 3 | Domains with tautology include **achievements**, **crystal_ball_picks**, **crystal_ball_result** | Cross-league cultural data exposure / write path weakness |
| 4 | `picks` / `pick_games` “manage own” by `user_id` without clear **target-league membership** | User could write pick rows for a `league_id` they do not belong to (if FK allows league id) |
| 5 | Crystal Ball RLS embeds **hardcoded 2026** freeze timestamps | Year rollover failure; wrong sport freeze |
| 6 | `league_trophies` broad linked-winner SELECT | **Do not change in D0** (Profile Trophy Room product) |
| 7 | Broad authenticated profile/league discovery reads | **Do not change in D0** without product decision |

### Repo origin of defects (source archaeology)

| Artifact | Path | Note |
|----------|------|------|
| Commissioner DELETE league | `supabase/leave-delete-policies.sql` | Explicit product at time of write |
| Unqualified `m.league_id = league_id` | `crystal-ball.sql`, `crystal-ball-privacy.sql`, `crystal-ball-full.sql`, others | Live planner can collapse to `m.league_id = m.league_id` |
| Hardcoded CB freeze | `crystal-ball-privacy.sql` L37–40 | `2026-08-29` / `2026-09-10` |
| Own picks without membership | `schema.sql` “Users manage own picks” | `using (auth.uid() = user_id)` only |
| Sport immutability | `supabase/league-sport-immutable.sql` | Trigger `leagues_sport_id_immutable_trg` — **preserve** |
| Deputy ops | `supabase/deputy-ops.sql` | `is_league_ops()` + Ops policies — **do not break** |
| Postseason snapshots | `supabase/postseason-snapshots-REVIEW-ONLY.sql` | Table may be **absent** live — catalog only |
| Trophy career read | `supabase/trophy-career-read.sql` | Out of D0 |

---

## A. Read-only catalog evidence (complete via preflight SQL)

**File:** `supabase/D0-rls-preflight-SELECT-ONLY.sql`  

Mike (or ops) runs this **SELECT-only** pack against production to fill live truth. Agent cannot see live `pg_policies` without that paste.

### A1. Checklist (every item is SELECT-only)

| Probe | Purpose |
|-------|---------|
| `pg_class.relrowsecurity` / `relforcerowsecurity` | RLS enabled / forced per table |
| `pg_policies` for target tables | Live policy names, cmd, qual, with_check |
| Detect `m.league_id = m.league_id` or uncorrelated patterns in `qual`/`with_check` | Confirm tautologies |
| `pg_proc` + `pg_trigger` for `leagues_sport_id_immutable` | Function body + trigger enabled |
| Unique constraints on picks, memberships, crystal_ball, achievements | Integrity |
| `to_regclass('public.league_postseason_snapshots')` | Presence/absence |
| `SECURITY DEFINER` routines in `public` | Inventory |
| `information_schema.routine_privileges` EXECUTE for `anon`/`authenticated` | Over-grant risk |
| `prosecdef` + `proconfig` search_path | search_path safety |
| Multiple UPDATE policies on `leagues` | Duplicate commissioner/ops UPDATE |
| Policies mentioning `is_deputy` / `is_league_ops` | **Deputy authorization map before any change** |

### A2. Expected deputy authorization (from repo — verify live)

| Capability | Repo mechanism | D0 impact |
|------------|----------------|-----------|
| Week cards / card games / results | `is_league_ops(league_id)` policies | **Unchanged** |
| Update league settings / active week | `"Ops update league"` | **Unchanged** (preserve) |
| Update membership stats (scoring) | `"Ops update memberships"` | **Unchanged** |
| Read all picks / pick_games for scoring | `"Ops read league picks"` / pick_games | **Unchanged** |
| Score pick totals | `"Ops score picks"` UPDATE | **Unchanged** |
| Appoint deputies / reset season / transfer commissioner | App + commish-only RPCs | **Out of D0** |
| DELETE league | `"Commissioner deletes league"` | **Removed** (commish should not delete via client) |

**Deputy report requirement:** Before apply, paste preflight section `D0_deputy_policies` listing every policy whose qual references `is_league_ops` or `is_deputy`. D0 must not drop those.

---

## B. Proposed policy corrections (summary)

| # | Change | Tables |
|---|--------|--------|
| 1 | **DROP** `"Commissioner deletes league"` | `leagues` |
| 2 | Ensure **no** authenticated DELETE policy remains on `leagues` | `leagues` |
| 3 | Keep INSERT `"Users create leagues"`; keep UPDATE via `"Ops update league"` / equivalent | `leagues` |
| 4 | Do **not** drop sport immutability trigger | `leagues` |
| 5 | Replace membership EXISTS with **correlated** `m.league_id = <table>.league_id` | achievements, crystal_ball_* |
| 6 | Own pick write requires **membership in picks.league_id** | `picks`, `pick_games` |
| 7 | Keep ops read/score policies | `picks`, `pick_games` |
| 8 | Crystal Ball read/write use correlated membership + **no hardcoded years** | crystal_ball_* |
| 9 | Introduce `crystal_ball_board_is_revealed(league_id)` (season/sport-safe, fail-closed on calendar) | function |
| 10 | No changes to trophies, profiles discovery, gazette, locker | — |

### Crystal Ball freeze design (D0)

**Removed:** `timestamptz '2026-08-29…'` / `'2026-09-10…'`.

**Reveal (SELECT peers’ picks) when ANY of:**

1. Row exists in `crystal_ball_result` for that league (crowned), **or**  
2. Opening week scored: `week_results` for  
   - `sport_id = 'nfl'` → `week_number = 1`  
   - else (cfb/default) → `week_number = 0`

**Not in D0 (document gap):** authoritative multi-year calendar freeze (“noon ET Saturday of week 0”) requires a dedicated function (e.g. future `season_crystal_ball_freeze_at(league_id)`) fed by War Room calendar tables. Until that exists, **calendar-only freeze is fail-closed (absent)** — board reveals on crown or opening-week score only.

**Write (insert/update own pick):** member of league + `user_id = auth.uid()` + board **not** revealed.

### League DELETE product note

Removing client DELETE does **not** remove service-role or dashboard SQL delete. Product “delete room” must use a **SECURITY DEFINER RPC** with audit (future) or support ticket — out of D0.

---

## C. Authorization matrix (intended after D0)

Legend: **Y** allow · **N** deny · **—** N/A · **RO** read-only · **\*** service role bypasses RLS when using service key

### `public.leagues`

| Actor | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| anon | N (typical; live may vary — catalog) | N | N | N |
| authenticated non-member | Y if broad discovery policy remains (unchanged D0) | N | N | **N** |
| member | Y | N | N | **N** |
| commissioner | Y | Y (create as self) | Y (settings; not sport_id) | **N** (D0 removes client delete) |
| deputy | Y | N | Y via `is_league_ops` (active week etc.) | **N** |
| service role | * | * | * | * |

### `public.achievements`

| Actor | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| anon | N | N | N | N |
| non-member | **N** (correlated membership) | N | N | N |
| member | Y (own league only) | N | N | N |
| row “owner” (user_id) | Y if member | N | N | N |
| commissioner | Y if member/commish path | Y (grant) | N unless policy | N unless policy |
| deputy | Y if member | N (unless separate) | N | N |
| service role | * | * | * | * |

### `public.crystal_ball_picks`

| Actor | SELECT own | SELECT peers | INSERT/UPDATE own | DELETE |
|-------|------------|--------------|------------------|--------|
| non-member | N | N | N | N |
| member pre-reveal | Y | N | Y until reveal | N (no policy) |
| member post-reveal | Y | Y | **N** (fail closed) | N |
| commissioner | as member + crown elsewhere | as member | as member | N |
| deputy | as member | as member | as member | N |
| service role | * | * | * | * |

### `public.crystal_ball_result`

| Actor | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| non-member | N | N |
| member | Y (correlated) | N |
| commissioner | Y | Y (crown) |
| deputy | Y if member | N (commish-only crown in D0) |
| service role | * | * |

### `public.picks`

| Actor | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| non-member | N | **N** (membership required) | **N** | **N** |
| member own row | Y | Y | Y | Y (if FOR ALL) |
| member others | N (privacy) unless ops | N | N | N |
| commissioner/deputy (ops) | Y all league | N | Y score fields via Ops score | N |
| service role | * | * | * | * |

### `public.pick_games`

| Actor | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| non-member | N | N |
| member own slip | Y | Y (via own pick + membership) |
| ops | Y league | N (score via picks update / results) |
| service role | * | * |

---

## D. Regression plan (prove after apply — non-prod first)

| # | Test | Pass criteria |
|---|------|----------------|
| R1 | Commish `DELETE /rest/v1/leagues?id=eq.…` | **403/empty** — row remains |
| R2 | Authenticated create league INSERT | **201** — row with sport_id |
| R3 | Commish UPDATE name/cut_percent | **204** — changed |
| R4 | Commish UPDATE `sport_id` | **Error** immutability trigger |
| R5 | Member upsert own pick in own league | **OK** |
| R6 | Member INSERT pick `league_id` = other league | **Fail** RLS |
| R7 | Former member (removed) mutate old league picks | **Fail** |
| R8 | Deputy/commish publish card + score week | **OK** (ops policies) |
| R9 | Member CB write while unrevealed | **OK** |
| R10 | Member CB write after opening week scored / crowned | **Fail** |
| R11 | Cross-league CB read | **Fail** / empty |
| R12 | `pg_policies` scan for `m.league_id = m.league_id` | **Zero hits** |
| R13 | No hardcoded `2026-08-29` / `2026-09-10` in CB policies | **Zero hits** |
| R14 | Profile trophy / broad league SELECT smoke | **Unchanged behavior** |
| R15 | Deputy still `is_league_ops` for week_cards | **OK** |

**Environment:** Sandbox Supabase or local clone — **not** production mutation tests.

---

## E. Deployment plan

### E1. Preflight

1. Run `supabase/D0-rls-preflight-SELECT-ONLY.sql` on target DB.  
2. Archive result CSVs (policy dump, triggers, definer funcs).  
3. Confirm deputy policy list.  
4. Confirm sport immutability trigger enabled.

### E2. Review-only migration

**File:** `supabase/D0-rls-corrections-REVIEW-ONLY.sql`  

- Header: DO NOT APPLY without Mike authorization  
- Idempotent `DROP POLICY IF EXISTS` / `CREATE POLICY`  
- Comments on every policy  
- No trophy/profile/gazette/locker changes  

### E3. Post-apply verification SELECT

Included at bottom of migration as commented SELECTs + `D0-rls-preflight` re-run sections.

### E4. Behavioral tests

Non-production project with fixture league + two users + deputy.

### E5. Production rollout order

1. Announce maintenance window (low risk, policy-only).  
2. Preflight SELECT archive.  
3. Apply migration as postgres/supabase admin.  
4. Post-apply SELECT verification.  
5. Smoke: create league, join, pick, CB, score as ops.  
6. Confirm Foundry still quarantined (unrelated).  

### E6. Rollback

**File:** `supabase/D0-rls-corrections-ROLLBACK.sql`  

Restores prior policy shapes (including commissioner DELETE and prior CB/picks definitions as known from repo). Prefer restore from preflight `pg_policies` dump if live names differ.

### E7. Application compatibility

| App path | Expected |
|----------|----------|
| Create league | OK |
| Commish settings / active week | OK via Ops update |
| Delete league button (if any) | **Breaks** client delete — product must hide or use future RPC |
| Player picks | OK if member |
| Cross-league pick bugs | Fixed (denied) |
| Crystal Ball pre-score | OK for members |
| Crystal Ball after W0/W1 score | Peer board readable; writes stop |
| Calendar-only freeze before any score | **Board stays private** until score/crown (documented product change vs hardcoded 2026 dates) |
| Sport change | Still rejected by trigger |

### E8. Risks / Mike decisions

| Risk | Decision needed |
|------|-----------------|
| Removing league DELETE | Is there a product “delete room” path? Schedule RPC later? |
| CB calendar freeze removed | Accept score/crown-only reveal until calendar function exists? |
| Tautology may have allowed accidental cross-league reads | Anyone relying on broken visibility? |
| Live policy names differ from repo | Preflight must drive final DROP list |
| Duplicate UPDATE policies | Prefer single `"Ops update league"` — don’t leave orphan `"Commissioner updates league"` if both exist |
| `pick_games` DELETE on leave | Membership-required manage may block orphan cleanup — acceptable |

---

## Files created (D0)

| File | Role |
|------|------|
| `docs/STRUCTURAL-HARDENING-D0-RLS.md` | This design |
| `supabase/D0-rls-preflight-SELECT-ONLY.sql` | Catalog evidence |
| `supabase/D0-rls-corrections-REVIEW-ONLY.sql` | Migration proposal |
| `supabase/D0-rls-corrections-ROLLBACK.sql` | Rollback proposal |

---

## Production status

| Claim | Status |
|-------|--------|
| Production DB mutated by D0 work | **No** |
| Migration executed | **No** |
| App runtime changed | **No** |
| Foundry quarantine | **Still active** |

---

## Stop

**D0 complete** as design + review-only SQL.  
Next phase (D1 apply) requires explicit Mike authorization after preflight paste review.
