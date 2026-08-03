# Profile pre-render freeze (P0) — attribution mission

**Date:** 2026-08-03  
**Build under test:** containment `0f802f4` (`fix(profile): prevent duplicate navigation and defer heavy profile work`)  
**Status:** Instrumentation + audit only. **No speculative profile rewrite.**

---

## Live production evidence (containment failed)

| Observation | Result |
|-------------|--------|
| Duplicate-nav guard | **Works** — exactly one `click-received` |
| `prepareNavigation` | **1 ms** |
| Immediate longtask | **`[WR-PERF][longtask] 52030 ms`** then **`11220 ms`** |
| UI | Profile stuck on **Loading** |
| Profile timings | **No** `evaluateBadges` / `buildResume` / details markers before freeze |

### Conclusion

The deferred profile-details path is **not** the immediate blocker.  
The ~52s main-thread task happens **between** PlayerLink click and lightweight ProfilePage becoming interactive (likely before or during module evaluation / first paint).

---

## 1. Route-boundary markers (instrumented)

Enable:

```js
localStorage.setItem("warroom-runtime-debug", "1")
// hard refresh
```

### Expected log sequence on a healthy profile click

```
[WR-PERF][profile-route] click @T0 id=…
[WR-PERF][profile-route] Link.nav-prepare /profile/…
[WR-PERF][prep-nav] START …          // ~1ms
[WR-PERF][profile-route] Link.nav-prepare-done
// Next fetches / evaluates profile chunk
[WR-PERF][profile-route] module-top          // profile page module evaluated
[WR-PERF][profile-route] render-enter        // ProfilePage function body
[WR-PERF][profile-route] AppShell.render-start  (if re-render)
[WR-PERF][profile-route] Nav.render
[WR-PERF][profile-route] effect-enter
[WR-PERF][profile] data-effect-start
[WR-PERF][profile-route] SmoothRuntime.route-effect /profile/…
[WR-PERF][profile-route] SmoothRuntime.dispatch-route-change
[WR-PERF][profile-route] listener:PlayerLink.…
[WR-PERF][profile-route] SmoothRuntime.dispatch-route-change-done
[WR-PERF][profile] interactive
```

### How to read failure modes

| Last marker before 52s longtask | Meaning |
|--------------------------------|---------|
| `click` only (no `module-top`) | Freeze **before** profile module runs: Next chunk fetch/eval of **shared** deps, or global shell work on same tick as nav |
| `click` → `Link.nav-prepare-done` only | Stuck in **router / RSC / chunk load**, not ProfilePage |
| `module-top` but no `render-enter` | Module body ran side effects; hang during **import graph evaluation** or React setup |
| `render-enter` but no `effect-enter` | Hang during **first render** (sync work in ProfilePage body or child layout) |
| `effect-enter` then longtask | Hang in **data effect** or concurrent shell commits |
| `module-top` **after** longtask | Longtask is **pre-module** (shell / shared chunk / previous page unmount) |

Also: longtask lines now include `after=<last wr-profile-route mark>` when available.

Chunk downloads (when observable):

```
[WR-PERF][chunk] … PROFILE …
```

### Files instrumented

| File | Markers |
|------|---------|
| `src/components/PlayerLink.tsx` | `click`, `listener:PlayerLink.*` |
| `src/app/profile/[id]/page.tsx` | `module-top`, `render-enter`, `effect-enter` |
| `src/components/SmoothRuntime.tsx` | `Link.nav-prepare*`, `route-effect`, `dispatch-route-change*` |
| `src/components/AppShell.tsx` | `AppShell.render-start/end`, `route-effect` |
| `src/components/Nav.tsx` | `Nav.render` |
| `src/components/ThemeDecorGate.tsx` | `ThemeDecorGate.render` |
| `src/components/RoomDeferredChrome.tsx` | `RoomDeferredChrome.render`, `routeHop` |
| `src/lib/runtime-iso.ts` | `wrProfileRoute()` + `performance.mark` |
| `src/lib/event-loop-probe.ts` | longtask ↔ last mark; resource/chunk observer |

---

## 2. Chrome Performance profiling (operator — required for call tree)

Console logs alone **cannot** name the 52s function. Use a real performance profile.

### Exact steps

1. Open **https://www.war-room-picks.com** in Chrome (desktop is fine if phone repro is hard; prefer same session warmth as phone).
2. Enable diagnostics:
   ```js
   localStorage.setItem("warroom-runtime-debug", "1")
   ```
3. Hard refresh (`Ctrl+Shift+R`). Log into Group 1. Open **Standings**. Wait until the board feels settled (~wave 2 may be active — that is intentional; we want the warm-shell repro).
4. DevTools → **Performance** tab.
5. Settings (gear): enable **Screenshots**, **Web Vitals**; CPU: **4× slowdown** optional for clearer trees (also try **No throttling** once).
6. Click **Record** (●).
7. **One** click on a player name (PlayerLink).
8. Wait until the page is responsive again (even if profile never finishes — stop after ~70s if still frozen).
9. Click **Stop**.
10. **Save profile…** → export `.json` (e.g. `profile-click-52s.json`).

### Inspect the 52-second task

1. In the main-thread track, find the long **Task** (~50s).
2. Click it → **Bottom-Up** and **Call Tree**.
3. Sort by **Self Time**.
4. Fill the table below (paste into Notepad / PR comment).

| Field | Value (operator paste) |
|-------|------------------------|
| Task duration | ~52030 ms (or measured) |
| Top function by self time | _TBD_ |
| Script / chunk URL | _TBD_ (e.g. `…/_next/static/chunks/….js`) |
| Component / module (if named) | _TBD_ |
| Category | ☐ JS evaluation ☐ React render/commit ☐ Style/layout ☐ Event handler ☐ GC ☐ Other |
| First `profile-route` mark still present in console before task | _TBD_ |
| Did `module-top` appear before or after freeze? | _TBD_ |

### Optional: Performance insights

- **Bottom-Up → Group by URL** — which chunk owns self-time.
- Search timeline for `wr-profile-route` **User Timing** marks (we call `performance.mark`).

---

## 3. Global shell isolation (do first — not badges/trophies)

Hard refresh after **each** flag. One click. Record only the three columns.

```js
localStorage.setItem("warroom-runtime-debug", "1")
```

| Test | Flag | `module-top` appears? | Largest longtask | click → route complete |
|------|------|----------------------|------------------|------------------------|
| A | `localStorage.setItem("warroom-iso", JSON.stringify({ deferred:false }))` | _TBD_ | _TBD_ | _TBD_ |
| B | `… { wave2:false }` | _TBD_ | _TBD_ | _TBD_ |
| C | `… { smoothRuntime:false }` **Note:** layout still mounts SmoothRuntime; use `{ smoothPrep:false, smoothPrefetch:false, smoothPulse:false }` if full flag not wired to unmount | _TBD_ | _TBD_ | _TBD_ |
| D | `{ profileMinimal:true }` (already production default path) | _TBD_ | _TBD_ | _TBD_ |

Reset:

```js
localStorage.removeItem("warroom-iso")
```

**Do not** re-test badges/trophies/history isolation until pre-render markers + Chrome tree are filled.

---

## 4. Pre-profile import graph (code audit)

### Static imports of `src/app/profile/[id]/page.tsx`

| Import | Risk |
|--------|------|
| `Avatar`, `AvatarLightbox` | Medium — Avatar → `profile` / borders (not full badges catalog) |
| `divisionFullLabel` | Low |
| `isSandboxMode` | Low (season-countdown) |
| `withCreatorFlag` | Low |
| `join-titles` | Low |
| `equipped-title-store` | Medium — supabase client + league |
| `last-seen` | Medium — supabase + league |
| `mock-roasts` | Low |
| **`findPlayer` from `@/lib/store`** | **CRITICAL** — see below |
| **`getLeague` / `getSession` from `@/lib/league`** | **CRITICAL** — league → store → badges |
| `runtime-iso` | Low (debug helpers) |

### Smoking gun (static graph — still present after containment)

```
profile/[id]/page.tsx
  → @/lib/store  (findPlayer)
      → @/lib/badges  (syncLeagueCheevoKing)   ← ~68 KB / ~2165 lines BADGE_CATALOG
      → @/lib/scoring
      → @/lib/mock-data
  → @/lib/league  (getLeague, getSession)
      → @/lib/store  → @/lib/badges   (same)
```

Containment correctly **removed** direct `import { formatMemberSince } from "@/lib/badges"` and deferred `ProfileHeavyDetails`, but **`store` still statically imports `badges`**. First evaluation of the profile route module (or any shared chunk that first loads `store`) still pays for the full badge module graph **before** `render-enter` if that chunk is not already evaluated.

### Production bundle note (local build after containment)

| Artifact | Size | Badges strings? |
|----------|------|-----------------|
| `.next/static/chunks/app/profile/[id]/page-*.js` | **~18.5 KB** | No direct `BADGE_CATALOG` / `getPlayerBadges` in page chunk |
| Shared chunks | various | Badges live in **shared** webpack modules pulled via `store`, not inlined in page chunk |

So: page chunk is small, but **dependency evaluation** of `store`/`badges` (if not already warm) can still dominate first navigation. If Standings already evaluated `store`/`badges`, the 52s task is **less likely pure first-eval** and more likely **shell re-render / commit / other sync JS** — Chrome Bottom-Up decides this.

### Modules **not** on initial profile static path (good)

- `ProfileHeavyDetails` — dynamic only
- `BadgeShelf`, `getPlayerBadges` call sites on page — removed
- `buildFootballResume`, `ProfileSeasonPlot`, `ProfileTrophyCase` — deferred

---

## 5. Global background loaders (mounted across routes)

These stay mounted under layout / Nav / deferred chrome and can complete **during** profile navigation, triggering React commits on the same main thread.

### Call sites of interest

| API | Global / persistent callers | Route-only callers |
|-----|----------------------------|--------------------|
| `loadLeagueActiveWeek` | **PlayerLink** (each instance mount), **RoomDataHydrator** (warm picks @2.8s), **CommishWeekChecklist**, **PlayerWeekChecklist**, **CommishSetupBanner**, **HomeGazetteSpotlight**, **RingCeremonyModal**, SmoothRuntime path N/A | board, picks, founder, story-doors |
| `listScoredWeekNumbers` | **CommishWeekChecklist**, **PlayerWeekChecklist**, **CommishSetupBanner**, **HomeHostScoreStrip**, **HomeGazetteSpotlight**, **RingCeremonyModal**, LockPicksRoast | board, picks, toilet-bowl, championship, commissioner |
| `loadLeagueStandings` | Defined in `cloud.ts`; used internally by standings helpers | primarily standings/cloud helpers — not a layout default import |
| `loadLeaguePlayers` | HotTakeTicker, HomeWeekHero, CrownAndShame, CrewLiveBoard, GazetteModal, EasterEggHost | **standings page**, profile heavy details |

### Shell components mounted on **all** in-app routes (via `layout` / `AppShell` / `Nav`)

| Component | Mount scope | Work on route change |
|-----------|-------------|----------------------|
| `SmoothRuntime` | layout always | `forceUnlockAllChrome`, scroll, **`warroom-route-change` dispatch**, orphan pulse |
| `ThemeDecorGate` + sport/season theme appliers | layout | re-render; storage/theme listeners |
| `FoundrySessionChrome` / `SandboxSessionChrome` / `LeagueBuildGate` | layout | session/sandbox listeners |
| `AppShell` + **`Nav`** | all non-bare routes | pathname effects; progressive snapshot **once** (not every hop after fix) |
| `RoomDeferredChrome` (dynamic after Nav idle) | persistent after arm | **routeHops++** every pathname; may arm wave1 at hop≥2; wave2 timers |
| `RoomDataHydrator` | wave0 of deferred | roster every 5 min + visibility; active week warm once |

### Why this matters for a 52s task

- Network latency alone does **not** create a 52s **longtask** (longtasks are sync main-thread).
- Stacked **promise resolutions** that each call `setState` can produce a **large React commit** if many global children re-render.
- **`warroom-route-change`** listeners currently: PlayerLink (×N instances on Standings!) clear nav guards — if many PlayerLinks mount, **N listeners fire** on one dispatch (each logs under debug).
- Wave-2 modules (RingCeremony, WeeklyColdOpen video, EasterEggHost) if already mounted can be expensive on re-render — isolation test **B `{ wave2:false }`** is critical.

---

## 6. Smallest safe production fix (proposed — **not implemented yet**)

Do **not** restore eager profile shelves. After markers + Chrome tree confirm:

### Candidate A (import-graph) — if `module-top` is late / missing until after longtask, or Bottom-Up shows badges/store eval

1. Break **`store.ts` → static `import { syncLeagueCheevoKing } from "./badges"`**  
   - Move cheevo-king sync behind dynamic `import()` only where needed, **or** extract `findPlayer` / roster defaults into `store-lite.ts` without badges.
2. Stop profile page from importing full `@/lib/store` / heavy `@/lib/league` surface if only `findPlayer` + session id are needed.
3. Re-measure: `module-top` within ms of click; no multi-second longtask.

### Candidate B (shell) — if `module-top` appears **before** freeze and Bottom-Up shows React commit / deferred chrome

1. On `/profile/*`, skip or defer `RoomDeferredChrome` routeHop side effects / wave mounts.
2. Pause non-profile hydrators while profile navigation is in flight (flag from `prepareNavigation` or pathname).
3. Cap PlayerLink `warroom-route-change` work (single global guard, not N listeners doing state).

### Candidate C (if tree shows style/layout thrash)

1. Audit `forceUnlockAllChrome` + body lock + theme class churn on route hop.
2. Isolation: `smoothPrep:false` / themeDecor off.

**Implement only after** first marker + Chrome self-time are filled. One candidate at a time.

---

## 7. Operator paste block (fill and return)

```
DEPLOY SHA: ________
LAST profile-route MARK BEFORE LONGTASK: ________
module-top before/after freeze: ________
LONGEST LONGTASK ms: ________
CHROME top self-time function: ________
CHROME script URL: ________
CATEGORY: eval | react | layout | handler | other
ISO A deferred=false: module-top? __ longtask __ complete __
ISO B wave2=false: …
ISO C smooth*: …
```

---

## 8. Out of scope for this mission

- Query optimization  
- Schema changes  
- Restoring badges/trophies/resume on first paint  
- Another full profile page rewrite without attribution  

---

## 9. Instrumentation commit note

Markers are debug-gated (`warroom-runtime-debug=1` or development). Production users without the flag see no extra console noise.
