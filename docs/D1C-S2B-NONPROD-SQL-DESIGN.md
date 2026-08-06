# D1C-S2B — Non-Production REVIEW-ONLY SQL Design

**Status:** REVIEW ONLY · NON-PRODUCTION · **NOT AUTHORIZED FOR LIVE SUPABASE**  
**Date:** 2026-08-06  
**SQL path:** `supabase/review-only/D1C-S2B/`  
**Parents:** `docs/D1C-S2-EPHEMERAL-SCHEMA-POLICY-DESIGN.md` · `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` (P1–P12)  
**Classification:** D1C **NOT REPAIRED**

### Explicit non-actions

| Action | Status |
|--------|--------|
| Production SQL / Supabase live apply | **No** |
| App changes / deploy | **No** |
| Live-data backfill | **No** |
| Mutate ~7 production picks / results | **No** |
| D1B / H-01 package | **No** · **untouched** |
| Claim D1C repaired | **No** |

```
REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
```

---

## 1. Package inventory

| File | Role |
|------|------|
| `supabase/review-only/D1C-S2B/00-README.md` | Package gate |
| `01-schema.sql` | `platform_staff`, deadlines, state, audit tables, `leagues.active_competition_season_year` |
| `02-helpers.sql` | T5/T8 helpers, write/reveal, lock_state, sticky apply, propose |
| `03-policies.sql` | Correlated RLS + lock gates |
| `04-rpc-bot-crown-deadline.sql` | Bot gate, crown RPC, deadline correction |
| `05-ephemeral-fixture-membership.sql` | **Test fixture only** — not D1B production |
| `06-ephemeral-test-harness.sql` | Test result table + static checks |
| `99-rollback-ephemeral.sql` | Ephemeral rollback (no pick deletes) |
| `docs/D1C-S2B-TEST-PLAN-AND-RESULTS.md` | Matrix + execution status |

---

## 2. T8 inventory — platform authority (locked engineering)

### 2.1 Existing repo / live role surfaces

| Authority | Source | Scope | Safe for platform crown / deadline correction? |
|-----------|--------|-------|-----------------------------------------------|
| `leagues.commissioner_id` | Table column | One league | **Yes** for league-scoped crown only |
| `public.is_league_ops(league_id)` | Commish **OR** `memberships.is_deputy` | League | **No** for platform ops (deputies are not platform staff) |
| `public.is_league_staff(league_id)` | Commish **OR** `memberships.is_moderator` | League | **No** for platform deadline correction |
| `memberships.is_deputy` / `is_moderator` | Editable via commissioner moderation RPC | League | **No** — client-influenced staff flags |
| App `isOps()` | Session isCommissioner \|\| isDeputy | Client UI | **No** — not server authority |
| App Founder tools | Browser + membership, not DB allowlist | Product | **No** trusted SQL source found |
| Profiles / display name | User-editable | — | **No** |

**Conclusion:** **No suitable trusted platform-wide staff authority exists in live DB today.**  
S2b therefore introduces **`public.platform_staff`** + **`is_platform_staff()`**.

### 2.2 S2b implementation (safe default)

| Property | Design |
|----------|--------|
| Table | `platform_staff(user_id PK, note, created_at, created_by, revoked_at)` |
| Client write | **None** (no INSERT/UPDATE/DELETE policies for authenticated) |
| Helper | `is_platform_staff()` SECURITY DEFINER reads allowlist only |
| Crown | `is_league_commissioner_uid(league)` **OR** `is_platform_staff()` — **not** `is_league_ops` |
| Deadline correction | **`is_platform_staff()` only** — not commissioners (routine), not deputies |
| Empty allowlist | Platform paths **always fail** → prevents accidental deploy privilege escalation |
| Seed of UIDs | Future separate auth / service_role only — **not** in S2b apply to prod |

**Placeholder safety:** Until `platform_staff` is populated by a trusted offline process, production-like DBs behave as **commissioner-only crown** and **no deadline correction**.

---

## 3. T5 — season-year (locked engineering)

| Rule | Implementation |
|------|----------------|
| Not solely `now()` | `crystal_ball_resolve_season_year` order: `leagues.active_competition_season_year` → max state year → max `crystal_ball_season_deadlines` for sport → **clock last-resort only** |
| Explicit persist | New column `leagues.active_competition_season_year`; state PK includes `season_year` |
| Stable once created | State row PK fixed; ensure_state does not renumber year |
| Historical lookup | Query state by `(league_id, season_year)` |
| Duplicate creation | `ON CONFLICT DO NOTHING` / PK |

**Ephemeral cases to test (see test plan):** pre-season league, active season, calendar rollover, NFL/CFB postseason into next calendar year, reset before opening week, delayed setup, missing slate, historical rows, duplicate ensure.

---

## 4. Sticky deadline correction (locked)

| Actor | May |
|-------|-----|
| Automation `crystal_ball_apply_lock_candidate` | Set if unset; move **earlier** only if current lock not yet passed; **never later**; never null-clobber |
| Routine commissioner | **No** direct state timestamp edit |
| Platform staff pre-lock | `correct_crystal_ball_deadline` with reason ≥ 8 chars; audit row |
| Anyone post-lock | **No** (immutable); break-glass **out of S2b** |
| `reveal_at` | Set equal to `lock_at` on set/correct; never later-only drift |

Audit table: `crystal_ball_deadline_corrections` (old/new lock+reveal, reason, actor, time).

---

## 5. Object inventory (created / replaced in package)

### Tables

- `platform_staff`
- `crystal_ball_season_deadlines`
- `crystal_ball_state`
- `crystal_ball_deadline_corrections`
- `crystal_ball_result_repair_log` (schema only; no repair RPC)
- Column `leagues.active_competition_season_year`

### Functions

- `is_platform_staff()`
- `is_league_commissioner_uid(uuid)`
- `crystal_ball_resolve_season_year(uuid)`
- `crystal_ball_ensure_state(uuid, int)`
- `crystal_ball_is_write_open(uuid, int)`
- `crystal_ball_is_peers_revealed(uuid, int)`
- `crystal_ball_lock_state(uuid, int)`
- `crystal_ball_parse_iso_timestamptz(text)`
- `crystal_ball_opening_week_first_kickoff(uuid, int)`
- `crystal_ball_apply_lock_candidate(...)`
- `crystal_ball_propose_lock_from_schedule(uuid)`
- `seed_bot_crystal_ball_picks` (body with lock gate)
- `crown_crystal_ball_champion(uuid, text)`
- `correct_crystal_ball_deadline(...)`

### Policies (target)

| Table | Policies |
|-------|----------|
| `crystal_ball_state` | Member SELECT only |
| `crystal_ball_picks` | Own SELECT; peer SELECT if revealed; INSERT/UPDATE if write_open + member + owner |
| `crystal_ball_result` | Member SELECT; **no** client write |
| `crystal_ball_season_deadlines` | Authenticated SELECT |
| `platform_staff` | Self SELECT if active |
| `crystal_ball_deadline_corrections` | Platform staff SELECT |

### Untouched by design intent

- Existing production pick/result **row contents**
- D1B-A/B/C SQL
- H-01 grants mass changes

---

## 6. D1B dependency (not bundled)

| D1C policy | Requires correct correlation |
|------------|------------------------------|
| Own pick SELECT | `is_league_member(crystal_ball_picks.league_id)` |
| Peer SELECT | same + `crystal_ball_is_peers_revealed` |
| INSERT/UPDATE | same + write_open |
| Result SELECT | `is_league_member(crystal_ball_result.league_id)` |
| State SELECT | `is_league_member(crystal_ball_state.league_id)` |

Live tautologies (`m.league_id = m.league_id`) must be replaced.  
**S2b policies use the correct form.** Applying S2b `03-policies.sql` on production without a coordinated plan still **must not** happen under this package’s authorization.

**Fixture `05`:** optional ephemeral `is_league_member` if missing — labeled **not D1B production**.

---

## 7. Migration rehearsal (synthetic)

```text
1. Create synthetic profiles, leagues (cfb + nfl), memberships, bots
2. Insert N synthetic crystal_ball_picks (simulate "7")
3. Fingerprint: count + ordered hash of (league_id, user_id, team_name, picked_at)
4. Run state ensure + propose/backfill ONLY into crystal_ball_state
5. Re-fingerprint picks → MUST match
6. Demonstrate no SQL in backfill path targets crystal_ball_picks DML
```

Production ~7 picks: **zero mutation** when state-only backfill is used.

---

## 8. Rollback rehearsal (ephemeral)

1. Apply 01–04 on disposable DB.  
2. Insert synthetic picks + state.  
3. Run `99-rollback-ephemeral.sql` (drop policies/functions; optionally leave tables).  
4. Assert pick/result row counts unchanged.  
5. Document that production rollback would **re-apply archived legacy policies**, not this 99 file alone.

---

## 9. Dual-read (app — not in this package)

App still unchanged. Future: call `crystal_ball_lock_state`; UI advisory; DB enforces.

---

## 10. Remaining blockers before any production proposal

| Blocker | Notes |
|---------|--------|
| B1 | Disposable ephemeral DB validation of full auth matrix (currently environment missing) |
| B2 | Trusted process to populate `platform_staff` (empty-safe, but ops crown unusable until then) |
| B3 | Seed `crystal_ball_season_deadlines` for active season (data, not RLS literals) |
| B4 | Set `leagues.active_competition_season_year` for live leagues |
| B5 | Separate D1B membership correlation auth or ordered dual-auth with D1C |
| B6 | App dual-read PR |
| B7 | Production SELECT-only preflight + Mike apply auth |
| B8 | Confirm `published_at` / `start_time` types match parse helpers on live schema |
| B9 | Decide whether REPLACE of live `seed_bot_crystal_ball_picks` is same-tx as policies |
| B10 | Post-lock break-glass + crown repair still separate packages |

---

## 11. Environment note (authoring session)

| Tool | Available in authoring environment? |
|------|-------------------------------------|
| Local Docker Postgres | **No** |
| Supabase CLI | **No** |
| `psql` | **No** |
| Production Supabase | **Must not use** |

**Ephemeral SQL execution:** **NOT RUN** against any database in the authoring session.  
Package is authored for future disposable runs only.

---

## 12. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged | **Yes** |
| D1C repaired | **No** |
| Live picks/results mutated | **No** |
| D1B / H-01 untouched | **Yes** |
| Executable production apply authorized | **No** |
| Review-only SQL authored under `supabase/review-only/D1C-S2B/` | **Yes** |
