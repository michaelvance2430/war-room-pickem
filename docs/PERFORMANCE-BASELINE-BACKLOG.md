# Performance baseline backlog (post-P0)

**Status:** Stabilization only — **not P0**  
**Rule:** Do **not** optimize these items until the structured app usability scrub is complete and we have repeatable baseline numbers.

P0 freezes (DeferredChrome, sport-theme recursion, event-loop starvation, 20–100s profile blocks) are considered **closed**. Remaining work is measurement-first polish.

---

## Healthy production baseline (reference)

| Surface | Observation |
|---------|-------------|
| Standings / Board / navigation | Sub-second, responsive |
| Supabase typical | ~60–270 ms |
| Founder + Supabase | ~124–135 ms (healthy) |
| React #418 | Fixed |
| Complete freeze / multi-10s longtasks | Not reproducing |

---

## Backlog items

### PB-1 — Account / Profile first-load chunk evaluation (~1.7s longtask)

**Severity:** Stabilization note — **not P0**  
**Observed on current production (do not change production for this yet)**

| Signal | Value |
|--------|--------|
| Context | `/account` navigation worked |
| Profile RSC / chunk | ~**1057 ms** |
| Longtask | **~1759 ms** |
| Timer lag | **~1415 ms** |
| Founder + Supabase | ~124–135 ms (healthy) |
| Complete freeze | None |
| React #418 | None |
| 20–100 s block | None |

**One-line backlog label:**

> **Account/Profile first-load chunk evaluation can create a ~1.7s longtask.**

**When structured app scrub begins, measure (before any optimize):**

1. Cold **Account** open  
2. Warm **Account** open  
3. Cold **Profile** open  
4. Whether the longtask occurs **only on first chunk load**  
5. Top component/module by **React Profiler** or Chrome **Bottom-Up** (self time + script URL)

**Do not optimize until:**

- Framework usability scrub is complete  
- Repeatable baseline numbers exist for the five measurements above  

**Related (historical, closed as P0):**

- `docs/PROFILE_PRE_RENDER_FREEZE.md`  
- `docs/PROFILE-MAIN-THREAD-FREEZE.md`  
- Containment: identity-first profile, DeferredChrome production safe mode  

---

### PB-2 — Duplicate concurrent scored-week snapshot loads on Home

**Severity:** Stabilization note — **not P0**  
**Rule:** Log only. **Do not implement** until after the current Commissioner / onboarding usability scrub.  
**Production remains functional and responsive.**

#### One-line backlog label

> **PB-2 — Duplicate concurrent scored-week snapshot loads on Home; observed 994 ms longtask and repeated 230–511 ms serial query chains.**

#### Raw evidence (as reported)

| Signal | Value |
|--------|--------|
| Context | One **Home** navigation (production still healthy overall) |
| Completed `listScoredWeekNumbers` chains (same navigation) | **511 ms**, **230 ms**, **295 ms**, **353 ms**, **419 ms** |
| Each chain pattern | `week_results` → `game_results` **serially** |
| Longtask | **~994 ms** |
| Timer starvation | **~647 ms** |
| Healthy contrast | `current_week` single-flight dedupe works; standings ~142 ms; most Supabase ~77–355 ms |
| Not present | Hydration error, stack overflow, catastrophic freeze |

**Interpretation (baseline only):** Multiple independent callers race `listScoredWeekNumbers` before the TTL cache is filled. Each winner of the race (all concurrent misses) runs the full serial two-query path. Completions + React setState fan-out can align with a ~1s main-thread longtask and timer lag. This is **overlap waste**, not a single 2s Supabase hang.

#### Audit answers (code, no code changes)

##### 1. Mounted / concurrent callers that can hit scored-week loads on Home / app shell

**Direct `listScoredWeekNumbers()` (or via helpers that always call it):**

| Surface | Path | Notes |
|---------|------|--------|
| Progressive snapshot | `src/lib/progressive-disclosure.ts` | `getProgressiveSnapshot` → `listScoredWeekNumbers` in parallel with `syncFirstWeekFromCloud` + active week; Home boot uses this repeatedly |
| First-week sync | `src/lib/first-week.ts` | `ensureSeasonAliveFromCloud` / `syncFirstWeekFromCloud` → scored list (short-circuits when local flags already unlocked) |
| Active week resolve | `src/lib/active-week.ts` | `resolvePlayerActiveWeek` always `Promise.all([loadLeagueActiveWeek, listScoredWeekNumbers])` |
| Home week hero | `src/components/HomeWeekHero.tsx` | Uses `resolvePlayerActiveWeek` → scored list |
| Home host score strip | `src/components/HomeHostScoreStrip.tsx` | May call `listScoredWeekNumbers` again if `scored` empty from resolve |
| Gazette spotlight | `src/components/HomeGazetteSpotlight.tsx` | Own `listScoredWeekNumbers()` in `useEffect` |
| Lock picks roast | `src/components/LockPicksRoast.tsx` | Own scored list (+ often `resolvePlayerActiveWeek`) |
| Player week checklist | `src/components/PlayerWeekChecklist.tsx` | Own scored list |
| Commish setup banner | `src/components/CommishSetupBanner.tsx` | Own scored list (first-time host Home) |
| Onboarding start | `src/lib/onboarding/start.ts` via `OnboardingHost` in Nav | `listScoredWeekNumbers` for first-time host gate |
| Story doors | `src/lib/story-doors.ts` | Can call scored list after first-week sync |

**Home composition (`src/app/page.tsx`):** progressive snapshot / first-week chrome on boot; mounts `HomeWeekHero`, `CommishSetupBanner`, and (when not first-week chrome) `HomeGazetteSpotlight`, `LockPicksRoast`, `PlayerWeekChecklist`, etc. **App shell** (`AppShell` → `Nav` → `OnboardingHost`) can start onboarding in parallel with Home widgets.

##### 2. Why several calls miss or begin before the shared cache is populated

- Cache is **result TTL only** (`scoredCache` + `LIST_TTL_MS` = 12s), keyed by `leagueId`.  
- On concurrent miss, **every** caller proceeds into network work.  
- First completion writes the cache; callers that already passed the `cacheGet` check **do not join** an in-flight promise — they finish their own chain.  
- Observed 5 completions on one Home nav matches **≥5 overlapping cold starts**, not five sequential TTL expiries.

##### 3. In-flight Promise dedupe map?

| Loader | Result TTL | In-flight / single-flight map |
|--------|------------|-------------------------------|
| `loadLeagueActiveWeek` / `current_week` | yes | **yes** — `activeWeekInflight` |
| `loadWeekCard` | yes | **yes** — `cardInflight` |
| `loadLeaguePlayers` | yes | **yes** — `playersInflight` |
| roster / joined-at | yes | **yes** |
| **`listScoredWeekNumbers`** | **yes** (`scoredCache`) | **no** — **missing** `scoredInflight` (or equivalent) |

See `src/lib/cloud.ts` ~L107–110 vs `listScoredWeekNumbers` ~L2085–2246: cache hit returns early; cache miss always starts a new serial `week_results` then `game_results` query pair.

##### 4. Cache scope by league

- **Yes:** `cacheGet(scoredCache, session.leagueId, LIST_TTL_MS)` / `cacheSet(..., session.leagueId, ...)`.  
- Correct multi-league isolation.  
- PB-2 is **not** cross-league bleed; it is **same-league concurrent stampede**.

##### 5. Multiple Home widgets independently request the same snapshot

**Yes.** At minimum, overlapping patterns on a mature Home paint:

1. Progressive snapshot (shell chrome)  
2. First-week cloud sync (nested scored probe)  
3. HomeWeekHero → `resolvePlayerActiveWeek`  
4. One or more of: Gazette spotlight, Lock roast, Player checklist, Commish banner  
5. Onboarding host (if first-time host path)

Each sets its **own** React state when done → multiple identical list results can trigger multiple re-renders.

##### 6. Does the ~994 ms longtask align with multi-query + React updates?

**Plausible alignment (not proven with a single Chrome profile in this note):**

- Five serial chains completing within one navigation window (~230–511 ms each, overlapping)  
- Each completion: cache write + promise resolve + component `setState`  
- Main-thread longtask **~994 ms** + timer starvation **~647 ms** is consistent with **batched layout/commit work** when several widgets update from the same data shape, not with a single 994 ms Supabase RTT  

When future work starts: confirm with WR-PERF / Performance panel that longtask **self time** sits in React commit / script after multiple `listScoredWeekNumbers` DONE markers, not inside one network wait.

#### Likely future safe fix (do not implement yet)

1. **Single-flight Promise per league** for `listScoredWeekNumbers` (mirror `activeWeekInflight` / `cardInflight`).  
2. **One shared scored-week snapshot** (or callers always go through `resolvePlayerActiveWeek` / progressive snapshot only).  
3. Parallelize `week_results` + `game_results` **only if** semantics allow (today game_results needs week_result ids — second query must wait for first; **intra-function** stays serial; **inter-caller** must dedupe).  
4. Prevent multiple widgets from independently re-deriving UI from identical parallel fetches (lift state or subscribe to one store).  

**Do not** change scoring logic, onboarding product flow, or production behavior in this backlog pass.

#### When structured performance scrub resumes

Measure before/after:

1. Cold Home open — count of `listScoredWeekNumbers` START vs CACHE hits  
2. Warm Home open (&lt;12s) — expect CACHE only  
3. Longtask max on Home nav  
4. Whether single-flight collapses 5 chains → 1  

---

## Scrub order (reminder)

1. Usability / framework scrub across core desks (**including current Commissioner / onboarding scrub**)  
2. Capture cold/warm baselines (table above + PB-1 + **PB-2** Home scored-week stampede matrix)  
3. Only then: chunk-split / dynamic import (PB-1) **or** scored-week single-flight (PB-2) if still justified  

---

## Out of scope for this backlog entry

- Re-enabling DeferredChrome  
- Restoring eager profile details  
- Removing WR-PERF instrumentation (separate cleanup after scrub)  
- Schema / query redesign for “feel snappier” without profiles  
- **Implementing PB-2 single-flight / shared store (blocked until post-usability scrub)**  
