# Automated read-only scrub sweep — COMPLETE

**Date:** 2026-08-06 (operator / ChatGPT Supabase plugin)  
**Project:** `war-room-pickem` · ref `dorhjepugsjpmnuzdzck`  
**Mode:** Read-only catalog, policy, integrity, ACL, advisor, regression  
**Connector:** Supabase plugin (SELECT / advisors only)

---

## Authorization / change status

| Claim | Status |
|-------|--------|
| Production SQL writes this sweep | **None** |
| Policies / functions / grants / triggers / constraints mutated | **None** |
| Auth settings changed | **None** |
| App code / Git deploy from this sweep | **None** |
| Behavioral calls against production identities | **None** |

**Production remained unchanged throughout this automated sweep.**

---

## Regression sweep — PASS

### D1A

| Check | Live |
|-------|------|
| `public.leagues` DELETE policies | **0** |
| RLS enabled | **true** |
| `leagues_sport_id_immutable_trg` | Present and enabled |

**Verdict:** **REGRESSION PASS** (desired delete-retired state)

### D-01

| Check | Live |
|-------|------|
| `purge_locker_before` anon EXECUTE | **false** |
| Prior structural repair | Intact (ACL regression); no function edit this sweep |

**Verdict:** **REGRESSION PASS** · behavioral suite still PENDING

### D-02

| Check | Live |
|-------|------|
| Active catalog rows | **20** |
| Distinct active IDs | **20** |
| Direct INSERT policies on `easter_egg_finds` | **0** |
| `record_easter_egg_find` anon EXECUTE | **false** |
| Historical mutation this sweep | **None** |

**Verdict:** **REGRESSION PASS** · behavioral suite still PENDING

### D-03

| Check | Live |
|-------|------|
| `record_league_first_join` anon EXECUTE | **false** |
| INSERT policy with `is_league_member` | **Exactly one** |
| Total first-join rows | **73** |
| Orphan first-join rows | **0** |
| Historical preservation | **PASS** |

**Verdict:** **REGRESSION PASS** (membership-gated structural state live) · behavioral suite still PENDING  
**Note:** Helper `is_league_member` body/grants not modified this sweep (H-01 surface separate).

---

## D1B — DEFECT CONFIRMED / CURRENT DATA CLEAN

### Live policies

| Table | Policy / note |
|-------|----------------|
| `picks` | “Users manage own picks”: `auth.uid() = user_id`; **no** target-league membership |
| `pick_games` | Ownership via parent pick user; **no** parent pick league-membership |
| `memberships` INSERT | Self-only |
| `memberships` UPDATE | **No** explicit `with_check` |

### Integrity inventory

| Metric | Value |
|--------|-------|
| Total picks | 7 |
| Picks without matching `(league_id, user_id)` membership | **0** |
| Pick-game rows under nonmember picks | **0** |
| Total memberships | 77 |
| Memberships missing league | **0** |
| Memberships missing Auth user | **0** |

### Classification

- **Confirmed structural authorization defect**  
- **No evidence of exploitation or dirty data**  
- **No cleanup needed**  
- Repair requires **separate D1B design/apply authorization**

Also include **achievements** tautology (see policy inventory) as correlation defect in D1B scope or sibling.

---

## D1C — DEFECT CONFIRMED / DESIGN REQUIRED

### Membership tautologies (`m.league_id = m.league_id`)

1. `crystal_ball_picks` — Users upsert own crystal ball  
2. `crystal_ball_picks` — Members read crystal ball when frozen  
3. `crystal_ball_picks` — Members read own crystal ball  
4. `crystal_ball_picks` — Users update own crystal ball  
5. `crystal_ball_result` — Members read crystal result  
6. `achievements` — Members read achievements *(also D1B correlation)*  

### Crystal Ball authority

| Finding |
|---------|
| No non-internal triggers on `crystal_ball_picks` / `crystal_ball_result` |
| INSERT/UPDATE membership checks tautological |
| UPDATE ownership self-only; no single DB lock authority |
| Frozen-read mixes: `crystal_ball_result` existence · hard-coded `2026-08-29 16:00:00+00` · hard-coded `2026-09-10 16:00:00+00` · week result 0 or 1 existence |
| `crystal_ball_lock_count(uuid)` SECURITY DEFINER; callable by anon/authenticated |

### Classification

- **D1C confirmed**  
- Needs product/DB design for **one** authoritative lock/reveal source  
- **Do not** quick-patch without Mike’s separate approval  

---

## H-01 — DEFINER EXECUTE surface CONFIRMED

| Aggregate | Count |
|-----------|-------|
| Public SECURITY DEFINER functions | **27** |
| Anon-callable | **14** |
| Authenticated-callable | **27** |
| PUBLIC-callable | **11** |
| DEFINER without proconfig | **0** |

### Anon-callable DEFINER (14)

1. `clear_trial_bots(uuid)`  
2. `crystal_ball_lock_count(uuid)`  
3. `get_league_favorite_team_counts(uuid,text)`  
4. `handle_new_user()`  
5. `is_league_commissioner(uuid)`  
6. `is_league_member(uuid)`  
7. `is_league_ops(uuid)`  
8. `is_league_staff(uuid)`  
9. `reset_league_season(uuid)`  
10. `seed_bot_picks_for_week(uuid,int)`  
11. `seed_bot_sport_pool_votes(uuid)`  
12. `seed_trial_bots(uuid,int)`  
13. `set_member_moderation(uuid,uuid,boolean,boolean,boolean)`  
14. `transfer_commissioner(uuid,uuid)`  

### Notes

- Aligns with Supabase advisor: anonymously callable SECURITY DEFINER = external warning even with body guards.  
- **Do not mass-REVOKE.**  
- Build app/RLS/trigger call-site matrix first.  
- RLS/trigger-only helpers may not need direct client EXECUTE.  
- **D-01, D-02, D-03 repaired RPCs remain absent from anon access.**  

---

## Global RLS / views

| Check | Result |
|-------|--------|
| Public tables RLS disabled | **Zero** |
| Public views | **Zero** |
| Gate | **PASS** |

---

## Supabase security advisors (not claimed exploits)

**Total notices:** 46  

| Category | Count |
|----------|-------|
| RLS enabled / no policy | 1 |
| Mutable function search_path | 3 |
| Anon-executable SECURITY DEFINER | 14 |
| Authenticated-executable SECURITY DEFINER | 27 |
| Leaked-password protection disabled | 1 |

### Mutable search_path (3)

- `profiles_birthday_hard_lock`  
- `profile_favorite_teams_set_updated_at`  
- `leagues_sport_id_immutable`  

### RLS enabled, no policy

- `platform_odds_api_usage` — may be intentional server-only; classify after grants/call sites; **do not** add permissive policy just to silence advisor  

### Auth hardening recommendation

- Supabase **leaked-password protection disabled**  
- Park as Auth config recommendation; **separate Mike authorization** before enabling  

---

## Performance advisors (informational)

Unused indexes, multiple permissive policies, duplicate index on `league_trophies`.  

**Do not** drop indexes or combine policies during security scrub (usage age-dependent; policy merge can change authz).

---

## Behavioral suites still PENDING

| Suite | Constraint |
|-------|------------|
| D-01 | Isolated disposable league |
| D-02 | Disposable identity |
| D-03 | Disposable membership / non-membership |

---

## Explicit non-actions from this archive

- No production SQL apply  
- No app code change  
- No H-01 revokes  
- No Auth setting changes  
- No D1B/D1C repair start without separate authorization  

---

*End automated read-only scrub sweep archive.*
