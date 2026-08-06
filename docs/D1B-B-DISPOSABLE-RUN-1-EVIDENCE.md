# D1B-B — Disposable Run 1 evidence archive

**Date:** 2026-08-06  
**Package source:** `cf26f53`  
**Status archived:**  
`DISPOSABLE RUN 1 PARTIAL PASS / 15 TESTS PASS / BLOCKED BY AMBIGUOUS FAIR-ENTRY SQL / REVISION REQUIRED / PRODUCTION NOT AUTHORIZED / NOT REPAIRED`

### Environment

| Field | Value |
|-------|--------|
| Production project touched | **NO** |
| Disposable branch | `d1b-b-disposable-run-20260806` |
| Disposable project ref | `auihgehslctgzmpwnaei` |
| Production data copied | **NO** |
| Public schema began empty | **YES** |
| File 07 executed | **NO** |
| Branch merged/rebased | **NO** |
| Branch deleted after evidence | **YES** |
| Branch billing stopped | **YES** |
| Branch migration status | **MIGRATIONS_FAILED** (repo chain defect — parked) |
| Branch DB health | ACTIVE_HEALTHY + empty; baseline loaded manually |

### Execution notes

- Connector refused `CREATE OR REPLACE auth.uid()` (platform-managed).
- Native `auth.uid()` already implements claim.sub + claims JSON sub → override skipped.
- Order run: `00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09` (stopped mid-09).
- Large scripts submitted in logical sections; executable logic not rewritten by operator.

### PASS (15)

| Test ID | Result |
|---------|--------|
| BASE-sentinel | PASS |
| BASE-cut-check | PASS |
| BASE-rpcs | PASS |
| JWT-set-uid | PASS (`aaaaaaaa-bbbb-cccc-dddd-000000000001`) |
| JWT-clear | PASS |
| CUT-default | PASS → 50 |
| CUT-ok-10 / 50 / 75 | PASS |
| CUT-bad-9 / 76 / -1 / 100 | PASS `d1b_b:validation_failed` |
| SPORT-cfb | PASS normalized `cfb` |
| SPORT-reject-wwc | PASS `validation_failed` |

### BLOCKING FAILURE

```text
public.d1b_b_percentile_value(integer[], numeric)
select public.d1b_b_percentile_value(array[42], 75);
ERROR: column reference "v" is ambiguous
```

**Cause:** PL/pgSQL variable `v` collided with `unnest(...) as v`.  
**Impact:** FE fixtures, freeze path, midseason join, remaining harness blocked.

### Tests NOT RUN (22)

FE-pct-*, AUTH-unauth-create, JOIN-*, CAP-*, OPEN-*, DISC-no-code, FE-preseason-zero, FE-freeze-reuse, FE-season-isolation, PRIV-no-commish-on-join, GRANT-no-anon-join, FIRST-join-row, RACE-final-seat (two-session still separate).

### Post–Run-1 package revisions (REVIEW-ONLY only)

| ID | Change |
|----|--------|
| **Blocker** | Rename percentile aliases / `v_result` — algorithm unchanged |
| **R1** | Remove disposable `auth.uid()` replace; assert native claim-based `auth.uid()` |
| **R2** | `d1b_b_fair_entry_points(uuid)` → **VOLATILE** (writes freeze) |
| **R3** | Remove create-RPC `undefined_column` fail-open fallback |
| **R4** | First-join: no `WHEN OTHERS THEN NULL` — required history |
| **R5** | Drop `commissioner_id` from `list_open_leagues_public` |
| **R6** | Stage complete `max_human_members` (backfill → verify → DEFAULT → NOT NULL) |
| **R7** | Canonical order everywhere: `00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09` |

### Non-actions confirmed

- No production SQL applied  
- No live RPC/schema/policy change  
- No app deploy  
- No membership INSERT/UPDATE drop  
- No league-code visibility tighten  
- D1C / H-01 untouched  
