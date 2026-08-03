# Current-week request storm — diagnosis

**Date:** 2026-08-02  
**Symptom:** Hundreds/thousands of  
`GET /rest/v1/leagues?select=current_week&id=<leagueId>`  
ending in `net::ERR_INSUFFICIENT_RESOURCES`  
**Status:** Diagnosis + temporary counters only. **Fix not implemented.**

---

## Root cause (proven from code)

### Single network call site

**Only one** Supabase select of `current_week` exists in the app:

| File | Function | Lines |
|------|----------|-------|
| `src/lib/cloud.ts` | `loadLeagueActiveWeek()` | ~286–354: `.from("leagues").select("current_week").eq("id", session.leagueId)` |

All other “active week” traffic funnels through this function (or localStorage only).

### Why it multiplies into a storm

1. **No in-flight dedupe**  
   `loadLeagueActiveWeek` has a **5s success cache** (`activeWeekCache`, `ACTIVE_WEEK_TTL_MS = 5_000`) but **no `activeWeekInflight` map**.  
   If N callers run while the first request is still open, **all N miss the cache and all N hit the network**.

2. **Amplifier: `PlayerLink` × roster size × route event**  
   `src/components/PlayerLink.tsx`:
   - On mount: `loadLeagueActiveWeek()` once per link  
   - On **every** `warroom-route-change`: `loadLeagueActiveWeek()` again per link  

   Standings / stats / board / toilet / trophies render **one `PlayerLink` per player** (often 10–32+).

3. **Route fan-out source: `SmoothRuntime`**  
   `src/components/SmoothRuntime.tsx` (pathname effect):  
   `window.dispatchEvent(new CustomEvent("warroom-route-change", …))`  
   on **every** soft navigation.

4. **Thundering herd math**  
   ```
   route change
     → warroom-route-change
     → N PlayerLink listeners (N = visible nameplates)
     → N concurrent loadLeagueActiveWeek()
     → cache empty (or TTL expired) / no inflight share
     → N identical GET current_week
   ```
   Hop tabs quickly while cache is cold → hundreds of identical requests → browser `ERR_INSUFFICIENT_RESOURCES`.

5. **Failure does not self-retry inside `loadLeagueActiveWeek`**  
   Catch is empty; still `cacheSet` with local fallback.  
   Storm is **caller fan-out + missing inflight**, not an internal retry loop.

6. **Secondary (lower rate) callers** — each one more concurrent miss during herd:  
   `resolvePlayerActiveWeek`, `HomeWeekHero`, `HomeGazetteSpotlight`, `RoomDataHydrator` warm, `progressive-disclosure` snapshot, `first-week` / `first-session`, Picks `softRefresh` / poll, modals, etc.  
   None match PlayerLink’s N×route multiplier.

---

## Call graph (page load → repeated request)

```
App Router soft-nav / pathname change
        │
        ▼
SmoothRuntime useEffect([pathname])          SmoothRuntime.tsx ~79–105
        │
        ├─ forceUnlockAllChrome / scrollTopHard
        └─ dispatchEvent("warroom-route-change")
                │
                ▼
  ┌─────────────┴─────────────┐
  │  PlayerLink #1..#N        │  PlayerLink.tsx ~51–54
  │  onRoute → loadLeagueActiveWeek()
  └─────────────┬─────────────┘
                │
                ▼
loadLeagueActiveWeek()                     cloud.ts ~286+
  localStorage week (sync)
  cacheGet(activeWeekCache, 5s) ── HIT → return (no network)
         │ MISS
         ▼
  ★ NO INFLIGHT MAP ★
  for each concurrent caller:
    supabase.from("leagues").select("current_week").eq("id", leagueId)
         │
         ▼
  Network: GET /rest/v1/leagues?select=current_week&id=…
  (× concurrent callers)
         │
         ▼
  cacheSet + return
```

### First function that turns “one route hop” into “many network GETs”

| Role | Function | File |
|------|----------|------|
| **Fan-out start** | `PlayerLink` `onRoute` / mount | `PlayerLink.tsx` |
| **Missing gate (primary fix locus)** | `loadLeagueActiveWeek` | `cloud.ts` — lacks single-flight |
| **Event emitter** | SmoothRuntime pathname effect | `SmoothRuntime.tsx` |

Without PlayerLink, route events still trigger other one-off callers (acceptable).  
With PlayerLink × N and no inflight, the browser collapses.

---

## Call-site inventory

| # | File:line | Function/component | Trigger | Expected frequency | Why it can repeat | Cleanup / dedupe | Failure → immediate retry? |
|---|-----------|--------------------|---------|---------------------|-------------------|------------------|----------------------------|
| 1 | **cloud.ts ~328–332** | `loadLeagueActiveWeek` | Any caller | Shared | **Only network site** | 5s TTL cache only; **no inflight** | No internal retry |
| 2 | **PlayerLink.tsx ~45–46** | mount effect | Mount of each link | Once per mount per name | Remount list = N calls | unmount cancel flag | No |
| 3 | **PlayerLink.tsx ~51–54** | `onRoute` | `warroom-route-change` | **Once per route × N links** | **Primary storm** | removeEventListener on unmount | No |
| 4 | active-week.ts ~83,97 | `resolvePlayerActiveWeek` | Home/picks resolve | Per page open | Multiple widgets | none | No |
| 5 | PicksClient ~525 | `softRefresh` | poll + visibility | Poll interval (SOFT gap) | Gap throttle | SOFT_REFRESH_GAP_MS | No |
| 6 | PicksClient ~793–796 | poll interval | `setInterval` softRefresh | Continuous on /picks | If gap low + tab open | cleared on unmount | No |
| 7 | RoomDataHydrator ~147 | warm picks | Delayed timeout once | Once per session arm | Rare | timeout cleanup | No |
| 8 | progressive-disclosure ~252 | `loadProgressiveSnapshot` | Nav progressive events | Event-driven | Events can re-fire | SNAP_TTL + inflight for **snapshot**, not week alone | No |
| 9 | first-week / first-session | boot | Once-ish | Low | — | — | No |
| 10 | HomeWeekHero / Gazette / checklists / modals / board / founder | various | Mount | Low–medium | Parallel home widgets | mixed | No |
| 11 | SmoothRuntime ~95–97 | event only | pathname | 1 event/hop | Multiplies only via listeners | timer cleanup | n/a |

**Updates** (`setLeagueActiveWeek` / `.update({ current_week })`) are writes, not the GET storm.

---

## Temporary instrumentation (added; not the fix)

In `loadLeagueActiveWeek`, **before** the network select (cache miss only):

```
[WR-CURRENT-WEEK] #N inflight=K league=… route=… t=…
```

+ short stack (dev always, or production with `localStorage warroom-runtime-debug=1`).

Globals:

- `window.__WR_CW_N` — total network attempts this page life  
- `window.__WR_CW_INFLIGHT` — concurrent in-flight

### How Mike reproduces

1. Dev or prod with debug flag  
2. Open Standings (many PlayerLinks)  
3. Hop Home ↔ Standings ↔ Picks quickly  
4. Console: many `[WR-CURRENT-WEEK]` with **inflight > 1** and stacks through PlayerLink  

**Proof of diagnosis:** inflight spikes to ~roster size on each hop when cache is cold.

---

## Minimum safe fix (DO NOT IMPLEMENT YET — design only)

All in/around `loadLeagueActiveWeek` (+ optional PlayerLink soft-down):

1. **`activeWeekInflight: Map<leagueId, Promise<number>>`**  
   On cache miss, if inflight exists → `return inflight`.  
   Else create promise, store, clear in `finally`.

2. **Keep short success TTL** (5s ok; could raise to 15–30s for week number).

3. **On network failure:** still cache fallback week for a **negative TTL** (e.g. 3–5s) so failures don’t re-stampede immediately.

4. **PlayerLink (optional second cut):**  
   - Do **not** re-fetch on every `warroom-route-change`; week rarely changes on nav  
   - Or read from a shared store / only mount once app-wide  
   - Chaos flames can use cached week from step 1

5. **Do not** remove `current_week` feature or suppress console only.

6. **Do not** require SmoothRuntime removal; event is fine if consumers don’t N-fan-out.

### Verification after fix

| Check | Pass |
|-------|------|
| Standings hop 2 min | `[WR-CURRENT-WEEK]` increments slowly; inflight ≤ 1 |
| Network | ≤ 1 `current_week` GET per ~5s per league under hop spam |
| No ERR_INSUFFICIENT_RESOURCES | yes |
| Picks still follows league week | yes |
| Commish set week still updates | invalidate cache on `setLeagueActiveWeek` (already `activeWeekCache.delete` in invalidate helpers — ensure writes clear cache) |

---

## What this is **not**

| Not | Why |
|-----|-----|
| Schema drift loop | `current_week` column exists; issue is volume of GETs |
| Hydration #418 | Separate |
| Internal `while` retry in cloud.ts | No retry; catch-and-return |
| setInterval alone | Picks poll is one caller; PlayerLink is N×event |

---

## Next step

**Mike:** confirm stacks show PlayerLink / multi-inflight via `[WR-CURRENT-WEEK]`.  
**Then** implement inflight + optional PlayerLink route-fetch removal only.

---

**END — diagnosis only**
