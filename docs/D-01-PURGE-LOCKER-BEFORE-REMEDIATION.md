# D-01 — `purge_locker_before` remediation design

**Status:** REVIEW ONLY — **not authorized to apply**  
**Defect:** STRUCTURAL-SECURITY-DEFECT-REGISTER **D-01** · P17 Block 2  
**Severity:** High / destructive authorization  

---

## 1. Problem (confirmed live)

Current behavior (repo `supabase/locker-week-purge.sql` + live body review):

| Check | Behavior |
|-------|----------|
| Unauthenticated | Rejected (`Not authenticated`) |
| Authorization | **Any league member** (or commissioner) |
| Action | `DELETE` all `locker_messages` for league with `created_at < p_before` |
| Abuse | Member passes a **future** `p_before` → can wipe **entire** Locker history |

App call site: `src/lib/locker-room.ts` → `purgeStaleLockerMessages` (best-effort weekly cleanup; comment assumes any member may trigger).

Existing product law for locker moderation (`moderation.sql`):

- `is_league_staff(league_id)` = **commissioner OR moderator**
- Moderators may mute + **delete any locker posts**
- Deputies (`is_league_ops`) are for cards/scoring — **not** the locker moderation role

---

## 2. Target authorization model

| Actor | May call successful purge? |
|-------|----------------------------|
| Anonymous / no JWT | **No** |
| Authenticated non-member | **No** |
| Regular league member | **No** |
| Moderator (`memberships.is_moderator`) | **Yes** |
| Commissioner (`leagues.commissioner_id`) | **Yes** |
| Deputy only (not mod/commish) | **No** (unless product later expands; default **No**) |
| Service role | Bypasses client path; not product Delete Locker UI |

**Helper:** reuse existing `public.is_league_staff(p_league_id)` — same authority as row-level locker staff delete.

### Defense in depth (recommended in same apply)

| Control | Rule |
|---------|------|
| Auth | `auth.uid()` required |
| Authz | `is_league_staff(p_league_id)` required |
| Timestamp | Reject `p_before > now()` (or `> now() + interval '1 minute'`) so even staff cannot one-shot wipe via future clock |
| Grants | `REVOKE ALL … FROM PUBLIC`; no `anon`; `GRANT EXECUTE … TO authenticated` only |

**Optional later (not in D-01 minimum):** server-computed week boundary only (ignore client `p_before`); audit log of purges.

---

## 3. Least-privilege grants

| Action | Target |
|--------|--------|
| `REVOKE ALL ON FUNCTION public.purge_locker_before(uuid, timestamptz) FROM PUBLIC` | Always |
| `REVOKE ALL ON FUNCTION … FROM anon` | If grant present |
| `GRANT EXECUTE ON FUNCTION … TO authenticated` | Keep (body enforces staff) |
| Do **not** grant to `anon` | Absolute |

Body checks remain mandatory; grants alone are insufficient (DEFINER).

---

## 4. App impact (when apply is authorized)

| Path | Today | After D-01 |
|------|-------|------------|
| `purgeStaleLockerMessages` on locker load | Any member RPC | Non-staff RPC fails; best-effort no-op (existing error swallow) |
| Stale-message cleanup | Happens when any member opens locker | Happens when **staff/commish** opens locker (or future cron) |
| Fallback table DELETE | Own rows under RLS; staff delete via RLS | Unchanged if RLS already staff-aware |

**Apply-time app follow-up (same release recommended):**

1. Stop advertising “any member can trigger league cleanup” in comments.  
2. Optionally gate RPC call on client-known staff flag to avoid noise errors.  
3. Optional: dedicated commissioner/mod “Clear old locker” control with explicit confirm.

App code changes are **out of band** of the SQL REVIEW-ONLY file unless Mike authorizes a combined release.

---

## 5. Proposed SQL

**File:** `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql`  

**DO NOT RUN** until Mike explicitly authorizes D-01.

---

## 6. Rollback

| Step | Action |
|------|--------|
| 1 | Re-apply prior function body from `supabase/locker-week-purge.sql` (member-authorized) **only if emergency** |
| 2 | Re-grant `EXECUTE` to `authenticated` (and avoid re-opening `PUBLIC`/`anon` if possible) |
| 3 | `NOTIFY pgrst, 'reload schema'` |

**Warning:** Rolling back reopens the confirmed high defect (member wipe). Prefer fix-forward.

Emergency rollback SQL is embedded as comments in the REVIEW-ONLY file.

---

## 7. Tests (must pass before/after authorize)

### Automated / manual matrix

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Unauthenticated RPC | Denied / exception |
| T2 | Authenticated non-member | Denied |
| T3 | Regular member, past `p_before` | Denied; **zero** rows deleted |
| T4 | Regular member, **future** `p_before` | Denied; **zero** rows deleted |
| T5 | Moderator, past `p_before` | Success; only rows with `created_at < p_before` deleted |
| T6 | Commissioner, past `p_before` | Success |
| T7 | Staff, future `p_before` | Denied by timestamp guard (if included) |
| T8 | Deputy only (not mod) | Denied |
| T9 | `anon` / `PUBLIC` EXECUTE | Prefer absent; if present, body still denies null `auth.uid()` |
| T10 | Sport trigger / leagues policies / other functions | Unchanged (no collateral) |

### Pre/post SELECT-only catalog

```sql
-- ACL
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'purge_locker_before'
  AND privilege_type = 'EXECUTE'
ORDER BY grantee;

-- Body present
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'purge_locker_before';
```

Expect body to reference `is_league_staff` (or equivalent staff check), not bare membership-only.

---

## 8. Explicit non-scope

- D1A / other RLS policies  
- D-02 easter eggs · D-03 first join  
- H-01 global EXECUTE revoke sweep  
- Deputy expansion into locker purge  
- Postseason / Crystal Ball  
- Automatic service-role cron (future product)

---

## 9. Authorization gate

| Item | Status |
|------|--------|
| Design | This document |
| SQL proposal | `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` |
| Production apply | **Blocked** until Mike says apply D-01 |
| This session | Design only · no production change |

---

*End D-01 REVIEW ONLY design.*
