# Structural / security defect register

**As of:** 2026-08-06 (updated after D1B-C preflight package queued; D1B-A repaired)  
**Evidence chain:** P15–P18 · D1A · D-01–D-03 · scrub · D1C parked · **D1B-A LIVE repaired** · **D1B-C next**  
**Mode:** Inspection / authorized repairs only  

**Production confirmation:** D1B-A structurally repaired on **war-room-pickem**. D1B-C **not applied**. No D1B-B / D1C / H-01 apply.  
**D1B-A:** **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS**.  
**D1B-C:** **DESIGN + PREFLIGHT PACKAGE READY / APPLY NOT AUTHORIZED / NOT REPAIRED** (safest next).  
**D1C:** parked — **not repaired**.  
**Archive:** `docs/D1B-A-APPLY-VERIFICATION.md` · `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md`

---

## 0. Regression dashboard (automated scrub)

| Item | Status |
|------|--------|
| **D1A** leagues DELETE retired | **REGRESSION PASS** (0 DELETE policies; RLS on; sport trigger enabled) |
| **D-01** `purge_locker_before` | **REGRESSION PASS** (anon EXECUTE false; structural repair intact) · behavioral PENDING |
| **D-02** eggs | **REGRESSION PASS** (catalog 20; no direct INSERT; anon EXECUTE false) · behavioral PENDING |
| **D-03** first join | **REGRESSION PASS** (anon EXECUTE false; INSERT uses `is_league_member`; 73 rows; 0 orphans) · behavioral PENDING |
| **D1B-A** picks/pick_games | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| **D1B-B** membership join | **CONFIRMED HIGH AUTHORIZATION DEFECT / COORDINATED DESIGN REQUIRED** |
| **D1B-C** achievements visibility | **DESIGN + PREFLIGHT PACKAGE READY / APPLY NOT AUTHORIZED / NOT REPAIRED** (next scrub) |
| **D1C** Crystal Ball | **DESIGN + NON-PRODUCTION SQL READY / EPHEMERAL TESTS NOT RUN / PRODUCTION APPLY BLOCKED / NOT REPAIRED** (parked) |
| **H-01** DEFINER EXECUTE | **CONFIRMED** · split **H-01A selective design READY** · **H-01B future-default design REQUIRED separately** · no apply |

---

## 1. Database-guts inspection gates (closed)

| Gate | Archive | Verdict |
|------|---------|---------|
| P15–P18 catalog chain | P15–P18 docs | Closed |
| Automated scrub regression | `AUTOMATED-READONLY-SCRUB-SWEEP.md` | **PASS** on D1A + D-01–D-03 structural |

---

## 2. Confirmed defects (authorization / integrity)

### D-01 · `purge_locker_before`

| Field | Value |
|-------|--------|
| Status | **REPAIRED / STRUCTURALLY VERIFIED / BEHAVIORAL PENDING** |
| Regression | anon EXECUTE **false** (scrub) |
| Design / SQL | D-01 docs + `supabase/D-01-purge-locker-before-REVIEW-ONLY.sql` |

### D-02 · `record_easter_egg_find`

| Field | Value |
|-------|--------|
| Status | **LIVE / STRUCTURALLY VERIFIED / BEHAVIORAL PENDING** |
| Regression | catalog **20**; INSERT policies **0**; anon EXECUTE **false** |
| App P6/P7 | LIVE on prod commit `40f4a1f` (pending sync + parity) |

### D-03 · `record_league_first_join`

| Field | Value |
|-------|--------|
| Status | **LIVE / STRUCTURALLY VERIFIED / BEHAVIORAL PENDING** (regression scrub) |
| Regression | anon EXECUTE **false**; exactly one INSERT policy with `is_league_member`; **73** rows; **0** orphans |
| Helper | `is_league_member` **unchanged** (shared; H-01 grants separate) |
| Design / SQL | D-03 docs + narrow `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql` |

### D1B (split) · Picks / join / achievements

**Data (post D1B-A apply):** picks **7** · pick_games **35** · nonmember picks **0** · nonmember pick_games **0** · orphan pick_games **0** · no cleanup.

#### D1B-A · picks / pick_games correlation

| Field | Value |
|-------|--------|
| Severity | High (write isolation) — **closed structurally** |
| Status | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| Design | `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md` |
| Live preflight | `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md` §0 — **PASS** |
| Apply verification | `docs/D1B-A-APPLY-VERIFICATION.md` |
| Migration | `d1b_a_picks_membership_correlation` on **war-room-pickem** (`success = true`) |
| Live policies | manage-own picks + pick_games: ownership **and** `is_league_member` on USING + WITH CHECK |
| Preserved | Commissioner reads league picks / pick_games (SELECT) |
| Helper | `is_league_member` **unchanged** (definition + grants) |
| Integrity | picks **7** · pick_games **35** · nonmember **0** · orphan **0** |
| Not claimed | D1B-B · D1B-C · D1C · H-01 · app · behavioral suite |

#### D1B-B · membership join authority

| Field | Value |
|-------|--------|
| Severity | **High** authorization defect |
| Status | **CONFIRMED HIGH AUTHORIZATION DEFECT / COORDINATED DESIGN REQUIRED** · not claimed repaired |
| Design | `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md` (architecture only; no join SQL) |
| Defect | Direct self INSERT + browser-only code join; open-room UUID without DB `is_open` |
| Next | Three narrow RPCs then drop/restrict client INSERT — **not now** |

#### D1B-C · achievements visibility

| Field | Value |
|-------|--------|
| Severity | Medium (read isolation) · **narrowest remaining isolation fix** |
| Status | **DESIGN + PREFLIGHT PACKAGE READY / APPLY NOT AUTHORIZED / NOT REPAIRED** |
| Design | `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` |
| Preflight | `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` · `supabase/D1B-C-preflight-SELECT-ONLY.sql` |
| SQL | `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql` (one SELECT policy only) |
| Defect | `"Members read achievements"` tautology / unqualified `league_id` in membership EXISTS |
| Rule | `public.is_league_member(achievements.league_id)` |
| Preserve | `"Commissioner grants achievements"` INSERT |
| Next | Live SELECT preflight → Mike **D1B-C only** auth → apply |
| Scope exclusion | No data mutation · no D1B-B · no D1C · no H-01 · no app |

### D1C · Crystal Ball lock / reveal / multi-authority defect

| Field | Value |
|-------|--------|
| Severity | **High** (write bypass after UI lock · multi-OR peer reveal · cross-sport hard-coded freezes · bot seed ignores lock) |
| Status | **DESIGN + NON-PRODUCTION SQL READY / EPHEMERAL TESTS NOT RUN / PRODUCTION APPLY BLOCKED / NOT REPAIRED** (**PARKED**) |
| Static map | `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md` |
| Remediation design | `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` (P1–P12 APPROVED) |
| S2 / S2b | Design + `supabase/review-only/D1C-S2B/*` — **not applied**; **do not test against production** |
| Next D1C work | Only if separately authorized: disposable Supabase · ephemeral S2b · platform_staff seed design · dual-read · prod preflight/apply |
| Apply | **Blocked** · not bundled with D1B-A |

### D-04 · `leagues` DELETE (product retired)

| Field | Value |
|-------|--------|
| Status | **VERIFIED ABSENT** (D1A) · **REGRESSION PASS** (0 DELETE policies) |
| Archive | `docs/D1A-VERIFICATION-NO-OP.md` |

---

## 3. Hardening findings (not claimed exploits)

| ID | Finding | Live (scrub) | Apply |
|----|---------|--------------|--------|
| **H-01** | SECURITY DEFINER client EXECUTE surface | **27** DEFINER · **14** anon · **27** authenticated · **11** PUBLIC · **0** missing proconfig | Split: **H-01A** selective REVOKE (design ready) · **H-01B** future defaults (design required) · **no mass REVOKE** · **no apply** |
| **H-01A** | Selective REVOKE on **live** functions only | Static matrix + scrub; 8 repo-referenced functions **absent live** | Design ready: `docs/H-01A-SELECTIVE-DEFINER-EXECUTE-DESIGN.md` · **SQL must not name absent functions** |
| **H-01B** | Auto-GRANT EXECUTE to anon/authenticated/service_role on **new** functions | Public default privileges (postgres / supabase_admin) | Design required: `docs/H-01B-FUTURE-DEFAULT-PRIVILEGES-DESIGN.md` · separate auth |
| **H-02** | `rls_forced = false` on leagues | Expected | No FORCE without product decision |
| **H-03** | Postseason tables | Still not applied (prior) | Separate PS auth |
| **H-05** | Mutable function `search_path` | **3** functions: `profiles_birthday_hard_lock`, `profile_favorite_teams_set_updated_at`, `leagues_sport_id_immutable` | Hardening only; separate auth |
| **H-06** | RLS enabled, no policy | `platform_odds_api_usage` | Classify grants/call sites; **do not** add permissive policy to silence advisor |
| **H-07** | Leaked-password protection **disabled** | Auth setting | Recommendation only; separate Mike auth before enable |

### H-01 anon-callable DEFINER list (14)

`clear_trial_bots`, `crystal_ball_lock_count`, `get_league_favorite_team_counts`, `handle_new_user`, `is_league_commissioner`, `is_league_member`, `is_league_ops`, `is_league_staff`, `reset_league_season`, `seed_bot_picks_for_week`, `seed_bot_sport_pool_votes`, `seed_trial_bots`, `set_member_moderation`, `transfer_commissioner`

**Not on anon list:** D-01 / D-02 / D-03 repaired RPCs.

### Policy tautology inventory (6)

1. `achievements.Members read achievements`  
2–5. `crystal_ball_picks` (upsert / frozen read / own read / update)  
6. `crystal_ball_result.Members read crystal result`  

### Global RLS / views (scrub)

- Public tables with RLS disabled: **0**  
- Public views: **0** · **PASS**

### Advisors summary

- Security notices: **46** (RLS/no-policy 1 · mutable search_path 3 · anon DEFINER 14 · authenticated DEFINER 27 · leaked-password 1)  
- Performance: unused indexes / multi-permissive policies / duplicate `league_trophies` index — **informational**; do not drop/merge during scrub  

---

## 4. Recommended repair order (updated)

| Order | Stage | Status |
|-------|--------|--------|
| 1 | D1A | **CLOSED** (absent / regression PASS) |
| 2 | D-01 | **STRUCTURALLY LIVE** · behavioral PENDING |
| 3 | D-02 | **STRUCTURALLY LIVE** · behavioral PENDING |
| 4 | D-03 | **STRUCTURALLY LIVE** · behavioral PENDING |
| 5 | **D1B-A** | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| **5b** | **D1B-C** | **Next scrub** — preflight package ready · await live SELECT + Mike auth |
| 5c | **D1B-B** | Membership/join authority — coordinated RPC + app (larger) |
| 6 | **H-01A** | Selective DEFINER EXECUTE cleanup |
| 6b | **H-01B** | Future default privileges |
| 7 | **D1C** | **Parked** until disposable testing + dependencies |
| 8 | Behavioral D-01 / D-02 / D-03 | Disposable identities only |
| 9 | H-05 / H-06 / H-07 | Advisor hardening (non-exploit) |
| 10 | PS | Postseason snapshots |

### Explicit non-goals until authorized

- Mass REVOKE / Auth leaked-password enable  
- Index drops / policy consolidation for performance advisors  
- Quick-patch D1C freezes  
- Behavioral suites on **real** identities  
- Bundling D1B-C with D1B-B / D1C / H-01  

---

## 5. Document index

| Doc | Role |
|-----|------|
| `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md` | Full scrub archive |
| `docs/H-01A-SELECTIVE-DEFINER-EXECUTE-DESIGN.md` | H-01A selective REVOKE design ready |
| `docs/H-01B-FUTURE-DEFAULT-PRIVILEGES-DESIGN.md` | H-01B future defaults (design required) |
| `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md` | D1B-A design (structurally repaired) |
| `docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md` | D1B-A live preflight PASS + apply-scope MATCH |
| `docs/D1B-A-APPLY-AUTHORIZATION.md` | D1B-A apply authorization (applied) |
| `docs/D1B-A-APPLY-VERIFICATION.md` | D1B-A production apply + post-verify archive |
| `supabase/D1B-A-preflight-SELECT-ONLY.sql` | D1B-A SELECT-only preflight |
| `supabase/D1B-A-APPLY-AUTHORIZED.sql` | D1B-A authorized apply (two policies) |
| `supabase/D1B-A-postverify-SELECT-ONLY.sql` | D1B-A post-verify SELECT-only |
| `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md` | D1B-B architecture |
| `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` | D1B-C design ready |
| `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` | D1B-C preflight + apply-scope (not applied) |
| `supabase/D1B-C-preflight-SELECT-ONLY.sql` | D1B-C SELECT-only preflight |
| `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md` | D1C static authority map (archived) |
| `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` | D1C remediation design REVIEW-ONLY (P1–P12 locked) |
| `docs/D1C-S2-EPHEMERAL-SCHEMA-POLICY-DESIGN.md` | D1C-S2 ephemeral/staging schema & policy design (not repaired) |
| `docs/D1C-S2B-NONPROD-SQL-DESIGN.md` | D1C-S2b non-prod SQL design |
| `docs/D1C-S2B-TEST-PLAN-AND-RESULTS.md` | D1C-S2b tests (NOT RUN) |
| `supabase/review-only/D1C-S2B/` | REVIEW-ONLY SQL package — do not apply live |
| `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql` | D1B-A policy SQL |
| `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql` | D1B-C policy SQL |
| `docs/D1A-VERIFICATION-NO-OP.md` | D1A closed |
| `docs/D-01-APPLY-VERIFICATION.md` | D-01 structural |
| `docs/D-02-APPLY-VERIFICATION.md` | D-02 structural |
| `docs/D-03-APPLY-SCOPE.md` / preflight / helper gate | D-03 |
| `docs/STRUCTURAL-HARDENING-D0-RLS.md` | D1A/B/C design |
| This file | Master register |

---

*End register — D1B-A LIVE/STRUCTURALLY REPAIRED; next narrow scrub D1B-C; D1B-B · D1C · H-01 still require separate Mike authorization.*
