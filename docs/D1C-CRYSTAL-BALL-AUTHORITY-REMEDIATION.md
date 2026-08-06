# D1C — Crystal Ball Authority Remediation

**Status:** REVIEW-ONLY DESIGN · **PRODUCT DECISIONS P1–P12 LOCKED** · **NOT AUTHORIZED TO APPLY**  
**Date:** 2026-08-06 (updated: Mike decisions locked)  
**Classification:** **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS LOCKED / NOT REPAIRED**  
**Evidence map:** `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md`  
**Prior design notes:** `docs/STRUCTURAL-HARDENING-D0-RLS.md` § Crystal Ball · blocked stub `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql`  
**Register:** `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`

### Explicit non-actions (this document / this package)

| Action | Status |
|--------|--------|
| Executable production SQL authoring | **No** |
| Ephemeral/staging SQL authoring in this commit | **No** — next phase proposed only |
| RLS / trigger / schema apply on production | **No** |
| App code changes | **No** |
| Deploy | **No** |
| Mutate live `crystal_ball_picks` / `crystal_ball_result` | **No** (~7 picks left untouched) |
| Bundle or apply D1B-A / D1B-B / D1B-C / H-01A / H-01B | **No** · **untouched** |
| Claim D1C repaired | **No** |

**Production remains unchanged until a later, separately authorized apply.**

---

## 0. P1–P12 decision table — APPROVED (LOCKED)

| ID | Topic | Status | Approved product law |
|----|-------|--------|----------------------|
| **P1** | Lock versus reveal | **APPROVED** | Lock and **peer reveal occur at the same instant by default**. Keep separate `lock_at` and `reveal_at` fields so delayed reveal remains possible later; initially set **`reveal_at = lock_at`**. Before lock: own pick only. At lock: submissions close **and** league members see everyone’s picks. Countdown and reveal feel like **one coordinated event**. |
| **P2** | Crown as permanent reveal | **APPROVED** | Crowning permanently reveals the board as a **backstop**, not the normal seasonal lock. Crown **must not** reopen writes or change original `lock_at`. |
| **P3** | Opening week scored | **APPROVED** | Scored opening week is **not** an ordinary lock/reveal authority. Remove `week_results` week 0/1 from eventual CB RLS. Scoring may be an **operational warning** only; never independently reveal private picks. |
| **P4** | CFB scheduling authority | **APPROVED** | Server-owned, **season-specific** CFB calendar deadline **combined with** persisted opening-week first kickoff. Authoritative CFB lock = **earlier valid instant** of (1) season CFB CB deadline (2) first valid kickoff on formally published Week 0 card. Normalize and persist as `timestamptz` before policies rely on it. **No yearly date literals in RLS**. |
| **P5** | NFL without published Week 1 slate | **APPROVED** | Keep **submissions open** and **peer picks private** when no valid Week 1 slate / persisted lock exists. Emit **operational warning** (commish/platform). Never reveal because schedule is missing. Once valid `lock_at` is **persisted**, it is authoritative and **must not drift** with later client calculations. |
| **P6** | Bot behavior after lock | **APPROVED** | **Hard-deny** production bot CB writes after lock. Bots and humans share the same deadline. Commish tools, padding, Founder tools, service functions, and bot RPCs must not silently insert/replace production picks after lock. Simulation overrides only in **isolated Foundry/test** with separate design + authorization. |
| **P7** | Crown immutability | **APPROVED** | **First crown immutable** via ordinary commissioner/client paths. No silent re-crown by upsert. Corrections require a separate narrow **audited repair** with explicit reason — **separately designed and authorized**. |
| **P8** | Crown authority | **APPROVED** | **Commissioner + authorized platform ops** may crown through **one narrow server-controlled RPC**. League commissioner crowns own league. Platform ops may complete closeout when necessary; server verifies and records actor. **No** broad direct table-write privileges to ops or clients. |
| **P9** | Storage model | **APPROVED** | Dedicated season-aware **`public.crystal_ball_state`** keyed by `(league_id, season_year)`. Not leagues-only authority. Supports `lock_at`, `reveal_at`, source/reason, audit timestamps, actor fields, historical seasons, one row per league×season. Clients may **read** permitted state; may **not invent or directly alter** authoritative timestamps. |
| **P10** | Removed members’ picks | **APPROVED** | **Retain** submitted picks as season history when a member leaves/is removed. Leave removes access/mutation; does **not** erase historical prediction. Privacy/moderation/account-deletion removal is separately authorized and auditable. |
| **P11** | Multi-season history | **APPROVED** | Version picks and results by **`season_year`**. Do not rely solely on destructive resets. Preserve each season’s picks, lock/reveal state, crown, winner/achievement relationships. **Do not migrate** ~7 current production picks until separate migration plan, preflight, and authorization. |
| **P12** | Invalid / unparseable schedule | **APPROVED** | **Fail open for submissions**, **fail closed for peer reveal** when no valid persisted authority exists. Never compute security from malformed free-text schedule values. If prior valid `lock_at` exists, **retain and use it**. If none: writes open temporarily, peers private, operational warning, never reveal on parse fail, never replace valid timestamp with invalid value. |

### Additional product law (binding)

| # | Law |
|---|-----|
| 1 | The **database** is the final security authority. |
| 2 | Browser countdowns and UI locks **display** database state; they do **not** create authority. |
| 3 | A direct authenticated API call must **not** bypass the lock. |
| 4 | Human and production bot picks obey the **same** deadline. |
| 5 | Locked picks cannot be replaced through normal upsert behavior. |
| 6 | One sport or league cannot lock or reveal another. |
| 7 | No hard-coded season dates belong in permanent RLS policies. |
| 8 | No scored-week shortcut independently reveals Crystal Ball picks. |
| 9 | Own-pick privacy remains intact before reveal. |
| 10 | Existing production picks/results remain **untouched** during design. |

---

## 1. Problem statement

Crystal Ball currently has **multiple competing authorities** for lock and reveal:

- Browser `resolveCrystalBallLock` (calendar + kickoff + scored week)
- UI countdown / localStorage
- RLS frozen-read OR chain (result · hard-coded 2026 dates · week_results 0/1)
- INSERT/UPDATE policies that **never** consult lock
- Bot DEFINER seed that **never** consults lock
- Membership tautologies (`m.league_id = m.league_id`) on CB policies (**D1B dependency**, separate apply)

**Security consequence:** An authenticated client can change their own pick after the UI claims lock. Peers may be revealed by global dates or score events independent of the app. Sports can cross-contaminate via hard-coded freezes.

**Goal (now decision-locked):** One **server-owned** source of truth for lock and reveal, enforced by the database, implementing P1–P12. Browser clocks and UI are advisory only.

---

## 2. Schema design reconciled to P1–P12

### 2.1 `public.crystal_ball_state` (P9) — conceptual

| Field | Type (intent) | Role |
|-------|---------------|------|
| `league_id` | uuid FK → leagues | Scope |
| `season_year` | int | Multi-season history key (P11) |
| `lock_at` | timestamptz **nullable** | Authoritative write-close (P1, P5, P12) |
| `reveal_at` | timestamptz **nullable** | Authoritative peer-read; default **`= lock_at`** (P1) |
| `lock_source` / `lock_reason` | text | e.g. `cfb_calendar_and_kickoff` · `nfl_w1_kickoff` · `manual` · `automation` (P4, P9) |
| `reveal_source` / `reveal_reason` | text optional | Normally mirrors lock; crown permanent reveal is separate path (P2) |
| `schedule_warning` | boolean or text optional | Ops warning when no valid slate / parse fail (P5, P12) |
| `created_at` / `updated_at` | timestamptz | Audit |
| `created_by` / `updated_by` | uuid nullable | Audit where useful |
| Optional: `locked_at` / `revealed_at` | timestamptz | Explicit event stamps if automation records “crossed” separately from deadline |

**Primary key:** `(league_id, season_year)` — one authoritative record per league and season.

**Client privileges (target):** SELECT permitted rows for members; **no** direct INSERT/UPDATE of `lock_at` / `reveal_at` by ordinary clients. Timestamp writes only via automation / service DEFINER / narrow ops RPC (P9).

**Not in this phase:** create table SQL, backfill, or migration of ~7 picks (P11).

### 2.2 Future picks / results versioning (P11) — design intent only

| Object | Future shape (not migrating now) |
|--------|----------------------------------|
| `crystal_ball_picks` | Eventually include `season_year`; uniqueness `(league_id, season_year, user_id)` |
| `crystal_ball_result` | Eventually include `season_year`; uniqueness `(league_id, season_year)`; first crown immutable (P7) |
| Achievements / trophies links | Preserve season association for Village Nerd / `crystal_ball_correct` |

**Current production ~7 picks:** leave as-is until separate migration plan + preflight + Mike auth.

### 2.3 Authority law (mapped to decisions)

| Law | Statement | Decision |
|-----|-----------|----------|
| A1 | Database is final security authority | Additional law 1 |
| A2 | Browser/UI are display only | Additional law 2 |
| A3 | Human INSERT/UPDATE rejected after lock | P1, law 3/5 |
| A4 | Direct PostgREST cannot bypass lock | Law 3/5 |
| A5 | Peers private until reveal | P1, P5, P12 |
| A6 | Own pick readable to submitting member | Law 9 |
| A7 | Membership correlates to row `league_id` | D1B dependency |
| A8 | No hard-coded years in permanent RLS | P4, law 7 |
| A9 | No score-based independent reveal | P3, law 8 |
| A10 | Crown permanently reveals; does not reopen writes or move lock | P2 |
| A11 | Bots same deadline; hard-deny after lock | P6, law 4 |
| A12 | First crown immutable via normal paths; repair separate | P7 |
| A13 | Crown via narrow server RPC; commish + verified ops | P8 |
| A14 | Fail open writes / fail closed peers without valid `lock_at` | P5, P12 |
| A15 | Persisted valid `lock_at` never replaced by invalid / client drift | P5, P12 |
| A16 | Removed-member picks retained as history | P10 |

### 2.4 Lock and reveal behavior (P1)

```text
BEFORE lock_at (or lock_at IS NULL per P5/P12):
  is_write_open = true (if member + feature on + not crowned-closed if ever applicable)
  is_peers_revealed = false  (unless P2 crown already exists)
  member sees own pick only

AT/AFTER lock_at (= reveal_at initially):
  is_write_open = false
  is_peers_revealed = true
  one coordinated event: close submissions + show room board

IF crystal_ball_result exists for that league/season (P2):
  is_peers_revealed = true (permanent backstop)
  is_write_open remains false; lock_at unchanged
```

### 2.5 Scheduling (P4, P5, P12)

| Sport | How `lock_at` is **proposed then persisted** |
|-------|-----------------------------------------------|
| **CFB** | `min(valid season CFB calendar deadline, first valid kickoff on formally published Week 0)` when each arm is valid; write earlier to `crystal_ball_state` as `timestamptz` with reason (P4) |
| **NFL** | First valid kickoff on formally published Week 1; if missing → `lock_at` null, writes open, peers private, **ops warning** (P5) |
| **Policies** | Read **only** persisted state (and crown for P2); **never** parse free-text `start_time` / `lock_time` in RLS (P12) |
| **Drift** | After valid persist, automation must not overwrite with weaker/invalid values (P5, P12) |
| **Parse fail** | Keep prior valid `lock_at` if any; else open writes + private peers + warning (P12) |

Server-owned CFB calendar: season-keyed table or approved function — **not** literals inside policy text.

### 2.6 Bot and privileged writes (P6)

| Path | After lock |
|------|------------|
| Human upsert | Denied (DB) |
| `seed_bot_crystal_ball_picks` | Denied (same production gate) |
| Pad bots / founder one-click / commish seed UI | Must surface error; no silent local “success” that implies cloud write |
| Foundry / test override | Isolated env only; separate design + auth — not production path |
| Emergency pick repair | Auditable, separate authorization — not normal RPC |

### 2.7 Crown / result (P2, P7, P8)

| Topic | Design target |
|-------|----------------|
| Normal crown | **One** narrow SECURITY DEFINER (or equivalent) RPC: verifies commissioner of that league **or** authorized platform ops; inserts first result; records actor; may grant achievements |
| Re-crown | Denied on ordinary path (no client upsert rewrite) |
| Repair | Separate RPC: reason required, audit log, separate auth package |
| Direct `crystal_ball_result` client ALL | **Remove / restrict** broad table-write; prefer RPC-only writes |
| Permanent reveal | Helper: peers revealed if `now() >= reveal_at` **OR** result exists (P2); writes still closed |
| Closeout | Ops uses same crown RPC (server-verified), not raw table privileges |

### 2.8 Removed members (P10)

- No automatic DELETE of `crystal_ball_picks` on leave/remove.
- Membership loss → no SELECT peers (nonmember), no own mutation; historical row remains for season board after reveal / crown / Village Nerd ranking.
- Account deletion / privacy wipe: separate authorized process.

---

## 3. Target resolver contract (design only — not created)

Conceptual: `public.crystal_ball_lock_state(p_league_id uuid, p_season_year int default <current>)`

```text
sport_id
season_year
lock_at
reveal_at
is_locked              -- now() >= lock_at when lock_at IS NOT NULL; never invent lock from free text
is_write_open          -- member may write own pick: NOT locked AND no stronger close rule
is_peers_revealed      -- (reveal_at IS NOT NULL AND now() >= reveal_at) OR (P2: result exists)
lock_source / reason
schedule_warning       -- no slate / unparseable / missing authority (P5, P12)
kickoff_known          -- whether lock_at derived from schedule
crowned
```

**Invariants:**

```text
Default product: reveal_at = lock_at when both set (P1)
is_write_open false when is_locked or crowned-closed for writes
is_peers_revealed true when reveal time passed OR crown exists (P2)
UI / Home / save / bot tools consume THIS only (display + optimistic UX); DB enforces
```

---

## 4. D1B membership-correlation dependency (reference only — not bundled)

| Dependency | Why D1C needs it | How it stays separate |
|------------|------------------|------------------------|
| Fix `m.league_id = m.league_id` on CB own/frozen/insert/update/result-read policies | Without correlation, “member of **this** league” is not trustworthy; peer privacy and write scope leak across leagues | D1B-style membership fix is a **separate authorization and apply**; D1C policy rewrite should assume correlated checks but **must not** ship D1B SQL in a D1C transaction |
| Prefer `is_league_member(crystal_ball_picks.league_id)` (or equivalent) | Shared helper already used by D-03; H-01 grants are separate | D1C docs reference helper; H-01A REVOKE list not applied here |
| D1B-A picks / D1B-C achievements / D1B-B join | Adjacent integrity, not CB lock authority | **Untouched** by this package |

**Recommended order (still two auths):**  
1) Membership correlation on CB (and related) policies when Mike authorizes D1B slice for CB tautologies **or** as first half of a D1C apply window with **explicit dual auth** — prefer **fully separate applies**.  
2) D1C state table + lock/reveal enforcement after ephemeral proof.

**This package does not apply D1B.**

---

## 5. Remaining technical questions (no product judgment required)

These can be resolved by engineering design / ephemeral prototyping without reopening P1–P12:

| # | Technical question | Notes |
|---|--------------------|-------|
| T1 | Exact name/shape of server CFB calendar source table or function | Season-keyed; no year literals in RLS |
| T2 | Definition of “formally published” card in SQL | Align with app: `published_at` present + games with valid kickoff |
| T3 | Kickoff validation rules when promoting text → `timestamptz` | ISO-only? regex + `AT TIME ZONE`? reject ambiguous local strings |
| T4 | Who runs automation that persists `lock_at` | Cron, publish-card hook, or one-shot backfill job — implementation choice |
| T5 | `season_year` derivation for a league | Align with existing `defaultSeasonYear()` / sport season boundaries |
| T6 | Whether crown RPC also writes `revealed_at` stamp for audit | Optional; P2 does not require mutating `lock_at`/`reveal_at` |
| T7 | Audit storage for crown repair (table vs log) | Required before P7 repair package |
| T8 | Platform ops identity check in crown RPC | Reuse `is_league_ops` / staff helper vs platform allowlist |
| T9 | Dual-read feature flag mechanism | Env, league flag, or release train |
| T10 | Whether interim state exists with `season_year` only on state table while picks remain unversioned | Likely yes until P11 migration auth |
| T11 | Operational warning channel | Commish checklist, Founder health, or `schedule_warning` column + UI |
| T12 | Interaction with `reset_league_season` | Must not silently destroy multi-season history once P11 lands — redesign wipe scope later |

---

## 6. Next proposed phase (NOT production SQL)

**Phase name:** D1C-S2 — **Ephemeral / staging schema & policy design**  
**Still design + non-prod experiment only until Mike authorizes.**  
**This commit does not create the SQL files.**

### 6.1 Goals of S2 (when authorized to author non-prod SQL)

1. Create `crystal_ball_state` + RLS (client cannot invent timestamps).  
2. Create `crystal_ball_lock_state` helper reading **only** state (+ crown for P2).  
3. Draft pick policies: own read; peer read on reveal; insert/update only when write open; **no** week_results; **no** 2026 literals.  
4. Draft bot seed body gate = same write-open check.  
5. Draft crown RPC (P8) with immutable first insert (P7).  
6. Unit/ephemeral tests for behavioral matrix §11.  
7. Document publish-hook / backfill **proposal** for CFB min(calendar, W0 kickoff) and NFL W1 kickoff.  

### 6.2 Explicitly out of S2

- Production apply  
- Migration of ~7 live picks  
- App dual-read PR (S4 later)  
- D1B / H-01 applies  
- Crown repair RPC full design (follow-on package after P7)

### 6.3 Suggested artifact names (future, not created now)

```text
docs/D1C-S2-EPHEMERAL-SCHEMA-POLICY-DESIGN.md   (optional narrative)
supabase/D1C-S2-ephemeral-crystal-ball-REVIEW-ONLY.sql  (when authoring allowed; still non-apply)
```

---

## 7. App convergence plan (later — not now)

| Step | Work |
|------|------|
| 1 | Expose `crystal_ball_lock_state` to the browser |
| 2 | Dual-read: RPC primary; old `resolveCrystalBallLock` fallback for display only |
| 3 | `saveCrystalBallPick` optimistic UI from RPC; **DB rejection is enforcement** |
| 4 | `loadCrystalBall` full board only when `is_peers_revealed` |
| 5 | Home / hub / checklist consume same facts |
| 6 | Bot / founder tools: hard error after lock (P6) |
| 7 | Crown UI → crown RPC only (P7/P8); closeout uses same RPC |
| 8 | Remove security-critical hard-coded 2026 / scored-week paths |
| 9 | Ops warning UI for missing slate / schedule_warning (P5, P12) |

**Affected inventory (eventual):**  
`src/lib/crystal-ball.ts`, `src/app/crystal-ball/page.tsx`, `src/lib/dates.ts`, `src/lib/cloud.ts`, `src/lib/league-hub-actions.ts`, `HomeWeekHero.tsx`, `PicksClient.tsx`, `PlayerWeekChecklist.tsx`, `auto-trophies.ts`, `season-closeout.ts`, `gazette.ts`, `CommissionerClient.tsx`, `ManageLeagueClient.tsx`, league-build, `founder-one-click.ts`, `league-sync.ts`, `session-restore.ts`, `scripts/verify-crystal-ball-states.mjs`

---

## 8. Migration stages (authorized separately)

| Stage | Name | Status |
|-------|------|--------|
| **S0** | Archive authority map | Done |
| **S1** | Freeze P1–P12 | **Done (this update)** |
| **S2** | Ephemeral/staging schema & policy design + non-prod SQL when authorized | **Next** |
| **S3** | Ephemeral Supabase behavioral tests | Pending |
| **S4** | App dual-read PR | Pending |
| **S5** | Production SELECT-only preflight | Pending |
| **S6** | Apply schema + state table (Mike auth) | Pending |
| **S7** | Backfill state **without** modifying picks | Pending |
| **S8** | Enable write/reveal enforcement | Pending |
| **S9** | Remove legacy dates / score-reveal / browser-only authority | Pending |
| **S10** | Disposable behavioral tests | Pending |
| **Later** | P11 picks/results `season_year` migration (own plan + auth) | Not now |
| **Later** | P7 crown repair RPC package | Not now |
| **Later** | Foundry isolation for bot overrides (P6) | Not now |

**Never combine S6–S9 with D1B/H-01 applies in one transaction for convenience.**

---

## 9. Backfill rules (when S7 authorized)

| Rule | Statement |
|------|-----------|
| Picks | **Unchanged** (~7 rows) |
| Results | **Unchanged** (0 rows today) |
| State rows | One per active league × current `season_year` |
| CFB | Persist earlier of season calendar vs W0 kickoff when valid (P4) |
| NFL | Persist W1 kickoff when valid; else null + warning (P5) |
| `reveal_at` | Set equal to `lock_at` when lock set (P1) |
| Invalid | Never write invalid over valid (P12) |
| Idempotent | Re-run safe; automation-owned fields only |

---

## 10. Rollback design

| Layer | Rollback |
|-------|----------|
| Policies | Restore archived pre-apply policy definitions |
| State table | Leave inert or drop if app never required it |
| App dual-read | Flag off → old resolver (display only) |
| Bot RPC | Prior definition from repo history |
| Crown RPC | Revert to prior commissioner table policy only if emergency **and** authorized (avoid reopening silent re-crown) |

**Rollback should not re-introduce hard-coded 2026 RLS dates** unless Mike explicitly accepts that regression.

---

## 11. Required behavioral matrix (acceptance)

| # | Behavior |
|---|----------|
| B1 | Member can submit before lock |
| B2 | Raw authenticated API write is **denied** after lock |
| B3 | Update/upsert cannot overwrite a locked pick |
| B4 | Nonmember cannot read or write league picks |
| B5 | Member sees only own pick before reveal |
| B6 | League members see peer picks after reveal (same instant as lock by default) |
| B7 | One league/sport cannot reveal another |
| B8 | No hard-coded year in **live** policy definitions |
| B9 | No `week_results` branch independently reveals picks |
| B10 | Bot seed denied after production lock |
| B11 | Crown permanently reveals; does not reopen writes or change `lock_at` |
| B12 | Result cannot be silently re-crowned under ordinary paths |
| B13 | No valid lock_at: writes open, peers private, ops warning |
| B14 | Invalid schedule never reveals; never clobbers valid `lock_at` |
| B15 | Existing ~7 picks unchanged by design/backfill |
| B16 | Removed member’s pick retained as history (P10) |

---

## 12. Sequencing (binding)

```text
1. Archive authority map                          ✅
2. Freeze Mike’s product decisions (P1–P12)       ✅ LOCKED
3. Prepare schema/RLS/RPC design                  ✅ this doc (reconciled)
4. Ephemeral/staging schema & policy design       ⏳ NEXT (still non-prod; no SQL in this commit)
5. Author non-prod REVIEW-ONLY SQL when authorized ⏳
6. Ephemeral database tests                       ⏳
7. App dual-read support                          ⏳
8. Production SELECT-only preflight               ⏳
9. Apply only with separate explicit authorization ⏳
10. Backfill state without modifying picks        ⏳
11. Enable database write/reveal enforcement      ⏳
12. Remove legacy dates / score-reveal / browser-only authority ⏳
13. Disposable behavioral tests                   ⏳
```

---

## 13. Keep workstreams separate

| Stream | Relationship |
|--------|----------------|
| **D1B-A / D1B-B / D1B-C** | Separate · **untouched** |
| **H-01A / H-01B** | Separate · **untouched** |
| **D1B CB membership tautology fix** | Referenced dependency only |
| **D1C** | This track — decisions locked; not repaired |

---

## 14. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged | **Yes** |
| D1C repaired | **No** |
| Executable production SQL authored | **No** |
| Application code changed | **No** |
| Current picks/results mutated | **No** |
| D1B and H-01 untouched | **Yes** |
| P1–P12 product decisions frozen | **Yes — APPROVED** |

---

## 15. Next authorized action (suggested)

1. ~~Mike completes P1–P12~~ **Done.**  
2. Authorize **D1C-S2**: ephemeral/staging schema & policy **design document and/or non-prod REVIEW-ONLY SQL** (still no production apply).  
3. Optionally schedule **separate** D1B membership-correlation apply for CB tautologies before production D1C enforcement.  
4. Production D1C apply only after S3–S5 gates and explicit Mike auth.
