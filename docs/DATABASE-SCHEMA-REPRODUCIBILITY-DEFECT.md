# Scrub finding — Database schema reproducibility defect

**Status:** **PARKED / HIGH / NOT REPAIRED**  
**Date:** 2026-08-06  
**Evidence:** Supabase development branch `d1b-b-disposable-20260806` (deleted)

### What happened

| Step | Result |
|------|--------|
| Branch project created | Success |
| Branch health | ACTIVE_HEALTHY |
| Migration status | **MIGRATIONS_FAILED** |
| Applied migrations | **0** |
| Public tables | **0** |
| leagues / memberships / week_results | **Absent** |
| Branch-action logs | No usable error detail |
| Branch deleted | Yes |
| Production | **Never touched** |
| Branch billing | Stopped |

### Classification

```text
DATABASE SCHEMA REPRODUCIBILITY DEFECT
```

The repository / Supabase migration chain cannot currently reconstruct the live production schema in a clean preview branch.

### Impact

- Disposable testing  
- Staging / preview environments  
- Disaster recovery confidence  
- Onboarding another developer  
- Safe schema-change validation  

### Immediate mitigation (D1B-B only)

**Do not** commit a baseline migration into `supabase/migrations/` that could auto-run on production.

Use instead:

```text
supabase/review-only/D1B-B/00-disposable-baseline.sql
```

Marked: **DISPOSABLE EMPTY BRANCH ONLY / NEVER PRODUCTION / NEVER MERGE AS PROD MIGRATION**.

### Long-term migration reconciliation plan (REVIEW-ONLY)

1. **Inventory live schema** (tables, enums, functions, policies, grants, checks) — SELECT-only export  
2. **Inventory repository migration history** (`supabase/migrations/`, ad-hoc `supabase/*.sql`)  
3. **Identify live objects missing from migrations**  
4. **Identify migrations unsafe to replay** (data mutations, destructive DDL, env-specific)  
5. **Establish a canonical baseline strategy** (versioned dump vs squashed baseline vs schema-diff tooling)  
6. **Ensure future migrations are additive and reproducible**  
7. **Prove a clean environment can be rebuilt** (CI job on empty project)  
8. **Never apply a generated baseline blindly to production**  
9. **Require explicit Mike authorization** for any production migration-history repair  

### Explicit non-actions

- Do not generate a production baseline migration in this package  
- Do not block D1B-B disposable testing on completing full reconciliation  
- Do not “fix” by applying baseline to production  

### Related D1B-B status

D1B-B disposable testing unblocked via **00-disposable-baseline.sql** only.  
D1B-B product work remains **NOT REPAIRED** until RPCs are authorized and verified.
