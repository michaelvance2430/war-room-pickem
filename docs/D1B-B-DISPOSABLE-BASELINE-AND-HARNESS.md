# D1B-B — Disposable baseline, JWT harness, and readiness

**Status:** **RUN-2 READY** (post Run-1 revisions) / **PRODUCTION NOT AUTHORIZED** / **NOT REPAIRED**  
**Date:** 2026-08-06  
**Run 1 archive:** `docs/D1B-B-DISPOSABLE-RUN-1-EVIDENCE.md`

### Classification

```text
D1B-B:
DISPOSABLE RUN 1 PARTIAL PASS ARCHIVED /
PACKAGE REVISED FOR RUN 2 /
PRODUCTION NOT AUTHORIZED / NOT REPAIRED
```

Related parking lot: `docs/DATABASE-SCHEMA-REPRODUCIBILITY-DEFECT.md`

---

## Canonical disposable order (R7 — only)

```text
00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09
optional: 12
never: 07
```

---

## 1. Baseline file paths

| Path | Role |
|------|------|
| `supabase/review-only/D1B-B/00-disposable-baseline.sql` | Empty-branch min schema + sentinel; **native auth.uid assert** |
| `supabase/review-only/D1B-B/00b-jwt-and-fixtures.sql` | JWT claim helpers + synthetic profiles |
| `01` … `06` | D1B-B package |
| `09-full-test-runner.sql` | Executable harness |
| `12-disposable-rollback.sql` | Full disposable teardown |
| `07` | **Excluded** |

---

## 2. Run-1 → Run-2 revisions

| ID | Fix |
|----|-----|
| Blocker | `d1b_b_percentile_value`: unambiguous `u(value)` / `v_result` (algorithm unchanged) |
| R1 | No `CREATE OR REPLACE auth.uid()`; assert native claim-based definition |
| R2 | One-arg (and two-arg) FE points **VOLATILE** |
| R3 | Create RPC: remove `undefined_column` fail-open |
| R4 | First-join: hard fail / full transaction rollback |
| R5 | `list_open_leagues_public`: omit `commissioner_id` |
| R6 | `01` completes backfill → verify → DEFAULT → NOT NULL |
| R7 | Single canonical order in all docs |

---

## 3. Safety-gate proof

| Gate | Mechanism |
|------|-----------|
| Empty env | Abort if leagues/memberships/profiles exist |
| Native auth.uid | Abort if missing or non claim-based |
| Sentinel | Required for 00b / 09 / 12 |
| No production identities | Synthetic UUIDs only |
| No fail-open schema | Create requires `max_human_members` column |

---

## 4. JWT fixture approach

| Item | Design |
|------|--------|
| Method | `set_config('request.jwt.claim.sub' / claims, …, true)` |
| Native `auth.uid()` | Platform function (not replaced) |
| Helpers | `d1b_b_disp_set_auth` / `d1b_b_disp_clear_auth` |
| Run 1 proof | JWT-set-uid / JWT-clear **PASS** with native uid |

---

## 5. Fresh disposable branch procedure (Run 2)

```text
1. Create NEW empty Supabase development branch
2. Confirm empty public (ignore MIGRATIONS_FAILED on branch metadata)
3. 00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09
4. Export d1b_b_tests.results
5. 12 optional → DELETE branch → billing stopped
```

If 00 aborts on auth.uid: inspect platform definition; do not replace it.

---

## 6. Source/static test results

| Check | Result |
|-------|--------|
| Percentile naming unambiguous | **PASS** (source) |
| Fair-entry TS fixtures | run `node scripts/verify-fair-entry-parity.mjs` |
| Run 1 full harness | **PARTIAL** — 15 PASS, FE blocked |
| Run 2 full harness | **NOT_RUN** |

---

## 7. Readiness verdict — Run 2?

```text
YES — READY FOR DISPOSABLE RUN 2 ON A FRESH EMPTY BRANCH:
  00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09
```

Do **not** apply to production. Do **not** merge baseline into `supabase/migrations/`.
