# D1B-B REVIEW-ONLY SQL package

```
REVIEW ONLY — NON-PRODUCTION APPLY BY DEFAULT
DO NOT APPLY TO LIVE SUPABASE WITHOUT SEPARATE MIKE AUTHORIZATION
FOR A SPECIFIC STAGE (RPCs vs INSERT drop vs UPDATE vs SELECT tighten)
```

| Field | Value |
|-------|--------|
| Authorization | **REVIEW-ONLY SQL package authorized — no production apply** |
| Status | **REVISED / DISPOSABLE READY** · **D1B-B NOT REPAIRED** · no prod apply |
| Product freeze | B1–B6 locked — `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md` |
| Docs | `docs/D1B-B-REVIEW-ONLY-SQL-PACKAGE.md` · source audit · fair-entry parity |

## Files (apply order when eventually authorized — staged)

| File | Purpose | Typical stage |
|------|---------|---------------|
| `01-schema-max-human-members.sql` | Column + default + backfill | Stage 6 prep / with RPCs |
| `02-helpers.sql` | VOLATILE errors, sport allowlist, human count, division, code gen | With RPCs |
| `02b-fair-entry.sql` | Freeze table + Fair Entry points (not division) | With RPCs |
| `03-rpc-create-league.sql` | Atomic create + commissioner seat (points 0) | Stage 6 |
| `04-rpc-join-by-code.sql` | Join closed league by code | Stage 6 |
| `05-rpc-join-open.sql` | Join open league by UUID | Stage 6 |
| `06-rpc-list-open-leagues.sql` | Safe open discovery (no codes) | Stage 13 prep |
| `07-policy-transitions-FUTURE.sql` | INSERT/UPDATE/SELECT policy sketches | Stages 10, 12, 14 — **not with stage 6** |
| `08-preflight-SELECT-ONLY.sql` | Pre-apply catalog checks | Before any stage |
| `09-disposable-test-harness.sql` | Ephemeral synthetic tests | Disposable DB only |
| `10-postverify-SELECT-ONLY.sql` | Post-stage verify | After each stage |
| `11-rollback-scripts.sql` | Rollback sketches | Emergency |

## Hard rules

1. **Never** drop membership INSERT in the same migration as first RPC apply.  
2. **Never** tighten leagues SELECT before discovery RPC + app map.  
3. **Never** remove broad UPDATE before narrow writer paths exist.  
4. Disposable harness only on non-production DBs.  
5. No D1C / H-01 bundling.
