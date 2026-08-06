# D1C-S2B — Non-production REVIEW-ONLY SQL package

```
REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
```

| Field | Value |
|-------|--------|
| Status | **REVIEW ONLY** · ephemeral/local validation only |
| Production apply | **FORBIDDEN** without a later, separate Mike authorization |
| App changes | None in this package |
| Live picks/results | Untouched |
| D1B / H-01 | Not included / untouched |
| D1C repaired? | **No** |

## Files

| File | Purpose |
|------|---------|
| `01-schema.sql` | Tables, constraints, indexes |
| `02-helpers.sql` | Season year, write-open, peers-revealed, lock_state, propose/sticky, platform staff |
| `03-policies.sql` | Correlated membership RLS + lock/reveal gates |
| `04-rpc-bot-crown-deadline.sql` | Bot gate, crown RPC, deadline correction + audit |
| `05-ephemeral-fixture-membership.sql` | **Test-fixture only** membership helper/predicate — **not** D1B production package |
| `06-ephemeral-test-harness.sql` | Synthetic tests (requires disposable DB) |
| `99-rollback-ephemeral.sql` | Ephemeral rollback rehearsal |

## Docs

- `docs/D1C-S2B-NONPROD-SQL-DESIGN.md`
- `docs/D1C-S2B-TEST-PLAN-AND-RESULTS.md`

## Execution

Run only on a **disposable** local/ephemeral Postgres/Supabase project.  
If none is available: do **not** run against production; mark tests **NOT RUN**.
