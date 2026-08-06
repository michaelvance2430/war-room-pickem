# Structural / security defect register

**As of:** 2026-08-06 (updated after D1B-B **fair-entry revision — disposable ready**)  
**Evidence chain:** P15–P18 · D1A · D-01–D-03 · scrub · D1C parked · D1B-A/C repaired · D1B-B preflight · B1–B6 · REVIEW-ONLY SQL · **FE parity revision**  
**Mode:** Inspection / authorized repairs only  

**Production confirmation:** D1B-A + D1B-C repaired. D1B-B **not applied**. No D1C / H-01 apply.  
**D1B-A / D1B-C:** **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS**.  
**D1B-B:** **REVIEW-ONLY PACKAGE REVISED / DISPOSABLE READY / NO PRODUCTION APPLY / NOT REPAIRED**.  
**D1C:** parked — **not repaired**.  
**Archive:** `docs/D1B-B-REVIEW-ONLY-SOURCE-AUDIT.md` · `docs/D1B-B-FAIR-ENTRY-SERVER-PARITY.md` · `supabase/review-only/D1B-B/02b-fair-entry.sql`

---

## 0. Regression dashboard (automated scrub)

| Item | Status |
|------|--------|
| **D1A** leagues DELETE retired | **REGRESSION PASS** (0 DELETE policies; RLS on; sport trigger enabled) |
| **D-01** `purge_locker_before` | **REGRESSION PASS** (anon EXECUTE false; structural repair intact) · behavioral PENDING |
| **D-02** eggs | **REGRESSION PASS** (catalog 20; no direct INSERT; anon EXECUTE false) · behavioral PENDING |
| **D-03** first join | **REGRESSION PASS** (anon EXECUTE false; INSERT uses `is_league_member`; 73 rows; 0 orphans) · behavioral PENDING |
| **D1B-A** picks/pick_games | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| **D1B-B** membership join | **REVIEW-ONLY REVISED / DISPOSABLE READY** · no prod apply · **not repaired** |
| **D1B-C** achievements visibility | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
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
| Severity | **High** — broader than join-only (INSERT privilege injection · row-wide UPDATE · public join codes) |
| Status | **REVIEW-ONLY PACKAGE REVISED / DISPOSABLE READY / NOT REPAIRED** |
| Design | `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md` |
| Product freeze + map | `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md` |
| REVIEW-ONLY SQL | `supabase/review-only/D1B-B/` including **02b-fair-entry.sql** |
| Source audit | `docs/D1B-B-REVIEW-ONLY-SOURCE-AUDIT.md` |
| Fair-entry | Server freeze table + percentile parity (no localStorage authority) |
| Fixes | Sport allowlist live-only · cut_percent persisted · d1b_b_raise VOLATILE |
| Disposable | Guide ready; JWT suite **NOT_RUN** |
| Next | Execute disposable suite; then separate Mike auth for prod stage-6 |
| Scope exclusion | No live apply · no H-01 · no D1C |

#### D1B-C · achievements visibility

| Field | Value |
|-------|--------|
| Severity | Medium (read isolation) — **closed structurally** |
| Status | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| Design | `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` |
| Live preflight | `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` §0 — **PASS** |
| Apply verification | `docs/D1B-C-APPLY-VERIFICATION.md` |
| Migration | `d1b_c_achievements_visibility_correlation` on **war-room-pickem** (`success = true`) |
| Live policy | Members read: `is_league_member(league_id)` — tautology **gone** |
| Preserved | Commissioner grants INSERT (correlated) |
| Helper | `is_league_member` **unchanged** (definition + grants; H-01 inventory separate) |
| Integrity | achievement_rows **0** before/after |
| Not claimed | D1B-B · D1C · H-01 · app |

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

### Policy tautology inventory

| Item | Status |
|------|--------|
| `achievements.Members read achievements` | **REPAIRED** (D1B-C — uses `is_league_member`) |
| `crystal_ball_picks` (upsert / frozen / own / update) | **Open** — D1C / CB correlation later |
| `crystal_ball_result.Members read crystal result` | **Open** — D1C later |

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
| 5b | **D1B-C** | **LIVE / STRUCTURALLY REPAIRED / POST-VERIFY PASS** |
| **5c** | **D1B-B** | REVIEW-ONLY revised · disposable ready · **not repaired** · no prod |
| 6 | **H-01A** | Selective live-function EXECUTE cleanup |
| 6b | **H-01B** | Safe future default privileges |
| 7 | Behavioral D-01 / D-02 / D-03 | Disposable identities only |
| 8 | **D1C** | **Parked** until disposable env + dependencies |
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
| `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md` | D1B-B architecture (coordinated; not repaired) |
| `docs/D1B-B-PREFLIGHT-AND-DESIGN-SCOPE.md` | D1B-B live preflight §0 |
| `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md` | D1B-B B1–B6 + call sites + RPC contracts |
| `docs/D1B-B-REVIEW-ONLY-SQL-PACKAGE.md` | D1B-B REVIEW-ONLY SQL index (not applied) |
| `docs/D1B-B-REVIEW-ONLY-SOURCE-AUDIT.md` | D1B-B source/SQL audit |
| `docs/D1B-B-FAIR-ENTRY-SERVER-PARITY.md` | Fair-entry server parity design (blocker) |
| `docs/D1B-B-DISPOSABLE-EXECUTION-GUIDE.md` | Disposable test guide |
| `docs/D1B-B-TEST-MATRIX.md` | Test matrix NOT_RUN |
| `supabase/review-only/D1B-B/` | D1B-B REVIEW-ONLY SQL files |
| `supabase/D1B-B-preflight-SELECT-ONLY.sql` | D1B-B SELECT-only preflight |
| `docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md` | D1B-C design ready |
| `docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md` | D1B-C live preflight PASS + apply-scope MATCH |
| `docs/D1B-C-APPLY-AUTHORIZATION.md` | D1B-C apply authorization (applied) |
| `docs/D1B-C-APPLY-VERIFICATION.md` | D1B-C production apply + post-verify archive |
| `supabase/D1B-C-preflight-SELECT-ONLY.sql` | D1B-C SELECT-only preflight |
| `supabase/D1B-C-APPLY-AUTHORIZED.sql` | D1B-C authorized apply (one SELECT policy) |
| `supabase/D1B-C-postverify-SELECT-ONLY.sql` | D1B-C post-verify SELECT-only |
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

*End register — D1B-A + D1B-C LIVE/STRUCTURALLY REPAIRED; D1B-B next (preflight only); D1C parked; H-01 later.*
