# D1B-A — Production apply & post-verify archive

**Status:** **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS**  
**Date:** 2026-08-06  
**Project:** war-room-pickem (connected production Supabase)  
**Migration:** `d1b_a_picks_membership_correlation`  
**Authorization:** Mike explicit D1B-A only  
**Apply SQL:** `supabase/D1B-A-APPLY-AUTHORIZED.sql`  
**Preflight:** `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md` §0  

### Explicit non-claims

| Track | Claimed repaired? |
|-------|-------------------|
| D1B-A | **Yes — structurally** |
| D1B-B | **No** |
| D1B-C | **No** |
| D1C | **No** (parked) |
| H-01 | **No** |

Behavioral / adversarial suite against real identities: **not** run in this package (structural only).

---

## 1. Execution

| Field | Value |
|-------|--------|
| Apply executed | **YES** |
| Environment | Connected production Supabase |
| Project | **war-room-pickem** |
| Migration name | `d1b_a_picks_membership_correlation` |
| SQL errors | **none** |
| Migration result | `success = true` |
| overall_pass | **true** |
| Operator verdict | **LIVE / STRUCTURALLY REPAIRED** |

---

## 2. V1 — Target policies (live post-apply)

### `public.picks` — `"Users manage own picks"`

| Field | Live |
|-------|------|
| Command | ALL |
| Roles | authenticated |
| USING | `(user_id = auth.uid()) AND is_league_member(league_id)` |
| WITH CHECK | `(user_id = auth.uid()) AND is_league_member(league_id)` |
| qual_has_member | **true** |
| with_check_has_member | **true** |
| with_check_present | **true** |

### `public.pick_games` — `"Users manage own pick_games"`

| Field | Live |
|-------|------|
| Command | ALL |
| Roles | authenticated |
| USING | EXISTS parent `public.picks` where `p.id = pick_games.pick_id` AND `p.user_id = auth.uid()` AND `is_league_member(p.league_id)` |
| WITH CHECK | Same correlated parent-pick ownership and membership test |
| qual_has_member | **true** |
| with_check_has_member | **true** |
| with_check_present | **true** |

**Pre-apply defect closed:** pick_games no longer has null WITH CHECK; both tables require target-league membership via `is_league_member`.

---

## 3. V2 — Complete policy set preserved

### `public.picks`

| Policy | Command |
|--------|---------|
| Users manage own picks | ALL *(replaced)* |
| Commissioner reads league picks | SELECT *(preserved)* |

### `public.pick_games`

| Policy | Command |
|--------|---------|
| Users manage own pick_games | ALL *(replaced)* |
| Commissioner reads league pick_games | SELECT *(preserved)* |

No other policies were replaced or removed.

---

## 4. V3 — Historical integrity (unchanged; no cleanup)

| Metric | Value |
|--------|------:|
| picks | **7** |
| pick_games | **35** |
| picks_without_membership | **0** |
| pick_games_under_nonmember_picks | **0** |
| pick_games_orphan_parent | **0** |

No historical cleanup or row mutation was performed.

---

## 5. V4 — Shared helper (untouched)

| Field | Value |
|-------|--------|
| Function | `public.is_league_member(p_league_id uuid)` |
| security_definer | **true** |
| search_path | **public** |
| body_refs_memberships | **true** |
| Helper definition changed | **NO** |
| Helper grants changed | **NO** |

---

## 6. Scope confirmation

| Item | Result |
|------|--------|
| Two authorized RLS policies changed | **YES** |
| Historical picks/pick_games changed | **NO** |
| Helper changed | **NO** |
| App changed | **NO** |
| D1B-B changed | **NO** |
| D1B-C changed | **NO** |
| D1C changed | **NO** |
| H-01 changed | **NO** |

---

## 7. Final classification

```text
D1B-A: LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS
```

Honest client write path already used active league membership; defect was cross-league manage-own via ownership alone. Database now enforces membership on manage-own for picks and pick_games.
