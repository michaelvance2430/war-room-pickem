# Standings & Board performance — critical path audit

**Date:** 2026-08-03  
**Scope:** `/standings` and `/board` only  
**Mode:** Code waterfall + live schema probes + temporary `[WR-PERF]` instrumentation  
**Status:** **Diagnosis only — no product fix implemented yet**

Temporary logs (dev or `localStorage.warroom-runtime-debug=1`):

- `[WR-PERF][standings] …`
- `[WR-PERF][board] …`
- `performance.mark('wr-standings:*')` / `wr-board:*`

---

## Executive answer to the 8 questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Page blocked on `loadLeagueActiveWeek`? | **Standings: no.** Board: **yes in phase 1** — `Promise.all` with published + scored weeks; wall clock = max of three, not serial. |
| 2 | Failed Supabase requests timeout before fallback? | **Standings: yes risk.** Primary memberships embed uses **`withTimeout` 8s**; on error/timeout, **another 6s** fallback. Page races with **`pageLoad` 4s** + UI failSafe **3.5s**. |
| 3 | Optional `league_first_joins` / reactions block core? | **Standings core: no** (not on `loadLeaguePlayers` path). **Roster path:** `loadJoinedAtByUser` hits missing `league_first_joins` (404, fast) then memberships. **Board: no locker reactions.** |
| 4 | React #418 delay interaction? | **Possible secondary** (hydration recovery). Not the main data bottleneck for these pages. |
| 5 | Why 2–3× `prepareNavigation` per click? | **Proven multi-call sites:** Nav `onClick`/`closeChrome` + SmoothRuntime capture-phase click (+ optional menu effect). Not a data fetch loop. |
| 6 | Page + shell same loaders? | **Standings:** page → `loadLeaguePlayers`; shell hydrator may also hit roster/active week separately. CrownAndShame reuses **passed `players`** (good). |
| 7 | Sequential should be parallel? | **Board `loadLeagueWeekBoard` is sequential** (results → card → members → picks → pick_games). Page already parallelizes phase 1 and phase 2, but **inner board re-awaits `loadWeekCard`**. |
| 8 | Missing schema → long waits? | **404s are usually fast.** **Timeouts** (8s/6s/4s) cause long waits when requests hang or stack. **`get_league_roster` 404** hurts roster/Home hydrators more than standings players path. Fail-backoff on `current_week` (5s) can show as repeated fail logs without multi-inflight. |

---

## /STANDINGS

### Loader entry

| Item | Location |
|------|----------|
| Page component | `src/app/standings/page.tsx` `StandingsPage` |
| Effect | `useEffect` ~line 51 `load()` |
| Core data | `pageLoad(loadLeaguePlayers(), [])` → `src/lib/cloud.ts` `loadLeaguePlayers` → `loadLeagueStandings` |
| Ceilings | `PAGE_LOAD_MS = 4000` (`smooth.ts`); failSafe **3500ms** clears spinner; standings query primary **8000ms** + fallback **6000ms** |

### Code waterfall (from click → usable)

```
T+0ms    Click Standings link
         ├─ Nav closeChrome → prepareNavigation()          [Nav.tsx]
         ├─ SmoothRuntime capture click → prepareNavigation()  [SmoothRuntime]
         └─ (maybe menu effect prepareNavigation if menu was open)

T+~0     Router soft-nav starts; loading.tsx may flash

T+~0     StandingsPage mount → loading=true → "Loading the board…"
         effect: mark engagement (dynamic import, non-blocking to data)
         start pageLoad(loadLeaguePlayers)

T+0…     loadLeaguePlayers
         ├─ playersCache hit? → return (fast)
         └─ loadLeagueStandings
              ├─ PRIMARY: memberships.select("*, profiles(display_name, last_seen_at)")
              │    withTimeout 8_000
              │    SUCCESS → map rows → return  ───★ critical path
              └─ FAIL/timeout → FALLBACK memberships.select without last_seen
                   withTimeout 6_000  ───★ can add +6s after primary failure

T+≤4000  pageLoad may resolve [] if standings still running
T+≤3500  failSafe forces setLoading(false)  ───★ spinner gone even if empty

T+…      setPlayers → rankPlayersWithSwings (CPU, local)
         CrownAndShame with players prop (no second cloud if list non-empty)
         Each row: PlayerLink (mount: 1× loadLeagueActiveWeek, single-flight)
         standingsHardwareFlair (local)

T+interactive  loading=false + table rendered
```

### What blocks first meaningful render

| Blocks spinner off? | Source |
|---------------------|--------|
| **Primary** | `loadLeaguePlayers` / memberships embed finishing **or** failSafe 3.5s / pageLoad 4s |
| **Not** | `loadLeagueActiveWeek` (not awaited on standings page) |
| **Not** | `league_first_joins` (not on this path) |
| **After paint** | PlayerLink week fetch (cached/single-flight); hardware flair CPU |

### Primary bottleneck (standings)

**`loadLeagueStandings` memberships→profiles query** (`cloud.ts` ~2474–2520) is the **only** required network for the table.  

**Worst-case wall clock:** primary hang → 8s timeout → fallback hang → +6s = **up to ~14s** inside loader, while UI may already show empty after **3.5–4s**.

**Secondary:**  
- Fail-open empty standings feels like “failed to load.”  
- Many PlayerLinks still mount (one week fetch shared).  
- `prepareNavigation` 2× is noise, not the board delay.  
- React #418 may cause extra client recovery cost.

### Exact queries (standings)

```
GET /rest/v1/memberships?select=*,profiles(display_name,last_seen_at)&league_id=eq.<id>
  optional fallback without last_seen_at
```

No `current_week` on critical standings path.

---

## /BOARD

### Loader entry

| Item | Location |
|------|----------|
| Page | `src/app/board/page.tsx` `BoardInner.load` (~70) |
| Trigger | `useEffect([weekParam, load])` + `goWeek` |

### Two-phase waterfall

```
PHASE 1 — Promise.all (parallel wall = max)
  listPublishedWeekNumbers()  → week_cards week_number          [timeout 8s]
  listScoredWeekNumbers()     → week_results (+ maybe game_results) [timeouts]
  loadLeagueActiveWeek()      → leagues current_week            [5s cache / single-flight / fail-backoff]

PHASE 2 — Promise.all (parallel wall = max)
  loadWeekCard(target)              → week_cards + card_games
  loadWeekResultsFromCloud(target)  → week_results + game_results (serial inside)
  loadLeagueWeekBoard(target)       → ★ SEQUENTIAL chain (see below)
```

### Inside `loadLeagueWeekBoard` (sequential — critical)

```
1. week_results (scored?)
2. await loadWeekCard(week)          ← often DUPLICATE of phase-2 card (inflight helps)
3. memberships + profiles names
4. picks for week (fallback select if is_chaos column missing)
5. pick_games for all pick ids
6. assemble slips
```

File: `cloud.ts` ~1458–1570+.

### What blocks board interactive

| Gate | Detail |
|------|--------|
| `loading=true` until **both** phase 1 and phase 2 complete | No intermediate shell of “weeks ready, slips loading” |
| failSafe | `armLoadingFailSafe(setLoading, 6_000)` — spinner max ~6s |
| Phase 1 max | Slowest of published / scored / active week (timeouts 6–8s) |
| Phase 2 max | Slowest of card / results / **full sequential board** |

### Primary bottleneck (board)

1. **`loadLeagueWeekBoard` sequential awaits** — cannot finish phase 2 before members + picks + pick_games chain completes; card loaded twice (outer + inner).  
2. **Phase 1 waits on three list/week endpoints** before any card fetch starts — even if target week is known from URL (`?week=`).  
3. **Missing optional tables** (`league_first_joins`, reactions) are **not** on this board path; **picks/RLS/lock gate** can return “secret until kickoff” without being a hang.

### Secondary

- `listScoredWeekNumbers` multi-step with timeouts.  
- `current_week` fail-backoff: repeated failures after 5s, not multi-inflight.  
- Double `prepareNavigation` on click.

---

## Measured / probe timings (agent)

| Probe | Result |
|-------|--------|
| `league_first_joins` | **404** PGRST205 (fast fail, not 8s hang by itself) |
| `locker_message_reactions` | **404** PGRST205 |
| `memberships` simple | **200** |
| Full standings-style select | **200** (anon, empty or small payload) |
| Browser hop waterfalls | **Mike must capture** with `[WR-PERF]` after deploy |

**Fill-in after Mike’s run:**

```
Standings: loading-false-interactive +____ms
  primary-done +____ms err=
Board: phase1-done +____ms phase2-done +____ms
  weekBoard: week_results / card / memberships / picks +____ms each
```

---

## prepareNavigation 2–3× per click (proven)

| # | Site | When |
|---|------|------|
| 1 | `Nav.tsx` `closeChrome` / Link `onClick` | User clicks nav |
| 2 | `SmoothRuntime.tsx` capture `click` on `a[href]` | Same click |
| 3 | `Nav.tsx` menu effect when `menuOpen` → false | If mobile menu was open |

**Not** a Supabase storm. Safe later cleanup: one prepare path only.

---

## React #418 (separate track)

Most likely shell: **`Nav` `isoEnabled()` during render** (localStorage vs SSR).  
Not fixed here. May add jank after data is ready.

---

## Smallest fix sequence (do not implement until Mike confirms WR-PERF numbers)

### P0 — Board

1. **Parallelize `loadLeagueWeekBoard`:** after knowing `lockedOpen` needs, run `memberships` + `picks` in `Promise.all`; avoid second card fetch if card passed in.  
2. **Skip phase 1 when `?week=` valid:** don’t block on published/scored/active lists for first paint of that week (still load lists for week switcher in background).  
3. **Lower hang ceilings** only if probes show hangs (prefer fail-fast over 8s+6s).

### P0 — Standings

1. **Don’t run 6s fallback after 8s timeout when `pageLoad` already abandoned** — or single attempt with **≤3–4s** timeout matching `pageLoad`.  
2. **Paint shell immediately** from local session roster/cache if any (shell first).  
3. Ensure primary memberships select doesn’t error (schema/RLS) so fallback never runs.

### P1 — Schema (separate mission already drafted)

- Apply `FIX-PRODUCTION-SCHEMA-DRIFT.sql`  
- Add `league_first_joins` / join-order when titles needed  
- Reactions optional, non-blocking (already fail-soft in locker)

### P2 — UX noise

- Deduplicate `prepareNavigation`  
- Hydration #418 after data path fixed

### Expected improvement (if sequential board + double timeout are confirmed)

| Page | Expected |
|------|----------|
| Standings | Spinner ≤ ~1–2s on healthy network; empty only on real empty roster / auth fail — not 3.5s timeout empty |
| Board | Phase 2 wall ≈ max(card, results, picks∥members) instead of sum of sequential awaits; drop one card RTT |

---

## Instrumentation how-to (Mike)

```js
localStorage.setItem("warroom-runtime-debug", "1");
// hard refresh
// open Standings, watch console [WR-PERF][standings]
// open Board, watch [WR-PERF][board] phase1/phase2/weekBoard
performance.getEntriesByType("measure").filter(e => e.name.startsWith("wr-"))
```

---

## Files touched for instrumentation only

| File | Change |
|------|--------|
| `src/app/standings/page.tsx` | `[WR-PERF][standings]` marks |
| `src/app/board/page.tsx` | `[WR-PERF][board]` phase marks |
| `src/lib/cloud.ts` | standings query + weekBoard substep logs |

**No behavioral fix** beyond existing current_week dedupe already shipped.

---

## Remaining risks

- Attributing “slow” solely to request count (already fixed) while **sequential board** and **long timeouts** still dominate.  
- Auth RLS making memberships slow for real session vs anon probe.  
- Picks locked gate returns intentional empty board (product), not hang.

---

**END — wait for Mike’s `[WR-PERF]` paste before implementing P0 fixes.**
