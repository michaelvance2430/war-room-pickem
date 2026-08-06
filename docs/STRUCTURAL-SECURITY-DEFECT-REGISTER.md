# Structural / security defect register

**As of:** 2026-08-06 (updated after D1C P1–P12 product decisions locked)  
**Evidence chain:** P15–P18 · D1A · D-01–D-03 apply/regression · automated Supabase plugin scrub · D1C static authority map · **D1C P1–P12 LOCKED**  
**Mode:** Inspection / authorized repairs only  

**Production confirmation (automated scrub):** no SQL writes, no Auth/app/deploy changes during that sweep.  
**D1C docs package:** map + remediation design (decisions locked) — **no executable SQL · no app change · no prod apply · picks/results untouched · D1B/H-01 untouched**.  
**Archive:** `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md`

---

## 0. Regression dashboard (automated scrub)

| Item | Status |
|------|--------|
| **D1A** leagues DELETE retired | **REGRESSION PASS** (0 DELETE policies; RLS on; sport trigger enabled) |
| **D-01** `purge_locker_before` | **REGRESSION PASS** (anon EXECUTE false; structural repair intact) · behavioral PENDING |
| **D-02** eggs | **REGRESSION PASS** (catalog 20; no direct INSERT; anon EXECUTE false) · behavioral PENDING |
| **D-03** first join | **REGRESSION PASS** (anon EXECUTE false; INSERT uses `is_league_member`; 73 rows; 0 orphans) · behavioral PENDING |
| **D1B-A** picks/pick_games | **DESIGN READY / APPLY NOT AUTHORIZED** |
| **D1B-B** membership join | **CONFIRMED HIGH AUTHORIZATION DEFECT / COORDINATED DESIGN REQUIRED** |
| **D1B-C** achievements visibility | **DESIGN READY / APPLY NOT AUTHORIZED** |
| **D1C** Crystal Ball | **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS LOCKED (P1–P12) / NOT REPAIRED** · map archived · remediation design REVIEW-ONLY · no apply · no executable SQL |
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

**Data:** clean (picks 7 · nonmember 0 · memberships 77 · no cleanup). **Indexes:** existing uniques sufficient — **no new indexes**.

#### D1B-A · picks / pick_games correlation

| Field | Value |
|-------|--------|
| Severity | High (write isolation) · low apply risk for honest clients |
| Status | **DESIGN READY / APPLY NOT AUTHORIZED** · not claimed repaired |
| Design | `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md` |
| SQL | `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql` (policy-only) |
| Rule | Own pick + `is_league_member(league_id)`; pick_games via parent pick |

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
| Severity | Medium (read isolation) |
| Status | **DESIGN READY / APPLY NOT AUTHORIZED** · not claimed repaired |
| Design | `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` |
| SQL | `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql` |
| Rule | SELECT only if `is_league_member(achievements.league_id)` |

### D1C · Crystal Ball lock / reveal / multi-authority defect

| Field | Value |
|-------|--------|
| Severity | **High** (write bypass after UI lock · multi-OR peer reveal · cross-sport hard-coded freezes · bot seed ignores lock) |
| Status | **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS LOCKED (P1–P12) / NOT REPAIRED** |
| Static map | `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md` |
| Remediation design | `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` (REVIEW-ONLY; **P1–P12 APPROVED**; **no executable SQL**) |
| Tautologies | All listed `crystal_ball_picks` / `crystal_ball_result` member policies use `m.league_id = m.league_id` (**D1B correlation dependency — separate auth; not bundled**) |
| Authority | No non-internal CB triggers; app lock ≠ DB write gate; frozen-read mixes result · hard-coded `2026-08-29 16:00:00+00` · hard-coded `2026-09-10 16:00:00+00` · `week_results` week 0/1 |
| Extra | `crystal_ball_lock_count` DEFINER; anon+authenticated EXECUTE |
| Live data | ~7 `crystal_ball_picks` · 0 `crystal_ball_result` · **no cleanup authorized** · **picks/results untouched** |
| Product | **P1–P12 LOCKED** (same-instant lock+reveal; crown permanent reveal backstop; no score reveal; CFB calendar+kickoff; NFL fail-open writes/fail-closed peers; hard-deny bots; immutable crown via RPC; state table; retain leavers; season_year versioning later; parse fail rules) |
| Design target | Season-aware `crystal_ball_state`; DB-only security; narrow crown RPC; no year literals in RLS |
| Next | **D1C-S2** ephemeral/staging schema & policy design (still non-prod; not yet authored) |
| Apply | **Not authorized** · no quick-patch · do **not** bundle with D1B / H-01 |

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
| 5 | **D1B-A** | Picks correlation (design ready) |
| 5b | **D1B-C** | Achievements SELECT (design ready; separate apply) |
| 5c | **D1B-B** | Join RPCs + drop client INSERT (coordinated design) |
| 6 | **D1C** | Map archived · **P1–P12 LOCKED** · remediation design REVIEW-ONLY · next S2 ephemeral design · no SQL/apply |
| 7 | **H-01A** | Selective live REVOKE (design ready; auth pending) |
| 7b | **H-01B** | Future default privileges (design required separately) |
| 8 | H-05 / H-06 / H-07 | Advisor hardening (non-exploit) |
| 9 | PS | Postseason snapshots |

### Explicit non-goals until authorized

- Mass REVOKE / Auth leaked-password enable  
- Index drops / policy consolidation for performance advisors  
- Quick-patch D1C freezes  
- Behavioral suites on real identities  

---

## 5. Document index

| Doc | Role |
|-----|------|
| `docs/AUTOMATED-READONLY-SCRUB-SWEEP.md` | Full scrub archive |
| `docs/H-01A-SELECTIVE-DEFINER-EXECUTE-DESIGN.md` | H-01A selective REVOKE design ready |
| `docs/H-01B-FUTURE-DEFAULT-PRIVILEGES-DESIGN.md` | H-01B future defaults (design required) |
| `docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md` | D1B-A design ready |
| `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md` | D1B-B architecture |
| `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` | D1B-C design ready |
| `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md` | D1C static authority map (archived) |
| `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` | D1C remediation design REVIEW-ONLY (no executable SQL) |
| `supabase/D1B-A-picks-membership-REVIEW-ONLY.sql` | D1B-A policy SQL |
| `supabase/D1B-C-achievements-select-REVIEW-ONLY.sql` | D1B-C policy SQL |
| `docs/D1A-VERIFICATION-NO-OP.md` | D1A closed |
| `docs/D-01-APPLY-VERIFICATION.md` | D-01 structural |
| `docs/D-02-APPLY-VERIFICATION.md` | D-02 structural |
| `docs/D-03-APPLY-SCOPE.md` / preflight / helper gate | D-03 |
| `docs/STRUCTURAL-HARDENING-D0-RLS.md` | D1A/B/C design |
| This file | Master register |

---

*End register — automated scrub archived; repairs beyond D-01–D-03 require Mike authorization.*
