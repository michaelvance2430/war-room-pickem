# D1B-A — Apply authorization & execution package

**Date:** 2026-08-06  
**Authorization:** Mike explicit **D1B-A only**  
**Status:** **AUTHORIZED / APPLY PACKAGE READY** · structural repair **pending operator execution of apply SQL** (or post-verify if already executed outside this agent)

### Scope lock

| In | Out |
|----|-----|
| Replace `"Users manage own picks"` on `public.picks` | `is_league_member` redefine/grants |
| Replace `"Users manage own pick_games"` on `public.pick_games` | Historical data DELETE/UPDATE |
| | Indexes, table grants, app |
| | Other picks/pick_games policies |
| | D1B-B, D1B-C, D1C, H-01 |

### Files

| File | Use |
|------|-----|
| `supabase/D1B-A-APPLY-AUTHORIZED.sql` | **Apply** (authorized) |
| `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql` | Same policy text (historical name) |
| `supabase/D1B-A-postverify-SELECT-ONLY.sql` | Post-apply SELECT-only verification |

### Preflight gate (satisfied)

See `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md` §0 — **LIVE PREFLIGHT PASS / APPLY-SCOPE MATCH**.

### Agent execution note

This Grok Build environment has **no** Supabase service role / Management API token to run DDL against production. Apply must run on the **connected Supabase production project** (same path as live preflight). After apply, paste post-verify results for archive.

### Structural repair criteria

D1B-A is **structurally repaired** only when post-verify shows:

1. Both manage-own policies include `is_league_member` in **USING and WITH CHECK**  
2. `pick_games` manage-own **WITH CHECK is not null**  
3. Integrity counts remain: nonmember picks **0**, pick_games under nonmember **0**, orphan parents **0**  
4. Helper body still membership-based DEFINER (unchanged intent)  
5. No unauthorized objects modified  

### Gray copy box — apply + post-verify results (for Grok archive)

Paste the following block back after you run apply + `D1B-A-postverify-SELECT-ONLY.sql`:

```text
D1B-A APPLY + POST-VERIFY RESULTS

Apply executed: YES / NO
Environment: production Supabase (connected project)
Apply file: supabase/D1B-A-APPLY-AUTHORIZED.sql
Errors during apply: (none | paste)

V1 manage-own policies (tablename | policyname | qual | with_check):
(paste)

V2 member flags:
picks qual_has_member: true/false
picks with_check_has_member: true/false
pick_games qual_has_member: true/false
pick_games with_check_has_member: true/false
pick_games with_check_present: true/false

V3 full policy list picks/pick_games:
(paste names)

V4 integrity:
picks: 
pick_games: 
picks_without_membership: 
pick_games_under_nonmember_picks: 
pick_games_orphan_parent: 

V5 is_league_member:
security_definer: 
body_refs_memberships: 

Operator verdict: STRUCTURALLY REPAIRED / FAILED / PARTIAL
```

---

**Do not claim D1B-A repaired until post-verify PASS is archived.**
