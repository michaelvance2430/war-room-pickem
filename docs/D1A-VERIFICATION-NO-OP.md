# D1A — League deletion lockdown · verification archive

**Date:** 2026-08-06  
**Mode:** Preflight + post-state verification via Supabase SQL Editor  
**Authorization:** Mike authorized D1A only for this session  

---

## Verdict

**VERIFIED NO-OP / ALREADY ABSENT**

| Claim | Status |
|-------|--------|
| Desired production state (no client DELETE path via retired policy) | **Satisfied** |
| This session ran Block B (`DROP POLICY`) | **No** |
| This session changed production | **No** |
| Do not claim this session applied the DROP | **Correct** |

---

## Live preflight / verification results

### 1. DELETE policies on `public.leagues`

| Field | Live |
|-------|------|
| Row count | **Zero** |
| `"Commissioner deletes league"` | **Already absent** |
| Block B applied this session | **Not run** |

### 2. Remaining `public.leagues` policies

| cmd | policyname |
|-----|------------|
| INSERT | `Users create leagues` |
| SELECT | `Leagues readable authenticated` |
| UPDATE | `Commissioner updates league` |
| UPDATE | `leagues_commish_update_sport` |
| DELETE | **none** |

### 3. RLS on `public.leagues`

| Field | Live |
|-------|------|
| `rls_enabled` | **true** |
| `rls_forced` | **false** |

### 4. Sport immutability

| Field | Live |
|-------|------|
| Trigger | `leagues_sport_id_immutable_trg` |
| `tgenabled` | **O** (enabled) |

---

## Drift vs earlier evidence

| Source | Statement |
|--------|-----------|
| Prior evidence (Pass 1.5 / D1A design freeze) | Reported **exactly one** DELETE policy: `"Commissioner deletes league"` with `qual = (commissioner_id = auth.uid())` |
| Live state this session | **Zero** DELETE policies |

**Interpretation (bounded):**

- Production state for this policy **differs** from the earlier freeze.
- The DELETE policy was **removed or never present at verification time** relative to that prior report.
- **Timing and cause are unknown.** Possible causes include a prior manual apply, another session, dashboard edit, or documentation lag — **do not attribute without evidence.**

This session **did not** perform the DROP and **does not** claim credit for the removal.

---

## Scope hold (honored)

Not modified this session:

- Functions  
- EXECUTE grants  
- RLS on other tables  
- Triggers / constraints  
- Crystal Ball  
- Postseason structures  
- Any other `leagues` policies  

---

## Residual notes

- **P18:** no public SECURITY DEFINER function deletes `public.leagues` (separate archive).
- App-layer Delete League remains fail-closed (separate pure tests / product law).
- Emergency re-create of the DELETE policy would reopen destructive client delete — **prefer leave locked.**
- Optional future re-check: same DELETE-policy SELECT before any other league RLS work.

---

## Related files

| File | Role |
|------|------|
| `supabase/D1A-league-delete-lockdown-REVIEW-ONLY.sql` | Historical apply proposal (not executed this session) |
| `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md` | D-04 status → verified absent |
| This file | Authoritative D1A closeout for 2026-08-06 |

---

*End D1A verification archive.*
