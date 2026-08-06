# D1B-A — SELECT-Only Preflight & Final Apply-Scope Review

**Status:** **PREFLIGHT PACKAGE READY / APPLY NOT AUTHORIZED / NOT REPAIRED**  
**Date:** 2026-08-06  
**Slice:** `public.picks` + `public.pick_games` manage-own membership correlation only  
**Design:** `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md`  
**SQL proposal:** `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`  
**Preflight SQL:** `supabase/D1B-A-preflight-SELECT-ONLY.sql`  

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Apply D1B-A policies | **No** — requires Mike’s separate explicit authorization |
| DELETE / UPDATE / cleanup of historical rows | **No** |
| Index changes | **No** (none indicated) |
| App code | **No** |
| D1B-B / D1B-C / D1C / H-01 | **Untouched** |

---

## Related program status (parked / separate)

| Track | Classification |
|-------|----------------|
| **D1C** | **DESIGN + NON-PRODUCTION SQL READY / EPHEMERAL TESTS NOT RUN / PRODUCTION APPLY BLOCKED / NOT REPAIRED** — no further D1C work without separate auth (disposable DB, ephemeral S2b run, platform_staff seed design, dual-read, or prod preflight/apply). **Do not test S2b against production.** |
| **D1B-B / D1B-C / H-01** | Untouched by this package |

---

## 1. How preflight was (and was not) executed

| Source | Role |
|--------|------|
| `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md` (2026-08-06) | **Archived live evidence** for manage-own defect + historical inventory |
| `docs/D-03-HELPER-SAFETY-GATE.md` | Archived live `is_league_member` body/grants |
| Repo `schema.sql` / `deputy-ops.sql` / reveal SQL | Expected policy names (may lag live) |
| Agent session catalog re-query | **NOT RUN** — no SQL Editor / service_role / `psql` in this environment; only anon PostgREST env present |

**Operator action before apply:** paste `supabase/D1B-A-preflight-SELECT-ONLY.sql` blocks into Supabase SQL Editor, archive raw results, and confirm **no material drift** vs this report.  
**Stop rule:** if live policy names, FKs, or `is_league_member` body differ materially from design → **do not apply**.

---

## 2. Match or drift (design vs last live scrub + proposal)

| Item | Design / proposal | Last live scrub / archive | Verdict |
|------|-------------------|---------------------------|---------|
| Policy name `Users manage own picks` | Replace in place | Present; `auth.uid() = user_id` only | **MATCH** defect + name |
| Policy name `Users manage own pick_games` | Replace in place | Present; parent pick ownership only | **MATCH** defect + name |
| Self ownership | Required | Present | **MATCH** |
| Target-league membership on picks | `is_league_member(league_id)` | **Missing** | **DEFECT CONFIRMED** |
| Parent pick league membership on pick_games | `is_league_member(p.league_id)` | **Missing** | **DEFECT CONFIRMED** |
| Preserve mate/ops read | Do not drop | Ops + member/read policies exist in repo lineage | **MATCH intent** — reconfirm live names via P1/P2/P14 |
| Historical nonmember picks | 0 expected | Scrub: **0** of 7 | **MATCH clean data** |
| `is_league_member` reuse unchanged | Yes | D-03 gate: body correct; broad EXECUTE (H-01 separate) | **MATCH** |
| Indexes | No new | Uniques sufficient per design | **MATCH** |
| D1B-A SQL scope | 2 policies only | Proposal file matches | **MATCH** |

### Material stop conditions (if live preflight differs)

- Manage-own policy **renamed** or split into per-command policies  
- `pick_games.pick_id` FK missing or not → `picks(id)`  
- `is_league_member(uuid)` missing or body not membership EXISTS  
- Manage-own already includes `is_league_member` (already repaired)  

---

## 3. Historical invalid-row counts (evidence only — no cleanup)

From **automated scrub archive** (not re-counted this session):

| Metric | Value | Action |
|--------|-------|--------|
| Total picks | **7** | Leave |
| Picks without `(league_id, user_id)` membership | **0** | No cleanup |
| Pick-games under nonmember picks | **0** | No cleanup |
| Total memberships | **77** | — |

**Re-run P6–P9** before apply; if counts ≠ 0 nonmember, still **no DELETE** — inventory only and reassess product risk.

---

## 4. Expected live policy surface (repo + scrub)

### picks (expected family — confirm live with P1)

| Policy (repo lineage) | cmd | Role in D1B-A |
|-----------------------|-----|----------------|
| **Users manage own picks** | ALL | **REPLACE** |
| Members view league picks | SELECT | **PRESERVE** (if still live) |
| Ops read league picks | SELECT | **PRESERVE** |
| Ops score picks | UPDATE | **PRESERVE** |
| Members read locked/scored week picks | SELECT | **PRESERVE** if present |

### pick_games (expected family — confirm live with P2)

| Policy (repo lineage) | cmd | Role in D1B-A |
|-----------------------|-----|----------------|
| **Users manage own pick_games** | ALL | **REPLACE** |
| Members read pick_games | SELECT | **PRESERVE** (if still live) |
| Ops read league pick_games | SELECT | **PRESERVE** |
| Members read locked/scored week pick_games | SELECT | **PRESERVE** if present |

**Note:** `picks-privacy.sql` drops open mate view in favor of commissioner/ops read — live may show either lineage. D1B-A must **not** drop any non-manage-own policy.

### Schema keys (repo `schema.sql` — confirm P4)

| Object | Definition |
|--------|------------|
| `picks` PK | `id uuid` |
| `picks` unique | `(league_id, user_id, week_number)` |
| `picks.league_id` | FK → `leagues` |
| `pick_games` PK | `id uuid` |
| `pick_games.pick_id` | FK → `picks(id)` ON DELETE CASCADE |
| `pick_games` unique | `(pick_id, card_game_id)` |

### RLS (repo)

| Table | RLS enabled in schema.sql |
|-------|---------------------------|
| picks | Yes |
| pick_games | Yes |

Forced RLS: expect **false** unless product changed — confirm P3.

---

## 5. `is_league_member(uuid)` — archived live definition summary

From **D-03 helper safety gate** (live at that time):

| Field | Value |
|-------|--------|
| Body | Correct `memberships` EXISTS for `p_league_id` + `auth.uid()` |
| SECURITY DEFINER / STABLE | Yes |
| `search_path` | `public` |
| EXECUTE | PUBLIC, anon, authenticated, postgres, service_role (H-01 inventory — **do not change in D1B-A**) |

**D1B-A must NOT** CREATE OR REPLACE / REVOKE / GRANT this helper.

### Known policy consumers of `is_league_member` (archive + expected)

| Table | Policy (archive) |
|-------|------------------|
| `card_games` | Members read card games |
| `memberships` | Memberships select for members |
| `week_cards` | Members read week cards |
| `league_first_joins` | Users insert own first join (after D-03) |

D1B-A **adds** manage-own picks/pick_games as consumers. Re-run P11 before apply.

---

## 6. Exact policies proposed for replacement

### 6.1 `public.picks` — `"Users manage own picks"`

| Attribute | Value |
|-----------|--------|
| Command | `FOR ALL` |
| Role | `TO authenticated` |
| USING | `user_id = auth.uid() AND public.is_league_member(league_id)` |
| WITH CHECK | `user_id = auth.uid() AND public.is_league_member(league_id)` |
| Correlates to | **row** `picks.league_id` |

### 6.2 `public.pick_games` — `"Users manage own pick_games"`

| Attribute | Value |
|-----------|--------|
| Command | `FOR ALL` |
| Role | `TO authenticated` |
| USING | EXISTS parent `picks p` where `p.id = pick_games.pick_id` AND `p.user_id = auth.uid()` AND `public.is_league_member(p.league_id)` |
| WITH CHECK | Same EXISTS (parent ownership + membership on **parent pick’s** `league_id`) |
| Correlates to | **parent** `picks.league_id` (not a free-standing league on pick_games) |

---

## 7. End-to-end audit of REVIEW-ONLY SQL

File: `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql`

| Check | Result |
|-------|--------|
| Replaces only the two authorized manage-own policies | **PASS** — only those two DROP/CREATE |
| No DROP of mate/ops/reveal policies | **PASS** |
| No helper create/replace/grants | **PASS** |
| No index/trigger/table DDL | **PASS** |
| No historical DML | **PASS** |
| No D1B-B/C, D1C, H-01 | **PASS** |
| picks USING self + membership | **PASS** |
| picks WITH CHECK self + membership | **PASS** (both required for ALL) |
| pick_games USING parent + membership on `p.league_id` | **PASS** |
| pick_games WITH CHECK same | **PASS** (schema live may lack WITH CHECK today — proposal correctly adds it for INSERT/UPDATE) |
| Membership predicate on actual row league | **PASS** — `league_id` / `p.league_id` |
| Transaction wrapped | **PASS** (`begin`/`commit`) |
| `NOTIFY pgrst` | Present — OK post-apply only |

**Caveat:** `FOR ALL` means SELECT is also gated by manage-own USING. Own-row SELECT still works for members; **nonmember former owners** lose manage-own SELECT (mates/ops/locked-week policies may still apply for others). Historical rows retained; visibility follows remaining policies. Acceptable under “current membership required.”

---

## 8. Exact SQL-object scope (apply, when authorized)

| Object | Action |
|--------|--------|
| Policy `Users manage own picks` on `public.picks` | DROP + CREATE |
| Policy `Users manage own pick_games` on `public.pick_games` | DROP + CREATE |
| All other policies | **None** |
| Functions / grants / indexes / tables / data | **None** |

**Out of scope:** bot RPCs, reset, remove-member, app, D1B-B join, D1B-C achievements, D1C, H-01.

---

## 9. Rollback (when apply later authorized)

Restore prior manage-own (ownership only) from pre-apply archive of `qual`/`with_check` — **reopens cross-league write risk**. Prefer re-apply archived exact strings rather than guessing.

---

## 10. Apply gate checklist (Mike)

- [ ] Run full `D1B-A-preflight-SELECT-ONLY.sql` on production **SELECT-only**  
- [ ] Archive raw results next to this doc  
- [ ] Confirm policy names match §6  
- [ ] Confirm nonmember counts still 0 (or accept risk without cleanup)  
- [ ] Confirm `is_league_member` body still correct  
- [ ] Confirm preserve-list policies still present  
- [ ] Explicit chat/message: **authorize D1B-A apply only**  
- [ ] Apply `D1B-A-picks-membership-REVIEW-ONLY.sql`  
- [ ] Post-verify manage-own quals contain `is_league_member`  
- [ ] Spot-check honest client pick save still works  

**This document does not authorize apply.**

---

## 11. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged by this package | **Yes** |
| D1B-A repaired | **No** |
| D1B-B / D1B-C untouched | **Yes** |
| D1C untouched / parked | **Yes** |
| H-01 untouched | **Yes** |
| Live catalog re-queried this session | **No** — operator must run preflight SQL |
| Historical invalid-row cleanup | **Not done / not needed per scrub (0)** |
