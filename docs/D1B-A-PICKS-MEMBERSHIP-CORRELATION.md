# D1B-A — Picks / pick_games membership correlation

**Status:** **DESIGN READY / SELECT-ONLY PREFLIGHT PACKAGE READY / APPLY NOT AUTHORIZED / NOT REPAIRED**  
**Slice:** Isolation of own pick writes to **current** league membership  
**Date:** 2026-08-06  
**Preflight + apply-scope:** `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md`  
**Preflight SQL:** `supabase/D1B-A-preflight-SELECT-ONLY.sql`  


---

## Locked findings

- Honest browser pick flows already use active league session.  
- Require **self ownership** + **current membership in target league**.  
- Bot writes stay on guarded SECURITY DEFINER RPCs.  
- Data clean (0 nonmember picks).  
- Existing uniques sufficient — **no new indexes**.  
- **Do not** bundle commissioner scoring / admin fallback redesign.

---

## Live defect (repo + scrub)

| Policy | Problem |
|--------|---------|
| `"Users manage own picks"` | `auth.uid() = user_id` only — can target any `league_id` |
| `"Users manage own pick_games"` | Parent pick ownership only — no membership on that pick’s league |

Preserved separately (do not drop):

- `"Members view league picks"` (SELECT for mates)  
- `"Members read pick_games"`  
- Ops / commissioner read-score policies from `deputy-ops.sql` (OR semantics with manage-own)

---

## Target policy semantics

### picks — `"Users manage own picks"` (ALL for authenticated)

**USING and WITH CHECK both require:**

1. `user_id = auth.uid()`  
2. `public.is_league_member(league_id)` — reuses live SECURITY DEFINER helper (avoids memberships RLS recursion / tautology)

### pick_games — `"Users manage own pick_games"` (ALL for authenticated)

**USING and WITH CHECK both require** exists parent pick where:

1. `p.id = pick_games.pick_id`  
2. `p.user_id = auth.uid()`  
3. `public.is_league_member(p.league_id)`

---

## Compatibility

| Path | Impact |
|------|--------|
| Human save/autosave/lock | OK if member of session league |
| Nonmember spoof | Denied (desired) |
| `seed_bot_picks_for_week` | Unaffected (DEFINER) |
| Scoring / ops read | Separate policies; not rewritten in D1B-A |
| Client season-reset / remove-member pick deletes | May already be RLS-limited; **do not** broaden RLS to keep insecure fallbacks |

---

## SQL proposal

`supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`

---

## Explicit non-scope

- No grants, functions (except using existing `is_league_member`), triggers, indexes  
- No app edits  
- No historical mutation  
- No D1B-B / D1B-C / H-01 / D1C  

---

## Apply gate

Mike must:

1. Run `supabase/D1B-A-preflight-SELECT-ONLY.sql` (SELECT only) and archive results.  
2. Confirm match vs `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md`.  
3. Explicitly authorize **D1B-A only** before applying `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`.  

**Not authorized by design or preflight alone.**

---

*End D1B-A design.*
