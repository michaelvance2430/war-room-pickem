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

### PB-1 — Account / Profile first-load longtask (repeatable ~1.7–2.1s)

**Severity:** Performance backlog — **high priority after onboarding / Commissioner scrub**  
**Not a P0 runtime emergency.** Do **not** modify production during the current usability scrub.

**Classification strengthened:** prior sample looked one-off; **new production sample repeats** the pattern → treat as **repeatable**, not fluke.

#### One-line backlog label

> **PB-1 — Account/Profile first-load work produces a repeatable ~1.7–2.1s longtask while network stays fast.**

#### Evidence (production)

| Sample | Context | Network / RSC | Longtask | Timer lag | Failures / freeze |
|--------|---------|---------------|----------|-----------|-------------------|
| **A (earlier)** | `/account` completed | Profile RSC/chunk ~**1057 ms**; Founder+Supabase ~124–135 ms healthy | **~1759 ms** | **~1415 ms** | None; no #418; no multi-10s freeze |
| **B (new)** | `/account` completed | Profile request **76 ms**; profile RSC **120 ms** | **~2054 ms** | **~1381 ms** | No failed War Room request; no complete freeze |

**Shared pattern (both samples):**

- Longtask occurs around **Account / Profile first-load work**  
- **Network remains fast** (ms-scale profile requests / healthy RSC in sample B)  
- Likely **chunk evaluation**, **synchronous render**, or **shared import graph** — not a Supabase hang  
- `feature_collector.js` remains **browser/extension noise** (ignore for War Room attribution)

#### Later baseline mission (measure before any optimize)

1. Cold **Account** ×3  
2. Warm **Account** ×3  
3. Cold **Profile** ×3  
4. Warm **Profile** ×3  
5. Chrome Performance **Bottom-Up** on the **slowest cold Account** run  
6. Identify **top function/module by self time**  
7. Confirm whether Account **statically imports** profile / store / badge / history modules  
8. Compare **route chunk** vs **shared chunk** evaluation  
9. **Optimize only after attribution** (and only after onboarding / Commissioner scrub)

**Do not optimize until:**

- Usability scrub (onboarding / Commissioner) is complete  
- Cold/warm matrix above exists  
- Bottom-Up names the owning module/function  

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

> **PB-2 — Home longtask (~1–1.5s) persists even when `listScoredWeekNumbers` is CACHE_HIT; cold path also has concurrent scored-week stampede.**

#### Raw evidence (as reported)

**Sample A — cold scored-week cache (query storm)**

| Signal | Value |
|--------|--------|
| Context | One **Home** navigation (production still healthy overall) |
| Completed `listScoredWeekNumbers` chains (same navigation) | **511 ms**, **230 ms**, **295 ms**, **353 ms**, **419 ms** |
| Each chain pattern | `week_results` → `game_results` **serially** |
| Longtask | **~994 ms** |
| Timer starvation | **~647 ms** |
| Healthy contrast | `current_week` single-flight dedupe works; standings ~142 ms; most Supabase ~77–355 ms |
| Not present | Hydration error, stack overflow, catastrophic freeze |

**Sample B — warm scored-week cache (no query storm)**

| Signal | Value |
|--------|--------|
| Context | Home / shared app-shell work (production healthy) |
| `listScoredWeekNumbers` | **176 ms** (one network completion) |
| Subsequent scored-week calls | **CACHE_HIT** |
| `memberships` | **~102 ms** |
| Longtask | **~1197 ms** |
| Failed War Room requests | **None** |
| Freeze | **None** |
| Noise | `feature_collector.js` — **browser/extension** (ignore) |

**Sample C — fully warm scored-week cache (stronger counter-evidence)**

| Signal | Value |
|--------|--------|
| Context | Home / app-shell (production healthy; usability scrub period) |
| `listScoredWeekNumbers` | **CACHE_HIT** (already warm — network query did not own the path) |
| Longtask | **~1546 ms** |
| Timer-lag starvation | **~651 ms** |
| Failed War Room requests | **None** |
| Freeze | **None** |
| Noise | `feature_collector.js` — **browser/extension** (ignore; not War Room) |

**Interpretation (baseline only):**

- **Sample A:** Multiple independent callers race `listScoredWeekNumbers` before the TTL cache is filled. Concurrent misses each run the full serial two-query path. Completions + React setState fan-out can align with a ~1s main-thread longtask. This is **overlap waste**, not a single multi-second Supabase hang.  
- **Sample B:** Does **not** show another query storm — scored-week cache was warm (CACHE_HIT after one 176 ms load). Still shows another **~1.2s main-thread task** while network stays small.  
- **Sample C:** Further **weakens** the theory that the **network query itself owns the longtask**. Scored-week was already warm (**CACHE_HIT** only); longtask rose to **~1546 ms** with timer-lag **~651 ms**, still no failed WR requests and no freeze.  

**Working split (evidence-only, no fix yet):**

| Thread | What samples support | What they do not prove |
|--------|----------------------|-------------------------|
| **(1) Cold concurrent stampede** | Sample A only | Not the sole cause of ~1–1.5s longtask |
| **(2) Main-thread Home / app-shell work** | Samples B + C (warm / CACHE_HIT) | Exact owning function unknown without Bottom-Up |

**Implication for later attribution:** Single-flight scored-week may still be worth doing for Sample A waste, but **will not by itself explain Sample C**. Trace must prioritize main-thread causes (see checklist below).

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

##### 6. Does the longtask align with multi-query + React updates?

**Sample A (plausible, not proven with one Chrome profile):**

- Five serial chains completing within one navigation window (~230–511 ms each, overlapping)  
- Each completion: cache write + promise resolve + component `setState`  
- Main-thread longtask **~994 ms** + timer starvation **~647 ms** is consistent with **batched layout/commit work** when several widgets update from the same data shape, not with a single 994 ms Supabase RTT  

**Sample B (counter-evidence):**

- Scored-week was **warm** (CACHE_HIT after one 176 ms load)  
- Network small (`memberships` ~102 ms)  
- Longtask still **~1197 ms**  

**Sample C (stronger counter-evidence):**

- `listScoredWeekNumbers` already **CACHE_HIT** (no scored-week network work observed as owner)  
- Longtask **~1546 ms** + timer-lag **~651 ms**  
- No failed War Room request; no freeze  
→ Longtask is **not explained by** the scored-week network query. Prefer main-thread attribution on later traces.  

#### Later Performance trace checklist (when PB-2 is worked)

**Priority order for the later warm-cache / CACHE_HIT longtask (Sample B–C class):**

1. **Shared Home / app-shell React commit work** (Home page + Nav + layout shell paint)  
2. **Multiple consumers updating from the same cached snapshot** (many widgets `setState` / re-render on identical scored-week / progressive data)  
3. **Synchronous derived calculations** (on render or immediately after resolve — not network)  
4. **Chunk / module evaluation** (route or shared chunk first-eval on the critical path)  
5. **Global route-change listeners** (shell effects that re-fire on Home nav)

Still record for cold path (Sample A class):

- Scored-week START vs CACHE_HIT counts  
- Whether single-flight would collapse concurrent chains  

**Always:** cold vs warm Home, largest longtask, Bottom-Up **self time** for the slowest **warm CACHE_HIT** run.

#### Likely future safe fix (do not implement yet)

1. **Single-flight Promise per league** for `listScoredWeekNumbers` (mirror `activeWeekInflight` / `cardInflight`) — addresses Sample A stampede only.  
2. **One shared scored-week snapshot** (or callers always go through `resolvePlayerActiveWeek` / progressive snapshot only).  
3. Parallelize `week_results` + `game_results` **only if** semantics allow (today game_results needs week_result ids — second query must wait for first; **intra-function** stays serial; **inter-caller** must dedupe).  
4. Prevent multiple widgets from independently re-deriving UI from identical parallel / cache hits (lift state or subscribe to one store) — candidate for Sample B–C.  
5. After single-flight: if warm-cache Home still shows &gt;500 ms longtask (Samples B–C already do), attribute via **priority checklist 1–5** (may join PB-1-style chunk/render work).  

**Do not** change scoring logic, onboarding product flow, or production behavior in this backlog pass.  
**Do not modify production during the usability scrub.**

#### When structured performance scrub resumes

Measure before/after:

1. Cold Home open — count of `listScoredWeekNumbers` START vs CACHE hits  
2. Warm Home open (&lt;12s) — expect CACHE only (Sample C class)  
3. Longtask max on Home nav (**cold and warm** — Sample B ~1.2s, Sample C ~1.5s warm)  
4. Whether single-flight collapses 5 chains → 1 (Sample A only)  
5. Trace **priority checklist 1–5** on the slowest **CACHE_HIT** run  

---

### PB-3 — Announcements route one-off ~815 ms longtask

**Severity:** Stabilization note — **not P0**  
**Rule:** Baseline candidate only. **Do not change production** for this yet.  
**Production remains functional and responsive.**

#### One-line backlog label

> **PB-3 — Announcements route produced a one-off 815 ms longtask.**

#### Raw evidence (as reported)

| Signal | Value |
|--------|--------|
| Context | `/announcements` |
| Route | Completed normally |
| Profile request | ~**96 ms** (healthy) |
| Longtask | **one-off ~815 ms** |
| Failed War Room requests | **None** |
| Freeze | **None** |
| Noise | `feature_collector.js` warning — treat as **browser/extension**, not War Room |

**Interpretation (baseline only):** Single longtask on an otherwise healthy navigation. Network path looks fine. Treat as possible first-chunk / module evaluation or one-time main-thread work until the cold/warm matrix proves it is **repeatable**.

#### When structured performance baseline runs (measure before any optimize)

1. Cold **Announcements** open — **three** times  
2. Warm **Announcements** open — **three** times  
3. Record **median largest longtask** (cold median vs warm median)  
4. Determine whether **first chunk/module evaluation** owns it (Chrome Bottom-Up / WR-PERF script URL)  
5. **Only optimize if** the longtask is **repeatable above 500 ms** **or** visibly disruptive  

**Do not optimize** a one-off sample or extension-noise correlation.

---

## Scrub order (reminder)

1. Usability / framework scrub across core desks (**including current Commissioner / onboarding scrub**)  
2. Capture cold/warm baselines (table above + **PB-1** Account/Profile matrix + **PB-2** Home scored-week + **PB-3** Announcements)  
3. Only then optimize in priority order if numbers still justify:  
   - **PB-1 first** (high priority — repeatable ~2s Account longtask; chunk/import attribution)  
   - then PB-2 (scored-week single-flight)  
   - then PB-3 (Announcements only if cold/warm median &gt; 500 ms or visibly disruptive)  

---

## Out of scope for this backlog entry

- Re-enabling DeferredChrome  
- Restoring eager profile details  
- Removing WR-PERF instrumentation (separate cleanup after scrub)  
- Schema / query redesign for “feel snappier” without profiles  
- **Implementing PB-2 single-flight / shared store (blocked until post-usability scrub)**  
- **Implementing PB-3 Announcements optimizations (blocked until cold/warm matrix)**  
- Investigating or “fixing” `feature_collector.js` (browser/extension)  
