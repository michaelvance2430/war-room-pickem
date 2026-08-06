# D1B-C — Apply authorization

**Date:** 2026-08-06  
**Authorization:** Mike explicit **`D1B-C authorized — apply only`**  
**Status:** **AUTHORIZED / APPLY PACKAGE READY** · structural repair **pending post-verify archive** after production execution  

### Scope lock

| In | Out |
|----|-----|
| Replace `"Members read achievements"` SELECT only | `"Commissioner grants achievements"` |
| `USING (public.is_league_member(achievements.league_id))` | Helper redefine/grants |
| | Achievement data DML |
| | Indexes, table grants, app |
| | D1B-A, D1B-B, D1C, H-01 |

### Files

| File | Use |
|------|-----|
| `supabase/D1B-C-APPLY-AUTHORIZED.sql` | **Apply** |
| `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql` | Twin of apply body |
| `supabase/D1B-C-postverify-SELECT-ONLY.sql` | Post-apply SELECT-only |

### Preflight gate (satisfied)

`docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` §0 — **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH**.

### Structural repair criteria

1. Tautology `m.league_id = m.league_id` **gone**  
2. USING calls `is_league_member` correlated to achievement league  
3. Commissioner INSERT **unchanged**  
4. RLS still enabled  
5. Achievement count still **0**  
6. No helper / grants / data / app / D1B-B / D1C / H-01 changes  

### Gray copy box — paste results for Grok archive

```text
D1B-C APPLY + POST-VERIFY RESULTS

Apply executed: YES / NO
Environment: production Supabase (connected project)
Project: war-room-pickem
Migration / file: 
SQL errors: (none | paste)

V1 Members read achievements:
qual: 
uses_is_league_member: true/false
still_has_tautology: true/false

V2 Commissioner grants achievements:
present: true/false
with_check correlated: true/false

V3 full policy list:
(paste names + cmd)

V4 RLS enabled: true/false

V5 achievement_rows: 

V6 is_league_member security_definer / body_refs_memberships:
helper definition changed: NO (expected)
helper grants changed: NO (expected)

Operator verdict: LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS
  or FAILED / PARTIAL
```

**Do not claim D1B-C repaired until post-verify PASS is archived.**
