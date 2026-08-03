# Profile main-thread freeze diagnosis

**Date:** 2026-08-03  
**Repro:** Click `/profile/<uuid>` after session warm (wave 2 active)  
**Evidence:** `prepareNavigation` **2 ms** → **longtask 8954 ms** (also 13.8s / 39s earlier)  
**Status:** Instrumentation + isolation flags only — **no production performance fix yet**

---

## 1. Primary synchronous suspect (code-proven)

### A. First-route **module evaluation** of `/profile/[id]`

`src/app/profile/[id]/page.tsx` is `"use client"` and **statically imports** a heavy graph:

| Static import | Approx size / role |
|---------------|--------------------|
| `@/lib/badges` | **~2165 lines** — full `BADGE_CATALOG`, `getPlayerBadges`, `evaluateBadge` |
| `@/lib/player-history` | ~675 lines — `buildFootballResume` |
| `@/lib/profile-hardware` | trophies |
| `BadgeShelf`, `ProfileTrophyCase`, `FootballResume`, `ProfileSeasonPlot`, … | large UI |

**First navigation** to any profile pays **parse + evaluate** of this graph on the main thread **before** first paint of the route. That alone can produce multi-second longtasks (especially on mid phones) and matches “prep-nav 2ms then longtask 8.9s”.

**Log:** `[WR-PERF][profile] module-eval-to-first-render Nms` (first render only).

### B. **`getPlayerBadges` / `evaluateBadges`** (sync on render path)

```317:331:src/app/profile/[id]/page.tsx  (instrumented as evaluateBadges)
useMemo → getPlayerBadges(player, leaguePeers)
```

Inside `getPlayerBadges` (`badges.ts` ~2014+):

1. Side effects: tenure sync, localStorage, `applyLegacyBadgeGrants`, permanent badge grants  
2. `peers = leaguePeers.map(withPermanentBadges)` — **whole league** after standings load  
3. `syncCareerLastPlacesFromLeague(peers)`, `syncStackableWeekCheevosFromLeague(peers)` — **league-wide**  
4. **`catalog.map((def) => evaluateBadge(def.id, p, peers))`** over **full badge catalog** (+ ladder, NFL overlays)

**Complexity:** roughly **O(catalog size × peer work)** — not O(1) identity paint.

**Critical timing:** After background `loadLeaguePlayers()`, `setLeaguePeers(full roster)` re-runs this useMemo → **second multi-second sync spike** after first paint.

### C. **Unmemoized sync work every full render** (now timed)

On every render when `ready && player` (before isolation):

| Call | Location |
|------|----------|
| `buildFootballResume(...)` | body of ProfilePage |
| `buildSignatureStyle(...)` | body |
| `buildSeasonPlot(...)` | body |

These re-run whenever parent re-renders even if inputs unchanged (now wrapped in `wrProfileTimed` + gated by `showHistory`).

### D. **Not the primary blocker**

| Item | Why |
|------|-----|
| `prepareNavigation` | Measured **2 ms** |
| Supabase | Downstream of starvation; cold Board queries were ~100–300 ms |
| Network waits in first paint | First paint uses roster only; cloud standings are background |

---

## 2. Measured durations (fill from Mike’s console)

| Marker | Expected meaning | Paste ms |
|--------|------------------|----------|
| `click-received` | PlayerLink onClick | |
| `module-eval-to-first-render` | Chunk eval cost first visit | |
| `component-render-start` | Each ProfilePage render | |
| `evaluateBadges` | getPlayerBadges | **suspect #1 after paint** |
| `buildResume` | buildFootballResume | |
| `buildSignature` / `buildSeasonPlot` | render body | |
| `bg-standings-peers n=N` | Peers expanded → badge re-eval | |
| `interactive` | End of render work | |
| longtask after click | Should align with module-eval or evaluateBadges | **8954** (Mike) |

---

## 3. Profile-specific vs global

| Scope | Evidence |
|-------|----------|
| **Profile-specific** | Static import graph + getPlayerBadges + resume/trophies only on this route |
| **Global amplifiers** | Deferred wave 2 (many modals) + `hasVisibleModal` style walks on other paths; **#418** at startup |
| **Wave 2 coincidence** | Freeze after wave 2 active → more dialog DOM + more main-thread competition, but **profile import+badge eval** still the direct work after profile click |

---

## 4. Isolation flags (run one at a time)

```js
localStorage.setItem("warroom-runtime-debug", "1");

// A — identity only
localStorage.setItem("warroom-iso", JSON.stringify({ profileMinimal: true }));
// hard refresh → click same profile

// B
localStorage.setItem("warroom-iso", JSON.stringify({ profileBadges: false }));

// C
localStorage.setItem("warroom-iso", JSON.stringify({ profileTrophies: false }));

// D
localStorage.setItem("warroom-iso", JSON.stringify({ profileHistory: false }));

// E
localStorage.setItem("warroom-iso", JSON.stringify({ deferred: false }));

// F
localStorage.setItem("warroom-iso", JSON.stringify({ wave2: false }));

// G
localStorage.setItem("warroom-iso", JSON.stringify({ smoothRuntime: false }));

// Reset
localStorage.removeItem("warroom-iso");
```

### Decision table (Mike fills)

| Config | longtask after profile click | Notes |
|--------|------------------------------|-------|
| Normal | ~8954 ms | baseline |
| **profileMinimal:true** | ? | If ≪1s → profile heavy UI/compute confirmed |
| profileBadges:false | ? | If large drop → getPlayerBadges/catalog |
| profileTrophies:false | ? | hardware/trophy case |
| profileHistory:false | ? | resume/plot/passport |
| deferred:false | ? | global chrome |
| wave2:false | ? | ceremonies/modals |
| smoothRuntime:false | ? | nav unlock (prep already 2ms) |

**Most important:** Normal vs **profileMinimal** vs **profileBadges:false**.

---

## 5. Wave 2 / soft_unlock / hasVisibleModal

At profile click:

- Soft_unlock / finale may already own session-drama (logs elsewhere).  
- `hasVisibleModal` not on profile open path unless SmoothRuntime orphan check runs (gated, 8s pulse).  
- **Wave 2 does not need to run badge catalog** — but adds concurrent main-thread noise.

Correlate: if **wave2:false** removes 8.9s longtask, profile work was only part of load; if **profileMinimal** removes it and wave2 does not, **profile is the root**.

---

## 6. Hydration #418 (separate)

| Likely mismatch | Why |
|-----------------|-----|
| `Nav` `isoEnabled()` during render | localStorage vs SSR defaults |
| Theme/sport `data-*` on `<html>` after mount | attribute differs server/client |
| `ThemeDecorGate` / `SmoothRuntimeGate` | SSR true → effect may flip |

#418 at startup is **not** proven to be the 8.9s profile longtask (prep is 2ms then longtask on navigation). Still fix later.

---

## 7. Smallest safe fix (AFTER isolation proof — do not implement production fix yet)

**If profileMinimal or profileBadges:false eliminates freeze:**

1. **Dynamic-import** badge/trophy/resume modules **after** first identity paint (`import()` in effect, not static top-level).  
2. **Never call `getPlayerBadges` with full league peers on first paint** — keep peers=`[player]` until idle / user expands shelves.  
3. **Memoize** `buildFootballResume` / signature / season plot with stable deps.  
4. Move side effects out of `useMemo` / render (`nuke*`, `applyLegacy*`, `syncCareer*`).  
5. Defer `BadgeShelf` mount with `requestIdleCallback` or details/summary.

**If only wave2/deferred changes freeze:** separate chrome fix (hasVisibleModal / modal catalog).

---

## 8. Verification plan

1. Deploy instrumentation.  
2. `warroom-runtime-debug=1`.  
3. Same profile id; record longtask + `[WR-PERF][profile]*` for Normal and each flag.  
4. Declare root cause = system that drops longtask under **8.9s → &lt;500ms**.  
5. Only then implement smallest fix from §7.

---

## Instrumentation files

| File | Change |
|------|--------|
| `src/app/profile/[id]/page.tsx` | iso gates + timed pure functions + logs |
| `src/lib/runtime-iso.ts` | profile* flags + `wrProfile` / `wrProfileTimed` |
| `src/components/PlayerLink.tsx` | `click-received` log |

**No production behavior change** unless isolation flags set.

---

**END — wait for isolation matrix before shipping a fix.**
