# Event-loop starvation diagnosis (Board timeouts 12–30s)

**Date:** 2026-08-03  
**Evidence (Mike):** Cold Board Phase 1 queries **145–294 ms**; later same session  
`current_week` / `week_results` **TIMEOUT at 12.7s / 25.3s / 30.6s** — **above coded 6–8s limits**.  
**Interpretation:** Not DB latency. **`setTimeout` callbacks run late** because the **main thread is blocked**.

**Status:** Instrumentation only. **No query optimization in this change.**

---

## Why late timeouts prove starvation

`withTimeout` in `cloud.ts` uses `setTimeout(fn, limitMs)`.

| If event loop is free | If main thread blocked for 20s |
|----------------------|--------------------------------|
| Timeout fires ~`limitMs` after schedule | Timeout **cannot run** until the block ends |
| Log: `TIMEOUT ~6000–8000 ms` | Log: `TIMEOUT 25000+ ms` + `[WR-PERF][timeout-late]` |

Cold path proving queries are fast (**294 ms**) + later path showing **25s timeout** = **same query path, different event-loop health**.

---

## Timeline model (what to capture)

```
T+0     [prep-nav] START/FINISH caller=… duration=Nms
T+…     [timeline] / navigation / route
T+…     [board-p1] query START
T+…     [longtask] 412ms @…     ← main thread blocked
T+…     [timer-lag] gap 4200ms  ← setInterval late
T+…     [board-p1] query TIMEOUT 25300 ms limit=6000ms
T+…     [timeout-late] LATE_BY=19300ms
```

If **longtask** / **timer-lag** clusters **before** a **timeout-late**, starvation is proven.

---

## Instrumentation shipped

| Tag | Source | Meaning |
|-----|--------|---------|
| `[WR-PERF][longtask]` | `event-loop-probe.ts` PerformanceObserver | Tasks **>100 ms** (Chromium) |
| `[WR-PERF][timer-lag]` | 1s interval gap | Gap **>1500 ms** ⇒ blocked ~gap−1000 |
| `[WR-PERF][prep-nav]` | `prepareNavigation` | START / FINISH / duration / caller / stack |
| `[WR-PERF][timeout-late]` | `withTimeout` | actual ≫ limit |
| `[WR-PERF][board-p1]` | existing | Per-query START/DONE/TIMEOUT |

**Enable:**

```js
localStorage.setItem("warroom-runtime-debug", "1");
// hard refresh
// window.__WR_EVENT_LOOP__.help()
```

**Install point:** `SmoothRuntime` mount → `installEventLoopProbe()`.

---

## prepareNavigation 2–3× per click (call sites)

| Caller label | File |
|--------------|------|
| `Nav.closeChrome` | Nav link onClick |
| `SmoothRuntime.click→/path` | capture-phase `a[href]` |
| `Nav.menuOpen=false-effect` | menu close effect |
| `RouteHardSwitch.hardNavPrepare` | if used |

**Sync cost:** FINISH `duration` should be **&lt;1–5 ms** (forceUnlock + dispatch).  
If **SLOW_SYNC ≥16 ms**, prepare itself is blocking (unlikely alone for 25s).

---

## Hypotheses ranked (code + evidence)

| Rank | Hypothesis | Why plausible | How logs confirm |
|------|------------|---------------|------------------|
| **1** | **Long React commits / hydration recovery (#418)** | Large client trees (Board slips, Standings rows, modals) + hydration mismatch force recovery | **longtask** bursts after nav; #418 in console same window |
| **2** | **Synchronous layout thrash** (`hasVisibleModal` getComputedStyle/rect on many dialogs) | Used by orphan unlock; deferred chrome waves mount many modals | longtask during/after route unlock; prep-nav stays short |
| **3** | **Repeated nav prep + route unlock work stacking** | 2–3 prep-nav + SmoothRuntime forceUnlock/rAF per hop | Many prep-nav START lines per click; not 25s alone unless combined with #1 |
| **4** | **Heavy sync JS** (rank/swing/score over large data) | After data returns | longtask with no network |
| **5** | **DB actually slow** | Contradicted by cold 145–294 ms | DONE lines still fast when no starvation |

**Not primary:** missing `league_first_joins` (fast 404). **Not** multi-inflight current_week (already fixed).

---

## Code suspects (files — no fix yet)

| File | Risk |
|------|------|
| `SmoothRuntime.tsx` | Route effect: forceUnlock, rAF, orphan check; click capture prepareNavigation |
| `smooth.ts` `hasVisibleModal` | Forced style/layout on all dialogs |
| `Nav.tsx` | isoEnabled during render → #418 candidate; double prepareNavigation |
| `RoomDeferredChrome` | Mounts many dynamic modals → more dialog DOM for hasVisibleModal |
| Board/Standings pages | Large renders after data |

---

## What Mike should paste back

1. One **cold** Board open: all `[WR-PERF][board-p1]` DONE lines (expect sub-second).  
2. Session later when hang happens:  
   - all `[WR-PERF][longtask]`  
   - all `[WR-PERF][timer-lag]`  
   - the late `[WR-PERF][board-p1] … TIMEOUT` + `[timeout-late]`  
   - `[prep-nav]` around the click  
3. Whether **React #418** appears in the same window.

---

## Smallest fix sequence (AFTER proof — do not implement now)

1. If longtasks align with hydration/#418 → fix Nav `isoEnabled` / SSR mismatch first.  
2. If longtasks align with unlock/orphan → stop calling `hasVisibleModal` on hot path / reduce dialog walk.  
3. If prep-nav multi-fire only → single prepare entry.  
4. Only then revisit query parallelism.

---

## Expected confirmation of starvation

| Signal | Healthy | Starved |
|--------|---------|---------|
| board-p1 query DONE | 100–400 ms | rare; mostly TIMEOUT |
| TIMEOUT actual | ≈ limit (6–8s) | **12–30s** |
| timer-lag | rare | frequent multi-second gaps |
| longtask | rare short | multi-100ms–seconds before late timeout |

---

**END — event-loop probe; no query optimization.**
