# D-01 — `purge_locker_before` remediation design

**Status:** REVIEW ONLY — **not authorized to apply**  
**Defect:** STRUCTURAL-SECURITY-DEFECT-REGISTER **D-01** · P17 Block 2  
**Severity:** High / destructive authorization  
**Revision:** server-enforced **7-day retention boundary** (not merely `p_before <= now()`)

---

## 1. Problem (confirmed live)

Current behavior (repo `supabase/locker-week-purge.sql` + live body review):

| Check | Behavior |
|-------|----------|
| Unauthenticated | Rejected (`Not authenticated`) |
| Authorization | **Any league member** (or commissioner) |
| Action | `DELETE` all `locker_messages` for league with `created_at < p_before` |
| Abuse A | Member (or staff) passes a **future** `p_before` → wipe **entire** history |
| Abuse B | Staff/member passes **`now()`** (or any recent instant) → wipe **almost everything**, including **recent** Locker traffic |

Rejecting only `p_before > now()` is **insufficient**: a moderator could pass `now()` and delete messages still inside the intended weekly board window.

App call site: `src/lib/locker-room.ts` → `purgeStaleLockerMessages` (best-effort weekly cleanup; passes client week-start ISO; comment assumes any member may trigger).

Existing product law for locker moderation (`moderation.sql`):

- `is_league_staff(league_id)` = **commissioner OR moderator**
- Moderators may mute + **delete any locker posts** (row-level single-post delete remains separate)
- Deputies (`is_league_ops`) are for cards/scoring — **not** the locker bulk-purge role

---

## 2. Target authorization + retention model

### 2.1 Who may purge

| Actor | May call successful purge? |
|-------|----------------------------|
| Anonymous / no JWT | **No** |
| Authenticated non-member | **No** |
| Regular league member | **No** |
| Moderator (`memberships.is_moderator`) | **Yes** (subject to retention) |
| Commissioner (`leagues.commissioner_id`) | **Yes** (subject to retention) |
| Deputy only (not mod/commish) | **No** |
| Service role | Bypasses client path; not product bulk-purge UI |

**Helper:** `public.is_league_staff(p_league_id)` — same authority class as locker staff delete policy.

### 2.2 Server-enforced retention boundary (required)

| Constant | Value |
|----------|--------|
| Retention window | **7 days** |
| Server boundary | `v_boundary := now() - interval '7 days'` |
| Protected messages | All rows with `created_at >= v_boundary` must **not** be deleted by this RPC |

**Preferred algorithm (do not trust caller cutoff):**

1. Require `auth.uid()` and `is_league_staff(p_league_id)`.  
2. Compute `v_boundary := now() - interval '7 days'`.  
3. **Primary cutoff:** derive on server — default effective cutoff is `v_boundary`.  
4. **Compatibility with existing signature** `purge_locker_before(uuid, timestamptz)`:  
   - Keep `p_before` parameter so the app/PostgREST contract does not break.  
   - If `p_before` is **null** → use `v_boundary`.  
   - If `p_before` is **older** than `v_boundary` (stricter / deletes less recent history) → allow and use `p_before`.  
   - If `p_before` is **newer** than `v_boundary` (including `now()`, future, or “start of this week” if that falls inside 7 days) → **reject** with a clear exception.  
5. `DELETE … WHERE league_id = p_league_id AND created_at < v_cutoff` where `v_cutoff <= v_boundary` always.

**Invariant:**

```text
v_cutoff <= now() - interval '7 days'
⇒ no message with created_at within the last 7 days is deleted by this RPC
```

Belt-and-suspenders: after resolving `v_cutoff`, still enforce `v_cutoff := least(v_cutoff, v_boundary)`.

### 2.3 Why not only `p_before <= now()`

| Client `p_before` | `<= now()` only | With 7-day boundary |
|-------------------|-----------------|---------------------|
| `now() + 1 day` | Reject | Reject |
| `now()` | **Allow → wipe recent** | **Reject** |
| `now() - 1 day` | Allow → wipe last day+ | **Reject** |
| `now() - 7 days` | Allow | Allow (max aggressive bulk) |
| `now() - 30 days` | Allow | Allow (more conservative) |

Single-post staff delete via RLS remains available for targeted moderation inside the window; **bulk RPC** must not erase the live board.

### 2.4 Grants

| Action | Target |
|--------|--------|
| `REVOKE ALL … FROM PUBLIC` | Always |
| `REVOKE ALL … FROM anon` | Always if present |
| `GRANT EXECUTE … TO authenticated` | Keep (body enforces staff + retention) |
| Do **not** grant to `anon` | Absolute |

---

## 3. Least-privilege grants

Same as §2.4. Body checks remain mandatory; grants alone are insufficient (SECURITY DEFINER).

---

## 4. App call-site notes (when apply is authorized)

| Path | Today | After D-01 |
|------|-------|------------|
| `purgeStaleLockerMessages` | Any member RPC; client supplies week-start as `p_before` | Non-staff → deny/no-op; staff → server caps to **≤ now()-7d** |
| Client week-start inside 7 days | Would delete “this week and older” under old rules | RPC **rejects** if week-start is newer than boundary; no bulk delete of protected rows |
| Fallback table `DELETE` | Own rows under RLS; staff delete via RLS | Unchanged; not a bulk wipe path for all members |

**Apply-time app follow-up (recommended same release):**

1. Stop comments that say any member can trigger league-wide cleanup.  
2. Optionally skip RPC unless client knows caller is staff.  
3. If client still passes week-start, treat reject as soft no-op **or** stop sending `p_before` and rely on server default boundary (signature still requires a value today — pass a safe old sentinel only after product agrees, or keep week-start and accept reject when week-start is within 7 days).  
4. Prefer: pass `p_before = weekStart` only when `weekStart <= now()-7d`; otherwise skip RPC (weekly board still full).  
5. Optional UI: staff “Clear messages older than 7 days” with confirm.

App code changes remain **out of band** of the SQL REVIEW-ONLY file unless Mike authorizes a combined release.

---

## 5. Proposed SQL

**File:** `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql`  

**DO NOT RUN** until Mike explicitly authorizes D-01.

---

## 6. Rollback

| Step | Action |
|------|--------|
| 1 | Re-apply prior function body from `supabase/locker-week-purge.sql` (member-authorized, no retention) **only if emergency** |
| 2 | Re-grant `EXECUTE` to `authenticated` (avoid re-opening `PUBLIC`/`anon`) |
| 3 | `NOTIFY pgrst, 'reload schema'` |

**Warning:** Rollback reopens the confirmed high defect (member + unbounded bulk wipe). Prefer fix-forward.

Emergency rollback notes remain in the REVIEW-ONLY SQL file comments.

---

## 7. Tests (must pass before/after authorize)

### Authorization

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Unauthenticated RPC | Denied |
| T2 | Authenticated non-member | Denied; zero deletes |
| T3 | Regular member, any `p_before` | Denied; zero deletes |
| T4 | Deputy only (not mod) | Denied; zero deletes |
| T5 | Moderator, valid cutoff (`p_before <= now()-7d`) | Success; only `created_at < v_cutoff` deleted |
| T6 | Commissioner, valid cutoff | Success |

### Retention (staff cannot erase protected window)

Seed messages at relative ages before the call: **M1** `now()-1 day`, **M2** `now()-3 days`, **M3** `now()-8 days`, **M4** `now()-30 days` (same league).

| # | Caller | `p_before` | Expected |
|---|--------|------------|----------|
| T7 | Moderator | `now()` | **Denied**; M1–M4 all remain |
| T8 | Commissioner | `now()` | **Denied**; all remain |
| T9 | Moderator | `now() - interval '1 day'` | **Denied**; all remain (newer than boundary) |
| T10 | Moderator | `now() - interval '7 days'` | Success; **M3, M4** deleted; **M1, M2 protected** remain |
| T11 | Commissioner | `now() - interval '30 days'` | Success; only **M4** deleted; M1–M3 remain |
| T12 | Moderator | `null` if ever allowed / omit | If null accepted: cutoff = boundary; same as T10 row set; if null rejected by signature, N/A |
| T13 | Moderator | `now() + interval '1 day'` | **Denied** |

### Grants / collateral

| # | Scenario | Expected |
|---|----------|----------|
| T14 | `anon` / `PUBLIC` EXECUTE | Absent preferred; body still denies null uid |
| T15 | Sport trigger / other leagues policies / unrelated functions | Unchanged |

### Catalog SELECT (pre/post)

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'purge_locker_before'
  AND privilege_type = 'EXECUTE'
ORDER BY grantee;

SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'purge_locker_before';
```

Expect body to contain `is_league_staff` and `interval '7 days'` (or equivalent boundary), not membership-only and not `p_before > now()` alone.

---

## 8. Explicit non-scope

- D1A / other RLS policies  
- D-02 easter eggs · D-03 first join  
- H-01 global EXECUTE revoke sweep  
- Changing row-level single-message staff delete  
- Deputy expansion into bulk purge  
- Postseason / Crystal Ball  
- Service-role cron (future product)

---

## 9. Authorization gate

| Item | Status |
|------|--------|
| Design | This document (retention-boundary revision) |
| SQL proposal | `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` |
| Production apply | **Blocked** until Mike says apply D-01 |
| Push of prior archive | `2fda376` on `origin/main` |
| This revision | Design/SQL docs only · **no production change** |

---

*End D-01 REVIEW ONLY design (7-day retention).*
