# D1C-S2 — Ephemeral / Staging Schema & Policy Design

**Status:** DESIGN ONLY · **EPHEMERAL/STAGING SCOPE** · **NOT AUTHORIZED FOR PRODUCTION APPLY**  
**Date:** 2026-08-06  
**Parent decisions:** `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` (P1–P12 **LOCKED**)  
**Evidence map:** `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md`  
**Register:** `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`  
**Classification:** D1C remains **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS LOCKED / NOT REPAIRED**

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Create executable production SQL | **No** |
| Apply any SQL (prod or live) | **No** |
| Change application code | **No** |
| Deploy | **No** |
| Modify picks, results, leagues, schedules, memberships | **No** |
| Change live RLS, grants, functions, triggers, tables | **No** |
| Bundle or implement D1B / H-01 | **No** · **untouched** |
| Claim D1C repaired | **No** |

**This document is the S2 deliverable.** Appendix pseudocode is **DESIGN ONLY** and is **not** an apply script.

**Production remains unchanged.**

---

## 1. Purpose of S2

Translate locked P1–P12 into a complete **ephemeral/staging-ready design** for:

1. Season-aware `public.crystal_ball_state`  
2. Server-authoritative lock/reveal helpers  
3. League-correlated RLS (no tautologies, no year literals, no `week_results` reveal)  
4. Post-lock write denial (human + bot)  
5. Narrow crown RPC (commissioner + verified ops)  
6. First-crown immutability + separate audited correction concept  
7. Schedule normalization + sticky `lock_at`  
8. Staged app dual-read migration  
9. Backfill without touching ~7 live picks  
10. Rollback + disposable behavioral testing  
11. T1–T12 technical recommendations  
12. Exact D1B dependency without bundling  

**Target environment for first implementation experiments:** ephemeral Supabase project or isolated staging clone — **never** production until a later, separately authorized stage.

---

## 2. Required technical properties (checklist)

| Property | Design enforcement |
|----------|-------------------|
| Database is final authority | Policies + DEFINER body gates read only `crystal_ball_state` / helpers; UI is advisory |
| Keyed by `league_id + season_year` | PK on `crystal_ball_state` |
| Separate `lock_at` / `reveal_at` | Both `timestamptz`; default equal |
| Default `reveal_at = lock_at` | Persist rule + CHECK optional |
| Missing/invalid schedule → writes open, peers private | Null `lock_at` ⇒ write open, peer closed |
| Valid persisted `lock_at` sticky | Update path refuses invalid/null clobber |
| PostgREST cannot bypass lock | INSERT/UPDATE RLS uses `is_write_open` |
| Bots obey production lock | `seed_bot_crystal_ball_picks` same gate |
| Crown permanently reveals; no reopen writes | Helper OR crown; write gate ignores crown for reopen |
| First crown immutable ordinary paths | No client UPSERT; RPC insert-only if absent |
| No hard-coded year/date in permanent RLS | Policies call helpers only |
| No `week_results` reveal shortcut | Omitted from peer SELECT |
| No membership tautologies | Always `m.league_id = <table>.league_id` or `is_league_member(row.league_id)` |
| Current picks/results untouched | S2 design / future backfill state only |
| D1B / H-01 separate | Risk register §15 |

---

## 3. Schema design — `public.crystal_ball_state`

### 3.1 Table purpose

One **authoritative** lock/reveal record per league per season. Clients may **read** (when permitted). Clients must **not** invent or directly write `lock_at` / `reveal_at`.

### 3.2 Columns (target)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `league_id` | `uuid` | NOT NULL | FK → `public.leagues(id)` ON DELETE CASCADE |
| `season_year` | `integer` | NOT NULL | e.g. 2026; sport-season identity (T5) |
| `lock_at` | `timestamptz` | NULL | Authoritative write-close; NULL = no lock yet (P5/P12) |
| `reveal_at` | `timestamptz` | NULL | Authoritative peer-read; default set equal to `lock_at` (P1) |
| `lock_source` | `text` | NOT NULL default `'unset'` | Enumerated values (below) |
| `lock_reason` | `text` | NULL | Human-readable detail |
| `reveal_source` | `text` | NULL | Usually mirrors lock; optional override later |
| `schedule_warning` | `boolean` | NOT NULL default `false` | Ops signal (P5, P12) |
| `schedule_warning_code` | `text` | NULL | e.g. `no_published_slate`, `unparseable_kickoff`, `missing_cfb_calendar` |
| `proposed_kickoff_at` | `timestamptz` | NULL | Last successfully **parsed** kickoff candidate (audit; not security alone) |
| `proposed_calendar_at` | `timestamptz` | NULL | Last known CFB calendar candidate (audit) |
| `authority_version` | `integer` | NOT NULL default `1` | Bump when automation rewrites under allowed rules |
| `created_at` | `timestamptz` | NOT NULL default `now()` | Audit |
| `updated_at` | `timestamptz` | NOT NULL default `now()` | Audit |
| `created_by` | `uuid` | NULL | `auth.uid()` or null for system |
| `updated_by` | `uuid` | NULL | Actor of last authority write |

**Primary key:** `(league_id, season_year)`  

**Optional CHECK (recommended):**  
`(lock_at IS NULL AND reveal_at IS NULL) OR (lock_at IS NOT NULL AND reveal_at IS NOT NULL AND reveal_at >= lock_at)`  
Initial product: `reveal_at = lock_at` always when set.

### 3.3 `lock_source` vocabulary

| Value | Meaning |
|-------|---------|
| `unset` | Row exists but no validated lock |
| `nfl_w1_kickoff` | Persisted from formally published Week 1 first kickoff |
| `cfb_calendar` | Only calendar arm was valid |
| `cfb_w0_kickoff` | Only Week 0 kickoff arm was valid |
| `cfb_min_calendar_kickoff` | Earlier of both arms |
| `manual_ops` | Explicit authorized ops set (rare; auditable) |
| `backfill` | One-time production backfill |

### 3.4 Supporting calendar table (T1 recommendation)

**Name:** `public.crystal_ball_season_deadlines`

| Column | Type | Notes |
|--------|------|-------|
| `sport_id` | `text` | `cfb` / `nfl` (NFL row optional; product uses kickoff primarily) |
| `season_year` | `integer` | |
| `lock_at` | `timestamptz` | Server-owned CFB (or sport) calendar deadline |
| `label` | `text` | Display |
| `created_at` / `updated_at` | `timestamptz` | |

**PK:** `(sport_id, season_year)`  

**RLS:** members may SELECT; only service role / narrow founder ops may write. **Policies never embed year literals** — they JOIN this table via sport + year.

### 3.5 Interim season versioning (P11 / T10)

| Phase | Picks / result | State |
|-------|----------------|-------|
| **S2–S8 (first production path)** | Existing tables **unversioned** (current PK) | `crystal_ball_state` **is** season-keyed |
| **Later authorized migration** | Add `season_year` to picks/result | Align historical rows |

S2 design **must not** migrate the ~7 live picks. Current season state row uses `season_year` from T5; picks remain global-per-league until P11 migration.

### 3.6 Result table posture (P7/P8 — design)

| Current | Target |
|---------|--------|
| Client UPSERT via `FOR ALL` commissioner policy | **No** broad client write |
| | Insert **only** via `crown_crystal_ball_champion` RPC |
| | Direct UPDATE/DELETE denied for `authenticated` |
| | Repair via separate future RPC |

Optional future columns on result (later migration): `season_year`, `crowned_by`, immutable after insert. Not required to touch live rows in S2.

### 3.7 Crown audit / correction concept (P7 — design only)

**Table (future package):** `public.crystal_ball_result_repair_log`

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `league_id`, `season_year` | Scope |
| `previous_champion_team`, `new_champion_team` | Diff |
| `reason` | Required non-empty |
| `repaired_by`, `repaired_at` | Actor + time |
| `ticket_or_ref` | Optional |

**Ordinary crown path never writes this table.** Repair RPC is a **separate authorized design** after first crown RPC ships.

---

## 4. Server-authoritative helpers

All permanent RLS and bot/crown gates call these helpers. **No** policy-local date literals or `week_results` branches.

### 4.1 `crystal_ball_current_season_year(p_league_id uuid) → int` (T5)

**Recommendation:**  
- Prefer league sport + platform calendar: CFB season year = year of CFB calendar row in force, else `extract(year from now())` with documented cutover (e.g. after final).  
- Align with app `defaultSeasonYear()` for dual-read parity.  
- Pure SQL or stable DEFINER reading `crystal_ball_season_deadlines` + `leagues.sport_id`.

### 4.2 `crystal_ball_is_write_open(p_league_id uuid, p_season_year int default null) → boolean`

```text
IF NOT is_league_member(p_league_id) → false (for policy use; bots checked separately)
sy := coalesce(p_season_year, crystal_ball_current_season_year(p_league_id))
state := row from crystal_ball_state where league_id = p_league_id and season_year = sy
IF state.lock_at IS NOT NULL AND now() >= state.lock_at → false
-- Crown does NOT reopen writes (P2)
IF crystal_ball_result exists for league (and season when versioned) → still false only for writes after lock;
   if lock_at is NULL and crown exists: still deny new picks? Product: crown implies season complete → DENY writes
IF lock_at IS NULL → true (P5/P12 fail-open submissions) unless feature disabled
ELSE true when now() < lock_at
```

**Feature off:** if `leagues.crystal_ball_enabled = false`, write open false (or app hides UI; DB may still deny).

### 4.3 `crystal_ball_is_peers_revealed(p_league_id uuid, p_season_year int default null) → boolean`

```text
sy := coalesce(...)
state := crystal_ball_state row
IF crystal_ball_result exists for league[/season] → true  -- P2 permanent backstop
IF state.reveal_at IS NOT NULL AND now() >= state.reveal_at → true
ELSE false   -- null reveal_at ⇒ private (P5/P12 fail-closed peers)
-- NEVER consult week_results
-- NEVER parse card_games.start_time here
```

### 4.4 `crystal_ball_lock_state(p_league_id uuid, p_season_year int default null) → record`

Returns for app dual-read:

| Field | Source |
|-------|--------|
| `sport_id` | `leagues.sport_id` |
| `season_year` | resolved |
| `lock_at`, `reveal_at` | state |
| `is_locked` | `lock_at IS NOT NULL AND now() >= lock_at` |
| `is_write_open` | helper |
| `is_peers_revealed` | helper |
| `lock_source`, `lock_reason` | state |
| `schedule_warning`, `schedule_warning_code` | state |
| `kickoff_known` | `proposed_kickoff_at IS NOT NULL` or source in kickoff set |
| `crowned` | result exists |
| `champion_team` | optional |

**SECURITY:** Prefer `SECURITY INVOKER` + RLS on state, **or** `SECURITY DEFINER` with `search_path = public` that only returns fields if `is_league_member(p_league_id)`. Do not leak other leagues’ state.

### 4.5 Schedule normalization (T2, T3, T4) — sticky persist

**Function concept:** `crystal_ball_propose_lock_from_schedule(p_league_id uuid)`  
Callable by: service role, publish-card hook DEFINER, or scheduled job — **not** ordinary clients.

#### Formally published card (T2)

```text
week_cards row for league + opening week (CFB: 0, NFL: 1)
  AND published_at IS NOT NULL AND length(trim(published_at)) > 0
  AND EXISTS card_games for that week_card_id
```

#### Valid kickoff parse (T3)

Only promote to `timestamptz` if `start_time` matches ISO-like pattern, e.g.:

```text
^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}
```

Reject free-text `"Sat 3pm"`, empty, null. Use `min(start_time::timestamptz)` among valid games only.

#### CFB proposal (P4)

```text
cal := crystal_ball_season_deadlines.lock_at for sport cfb + season_year
kick := min valid W0 kickoff if formally published else null
IF cal IS NULL AND kick IS NULL → no lock write; schedule_warning = true; code missing
IF both valid → lock_at = LEAST(cal, kick); source = cfb_min_calendar_kickoff
IF only cal → lock_at = cal; source = cfb_calendar
IF only kick → lock_at = kick; source = cfb_w0_kickoff
reveal_at := lock_at
```

#### NFL proposal (P5)

```text
kick := min valid W1 kickoff if formally published else null
IF kick IS NULL → do not set lock_at; schedule_warning = true; code no_published_slate
ELSE lock_at = kick; reveal_at = kick; source = nfl_w1_kickoff; clear warning if previously only missing slate
```

#### Sticky rules (P5, P12)

```text
IF existing.lock_at IS NOT NULL:
  IF new_candidate IS NULL OR invalid → KEEP existing; may set warning; never null out
  IF new_candidate IS NOT NULL:
    -- Product: first valid lock is sticky against "later client drift"
    -- Allowed automation refresh ONLY if new_candidate is strictly earlier AND still from formal publish
    --    (optional product refinement for slate correction before lock fires)
    -- Default S2 recommendation: STICKY = never replace existing.lock_at once set,
    -- except manual_ops / explicit repair with audit
    KEEP existing.lock_at
ELSE:
  IF new_candidate valid → INSERT/UPDATE lock_at, reveal_at = lock_at
```

**S2 default recommendation (T4 sticky policy):** Once a validated `lock_at` is written, automation **does not** overwrite it. Pre-lock slate corrections that must move the deadline require **ops-authorized** update with reason. This maximizes P5 “must not drift” and simplifies security proofs.

### 4.6 Opening-week scored (P3)

- **Not** in write/reveal helpers.  
- Optional: `crystal_ball_ops_deadline_missed_warning` for dashboards only if scored week exists while `lock_at` was null past a soft threshold — **never** security.

---

## 5. RLS policy design (league-correlated)

**Prerequisite note:** Live policies use membership tautologies. **Correct correlated form is required for D1C security.** Prefer applying **D1B-style correlation** first or in the same production window under **two explicit authorizations** (see §15). Design below assumes correlation helpers are correct.

### 5.1 Helper preference

```text
is_league_member(target_league_id uuid)  -- existing shared helper (D-03)
-- Policies: is_league_member(crystal_ball_picks.league_id)
-- NEVER: exists (select 1 from memberships m where m.league_id = m.league_id ...)
```

### 5.2 `crystal_ball_state`

| Policy | Command | Rule |
|--------|---------|------|
| Members read own league state | SELECT | `is_league_member(league_id)` |
| No client insert/update/delete | — | No policies for authenticated write; service/DEFINER only |

### 5.3 `crystal_ball_picks`

| Policy | Command | Rule |
|--------|---------|------|
| Members read own | SELECT | `user_id = auth.uid()` AND `is_league_member(crystal_ball_picks.league_id)` |
| Members read peers when revealed | SELECT | `is_league_member(crystal_ball_picks.league_id)` AND `crystal_ball_is_peers_revealed(crystal_ball_picks.league_id)` |
| Users insert own when open | INSERT | `user_id = auth.uid()` AND `is_league_member(league_id)` AND `crystal_ball_is_write_open(league_id)` |
| Users update own when open | UPDATE | USING: owner + member + write_open; WITH CHECK: same |

**Explicit removals from live intent:**

- Hard-coded `2026-08-29` / `2026-09-10`  
- `week_results` week 0/1 OR branch  
- Unqualified `m.league_id = league_id` tautologies  

**DELETE:** No client DELETE for normal members (P10 retain). Admin wipe only via existing DEFINER season reset (scope redesign later under P11).

### 5.4 `crystal_ball_result`

| Policy | Command | Rule |
|--------|---------|------|
| Members read result | SELECT | `is_league_member(crystal_ball_result.league_id)` |
| Client insert/update/delete | **None** for authenticated | Writes only via crown / repair RPCs |

Drop or replace live `"Commissioner crowns champion" FOR ALL`.

### 5.5 Achievements (crown side-effect)

Crown RPC inserts achievements as DEFINER or under existing commissioner insert policy. Prefer RPC-owned insert to avoid dual paths. D1B-C visibility remains separate workstream.

### 5.6 `crystal_ball_lock_count`

Keep DEFINER count for sealed pick count; body must use membership on `p_league_id`. EXECUTE grants are **H-01** territory — do not change in D1C apply without H-01 auth. Note only.

---

## 6. Post-lock write denial — human and bot

### 6.1 Human path

| Layer | Behavior |
|-------|----------|
| RLS INSERT/UPDATE | `crystal_ball_is_write_open` |
| App `saveCrystalBallPick` | Dual-read: show error early; **must not** treat UI as enforcement |
| Raw PostgREST upsert after lock | **Denied** (B2/B3 matrix) |

### 6.2 Bot path (P6)

**`seed_bot_crystal_ball_picks` body (target):**

```text
1. auth.uid() not null
2. caller is commissioner of p_league_id
3. crystal_ball_is_write_open(p_league_id) = true
   -- if false: return { ok: false, error: 'Crystal Ball locked' }
4. existing bot membership checks
5. insert ... on conflict do update  -- only when step 3 passed
```

Also gate pad-bots / founder one-click in app later so they do not claim success on denial.

**Foundry override:** out of scope; requires isolation design + separate auth. Production function has **no** “force” parameter.

### 6.3 Service / founder

No silent bypass. Emergency pick mutation = future audited repair (like crown repair), not seed RPC flags.

---

## 7. Narrow crown RPC (P8) + immutability (P7)

### 7.1 `crown_crystal_ball_champion(p_league_id uuid, p_champion_team text)`

**Type:** `SECURITY DEFINER`, `search_path = public`, revoke PUBLIC, grant EXECUTE to `authenticated` only (H-01 may later tighten).

**Algorithm:**

```text
v_uid := auth.uid()
IF v_uid IS NULL → error not authenticated

v_is_commish := exists leagues where id = p_league_id and commissioner_id = v_uid
v_is_ops := public.is_league_ops(p_league_id) OR platform staff helper (T8)
IF NOT (v_is_commish OR v_is_ops) → error forbidden

IF trim(p_champion_team) = '' → error

IF exists crystal_ball_result for p_league_id [and season] →
  error already_crowned   -- P7 immutable ordinary path

INSERT crystal_ball_result (league_id, champion_team, crowned_at, crowned_by)
VALUES (p_league_id, team, now(), v_uid)

-- Optional: grant achievements to correct pickers (same as app today)
-- Does NOT update crystal_ball_state.lock_at / reveal_at (P2)
-- Peers become readable via is_peers_revealed (result exists)

RETURN { ok, winners_count }
```

### 7.2 Separate correction concept (not implemented in first apply)

```text
repair_crystal_ball_champion(
  p_league_id, p_new_team, p_reason text
)
-- requires elevated platform role + non-empty reason
-- updates result + writes crystal_ball_result_repair_log
-- re-evaluates achievements carefully (product follow-on)
-- SEPARATE design + Mike auth
```

### 7.3 App closeout alignment

`grantCrystalBallForChampion` / season-closeout must call **RPC**, not table upsert, once live.

---

## 8. Schedule automation placement (T4)

| Trigger | Action |
|---------|--------|
| Week card publish (opening week) | Call propose/persist helper for that league |
| Season deadlines table upsert | Re-run propose for all leagues of that sport/year with **sticky** rules |
| Nightly cron (optional) | Set/clear `schedule_warning` only; do not clobber sticky lock |
| One-shot backfill (S7) | Fill state for existing leagues without touching picks |

---

## 9. Staged app dual-read migration

### Stage A — Read only (no security claim)

1. Add client wrapper `fetchCrystalBallLockState(leagueId)` → RPC.  
2. `loadCrystalBall` / page countdown prefer RPC fields when present.  
3. Fallback to legacy `resolveCrystalBallLock` if RPC missing/errors.  
4. Log divergence (lock_at / locked flag mismatch) for one release.

### Stage B — Soft save gate

1. `saveCrystalBallPick` checks RPC `is_write_open` first.  
2. Still relies on DB deny after enforcement apply.  
3. Bot tools show RPC-denied errors.

### Stage C — Enforcement live (after S8)

1. Legacy resolver **display-only** or deleted.  
2. Full board query only when `is_peers_revealed`.  
3. Crown UI calls crown RPC only.  
4. Remove hard-coded CFB/NFL security dates from app security paths.

### Stage D — Cleanup

1. Delete dual-read flag.  
2. Update `scripts/verify-crystal-ball-states.mjs` for RPC contract.  
3. Ops UI for `schedule_warning`.

**UI must never be described as the enforcement boundary** in product copy after Stage C.

---

## 10. Backfill strategy (existing leagues; picks untouched)

### 10.1 Goals

- Insert `crystal_ball_state` for every active league × current `season_year`.  
- Populate `lock_at`/`reveal_at` when schedule/calendar valid.  
- Set warnings when not.  
- **Zero** INSERT/UPDATE/DELETE on `crystal_ball_picks`.  
- **Zero** writes on `crystal_ball_result` (currently 0 rows).

### 10.2 Steps (production later — SELECT-only preflight first)

1. **Preflight SELECT:** league ids, sports, count picks (~7), count results (0), sample `start_time` formats, existing CB policies.  
2. Ensure `crystal_ball_season_deadlines` has CFB 2026 (or current) row **via data**, not RLS literals.  
3. For each league: run propose algorithm once; insert state row.  
4. Verify sticky: re-run backfill → no lock_at change if already set.  
5. Verify pick checksum: `count(*)`, `md5(string_agg(...))` identical before/after.

### 10.3 Leagues with no slate yet

`lock_at` null, `schedule_warning` true — matches P5/P12.

---

## 11. Migration stages (end-to-end)

| Stage | Name | Environment | Touches picks? |
|-------|------|-------------|----------------|
| S0 | Authority map archive | docs | No |
| S1 | P1–P12 locked | docs | No |
| **S2** | **This design** | docs | No |
| S2b | Optional: author non-prod REVIEW-ONLY SQL from appendix | repo / ephemeral | No |
| S3 | Ephemeral Supabase apply + matrix | ephemeral | Synthetic data only |
| S4 | App dual-read PR | app deploy separate | No |
| S5 | Production SELECT-only preflight | prod read | No |
| S6 | Prod apply: tables + helpers + (correlated) policies + crown RPC + bot gate | **Mike auth** | No |
| S7 | Prod backfill state | **Mike auth** | No |
| S8 | Confirm enforcement; disable dual-read security fallback | prod | No |
| S9 | Remove legacy RLS dates / app-only authority | prod + app | No |
| S10 | Disposable behavioral tests | controlled | No |
| Later | P11 season_year on picks/result | own plan | **Migration plan required** |
| Later | Crown repair RPC | own plan | No ordinary picks |
| Later | Foundry bot override isolation | own plan | Isolated only |

**D1B correlation:** preferred **before** S6 peer-privacy guarantees; see §15.

---

## 12. Rollback strategy

| Layer | Action |
|-------|--------|
| Pre-apply | Archive live policy defs, function defs, grants (SELECT catalog) |
| Policies | Restore archived CB pick/result policies from archive |
| New tables | Leave in place inert **or** DROP if no app dependency |
| Helpers/RPC | `CREATE OR REPLACE` prior versions from git |
| Bot function | Restore prior `seed_bot_crystal_ball_picks` |
| Crown | If RPC breaks closeout: temporary emergency only with Mike auth — avoid re-enabling silent UPSERT re-crown |
| App dual-read | Flag off → legacy display resolver |
| Backfill | State rows can be deleted; picks never needed restore if untouched |

**Do not** re-introduce hard-coded 2026 policy dates on rollback unless Mike explicitly accepts regression.

---

## 13. Test matrix (UI + raw API bypass)

### 13.1 Environment

Ephemeral DB with synthetic leagues: CFB with calendar+W0, CFB calendar-only, NFL with W1, NFL without slate, two leagues same sport (isolation), bot members, ops user, commissioner, plain member, nonmember.

### 13.2 Cases

| ID | Actor / path | Setup | Expected |
|----|--------------|-------|----------|
| T-UI-01 | Member UI save | before lock | Success |
| T-UI-02 | Member UI save | after lock_at | Denied in UI |
| T-API-01 | Member raw upsert | before lock | Success |
| T-API-02 | Member raw upsert | after lock | **Denied** (RLS) |
| T-API-03 | Member raw upsert change team | after lock | **Denied** — no overwrite |
| T-API-04 | Nonmember SELECT peers | any | Empty / denied |
| T-API-05 | Nonmember INSERT | any | Denied |
| T-API-06 | Member SELECT peers | lock_at null | Own only |
| T-API-07 | Member SELECT peers | now >= reveal_at | Full board |
| T-API-08 | Member SELECT peers | other league revealed | **No** cross-league rows |
| T-API-09 | CFB league after NFL-only calendar would have fired (old bug) | only CFB state | Isolated — no global date |
| T-API-10 | Policy catalog | post-apply | Zero `2026-` in CB policy quals; zero `week_results` in CB policies |
| T-API-11 | Bot seed RPC | after lock | `{ok:false}` locked |
| T-API-12 | Bot seed RPC | before lock | Inserts/updates bots |
| T-API-13 | Crown RPC | first crown | Result row; peers revealed; writes still closed if locked or crown |
| T-API-14 | Crown RPC | second call | `already_crowned` |
| T-API-15 | Client UPSERT result | any | Denied |
| T-API-16 | Ops crown RPC | closeout | Allowed if verified ops; `crowned_by` recorded |
| T-API-17 | Random member crown RPC | — | Denied |
| T-API-18 | Sticky lock | re-run propose with worse parse | `lock_at` unchanged |
| T-API-19 | Unparseable start_time only | no prior lock | writes open; peers private; warning |
| T-API-20 | Prior valid lock + garbage slate update | — | lock sticky; no reveal from parse fail |
| T-API-21 | Scored week_results W0/W1 | lock_at null | peers **still private** |
| T-API-22 | Crown without lock_at | — | peers revealed (P2); writes denied |
| T-DATA-01 | Backfill | ~7 prod picks sim | pick fingerprints unchanged |
| T-MEM-01 | Former member | left after pick | cannot read/write; row retained |
| T-TAUT-01 | Policy SQL review | — | No `m.league_id = m.league_id` |

### 13.3 Disposable production smoke (S10 only, Mike auth)

Minimal: one test league or controlled identity; raw PostgREST deny after lock; no mass identity tests.

---

## 14. Technical decision table T1–T12

| ID | Question | Recommendation | Status |
|----|----------|----------------|--------|
| **T1** | CFB calendar source | Table `public.crystal_ball_season_deadlines(sport_id, season_year, lock_at)` | **Recommended** |
| **T2** | Formally published | `published_at` non-null/non-blank + ≥1 `card_games` row | **Recommended** |
| **T3** | Kickoff parse | ISO-like regex only; `min(valid::timestamptz)`; reject free text | **Recommended** |
| **T4** | Automation placement | Propose on publish-card + optional cron for warnings; **sticky lock never auto-overwritten** | **Recommended** |
| **T5** | `season_year` derivation | Match app `defaultSeasonYear()`; helper reads sport + deadline year in force | **Recommended**; confirm cutover date in S3 |
| **T6** | Crown writes `revealed_at` stamp? | **No** change to `lock_at`/`reveal_at` on crown; optional separate `result.crowned_at` already exists | **Recommended** |
| **T7** | Repair audit storage | Table `crystal_ball_result_repair_log` in future repair package | **Recommended** (not S6) |
| **T8** | Platform ops check | `is_league_ops(p_league_id) OR is_platform_staff(auth.uid())` — implement staff helper if missing | **Recommended**; exact staff helper may need tiny shared design |
| **T9** | Dual-read flag | Env `NEXT_PUBLIC_CB_LOCK_STATE_RPC=1` or remote config; default on after S4 deploy | **Recommended** |
| **T10** | State season-keyed while picks unversioned | **Yes** for first production path; P11 later | **Recommended** |
| **T11** | Ops warning channel | `schedule_warning` on state + Founder/commish checklist read of lock_state | **Recommended** |
| **T12** | `reset_league_season` vs history | Short term: reset may still wipe current picks (existing behavior); **before P11**, document that reset is destructive; redesign wipe to archive-by-season in P11 package | **Recommended follow-on** |

**Unresolved (need only engineering confirmation in S3, not product re-litigation):**

- Exact platform staff helper name if `is_league_ops` is deputy-scoped only (T8 implementation detail).  
- Season year cutover calendar edge cases (T5) for late-spring leagues.  
- Whether pre-lock **ops** may move sticky `lock_at` earlier without full repair RPC (S2 default: **no auto**; manual_ops path optional).

---

## 15. Risk register — D1B correlation vs D1C enforcement

| Risk ID | Scenario | Severity | Mitigation |
|---------|----------|----------|------------|
| R1 | Apply D1C write/reveal helpers **without** fixing membership tautologies | **High** — wrong-league membership may still pass EXISTS | Prefer **D1B CB membership correlation apply first** (separate auth); or same maintenance window with **two named authorizations** and ordered SQL: correlation then D1C |
| R2 | Apply correlation alone without D1C lock deny | Medium residual — post-lock write bypass remains | Accept temporary residual; do not claim D1C fixed |
| R3 | Bundle D1B-A/B/C + D1C in one transaction | High blast radius / rollback coupling | **Forbidden** by program rules |
| R4 | Bundle H-01 REVOKE with D1C | High — may break `crystal_ball_lock_count` or crown RPC EXECUTE | H-01 separate; grant new RPCs carefully with defaults in mind |
| R5 | App dual-read before DB enforcement | Low — display drift only | Log mismatches; no security claim |
| R6 | DB enforcement before app dual-read | Medium UX — saves fail without good errors | Ship Stage B soft gate same week as S6 if possible |
| R7 | Sticky lock blocks legitimate slate correction | Medium product | Document manual_ops path; do not let clients drift |
| R8 | Crown RPC without removing table FOR ALL | High — re-crown bypass | Drop client write policies in same apply as RPC |
| R9 | Bot RPC updated but founder pad still local-success | Medium integrity illusion | App error handling in dual-read stage |
| R10 | Backfill accidentally touches picks | **Critical** | Checksums; no picks in backfill SQL; review gate |
| R11 | Ephemeral design treated as production SQL | High process failure | Appendix labeled DESIGN ONLY; no apply file in this commit |
| R12 | P11 delayed while multi-season runs | Medium history loss on reset | T12 follow-on before second season wipe |

### Exact D1B dependency (not implemented here)

| Object | Live defect | D1C need |
|--------|-------------|----------|
| `crystal_ball_picks` policies (own/frozen/insert/update) | `m.league_id = m.league_id` | Correlated `is_league_member(crystal_ball_picks.league_id)` |
| `crystal_ball_result` member read | Same tautology | Correlated member read |
| Achievements (optional adjacency) | Tautology / D1B-C | Crown grants still work; visibility is D1B-C |

**D1B-A** (picks weekly), **D1B-B** (join), **D1B-C** (achievements SELECT), **H-01A/B** remain **separate workstreams**.

---

## 16. Exact affected-object inventory (database — future apply)

| Object | Action (future) |
|--------|-----------------|
| `public.crystal_ball_state` | CREATE |
| `public.crystal_ball_season_deadlines` | CREATE |
| Optional `public.crystal_ball_result_repair_log` | CREATE later (repair package) |
| `public.crystal_ball_is_write_open` | CREATE |
| `public.crystal_ball_is_peers_revealed` | CREATE |
| `public.crystal_ball_lock_state` | CREATE |
| `public.crystal_ball_current_season_year` | CREATE |
| `public.crystal_ball_propose_lock_from_schedule` | CREATE (service/ops) |
| `public.crown_crystal_ball_champion` | CREATE |
| `public.seed_bot_crystal_ball_picks` | REPLACE body with lock gate |
| Policies on `crystal_ball_picks` | DROP legacy; CREATE correlated + lock/reveal |
| Policies on `crystal_ball_result` | DROP client ALL write; SELECT correlated |
| Policies on `crystal_ball_state` | CREATE SELECT member; no client write |
| Policies on `crystal_ball_season_deadlines` | CREATE SELECT; restricted write |
| Triggers on picks/result | None required for lock (optional `updated_at` on state) |
| Live `crystal_ball_picks` rows | **NONE** |
| Live `crystal_ball_result` rows | **NONE** |
| `week_results` | **No CB dependency** |

---

## 17. Exact future affected-file inventory (application / repo)

| Path | Change type (later) |
|------|---------------------|
| `src/lib/crystal-ball.ts` | Dual-read RPC; save/load/crown/seed |
| `src/app/crystal-ball/page.tsx` | Countdown from lock_state |
| `src/lib/dates.ts` | Display only if still used |
| `src/lib/cloud.ts` | Publish hook propose; pad bots error; reset docs |
| `src/lib/league-hub-actions.ts` | Task complete vs locked from state |
| `src/components/HomeWeekHero.tsx` | Seal/lock display |
| `src/app/picks/PicksClient.tsx` | CTA |
| `src/components/PlayerWeekChecklist.tsx` | Local advisory only |
| `src/lib/auto-trophies.ts` | After crown RPC |
| `src/lib/season-closeout.ts` | Crown via RPC |
| `src/lib/gazette.ts` | No-pick names after reveal rules |
| `src/app/commissioner/CommissionerClient.tsx` | Seed CB; warnings |
| `src/app/commissioner/ManageLeagueClient.tsx` | Enabled flag only |
| `src/app/league-build/page.tsx` | Enabled default |
| `src/lib/founder-one-click.ts` | Seed gate |
| `src/lib/league-sync.ts` / `session-restore.ts` | Unchanged columns mostly |
| `scripts/verify-crystal-ball-states.mjs` | RPC contract tests |
| `supabase/bot-crystal-ball.sql` | Historical source; superseded by apply |
| `supabase/crystal-ball*.sql` | Historical |
| `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql` | Replace later with real REVIEW-ONLY when authorized |
| `docs/D1C-*` | Design chain |

**This S2 commit changes documentation only** (plus register pointer).

---

## 18. Pseudocode appendix — DESIGN ONLY (NOT EXECUTABLE / NOT APPLY)

> **WARNING:** The following is **design pseudocode** for ephemeral experimentation and future REVIEW-ONLY authoring.  
> It is **not** production SQL.  
> **Do not paste into production.**  
> **Do not treat as authorized apply.**

```text
-- =============================================================================
-- D1C-S2 DESIGN ONLY PSEUDOCODE — NOT EXECUTABLE PRODUCTION SQL
-- =============================================================================

-- TABLE crystal_ball_season_deadlines (
--   sport_id text NOT NULL,
--   season_year int NOT NULL,
--   lock_at timestamptz NOT NULL,
--   label text,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   PRIMARY KEY (sport_id, season_year)
-- );

-- TABLE crystal_ball_state (
--   league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
--   season_year int NOT NULL,
--   lock_at timestamptz,
--   reveal_at timestamptz,
--   lock_source text NOT NULL DEFAULT 'unset',
--   lock_reason text,
--   reveal_source text,
--   schedule_warning boolean NOT NULL DEFAULT false,
--   schedule_warning_code text,
--   proposed_kickoff_at timestamptz,
--   proposed_calendar_at timestamptz,
--   authority_version int NOT NULL DEFAULT 1,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   created_by uuid,
--   updated_by uuid,
--   PRIMARY KEY (league_id, season_year),
--   CHECK (
--     (lock_at IS NULL AND reveal_at IS NULL)
--     OR (lock_at IS NOT NULL AND reveal_at IS NOT NULL AND reveal_at >= lock_at)
--   )
-- );

-- FUNCTION crystal_ball_is_write_open(p_league_id uuid, p_season_year int DEFAULT NULL)
-- RETURNS boolean
-- LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
-- AS $$
--   SELECT CASE
--     WHEN NOT public.is_league_member(p_league_id) THEN false
--     WHEN EXISTS (
--       SELECT 1 FROM public.leagues l
--       WHERE l.id = p_league_id AND l.crystal_ball_enabled IS FALSE
--     ) THEN false
--     WHEN EXISTS (
--       SELECT 1 FROM public.crystal_ball_result r WHERE r.league_id = p_league_id
--     ) THEN false  -- crown closes new picks (P2 side effect on writes)
--     WHEN EXISTS (
--       SELECT 1 FROM public.crystal_ball_state s
--       WHERE s.league_id = p_league_id
--         AND s.season_year = coalesce(p_season_year, public.crystal_ball_current_season_year(p_league_id))
--         AND s.lock_at IS NOT NULL
--         AND now() >= s.lock_at
--     ) THEN false
--     ELSE true  -- includes lock_at IS NULL (P5/P12 fail-open writes)
--   END;
-- $$;

-- FUNCTION crystal_ball_is_peers_revealed(p_league_id uuid, p_season_year int DEFAULT NULL)
-- RETURNS boolean
-- LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
-- AS $$
--   SELECT CASE
--     WHEN EXISTS (
--       SELECT 1 FROM public.crystal_ball_result r WHERE r.league_id = p_league_id
--     ) THEN true
--     WHEN EXISTS (
--       SELECT 1 FROM public.crystal_ball_state s
--       WHERE s.league_id = p_league_id
--         AND s.season_year = coalesce(p_season_year, public.crystal_ball_current_season_year(p_league_id))
--         AND s.reveal_at IS NOT NULL
--         AND now() >= s.reveal_at
--     ) THEN true
--     ELSE false
--   END;
-- $$;
-- -- NOTE: no week_results; no date literals

-- POLICIES crystal_ball_picks (sketch):
-- SELECT own:
--   user_id = auth.uid() AND is_league_member(crystal_ball_picks.league_id)
-- SELECT peers:
--   is_league_member(crystal_ball_picks.league_id)
--   AND crystal_ball_is_peers_revealed(crystal_ball_picks.league_id)
-- INSERT:
--   user_id = auth.uid()
--   AND is_league_member(crystal_ball_picks.league_id)
--   AND crystal_ball_is_write_open(crystal_ball_picks.league_id)
-- UPDATE:
--   USING and WITH CHECK same as INSERT owner+member+write_open

-- seed_bot_crystal_ball_picks: after commissioner check:
--   IF NOT crystal_ball_is_write_open(p_league_id) THEN
--     RETURN json_build_object('ok', false, 'error', 'Crystal Ball locked');
--   END IF;

-- crown_crystal_ball_champion:
--   IF NOT (commish OR ops) THEN deny
--   IF result exists THEN return already_crowned
--   INSERT result once; do not touch crystal_ball_state.lock_at

-- propose_lock sticky:
--   IF state.lock_at IS NOT NULL THEN keep; update warnings only
--   ELSE IF candidate valid THEN set lock_at = reveal_at = candidate

-- BACKFILL: INSERT state only; NEVER touch crystal_ball_picks

-- =============================================================================
-- END DESIGN ONLY PSEUDOCODE
-- =============================================================================
```

---

## 19. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged | **Yes** |
| D1C repaired | **No** |
| Executable production SQL authored | **No** |
| Application code changed | **No** |
| Current picks/results mutated | **No** |
| D1B / H-01 untouched | **Yes** |
| P1–P12 still locked | **Yes** |
| S2 design complete | **Yes** (this document) |

---

## 20. Next authorized actions (suggested)

1. Mike reviews S2 + T1–T12 recommendations (especially sticky lock + T8 staff helper).  
2. Optionally authorize **non-prod** `supabase/D1C-S2-ephemeral-*-REVIEW-ONLY.sql` authored from appendix.  
3. Ephemeral apply + full matrix §13.  
4. Separately authorize **D1B membership correlation** for CB policies (or ordered dual-auth with D1C).  
5. Production SELECT-only preflight → D1C apply only with explicit auth.  

**Do not claim D1C repaired until S8–S10 pass under production authorization.**
