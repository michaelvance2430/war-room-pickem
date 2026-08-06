# D1B-C — Production apply & post-verify archive

**Status:** **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS**  
**Date:** 2026-08-06  
**Project:** war-room-pickem (connected production Supabase)  
**Migration:** `d1b_c_achievements_visibility_correlation`  
**Authorization:** Mike explicit D1B-C only  
**Apply SQL:** `supabase/D1B-C-APPLY-AUTHORIZED.sql`  
**Preflight:** `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` §0  

### Explicit non-claims

| Track | Claimed repaired? |
|-------|-------------------|
| D1B-C | **Yes — structurally** |
| D1B-A | Already repaired (untouched by D1B-C) |
| D1B-B | **No** |
| D1C | **No** (parked) |
| H-01 | **No** (helper grants intentionally left for H-01 inventory) |

---

## 1. Execution

| Field | Value |
|-------|--------|
| Apply executed | **YES** |
| Environment | Production Supabase — connected project |
| Project | **war-room-pickem** |
| Migration | `d1b_c_achievements_visibility_correlation` |
| SQL errors | **none** |
| Migration result | `success = true` |
| overall_pass | **true** |
| Operator verdict | **LIVE / STRUCTURALLY REPAIRED** |

---

## 2. V1 — Members read achievements (live post-apply)

| Field | Live |
|-------|------|
| Policy | `"Members read achievements"` |
| Command | SELECT |
| Role | authenticated |
| USING (qual) | `is_league_member(league_id)` |
| WITH CHECK | null (correct for SELECT) |
| uses_is_league_member | **true** |
| still_has_tautology | **false** |

Prior `m.league_id = m.league_id` tautology is **gone**. Policy evaluates membership against each achievement row’s `league_id`.

---

## 3. V2 — Commissioner grants achievements (preserved)

| Field | Live |
|-------|------|
| Present | **true** |
| Command | INSERT |
| WITH CHECK | `l.id = achievements.league_id` AND `l.commissioner_id = auth.uid()` |
| correlates_row_league | **true** |
| correlates_commissioner | **true** |
| Changed by D1B-C | **NO** |

---

## 4. V3 — Complete policy list

1. Commissioner grants achievements — INSERT  
2. Members read achievements — SELECT  

No other achievements policies added, removed, or replaced.

---

## 5. V4 — RLS

| Field | Value |
|-------|--------|
| RLS enabled | **true** |
| RLS forced | **false** |

---

## 6. V5 — Data

| Metric | Value |
|--------|------:|
| achievement_rows before | **0** |
| achievement_rows after | **0** |
| Historical rows modified | **NO** |
| Cleanup performed | **NO** |

---

## 7. V6 — Shared helper (untouched)

| Field | Value |
|-------|--------|
| Function | `public.is_league_member(p_league_id uuid)` |
| security_definer | **true** |
| search_path | **public** |
| body_refs_memberships | **true** |
| correlates_league / auth user | **true** |
| Execute grantees | PUBLIC, anon, authenticated, postgres, service_role |
| Definition changed | **NO** |
| Grants changed | **NO** |

Broad helper grants remain **H-01 inventory** — intentionally untouched.

---

## 8. Scope confirmation

| Item | Result |
|------|--------|
| Replaced only Members read achievements | **YES** |
| Commissioner INSERT preserved | **YES** |
| RLS preserved | **YES** |
| Data / helper / grants / indexes / app | **NO** change |
| D1B-A / D1B-B / D1C / H-01 | **NO** change |

---

## 9. Final classification

```text
D1B-C: LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS
```
