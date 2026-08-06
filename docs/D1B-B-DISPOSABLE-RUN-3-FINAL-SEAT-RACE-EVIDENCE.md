# D1B-B — Disposable Run 3 evidence archive  
## Genuine two-session final-seat race — PASS

**Date:** 2026-08-06  
**Package source commit:** `20cfd5c`  
**Closes:** Run 2 `RACE-final-seat` (**NOT_RUN**)  
**Status archived:**

```text
D1B-B:
DISPOSABLE DATABASE PACKAGE PASS /
36 SEQUENTIAL PASS /
0 FAIL /
0 ERROR /
GENUINE TWO-SESSION FINAL-SEAT RACE PASS /
NO OVERSUBSCRIPTION /
APP CUTOVER PENDING /
PRODUCTION NOT AUTHORIZED /
NOT YET REPAIRED
```

---

## Purpose

Close the only NOT_RUN item from Disposable Run 2:

| Item | Prior status | This run |
|------|--------------|----------|
| `RACE-final-seat` | NOT_RUN (sequential capacity simulation only) | **PASS** |

Prove that simultaneous authenticated `join_league_by_code` calls for one remaining human seat serialize on the league row, admit exactly one contender, and reject the loser with a stable `d1b_b:league_full` error — without oversubscription.

---

## Environment

| Field | Value |
|-------|--------|
| Disposable branch name | `d1b-b-final-seat-race-20260806` |
| Project ref | `vuigoqusvmeklyggtagb` |
| Branch ID | `8e0a0e77-1f01-4eaf-b90d-3b7fadb1d0d7` |
| Parent production project | `dorhjepugsjpmnuzdzck` |
| Production data copied | **NO** |
| Production project altered | **NO** |
| Branch merged or rebased | **NO** |
| Branch deleted after evidence | **YES** (`success = true`) |
| Branch billing stopped | **YES** |
| Maximum expected branch-compute charge | one rounded branch hour at **$0.01344** |
| Branch migration status | repository migration-chain failure reported; branch remained **ACTIVE_HEALTHY** |
| Package load method | self-contained D1B-B disposable package loaded **manually** |

---

## Package load (canonical order)

```text
00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06
```

| Item | Status |
|------|--------|
| `07-policy-transitions-FUTURE.sql` | **NOT LOADED · NOT EXECUTED** |
| Full harness `09` | **NOT required for this run** (Run 2 already archived 36 sequential PASS) |
| Rollback | `12-disposable-rollback.sql` executed after race |

---

## Race fixture

| Field | Value |
|-------|--------|
| League code | `RACE2026` |
| League ID | `bbbbbbbb-1111-2222-3333-000000000001` |
| `max_human_members` | **2** |
| Existing humans before race | **1** (commissioner) |
| Remaining human seats | **1** |
| Contenders | Player A · Player B |

---

## Concurrency method

Both `join_league_by_code('RACE2026')` calls were launched **concurrently** through separate Supabase SQL executions with **separate transaction-local authenticated JWT identities**.

A **disposable-only, sentinel-gated BEFORE INSERT delay** was installed on fixture membership inserts.

### Purpose of delay

1. First transaction acquires the target league row lock.  
2. First transaction remains open for **three seconds** before inserting.  
3. Second transaction begins while the first still holds the lock.  
4. Second transaction must wait on the same league row.  
5. After the winner commits, the waiting transaction must **recount capacity** and reject the extra user.

This proves **real transaction overlap and lock serialization**, not two fast sequential calls.

---

## Race result

### Player B — JOIN SUCCESS

| Field | Value |
|-------|--------|
| `ok` | `true` |
| `already_member` | `false` |
| `league_id` | `bbbbbbbb-1111-2222-3333-000000000001` |
| `code` | `RACE2026` |
| `division` | `South` |
| `total_points` | `0` |
| Observed successful call interval | `2026-08-06 21:13:26.726101+00` through `2026-08-06 21:13:29.738734+00` |

### Player A — REJECTED

| Field | Value |
|-------|--------|
| Error | `d1b_b:league_full` |

### Client wall clock

| Metric | Value |
|--------|-------|
| Combined client-observed wall duration | **13,932 ms** |

---

## Final database state

| Check | Result |
|-------|--------|
| `max_human_members` | **2** |
| `human_members` | **2** |
| Admitted contenders | **1** (Player B) |
| Player A membership | **ABSENT** |
| First-join rows | **2** (commissioner + successful contender) |
| Rejected contender first-join row | **ABSENT** |

### Members

- Existing commissioner  
- Player B  

---

## Oversubscription and serialization proofs

| Assertion | Result |
|-----------|--------|
| Expected maximum human members | **2** |
| Actual human members | **2** |
| Oversubscribed | **NO** |
| Exactly one contender admitted | **YES** |
| Waiting transaction rechecked capacity | **YES** |
| Loser received stable `league_full` error | **YES** |

---

## Verdict

| Item | Result |
|------|--------|
| `RACE-final-seat` | **PASS** |
| D1B-B concurrency behavior | **PASS** |

The league-row `SELECT ... FOR UPDATE` capacity design successfully serialized simultaneous final-seat joins and prevented oversubscription.

---

## Teardown

| Step | Result |
|------|--------|
| Disposable overlap trigger removed | **YES** |
| Disposable overlap function removed | **YES** |
| `12-disposable-rollback.sql` executed | **YES** |
| `sentinel_removed` | true |
| `memberships_removed` | true |
| `instrumentation_removed` | true |
| Branch deleted | **YES** |
| Supabase delete response | `success = true` |
| Billing stopped | **YES** |

---

## Non-actions confirmed

| Item | Status |
|------|--------|
| Production SQL applied | **NO** |
| Production schema changed | **NO** |
| Production policies changed | **NO** |
| Production data changed | **NO** |
| D1B-A / D1B-C | **UNTOUCHED** (remain repaired) |
| D1C / H-01 | **UNTOUCHED** |
| D1B-B production apply | **NOT AUTHORIZED · NOT YET REPAIRED** |
| File 07 | **NOT LOADED · NOT EXECUTED** |

---

## Remaining gates (post–Run 3)

1. Map and implement the D1B-B **application cutover**.  
2. Replace browser create/join membership inserts with the three reviewed RPCs.  
3. Remove league-code exposure from open-room discovery.  
4. Design and verify the privileged sport-pool seating path.  
5. Confirm season-reset / fair-entry freeze lifecycle.  
6. Test the application against a disposable branch.  
7. Prepare narrowly staged production SQL and application deployment.  
8. Obtain **explicit Mike authorization** before every production stage.  
9. **Never** apply file 07 before the RPC and application cutover is green.

---

## Related archives

- Run 1 (partial / FE blocked): `docs/D1B-B-DISPOSABLE-RUN-1-EVIDENCE.md`  
- Run 2 (36 sequential PASS; race NOT_RUN): `docs/D1B-B-DISPOSABLE-RUN-2-EVIDENCE.md`  
- Package / harness readiness: `docs/D1B-B-DISPOSABLE-BASELINE-AND-HARNESS.md`  
- Schema reproducibility parking lot: `docs/DATABASE-SCHEMA-REPRODUCIBILITY-DEFECT.md`  
- Defect register: `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`  
