# D1B-B REVIEW-ONLY SQL package

```
REVIEW ONLY — NON-PRODUCTION APPLY BY DEFAULT
DO NOT APPLY TO LIVE SUPABASE WITHOUT SEPARATE MIKE AUTHORIZATION
FOR A SPECIFIC STAGE (RPCs vs INSERT drop vs UPDATE vs SELECT tighten)
```

| Field | Value |
|-------|--------|
| Authorization | **REVIEW-ONLY SQL package authorized — no production apply** |
| Status | **RUN-2 READY** · Run 1 partial (15 PASS / FE blocked) · **NOT REPAIRED** |
| Product freeze | B1–B6 locked |
| Run 1 evidence | `docs/D1B-B-DISPOSABLE-RUN-1-EVIDENCE.md` |
| Empty branch | Migration chain **cannot** rebuild prod schema — use `00-disposable-baseline.sql` only |
| Docs | `docs/D1B-B-DISPOSABLE-BASELINE-AND-HARNESS.md` · `docs/DATABASE-SCHEMA-REPRODUCIBILITY-DEFECT.md` |

## Canonical disposable order (R7 — only order)

```text
00 → 00b → 01 → 02 → 02b → 03 → 04 → 05 → 06 → 09
optional: 12-disposable-rollback.sql
NEVER: 07
```

| File | Purpose |
|------|---------|
| `00-disposable-baseline.sql` | Empty branch only — min schema + sentinel; **native** `auth.uid()` assert |
| `00b-jwt-and-fixtures.sql` | JWT claim helpers + synthetic profiles |
| `01-schema-max-human-members.sql` | Column + backfill + DEFAULT + NOT NULL (R6 complete for disposable) |
| `02-helpers.sql` | Errors, sport allowlist, human count, division, code gen |
| `02b-fair-entry.sql` | Freeze table + percentile (unambiguous aliases) + FE points |
| `03` … `06` | Create / join-code / join-open / list-open RPCs |
| `09-full-test-runner.sql` | Results harness |
| `12-disposable-rollback.sql` | Teardown (sentinel required) |
| `07` | **Never** in disposable stage-6 |

## Production stage files (future — separate auth)

| File | Purpose | Typical stage |
|------|---------|---------------|
| `01` … `06` | Same as above | Stage 6 (+ prep) |
| `07-policy-transitions-FUTURE.sql` | INSERT/UPDATE/SELECT policy sketches | Stages 10, 12, 14 — **not with stage 6** |
| `08-preflight-SELECT-ONLY.sql` | Pre-apply catalog checks | Before any stage |
| `10-postverify-SELECT-ONLY.sql` | Post-stage verify | After each stage |
| `11-rollback-scripts.sql` | Rollback sketches | Emergency |

## Hard rules

1. **Never** drop membership INSERT in the same migration as first RPC apply.  
2. **Never** tighten leagues SELECT before discovery RPC + app map.  
3. **Never** remove broad UPDATE before narrow writer paths exist.  
4. Disposable harness only on non-production DBs.  
5. No D1C / H-01 bundling.  
6. Do **not** `CREATE OR REPLACE auth.uid()` — use native platform + claim helpers.  
7. First-join history is **required** (create/join rolls back if `record_league_first_join` fails).  
