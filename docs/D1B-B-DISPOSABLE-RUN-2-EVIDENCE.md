# D1B-B — Disposable Run 2 evidence archive

**Date:** 2026-08-06  
**Package source commit:** `20cfd5c`  
**Status archived:**

```text
DISPOSABLE RUN 2 SEQUENTIAL PASS /
36 PASS /
0 FAIL /
0 ERROR /
TRUE TWO-SESSION FINAL-SEAT RACE NOT_RUN /
CONCURRENCY BEHAVIORAL TEST PENDING /
APP CUTOVER PENDING /
PRODUCTION NOT AUTHORIZED /
NOT REPAIRED
```

---

## Environment

| Field | Value |
|-------|--------|
| Disposable branch name | `d1b-b-disposable-run2-20260806` |
| Project ref | `tnabgofiwountwvkdrhq` |
| Branch ID | `f4b0937c-a66d-4a4b-af41-7cc70c8bb613` |
| Production data copied | **NO** |
| Production project altered | **NO** |
| Branch merged or rebased | **NO** |
| Branch deleted after evidence | **YES** (`success = true`) |
| Branch billing stopped | **YES** |

---

## Execution

Canonical sequence executed:

```text
00-disposable-baseline
00b-jwt-and-fixtures
01-schema-max-human-members
02-helpers
02b-fair-entry
03-rpc-create-league
04-rpc-join-by-code
05-rpc-join-open
06-rpc-list-open-leagues
09-full-test-runner
```

| Item | Status |
|------|--------|
| `07-policy-transitions-FUTURE.sql` | **NOT INCLUDED · NOT EXECUTED** |
| Rollback | `12-disposable-rollback.sql` executed |

### Percentile smoke tests

| Call | Result |
|------|--------|
| `d1b_b_percentile_value(array[42], 75)` | **42 — PASS** |
| `d1b_b_percentile_value(array[0,10,20,40], 75)` | **25 — PASS** |

### Full disposable harness

| Metric | Count |
|--------|-------|
| PASS | **36** |
| FAIL | **0** |
| ERROR | **0** |
| NOT_RUN | **1** (`RACE-final-seat`) |

**Only NOT_RUN:** `RACE-final-seat`  
**Reason:** Harness is sequential capacity simulation only. Genuine two-session last-seat concurrency remains required before production authorization.

### PASS coverage (summary)

- Disposable sentinel  
- `max_human_members` constraint  
- Required RPC presence  
- Native JWT / `auth.uid` claim behavior  
- Auth set/clear helpers  
- `cut_percent` default 50; accept 10/75; reject 9/76/-1/100  
- Sport `cfb` accept; `soccer_wwc` reject  
- Percentile empty / single / P75 / multi / ties  
- Unauthenticated create rejected  
- Atomic league + commissioner seat  
- Join by code; invalid code; rejoin idempotency  
- Full-league capacity; bots excluded from human capacity  
- Open join; closed rejection  
- Public discovery without league codes  
- Preseason FE points 0; freeze reuse 30→30; season isolation (stale 999 not reused)  
- Joiner not commissioner; anon lacks EXECUTE; first-join row recorded  

---

## Post-verify (disposable branch, pre-rollback)

### Expected DEFINER functions present

- `create_league_with_commissioner_seat`  
- `join_league_by_code`  
- `join_open_league_by_id`  
- `list_open_leagues_public`  
- `d1b_b_human_member_count`  

All five: `security_definer = true`

### RPC EXECUTE grants

| Role | EXECUTE |
|------|---------|
| authenticated | present |
| postgres | present |
| service_role | present |
| anon | **absent** |
| PUBLIC | **absent** |

### Capacity column

| Metric | Value |
|--------|-------|
| leagues | 7 |
| with `max_human_members` | 7 |
| null `max_human_members` | 0 |

### Membership policies (intentionally preserved)

- `disp memberships all`  
- `Memberships insert own`  

Confirms file **07** was not applied early.

### Fixture membership counts

| Metric | Value |
|--------|-------|
| memberships | 11 |
| humans | 10 |
| bots | 1 |

### Leagues SELECT policy query

Zero rows on the purpose-built disposable baseline. Does **not** establish or change production league visibility. Production visibility remains a later app / code-privacy cutover track.

---

## Rollback

| Step | Result |
|------|--------|
| Executed | `12-disposable-rollback.sql` |
| Sentinel safety gate | **PASS** |
| `sentinel_removed` | true |
| `leagues_removed` | true |
| `memberships_removed` | true |
| `results_removed` | true |

---

## Branch deletion

| Step | Result |
|------|--------|
| Disposable branch deleted | **YES** |
| Supabase delete response | `success = true` |
| Branch billing stopped | **YES** |

---

## Non-actions confirmed

| Item | Status |
|------|--------|
| Production SQL | **NONE** |
| Production data | **UNCHANGED** |
| D1B-A / D1B-C | **UNTOUCHED** (remain repaired) |
| D1C / H-01 | **UNTOUCHED** |
| D1B-B production apply | **NOT AUTHORIZED · NOT REPAIRED** |

---

## Remaining gates before production

1. Execute a genuine **two-session** last-seat concurrency test on another disposable branch.  
2. Archive the concurrency result.  
3. Complete the application cutover mapping and implementation.  
4. Remove league-code exposure from open-room discovery.  
5. Resolve the separate privileged sport-pool seating path.  
6. Verify season-reset / fair-entry freeze lifecycle.  
7. Prepare a narrowly staged production proposal.  
8. Obtain **explicit Mike authorization** for each production stage.  
9. **Never** apply file 07 before RPC and application cutover readiness.  

---

## Related archives

- Run 1 (partial / FE blocked): `docs/D1B-B-DISPOSABLE-RUN-1-EVIDENCE.md`  
- Package / harness readiness: `docs/D1B-B-DISPOSABLE-BASELINE-AND-HARNESS.md`  
- Schema reproducibility parking lot: `docs/DATABASE-SCHEMA-REPRODUCIBILITY-DEFECT.md`  
