# D1C-S2B — Test Plan and Results

**Status:** Plan authored · **Execution: NOT RUN** (no disposable database in authoring environment)  
**Package:** `supabase/review-only/D1C-S2B/`  
**Date:** 2026-08-06

```
REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
```

---

## 1. Environment

| Item | Result |
|------|--------|
| Disposable local Postgres / Docker | **Not available** |
| Supabase CLI local | **Not available** |
| `psql` | **Not available** |
| Production Supabase | **Not used** (forbidden) |
| SQL package executed? | **No** |
| Auth.uid() multi-actor simulation | **Not available** |

**Honest blocker:** Full matrix requires a disposable Supabase/Postgres project with JWT role simulation (or `request.jwt.claim.sub` settings). Authoring machine had none safely configured.

---

## 2. Authored vs executed

| Artifact | Authored | Executed |
|----------|----------|----------|
| `01-schema.sql` … `04-rpc-*.sql` | Yes | **No** |
| `05-ephemeral-fixture-membership.sql` | Yes | **No** |
| `06-ephemeral-test-harness.sql` | Yes | **No** |
| `99-rollback-ephemeral.sql` | Yes | **No** |
| Synthetic seed recipe (below) | Yes | **No** |

---

## 3. Full matrix (all NOT_RUN unless noted)

| ID | Case | Expected | Status |
|----|------|----------|--------|
| STATIC-01 | No hard-coded year/date in CB policies | Zero matches for `2026-`, etc. | **NOT_RUN** |
| STATIC-02 | No `week_results` in CB policies | Zero | **NOT_RUN** |
| STATIC-03 | No membership tautologies | Zero `m.league_id = m.league_id` | **NOT_RUN** |
| T-UI-01 | Submit before lock | Success | **NOT_RUN** |
| T-API-02 | Raw INSERT after lock | Denied | **NOT_RUN** |
| T-API-03 | Upsert overwrite after lock | Denied | **NOT_RUN** |
| T-API-06 | Own pre-reveal read | Own row only | **NOT_RUN** |
| T-API-07 | Peer pre-reveal | Denied / empty | **NOT_RUN** |
| T-API-08 | Peer post-reveal | Visible | **NOT_RUN** |
| T-API-09 | Cross-league denial | No foreign rows | **NOT_RUN** |
| T-API-10 | Cross-sport isolation | No global date reveal | **NOT_RUN** |
| T-API-11 | Missing deadline | Writes open; peers private; warning | **NOT_RUN** |
| T-API-12 | Invalid schedule text | No clobber; warning | **NOT_RUN** |
| STICKY-01 | Set when unset | lock_at set | **NOT_RUN** |
| STICKY-02 | Reject later move | Unchanged | **NOT_RUN** |
| STICKY-03 | Earlier pre-lock automation | Moves earlier | **NOT_RUN** |
| STICKY-04 | Post-lock sticky | Immutable | **NOT_RUN** |
| T-API-13 | Deadline correction audit | Row in corrections | **NOT_RUN** |
| T-API-14 | Post-lock correction denied | Error immutable | **NOT_RUN** |
| T-API-15 | Bot pre-lock | Inserts | **NOT_RUN** |
| T-API-16 | Bot post-lock | Denied | **NOT_RUN** |
| T-API-17 | First crown | Success | **NOT_RUN** |
| T-API-18 | Re-crown | `already_crowned` | **NOT_RUN** |
| T-API-19 | Platform staff crown | Success if allowlisted | **NOT_RUN** |
| T-API-20 | Deputy crown | Denied | **NOT_RUN** |
| T-API-21 | Regular member crown | Denied | **NOT_RUN** |
| SEASON-01 | Explicit active year | Used over clock | **NOT_RUN** |
| SEASON-02 | Pre-season new league | State year stable | **NOT_RUN** |
| SEASON-03 | Active mid-season | Stable | **NOT_RUN** |
| SEASON-04 | Calendar-year rollover | Explicit year wins | **NOT_RUN** |
| SEASON-05 | NFL postseason next calendar year | Explicit year wins | **NOT_RUN** |
| SEASON-06 | CFB postseason next calendar year | Explicit year wins | **NOT_RUN** |
| SEASON-07 | Reset before next opening week | New year only if column advanced | **NOT_RUN** |
| SEASON-08 | Delayed commissioner setup | ensure_state works | **NOT_RUN** |
| SEASON-09 | Missing opening slate | warning; open writes | **NOT_RUN** |
| SEASON-10 | Historical state lookup | Prior season_year rows | **NOT_RUN** |
| SEASON-11 | Duplicate state creation | PK / no double | **NOT_RUN** |
| MIG-01 | Backfill no pick mutation | Fingerprint match | **NOT_RUN** |
| MIG-02 | Seven-pick zero mutation proof | Code + fingerprint | **NOT_RUN** (conceptual PASS by SQL review: no picks DML in backfill helpers) |
| RB-01 | Rollback leaves picks | Counts stable | **NOT_RUN** |

**Code-review only note (not a runtime pass):** `crystal_ball_apply_lock_candidate` / ensure_state / propose paths contain **no** `INSERT`/`UPDATE`/`DELETE` on `crystal_ball_picks`. That supports MIG-02 design intent but is **not** a substitute for ephemeral execution.

---

## 4. Synthetic seed recipe (for future disposable run)

```text
-- As service role on EPHEMERAL only:
1. Create profiles: member_a, member_b, bot_1, commish, deputy, platform_user
2. Insert platform_staff(platform_user)
3. Create league_cfb (sport cfb, active_competition_season_year = 2026, commissioner = commish)
4. Create league_nfl (sport nfl, same)
5. Memberships for all roles; deputy flag on deputy user
6. Insert crystal_ball_season_deadlines ('cfb', 2026, <future ts>)
7. Optional week_cards + card_games with ISO start_time
8. Insert 7 synthetic picks on league_cfb
9. Fingerprint picks
10. Run propose / ensure_state
11. Re-fingerprint
12. Run actor tests with JWT sub = each user
```

Do **not** export production UUIDs, emails, or pick text into fixtures.

---

## 5. How to record a future run

1. Apply `01`→`05` on disposable DB.  
2. Run seed recipe.  
3. Run `06` + actor scripts.  
4. `COPY d1c_s2b_tests.results TO ...`  
5. Update this file: set **Executed: Yes**, fill PASS/FAIL, attach ephemeral project id (not production).  
6. Never claim production repair from ephemeral PASS.

---

## 6. Declarations

| Statement | Status |
|-----------|--------|
| Ephemeral SQL actually executed | **No** |
| Every test PASS/FAIL/NOT_RUN | **All critical cases NOT_RUN** (see table) |
| Production unchanged | **Yes** |
| D1C not repaired | **Yes** |
