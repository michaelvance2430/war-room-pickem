# D1B-B — Disposable baseline, JWT harness, and readiness

**Status:** **DISPOSABLE BASELINE AUTHORED / PRODUCTION NOT AUTHORIZED / NOT REPAIRED**  
**Date:** 2026-08-06  

### Classification

```text
D1B-B:
REVIEW-ONLY PACKAGE REVISED / DISPOSABLE BASELINE REQUIRED /
PRODUCTION NOT AUTHORIZED / NOT REPAIRED
```

Related parking lot: `docs/DATABASE-SCHEMA-REPRODUCIBILITY-DEFECT.md`

---

## 1. Baseline file paths

| Path | Role |
|------|------|
| `supabase/review-only/D1B-B/00-disposable-baseline.sql` | Empty-branch minimal schema + sentinel |
| `supabase/review-only/D1B-B/00b-jwt-and-fixtures.sql` | JWT claim helpers + synthetic profiles |
| `supabase/review-only/D1B-B/01` … `06` | Unchanged D1B-B package (after baseline) |
| `supabase/review-only/D1B-B/09-full-test-runner.sql` | Executable harness + results table |
| `supabase/review-only/D1B-B/12-disposable-rollback.sql` | Full disposable teardown (sentinel required) |
| `07` | **Still excluded** |

---

## 2. Static dependency inventory (for 01–06)

| Dependency | Why |
|------------|-----|
| `pgcrypto` | UUIDs |
| `auth.uid()` | RPC auth |
| `member_role`, `division` enums | memberships |
| `profiles` | FK for leagues/memberships |
| `leagues` | create/join; `cut_percent` CHECK 10–75; `code` unique; `is_open`; `sport_id`; `crystal_ball_enabled`; `current_week` |
| `memberships` | unique (league_id,user_id); is_bot; staff flags; stats defaults |
| `week_results` | fair-entry latest scored week |
| `league_first_joins` + `record_league_first_join` | create/join integration |
| `is_league_member` | FE RLS + first-join |
| Baseline RLS | Disposable permissive policies + live-like insert own |

**Not included:** picks, crystal_ball_*, gazette, etc.

---

## 3. Safety-gate proof

| Gate | Mechanism |
|------|-----------|
| Abort if sentinel exists | Double-baseline refuse |
| Abort if leagues/memberships/profiles exist | Not empty |
| Abort if picks/crystal_ball_picks exist | Production-like refuse |
| No production UUIDs/emails/codes | Synthetic `aaaaaaaa-bbbb-cccc-dddd-*` only |
| No production project ref embedded | None in SQL |
| Sentinel required for fixtures/runner/rollback | Explicit checks |
| Sentinel label fixed string | CHECK constraint |

Sentinel: `public.d1b_b_disposable_environment`  
Label: `D1B-B DISPOSABLE EMPTY BRANCH ONLY — NEVER PRODUCTION`

---

## 4. JWT fixture approach

| Item | Design |
|------|--------|
| Method | `set_config('request.jwt.claim.sub', uid, true)` + claims JSON |
| Helper | `d1b_b_disp_set_auth(uuid)` / `d1b_b_disp_clear_auth()` |
| `auth.uid()` | Disposable `auth.uid()` reads claim.sub / claims JSON |
| Identities | creator, player A/B, nonmember, bot — synthetic UUIDs |
| Isolation | Clear auth between cases; each test sets auth explicitly |
| Production Auth | **Not used** |

---

## 5. Fresh disposable branch procedure

```text
1. Create NEW empty Supabase development branch (do not re-use failed migration state)
2. Confirm public tables empty / migrations may still fail — IGNORE broken migration chain
3. SQL Editor (as postgres): run 00-disposable-baseline.sql  → must succeed + sentinel
4. Run 00b-jwt-and-fixtures.sql
5. Run 01 → 02 → 02b → 03 → 04 → 05 → 06  (NOT 07)
6. Run 09-full-test-runner.sql
7. Export d1b_b_tests.results
8. Run 12-disposable-rollback.sql (optional) then DELETE the branch
9. Confirm branch billing stopped
```

If step 3 aborts: environment not empty — delete branch and recreate.

---

## 6. Source/static test results

| Check | Result |
|-------|--------|
| Baseline never references production project | **PASS** (static) |
| Baseline refuses non-empty | **PASS** (source) |
| File 07 excluded from procedure | **PASS** |
| Live cut_percent 10–75 in baseline CHECK | **PASS** |
| Fair-entry TS fixtures | **PASS** (`node scripts/verify-fair-entry-parity.mjs`) |
| Full disposable runner on branch | **NOT_RUN** (await new empty branch) |

---

## 7. Readiness verdict — create fresh disposable branch?

```text
YES — READY TO CREATE A FRESH EMPTY BRANCH AND RUN:
  00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09
```

Do **not** rely on Supabase migration replay for this branch.  
Do **not** apply baseline to production.  
Do **not** leave the branch running after evidence capture.

---

## 8. Confirmations

| Statement | True? |
|-----------|-------|
| Production changed | **No** |
| Failed branch deleted (prior) | **Yes** (operator report) |
| D1B-B repaired | **No** |
| D1C / H-01 untouched | **Yes** |
