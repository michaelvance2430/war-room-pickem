# D1C — Crystal Ball Authority Remediation

**Status:** REVIEW-ONLY DESIGN · **NOT AUTHORIZED TO APPLY**  
**Date:** 2026-08-06  
**Classification:** **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS REQUIRED / NOT REPAIRED**  
**Evidence map:** `docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md`  
**Prior design notes:** `docs/STRUCTURAL-HARDENING-D0-RLS.md` § Crystal Ball · blocked stub `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql`  
**Register:** `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`

### Explicit non-actions (this document)

| Action | Status |
|--------|--------|
| Executable SQL creation | **No** — design only; no apply file in this package |
| RLS / trigger / schema apply on production | **No** |
| App code changes | **No** |
| Deploy | **No** |
| Mutate live `crystal_ball_picks` / `crystal_ball_result` | **No** (~7 picks left untouched) |
| Bundle D1B-A / D1B-B / D1B-C / H-01A / H-01B | **No** |
| Claim D1C repaired | **No** |

**Production remains unchanged until a later, separately authorized apply.**

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

**Goal:** One **server-owned** source of truth for lock and reveal, enforced by the database. Browser clocks and UI are advisory only.

---

## 2. Recommended design defaults

### 2.1 Storage — dedicated season-aware state table (preferred over `leagues` columns)

**Table (conceptual name):** `public.crystal_ball_state`

| Field | Type (intent) | Role |
|-------|---------------|------|
| `league_id` | uuid FK → leagues | Scope |
| `season_year` | int | Multi-season history key |
| `lock_at` | timestamptz nullable | Authoritative write-close instant |
| `reveal_at` | timestamptz nullable | Authoritative peer-read instant |
| `locked_at` | timestamptz nullable | When explicit/manual lock was recorded (if supported) |
| `revealed_at` | timestamptz nullable | When explicit/manual reveal was recorded (if supported) |
| `lock_reason` / `lock_source` | text | e.g. `kickoff_proposed` · `cfb_calendar` · `manual` · `automation` |
| `reveal_reason` / `reveal_source` | text optional | If reveal differs from lock |
| `created_at` / `updated_at` | timestamptz | Audit |
| `created_by` / `updated_by` | uuid nullable | Audit where useful |

**Primary key:** `(league_id, season_year)`  
**Why not only columns on `leagues`:** preserves multi-season history; avoids destructive reset as the only historical model; keeps CB authority out of the general league settings row.

**Not in this phase:** create table SQL, backfill of live rows, or migration of the ~7 picks.

### 2.2 Authority law

| Law | Statement |
|-----|-----------|
| A1 | **Database is the only security authority** for write-open and peer-reveal. |
| A2 | Browser-calculated dates and UI state are **advisory displays only**. |
| A3 | Human INSERT/UPDATE of picks **must be rejected** when authoritative lock has passed. |
| A4 | Direct PostgREST writes must **not** bypass the lock. |
| A5 | Peer picks remain private until authoritative **reveal**. |
| A6 | Own pick remains readable to the submitting **league member**. |
| A7 | Membership checks must correlate to the **row’s** `league_id` (not tautology). |
| A8 | Eventual RLS: **remove** hard-coded 2026 dates and `week_results` OR branches. |
| A9 | **No** score event independently reveals picks through RLS. |
| A10 | Crown/result existence may permanently reveal — **subject to P2**. |

### 2.3 Lock and reveal as separate concepts

- Schema keeps **both** `lock_at` and `reveal_at` even if initially equal.
- **Recommended initial product behavior (P1 default):** `reveal_at = lock_at` unless Mike chooses delayed reveal.
- Do **not** collapse the data model because initial values may match.

### 2.4 Scheduling

| Input | Role |
|-------|------|
| Opening-week first kickoff | May **propose** lock time |
| Persistence | Must be normalized and stored as **`timestamptz`** on `crystal_ball_state` **before** RLS relies on it |
| Policies | Must **not** parse free-form `card_games.start_time` text |
| CFB calendar | Season-aware, **server-owned** (table or approved function), not app `Date.parse("2026-…")` in security path |
| Missing schedule | Fail-open vs fail-closed is **P5 / P12** — document explicitly; do not invent in policy |

### 2.5 Bot and privileged writes

| Rule | Statement |
|------|-----------|
| Production bot seed | Obeys **same** lock as human picks |
| After lock | No commissioner, bot, Founder, or service function may **silently** rewrite picks |
| Foundry / test override | Must be **explicitly isolated** from production leagues and **separately authorized** |
| Emergency repair | Auditable, narrow, **not** a normal write path |

### 2.6 Result / crown

| Recommendation | Statement |
|----------------|-----------|
| First crown | Immutable through **normal client** paths |
| Corrections | Narrowly authorized, auditable repair only |
| Ops vs commissioner | **Do not change** crown authority in apply until **P8** decided; design documents the live mismatch (ops closeout expects write; RLS commissioner-only) |
| Permanent reveal | Depends on **P2** |

### 2.7 Picks and seasons

| Recommendation | Statement |
|----------------|-----------|
| Eventually | Version `crystal_ball_picks` by `season_year` rather than wipe-only history |
| This design phase | **No** migration or mutation of ~7 current picks |
| Removed members | **Default:** retain picks as historical records; membership controls visibility and normal mutation (**P10**) |
| Delete on remove | Separate product decision — not default |

---

## 3. Target resolver contract (design only — not created)

Conceptual RPC / SQL function: `public.crystal_ball_lock_state(p_league_id uuid, p_season_year int default <current>)`

Returns (shape):

```text
sport_id
season_year
lock_at
reveal_at
is_locked          -- now() >= lock_at OR explicit locked_at OR (optional) crowned write-close
is_write_open      -- NOT is_locked (and feature enabled / member)
is_peers_revealed  -- now() >= reveal_at OR (P2) result exists OR explicit revealed_at
lock_reason
reveal_reason
kickoff_known      -- whether lock_at was derived from schedule
crowned            -- crystal_ball_result present for league[/season]
```

**Invariants (target):**

```text
is_write_open  ⇔  member may INSERT/UPDATE own pick for that season
is_peers_revealed  ⇔  members may SELECT peer team_name rows
UI and Home tasks consume the same RPC facts — never a third clock
```

RLS (eventual) uses **only** this state / helper — no year literals, no `week_results` reveal branch.

---

## 4. Mike decision table (P1–P12)

| ID | Decision | Recommended default | Alternatives / tradeoffs |
|----|----------|---------------------|---------------------------|
| **P1** | Lock and reveal same time, or delayed reveal? | **Same time initially:** set `reveal_at = lock_at` at write of state; keep columns separate | Delayed reveal: better drama, more complex UI and dual gates; risk of “locked but secret forever” if reveal never set |
| **P2** | Does crown permanently reveal the board? | **Yes** — crown ⇒ `is_peers_revealed` forever for that season | No: reveal only via `reveal_at`; crown can be private until calendar — surprises for trophy ceremony |
| **P3** | Is opening-week **scored** an ordinary lock/reveal authority? | **No** — lagging signal only if ever used; **not** RLS reveal | Yes: matches some current app behavior but couples scoring mistakes to privacy leaks |
| **P4** | CFB: server calendar vs persisted first kickoff | **Both inputs, one persisted winner:** automation computes `min(server_calendar_at, kickoff_at)` when known and **writes** `lock_at` | Kickoff-only: simple but drops noon product law; calendar-only: ignores early Thursday openers |
| **P5** | No published slate: fail open or fail closed? | **Writes fail-open** (no invented lock); **peers fail-closed** (private) — matches current NFL app intent | Fail-closed writes: freezes entire preseason if slate late; fail-open peers: privacy risk |
| **P6** | Production bot writes after lock? | **Hard-denied** same as humans | Soft-allow for commish “fix”: becomes production bypass |
| **P7** | First crown immutable vs commissioner corrections? | **Immutable** on normal client path; correction = auditable repair RPC | Always-editable crown: re-crown races and achievement thrash |
| **P8** | Crown authority: commissioner only or commissioner + ops? | **Document only until decided** — live RLS = commissioner only; ops closeout currently mismatches | +ops: unblocks closeout automation; expands write surface — needs explicit grant design |
| **P9** | Dedicated season-aware state table? | **Yes** (`crystal_ball_state`) | Columns on `leagues`: simpler v1, poor multi-season |
| **P10** | Retain removed-member picks as history? | **Yes** (default) | Delete on leave: cleaner privacy; loses prophet history for Village Nerd edge cases |
| **P11** | Season-version picks vs reset-only model? | **Eventually version by `season_year`**; no migrate now | Reset-only: simpler now; destroys history on `reset_league_season` |
| **P12** | Unparseable schedule fail mode? | Align with **P5**: do not set `lock_at` from bad text; log; peers stay private; writes stay open until calendar or manual authority | Fail-closed on parse error: may lock room on data quality bug |

**Freeze required** before ephemeral SQL authoring or production preflight.

---

## 5. Dependency on D1B (reference only — do not apply here)

| Dependency | Why |
|------------|-----|
| Membership correlation on CB policies | Tautologies make “member of target league” unenforceable as intended |
| `is_league_member(league_id)` helper | Prefer shared helper after D-03/H-01 grant posture is clear |

**D1C design may assume correlated membership in the *target* RLS text but must not ship D1B SQL in a D1C transaction.**  
Order recommendation: **D1B membership correlation (separate auth) before or as a pre-step to D1C policy rewrite** — still two authorizations, two rollbacks.

---

## 6. Schema / RLS / RPC design (REVIEW ONLY — no SQL file)

### 6.1 Schema stages (conceptual)

1. Create `crystal_ball_state` (+ indexes, RLS deny client write of authority columns by default).  
2. Optional later: add `season_year` to picks/result (migration deferred; **not** this phase).  
3. Optional: server calendar table `crystal_ball_season_deadlines(sport_id, season_year, lock_at)` for CFB.

### 6.2 Who may write state rows

| Actor | Allowed writes |
|-------|----------------|
| Ordinary members | **None** on `crystal_ball_state` |
| Commissioner / ops (product) | Manual lock/reveal only if P1/E supports and is audited |
| Automation / service DEFINER | Propose/set `lock_at`/`reveal_at` from published kickoff + calendar |
| Foundry | Isolated leagues only (P6) |

### 6.3 Eventual policy sketch (not executable)

**`crystal_ball_picks` SELECT own:**  
`user_id = auth.uid()` AND `is_league_member(crystal_ball_picks.league_id)`

**SELECT peers:**  
member AND `crystal_ball_lock_state(...).is_peers_revealed`  
(+ optional P2 crown short-circuit inside helper)

**INSERT / UPDATE own:**  
owner AND member AND `is_write_open`  
**No** unlock via UI.

**`seed_bot_crystal_ball_picks`:** same `is_write_open` (or stricter) inside body; reject after lock.

**`crystal_ball_result`:**  
- INSERT first crown: commissioner (or P8).  
- UPDATE/DELETE: deny for normal roles; repair RPC only if P7.

### 6.4 Explicit non-goals of first apply (when later authorized)

- Mutating existing ~7 picks  
- Mass REVOKE unrelated DEFINER grants (H-01)  
- Changing Foundry quarantine product-wide  
- Bundling picks/join/achievements D1B applies  

---

## 7. App convergence plan (later — not now)

| Step | Work |
|------|------|
| 1 | Expose `crystal_ball_lock_state` to the browser (RPC) |
| 2 | Dual-read: new RPC primary; keep `resolveCrystalBallLock` fallback behind feature/flag for one release |
| 3 | `saveCrystalBallPick` still calls RPC but **relies on DB rejection** as enforcement |
| 4 | `loadCrystalBall` uses `is_peers_revealed` for full board query (not local calendar) |
| 5 | Home / hub / checklist: locked/complete from same facts |
| 6 | Bot tools + founder one-click: show error when write denied |
| 7 | Crown + closeout: honor P2/P7/P8 once decided |
| 8 | Remove hard-coded CFB/NFL date branches from security-critical paths |
| 9 | UI never presented as the enforcement boundary (copy + architecture comments) |

**Affected app inventory (eventual):**  
`src/lib/crystal-ball.ts`, `src/app/crystal-ball/page.tsx`, `src/lib/dates.ts`, `src/lib/cloud.ts`, `src/lib/league-hub-actions.ts`, `HomeWeekHero.tsx`, `PicksClient.tsx`, `PlayerWeekChecklist.tsx`, `auto-trophies.ts`, `season-closeout.ts`, `gazette.ts`, `CommissionerClient.tsx`, `ManageLeagueClient.tsx`, league-build, `founder-one-click.ts`, `league-sync.ts`, `session-restore.ts`, `scripts/verify-crystal-ball-states.mjs`

---

## 8. Migration stages (authorized separately, in order)

| Stage | Name | Production? | Notes |
|-------|------|-------------|-------|
| **S0** | Archive map + this design | Docs only | **This package** |
| **S1** | Freeze P1–P12 | Decision log | Blocker for SQL authoring |
| **S2** | Author REVIEW-ONLY SQL (schema + policies + RPC) | Repo only | Still no prod execute |
| **S3** | Ephemeral Supabase tests | Non-prod | Full behavioral matrix |
| **S4** | App dual-read PR | Staging/prod deploy separate | No enforcement removal yet |
| **S5** | Production SELECT-only preflight | Read-only | Policy names, grants, row counts |
| **S6** | Apply schema + state table | **Mike auth** | Empty/backfillable; picks untouched |
| **S7** | Backfill `crystal_ball_state` | **Mike auth** | Compute lock/reveal; **do not** modify picks |
| **S8** | Enable write/reveal enforcement policies | **Mike auth** | Hard cutover; dual-read still ok |
| **S9** | Remove legacy RLS dates / week_results reveal / browser-only authority | **Mike auth** | After app consumes RPC |
| **S10** | Disposable behavioral tests on prod (or clone) | Controlled | No mass identity tests |

**Never combine S6–S9 with D1B/H-01 applies in one transaction for convenience.**

---

## 9. Backfill rules (design)

| Rule | Statement |
|------|-----------|
| Picks | **Unchanged** (~7 rows remain as-is) |
| Results | **Unchanged** (0 rows today) |
| State rows | Insert one per active league × current `season_year` |
| Sources | Sport-specific proposal: NFL from published W1 kickoff if parseable; CFB from server calendar and/or W0 kickoff per **P4** |
| If unknown | `lock_at` / `reveal_at` null → P5/P12 behavior |
| Idempotent | Re-run backfill updates only null or automation-owned fields; never silent overwrite of manual locks without audit |

---

## 10. Rollback design

| Layer | Rollback |
|-------|----------|
| Policies | Restore archived pre-apply policy definitions (select-only export before apply) |
| State table | Leave table inert (policies ignore it) or drop if never depended on by app |
| App dual-read | Feature flag off → old resolver (display only; security still DB if policies remain) |
| Bot RPC | Prior function definition from repo history |
| Crown immutability | Re-enable update policy only if emergency and authorized |

**Rollback does not re-introduce hard-coded 2026 dates** unless Mike explicitly accepts that regression.

---

## 11. Required behavioral matrix (acceptance)

Must pass before claiming repair:

| # | Behavior |
|---|----------|
| B1 | Member can submit before lock |
| B2 | Raw authenticated API write is **denied** after lock |
| B3 | Update/upsert cannot overwrite a locked pick |
| B4 | Nonmember cannot read or write league picks |
| B5 | Member sees only own pick before reveal |
| B6 | League members see peer picks after reveal |
| B7 | One league/sport cannot reveal another |
| B8 | No hard-coded year appears in **live** policy definitions |
| B9 | No `week_results` branch independently reveals picks |
| B10 | Bot seed is denied after production lock |
| B11 | Crown produces the approved permanent-reveal behavior (P2) |
| B12 | Result cannot be silently re-crowned under P7 |
| B13 | Invalid/unparseable schedule matches P5/P12 |
| B14 | Existing ~7 picks remain unchanged by D1C apply/backfill |

---

## 12. Sequencing (binding)

```text
1. Archive authority map                          ✅ (docs/D1C-CRYSTAL-BALL-LOCK-REVEAL-AUTHORITY-MAP.md)
2. Freeze Mike’s product decisions (P1–P12)       ⏳
3. Prepare schema/RLS/RPC design                  ✅ this doc (no SQL yet)
4. Author REVIEW-ONLY SQL (later package)         ⏳ not this commit
5. Test in ephemeral database                     ⏳
6. Build app dual-read support                    ⏳
7. Production SELECT-only preflight               ⏳
8. Apply only with separate explicit authorization ⏳
9. Backfill state without modifying picks         ⏳
10. Enable database write/reveal enforcement      ⏳
11. Remove legacy dates / score-reveal / browser-only authority ⏳
12. Run disposable behavioral tests               ⏳
```

---

## 13. Keep workstreams separate

| Stream | Relationship to D1C |
|--------|---------------------|
| **D1B-A** picks correlation | Separate auth / apply |
| **D1B-C** achievements visibility | Separate |
| **D1B-B** membership join RPCs | Separate |
| **H-01A** selective DEFINER REVOKE | Separate (`crystal_ball_lock_count` may appear later) |
| **H-01B** future default privileges | Separate |
| **D1B membership on CB policies** | Referenced dependency; **not** applied by this design package |

---

## 14. Option comparison (storage & authority)

| Option | Security | Multi-sport | Commish UX | Automation | Migration | App | DB | Rollback |
|--------|----------|-------------|------------|------------|-----------|-----|-----|----------|
| **A** columns on leagues | Strong | OK single season | Simple | Easy | Low | Medium | Policies on columns | Easy |
| **B** `crystal_ball_state` (**preferred**) | Strong | Best multi-season | Slightly more | Best audit | Medium | Medium | Policies on state + picks | Drop/ignore table |
| **C** kickoff derive only | Partial | Weak CFB | Low | Fragile text | Low | Low | Bad if parses text in RLS | Easy |
| **D** result-only reveal | Partial | OK | Late board | Low | Low | Medium | Simple | Easy |
| **E** manual only | Operator-dependent | Flexible | High burden | Weak | Low | Medium | Flags | Too easy to flip |
| **F** server automation + B | Strongest | Strong | Low | Highest | Medium | Medium | DEFINER writers | Audit trail |

**Preferred package:** **B + F inputs (kickoff/calendar propose) + A3/A4 enforcement**, with P1 default equal timestamps.

---

## 15. Status declarations

| Statement | True? |
|-----------|-------|
| Production unchanged by this design package | **Yes** |
| D1C repaired | **No** |
| Executable SQL created for D1C apply | **No** |
| App code changed | **No** |
| Live picks/results mutated | **No** |
| Product decisions frozen | **No** — table ready for Mike |

---

## 16. Next authorized action (suggested)

1. Mike completes **P1–P12** (accept defaults or annotate deltas).  
2. Only then: author `supabase/D1C-*-REVIEW-ONLY.sql` (still non-apply until explicit auth).  
3. Ephemeral test run against behavioral matrix.  
4. Separate apply authorization — never bundled with D1B/H-01.
