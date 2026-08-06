# D-01 — `purge_locker_before` apply + structural verification archive

**Date:** 2026-08-06  
**Authorization:** Mike explicitly authorized D-01 only  
**Apply path:** Supabase SQL Editor (operator) using `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql`  
**Agent:** Did not execute DDL (no DB session); archives operator-reported results  

---

## Verdict

| Field | Status |
|-------|--------|
| Structural repair | **LIVE and PASS** |
| Register status | **REPAIRED / STRUCTURALLY VERIFIED / BEHAVIORAL TESTS PENDING** |
| Behavioral T7–T11 | **PENDING** — no verified isolated disposable league used |
| Do not claim T7–T11 passed | **Correct** |
| Tests against real Locker history | **Not run** (forbidden) |
| This session production change by agent | **None** (apply by operator prior to archive) |
| Further work (D-02, etc.) | **Not started** — requires Mike authorization |

---

## Preflight (pre-apply, operator)

| Check | Result |
|-------|--------|
| Signature | `purge_locker_before(uuid, timestamptz)` |
| Body | Matched archived **vulnerable** body (P17) |
| SECURITY DEFINER | Yes |
| `search_path` | `public` |
| EXECUTE grantees | `anon`, `authenticated`, `postgres`, `service_role` |
| `is_league_staff(uuid)` | Exists |
| Drift vs P17 | **None** — apply authorized |

---

## Apply

| Field | Result |
|-------|--------|
| SQL | Exact contents of `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` |
| Supabase response | **Success. No rows returned.** |
| Scope | Function replace + COMMENT + REVOKE/GRANT on this routine only |

---

## Post-verification (structural, operator)

### Live function body confirms

| Control | Live |
|---------|------|
| Authorization | `public.is_league_staff(p_league_id)` |
| Roles | Commissioner or moderator only |
| Retention boundary | `v_boundary = now() - interval '7 days'` |
| Client cutoff | `p_before` newer than boundary **rejected** |
| Effective cutoff | Server-capped (`least` / coalesce path) |
| SECURITY DEFINER | Preserved |
| `search_path=public` | Preserved |

### Live EXECUTE grants

| Present | Absent |
|---------|--------|
| `authenticated` | `anon` |
| `postgres` | `PUBLIC` |
| `service_role` | |

### Interpretation

- Original **anonymous / member-controlled** destructive bulk purge path is **closed**.  
- Staff bulk purge is limited by **7-day retention boundary**.  
- Row-level single-message staff delete (separate RLS) was out of scope and not claimed changed.

---

## Behavioral tests

| Suite | Status |
|-------|--------|
| T1–T6 auth matrix | Not claimed in this archive |
| T7–T11 retention (staff + recent messages) | **PENDING** |
| Constraint | Only in verified **isolated disposable** test league; **never** real Locker history |

Do **not** mark behavioral PASS until T7–T11 complete under that constraint.

---

## Exact production change (operator-applied)

| Object | Change |
|--------|--------|
| `public.purge_locker_before(uuid, timestamptz)` | **CREATE OR REPLACE** — staff-only + 7-day retention |
| EXECUTE on that function | **REVOKE** from `PUBLIC` and `anon`; **GRANT** to `authenticated` |
| Unchanged | All other functions, RLS policies, triggers, constraints, D-02/D-03, D1B/D1C, postseason, app code |

---

## Related files

| File | Role |
|------|------|
| `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` | Applied SQL (review file name retained) |
| `docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md` | Design (incl. retention revision) |
| `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md` | Status update |
| This file | Apply + structural verify archive |

---

*End D-01 structural verification archive.*
