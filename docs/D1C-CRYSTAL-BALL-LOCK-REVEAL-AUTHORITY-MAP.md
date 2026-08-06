# D1C — Crystal Ball Lock / Reveal Authority Map

**Status:** ARCHIVED STATIC MAP · **REVIEW ONLY**  
**Date:** 2026-08-06  
**Mode:** No edits to production · no SQL apply · no app deploy · no pick/result mutation  
**Classification:** **CONFIRMED HIGH / MULTI-AUTHORITY LOCK-REVEAL DEFECT / PRODUCT DECISIONS REQUIRED / NOT REPAIRED**  
**Companion design (REVIEW ONLY):** `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md`  
**Register:** `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`  
**Codebase root (map generation):** `war-room-pickem` mainline sources under `src/`, `supabase/`, `scripts/`

### Explicit non-actions (this archive and the mapping session)

| Action | Status |
|--------|--------|
| File edits beyond this archive + register + design docs | No (map session was read-only; design docs authorized separately) |
| Executable SQL creation for D1C apply | **No** |
| RLS / trigger / timestamp apply on production | **No** |
| App code changes | **No** |
| Crystal Ball row mutation | **No** |
| Bot changes / deploy | **No** |
| Bundle with H-01 / D1B apply | **No** |
| Claim D1C repaired | **No** |

### Live database facts already verified (input to this map)

| Fact | Value |
|------|--------|
| Tables | `public.crystal_ball_picks`, `public.crystal_ball_result` |
| Non-internal triggers on either table | **None** |
| `crystal_ball_picks` policies | INSERT + UPDATE present; **no** DB trigger preventing post-lock mutation |
| Tautologies | Four `crystal_ball_picks` policies + `crystal_ball_result` member-read contain `m.league_id = m.league_id` |
| Frozen-read OR authorities | (1) `crystal_ball_result` exists (2) `now() >= 2026-08-29 16:00:00+00` (3) `now() >= 2026-09-10 16:00:00+00` (4) `week_results` week 0 or 1 |
| `crystal_ball_lock_count(uuid)` | Browser RPC; anon/authenticated executable (live fact) |
| `leagues` | `crystal_ball_enabled` only — **no** authoritative `crystal_ball_lock_at` / `reveal_at` |
| `week_cards.lock_time`, `card_games.start_time` | Stored as **text**, not authoritative `timestamptz` |
| Live data | ~**7** `crystal_ball_picks` rows · **0** `crystal_ball_result` rows |
| Cleanup | **Not** authorized or indicated |

---

## 1. Complete call-site matrix

### A. Core library / page (primary authority surface)

| File:line (approx) | Role | R/W | Lock authority used | Reveal authority used | Post-lock mutate? | Auth enforcement |
|---|---|---|---|---|---|---|
| `src/lib/crystal-ball.ts:70–80` `crystalBallLockMs` | Browser | Read (const) | CFB: hard-coded `2026-08-29T12:00:00-04:00` (fallback `…16:00:00Z`). NFL: `+∞` (never calendar-lock) | N/A | N/A | Local only |
| `src/lib/crystal-ball.ts:83–89` `isCrystalBallLocked` | Browser | Read | CFB calendar only; NFL always false | N/A | N/A | Local only |
| `src/lib/crystal-ball.ts:131–288` `resolveCrystalBallLock` | Browser | Read cloud | **NFL:** W1 scored → lock; else published W1 card + `firstKickoffOnCardMs` / `isCardLockDeadlinePassed`. **CFB:** calendar ms OR W0 scored OR W0 card first kickoff | Same `locked` flag also drives full board load | N/A | Browser condition on cloud card/score data |
| `src/lib/crystal-ball.ts:363–411` `peekLocalCrystalBall` | Browser | Read localStorage | CFB calendar sync; NFL unlocked | Pre-lock: own only; champion/achievements only if local locked | N/A | Local state only |
| `src/lib/crystal-ball.ts:413–547` `loadCrystalBall` | Browser | Read | `resolveCrystalBallLock` | If `locked`: SELECT all league picks + result + achievements; else own pick only + `crystal_ball_lock_count` | N/A | Browser filter + RLS (own vs frozen policies) |
| `src/lib/crystal-ball.ts:437–441` RPC | Browser | Read | N/A | Count only (teams hidden) | N/A | DEFINER membership check in RPC body |
| `src/lib/crystal-ball.ts:549–640` `saveCrystalBallPick` | Browser | Write upsert | Re-resolves `resolveCrystalBallLock` + `lockAtMs` double-check | N/A | **UI blocks**; **DB does not** | Browser condition; then direct upsert; RLS owner+membership only (no lock) |
| `src/lib/crystal-ball.ts:597–605` upsert | Browser → PostgREST | INSERT/UPDATE | None at DB | N/A | **Yes if client bypasses UI** | RLS insert/update policies only |
| `src/lib/crystal-ball.ts:643–684` `loadCrystalBallNoPickNames` | Browser | Read | None | Selects all `user_id`s visible under RLS (own pre-lock; all when frozen) | N/A | RLS + membership |
| `src/lib/crystal-ball.ts:686–778` `crownNationalChampion` | Browser | Write | None for crown | Upsert result → permanent DB reveal path | Result UPSERT can re-crown | App: `session.isCommissioner`; DB: commissioner `FOR ALL` on result |
| `src/lib/crystal-ball.ts:785–894` `seedBotCrystalBallPicks` | Browser → RPC | Write | **None** | N/A | **Yes** — RPC upserts bots anytime | App: commissioner + `crystalBallEnabled`; RPC: commissioner + bot membership |
| `src/app/crystal-ball/page.tsx:140–325` | Browser UI | R/W | `state.locked` + countdown on `lockAtMs` (`liveLocked`) | Full board when `state.locked`; crown UI for commish | UI gate only | UI + lib above |
| `src/lib/dates.ts:51–67` | Browser util | Read | Parses `Game.commenceTime \|\| startTime` as `Date` | N/A | N/A | Client clock vs stored text times |

### B. Home / hub / checklist (task seals, not lock authority)

| File:line | Role | R/W | Lock | Reveal | Notes |
|---|---|---|---|---|---|
| `src/lib/league-hub-actions.ts:207–216` `isCrystalBallOpeningWeek` | Browser | — | Opening week only (CFB 0 / NFL 1) | N/A | Task eligibility, not freeze |
| `src/lib/league-hub-actions.ts:461–476` | Browser | Read own pick row | N/A | N/A | `crystalBallSealed` = row exists |
| `src/components/HomeWeekHero.tsx:247–278` | Browser | Read own | N/A | N/A | Cloud own pick or local |
| `src/app/picks/PicksClient.tsx:1661–1678` | Browser | Read own | N/A | N/A | “Lock Crystal Ball” CTA |
| `src/components/PlayerWeekChecklist.tsx:93–97` | Browser | local + engagement | N/A | N/A | Local engagement flag |

### C. Bot / Foundry / pad paths

| File:line | Role | R/W | Lock | Can mutate after app lock? |
|---|---|---|---|---|
| `src/lib/cloud.ts:4177–4253` pad bots → `seedBotCrystalBallPicks` | Browser (commish tools) | Write | Skips mid-season pad; **no CB lock check** | **Yes** if called pre-season tools path |
| `src/app/commissioner/CommissionerClient.tsx:1530–1536` | Browser | Write | None | Yes via RPC |
| `src/lib/founder-one-click.ts:97–98` | Browser/Foundry | Write | None | Yes |
| `supabase/bot-crystal-ball.sql:7–78` `seed_bot_crystal_ball_picks` | SQL DEFINER | INSERT upsert | **None** | **Yes** — always ON CONFLICT update |
| `supabase/trial-bots.sql` / `clear-trial-bots-now.sql` / `moderation.sql` | SQL DEFINER | DELETE picks | N/A | Yes (privileged) |

### D. Crown / trophies / closeout / gazette

| File:line | Role | R/W | Notes |
|---|---|---|---|
| `src/lib/auto-trophies.ts:115–188` | Browser | Read CB + write trophy | Needs `state.champion`; loads full board via `loadCrystalBall` |
| `src/lib/season-closeout.ts:163–200` | Browser | Read all picks for winners | Depends on RLS reveal |
| `src/lib/season-closeout.ts:612–670` `grantCrystalBallForChampion` | Browser ops | Upsert result + achievements | App: `isOps()`; **DB still requires commissioner** for result write |
| `src/lib/gazette.ts:1006–1007` | Browser | Read no-pick names | Soft meta, not team board |
| Trophy UI (`trophy-room`, `SeasonFinaleModal`, `profile-hardware`, etc.) | Browser | Read trophies | Depends on `league_trophies` / crown side effects, not pick RLS |

### E. Reset / leave / settings

| File:line | Role | R/W |
|---|---|---|
| `src/lib/cloud.ts:4916–4920` remove member | Browser delete pick | Direct DELETE (no client DELETE policy in CB SQL → typically denied unless DEFINER path) |
| `src/lib/cloud.ts:5373–5381` season wipe fallback | Browser | DELETE all CB rows for league |
| `supabase/reset-season.sql:63–69` `reset_league_season` | SQL DEFINER | DELETE picks + result |
| `supabase/gazette-archive.sql` / `prod-promote-latest.sql` | SQL DEFINER | Same wipe pattern |
| `src/lib/league-sync.ts` / ManageLeague / league-build / join | Browser | `crystal_ball_enabled` only — not lock timestamps |
| localStorage key `warroom-crystal-ball-${leagueId}` | Browser | Offline own pick cache; cleared on reset path ~5565 |

### F. SQL / RLS (live-intended from privacy/full scripts)

| Object | Role | R/W | Lock auth | Reveal auth | Post-lock mutate? | Auth |
|---|---|---|---|---|---|---|
| Policy “Members read own crystal ball” | SQL | SELECT | None | Own only | — | RLS (tautology membership risk) |
| Policy “Members read crystal ball when frozen” | SQL | SELECT | N/A | **OR of:** result exists · `2026-08-29 16:00+00` · `2026-09-10 16:00+00` · `week_results` week 0 **or** 1 | — | RLS |
| Policy “Users upsert own crystal ball” INSERT | SQL | INSERT | **None** | — | **Yes after app lock** | RLS owner+member |
| Policy “Users update own crystal ball” | SQL | UPDATE | **None** | — | **Yes after app lock** | RLS |
| Policy “Members read crystal result” | SQL | SELECT | — | Always if member (not gated on lock) | — | RLS tautology risk |
| Policy “Commissioner crowns champion” | SQL | ALL result | — | Crown write | Re-upsert allowed | `leagues.commissioner_id` |
| `crystal_ball_lock_count(uuid)` | SQL DEFINER | Read count | None | Not teams | — | Body membership; EXECUTE anon+auth (live fact) |
| No triggers on CB tables | — | — | — | — | No DB freeze trigger | — |

### G. Scripts (read-only / verify)

| Path | Role |
|---|---|
| `scripts/verify-crystal-ball-states.mjs` | Unit-style calendar/teams checks |
| `scripts/readonly-ssr-league-probe*.mjs` | Probe enabled + lock_count |
| `scripts/sql/E1-*` / `E1-SELECT-ONLY.sql` | SELECT-only audits |
| `supabase/D1C-crystal-ball-lock-REVIEW-ONLY.sql` | Blocked stub — no DDL |

---

## 2. Current lock authority list

Independent systems that can treat the board as **locked** (write closed / UI frozen). They are **not** unified.

| # | Authority | Where | Sport | Effect |
|---|---|---|---|---|
| L1 | CFB hard-coded calendar `2026-08-29 noon ET` | App `crystalBallLockMs` / `resolveCrystalBallLock` | CFB only | App write gate + UI lock |
| L2 | NFL published Week 1 first kickoff | App via `loadWeekCard(1)` + `firstKickoffOnCardMs` | NFL | App write gate |
| L3 | CFB published Week 0 first kickoff | App `loadWeekCard(0)` | CFB | App write gate (earlier of L1/L3 for countdown) |
| L4 | Opening week scored (`listScoredWeekNumbers` includes 0 or 1) | App | Both | App treats as locked |
| L5 | Client clock past `lockAtMs` on page | `crystal-ball/page.tsx` `liveLocked` | Both | UI only |
| L6 | **None in DB for writes** | INSERT/UPDATE policies | Both | **Writes remain allowed after L1–L5** |
| L7 | Crown existence | Implicit product law (desired); app still uses L1–L4 for “locked”, not result alone for write gate | Both | Result is primarily a **reveal** path in RLS |

**Not lock authorities:** `crystal_ball_enabled` (feature off), `crystal_ball_lock_count` (count only), `leagues` has no `crystal_ball_lock_at`.

---

## 3. Current reveal authority list

Who can see **other members’** pick teams:

| # | Authority | Layer | Notes |
|---|---|---|---|
| R1 | `resolveCrystalBallLock().locked === true` | App | Full `SELECT` without `user_id` filter |
| R2 | `crystal_ball_result` exists | RLS frozen policy | Permanent reveal; **sport-agnostic** |
| R3 | `now() >= 2026-08-29 16:00:00+00` | RLS | **Global all leagues** when wall clock hits |
| R4 | `now() >= 2026-09-10 16:00:00+00` | RLS | **Global all leagues** |
| R5 | `week_results` for week **0 or 1** on that league | RLS | Score-as-reveal; CFB week1 or NFL week0 can trip wrong week |
| R6 | Own pick always | RLS + app | Pre-lock secret self |
| R7 | `crystal_ball_lock_count` | RPC | Count only, not teams |
| R8 | localStorage | Browser | Own device only; other users’ teams not trusted as public pre-lock |

**Mismatch:** App can still be “open” while RLS already reveals (hard-coded date OR wrong sport’s week result). App can show “locked board” while another client still upserts (no DB write lock).

**Cross-sport date risk:** After R3, **NFL** leagues also pass frozen-read even if Week 1 not published. After R4, **CFB** leagues also pass. Product-hostile for multi-sport rooms.

---

## 4. Mutation bypass analysis

### Can a signed-in user change their pick after the UI says locked?

| Path | Result |
|---|---|
| Honest UI (`saveCrystalBallPick` / page `liveLocked`) | **No** — browser rejects |
| Direct Supabase client upsert with session JWT | **Yes** — INSERT/UPDATE policies have **no** lock/crowned check |
| Re-open change mode after lock | UI blocks; raw API does not |

### Direct Supabase write bypass browser lock?

**Yes.** PK `(league_id, user_id)` + `onConflict: "league_id,user_id"` means upsert **replaces** `team_name` / `picked_at`.

### UPSERT overwrite?

**Yes.** Human path and bot RPC both ON CONFLICT DO UPDATE.

### Unique constraint / idempotency

- **PK:** `(league_id, user_id)` — one pick per member per league; replaceable, not append-only.
- **Result PK:** `league_id` — one crown per league; upsert rewrites champion.

### User leaves league after submit

- Pick row remains unless wiped (remove-member tries client DELETE; without DELETE policy + without DEFINER remove path success, row can orphan).
- After leave, membership fails; own-read/update typically fail; row still in table for commissioner wipe / reset.

### League changes sport or season

- `sport_id` immutability is separate (sport trigger elsewhere).
- CB has **no** season key on picks — season reset deletes via `reset_league_season` / archive DEFINER, not automatic on sport change.
- App team list is sport-scoped; stale team names can remain if sport ever changed without wipe.

### Bot picks: production, Foundry, or both?

- **Same RPC** `seed_bot_crystal_ball_picks` from commissioner UI, pad-bots, founder one-click.
- **No Foundry isolation** on lock: production lock is not enforced in RPC.
- Falls back to **localStorage bot picks** if RPC missing (device-only, not cloud).
- Mid-season pad skips CB seed; pure “Seed Crystal Ball” button does not re-check lock.

### Other write paths

| Path | Post-lock risk |
|---|---|
| Bot seed DEFINER | High — can rewrite bot picks anytime |
| `reset_league_season` / trial clear / moderation DEFINER DELETE | Intentional admin wipe |
| Client DELETE in cloud.ts | Likely no-op under RLS if no DELETE policy |
| Offline localStorage | Can show/edit local after lock until cloud fails; cloud path still open if bypassed |

---

## 5. Crown / result analysis

| Question | Finding |
|---|---|
| Who can crown? | **App:** `session.isCommissioner` for `crownNationalChampion`. **Ops closeout:** `grantCrystalBallForChampion` requires `isOps()` but **result RLS is commissioner-only** — ops who are not commissioner will fail cloud write. |
| Commish checked in RLS and app? | **Yes, both** for result writes (app gate + `commissioner_id = auth.uid()`). |
| Update/delete after crown? | **UPDATE via upsert** allowed for commissioner (`FOR ALL`). No immutability trigger. Client DELETE of result only via DEFINER reset/archive. |
| Crown ⇒ reveal? | **Yes in RLS** (R2). App `loadCrystalBall` still keys full board off **`resolveCrystalBallLock`**, not result alone — so crown without L1–L4 may leave app in “secret” mode while DB would allow peer SELECT if client queried without filter. |
| Behavior depending on `crystal_ball_result` | Village Nerd engraving (`auto-trophies`), achievements `crystal_ball_correct`, season closeout readiness, permanent badge `national_nightmare`, trophy ceremony / finale slides, museum copy. |
| Achievements / flex / newspaper | Achievements on crown; gazette uses **no-pick names**, not crown; egg/newspaper not primary CB reveal. |

---

## 6. Scheduling sources

| Source | Origin | Type | Reliable as DB `timestamptz` authority? |
|---|---|---|---|
| `card_games.start_time` | Commissioner publish / odds | **text** (often ISO) | **Partially** — museum SQL already does `start_time::timestamptz` with regex guard; fragile if free-text |
| `week_cards.lock_time` | Card metadata | text (live fact) | **No** as sole CB authority without normalization |
| `week_cards.published_at` | Publish path | used as formal-publish signal | **Yes as presence signal**; not the lock instant |
| First kickoff | `min(valid start_time)` on published opening week | Derived | **Best existing derived lock** for NFL (and CFB kickoff arm) if publish is honest |
| CFB calendar hardcode | App + RLS literals 2026-08-29 | Const | **Not multi-year**; not multi-league |
| NFL calendar hardcode | RLS only 2026-09-10 (app deliberately does **not** use it) | Const | **Conflicts with app product law** |
| `season-calendar.ts` | Client copy/marketing | Year-scoped | **Not DB**; not authoritative for RLS |
| `crystal_ball_enabled` | `leagues` boolean | Feature flag | Not a timestamp |

**Conclusion:** No existing column is a clean per-league CB lock/reveal authority. Kickoff derivation is the strongest **read-only** input if stored as real `timestamptz` and formal-publish is enforced. Calendar still needs a **server-owned** season-keyed value or explicit league/state columns.

---

## 7. Option comparison (A–F) — summary

| Option | Security | Multi-sport | Commish UX | Automation | Notes |
|--------|----------|-------------|------------|------------|--------|
| **A.** Columns on `leagues` | Strong if RLS uses them | Good if set per league | Simple | Server fills | No multi-season history |
| **B.** Dedicated state table | Strong | Best | Slightly more UI | Best audit trail | **Preferred default in remediation design** |
| **C.** Derive kickoff only | Good NFL; CFB gap | Weak CFB | No manual | Breaks if slate wrong | Good *input*, not sole law |
| **D.** Result = reveal only | Good permanent seal | OK | Crown is late | No early board | Product decision |
| **E.** Manual lock/reveal | Depends on discipline | Flexible | High control/error | Weak | Flags easy to undo (integrity risk) |
| **F.** Server automation writes immutable timestamps | Strongest | Strong | Low day-to-day | Highest | Pair with A/B |

Full tradeoffs: see `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md`.

---

## 8. Recommended design direction (map conclusion only)

```text
Dedicated per-league season-aware server-owned state (not multi-clock UI)
One database-authoritative lock timestamp/state
One database-authoritative reveal timestamp/state
Lock and reveal may be separate events (even if initially equal)
Direct writes rejected after lock by database policy/trigger, not merely hidden by UI
Membership checks correlate to the target league
Result existence may trigger permanent reveal only if product adopts it
No hard-coded season-wide timestamps inside RLS
Bot/admin paths obey the same production lock unless explicitly isolated in Foundry
```

**Not repaired by this archive.**

---

## 9. Exact files that would eventually change (inventory for later work)

**App / lib**  
`src/lib/crystal-ball.ts`, `src/app/crystal-ball/page.tsx`, `src/lib/dates.ts`, `src/lib/cloud.ts`, `src/lib/league-hub-actions.ts`, `src/components/HomeWeekHero.tsx`, `src/app/picks/PicksClient.tsx`, `src/components/PlayerWeekChecklist.tsx`, `src/lib/auto-trophies.ts`, `src/lib/season-closeout.ts`, `src/lib/gazette.ts`, `src/app/commissioner/CommissionerClient.tsx`, `ManageLeagueClient.tsx`, league-build, `src/lib/founder-one-click.ts`, `src/lib/league-sync.ts`, `src/lib/session-restore.ts`, `scripts/verify-crystal-ball-states.mjs`

**SQL (eventual)**  
`supabase/crystal-ball*.sql`, `bot-crystal-ball.sql`, `reset-season.sql`, `gazette-archive.sql`, `moderation.sql`, `trial-bots.sql`, new D1C apply (replacing blocked stub)

---

## 10. Product decisions Mike must make

See concise **P1–P12** table in `docs/D1C-CRYSTAL-BALL-AUTHORITY-REMEDIATION.md` (authoritative for remediation). Map-level list:

1. Lock vs reveal same instant or delayed  
2. Crown permanently reveals?  
3. Opening-week scored as ordinary lock/reveal? (recommend **no**)  
4. CFB calendar source  
5. No published slate: fail open vs closed  
6. Bot seed after lock  
7. Re-crown immutability  
8. Ops vs commissioner crown  
9. Storage: state table vs leagues columns  
10. Orphan picks on leave  
11. Multi-season versioning  
12. Unparseable schedule fail mode  

---

## 11. Safe migration / backfill / test sequence (high level)

1. Archive this map  
2. Freeze Mike product decisions  
3. Schema/RLS/RPC **design only** (no execute SQL in this phase)  
4. Ephemeral DB tests  
5. App dual-read  
6. Production SELECT-only preflight  
7. Apply only with separate explicit authorization  
8. Backfill state **without** modifying picks  
9. Enable DB write/reveal enforcement  
10. Remove legacy dates, scored-week reveal, browser-only authority  
11. Disposable behavioral tests  

**Do not** bundle with H-01A / D1B-A/B/C apply.

---

## 12. Executive risk summary

| Risk | Severity |
|------|----------|
| App lock without DB write lock | **High** — spoofable post-lock pick change |
| Multi-OR RLS reveal (dates + score + result) | **High** — wrong-sport / early reveal |
| Membership tautologies | **High** — cross-league membership gate weak (**D1B** separate) |
| Bot DEFINER ignores lock | **Medium–High** |
| Hard-coded 2026 in RLS vs app NFL law | **High** product/security split |
| `start_time` as text | **Medium** automation reliability |
| ~7 live picks, 0 results | Low cleanup urgency; **no cleanup authorized** |

---

## Status line

**Production unchanged by this archive.**  
**D1C not repaired.**  
**No executable SQL created in the mapping session.**  
**No app code changed for this archive (docs only when committed with design).**  
**No live picks/results mutated.**
