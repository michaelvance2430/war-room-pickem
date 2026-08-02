# Runtime Freeze Audit — Problem Group 1

**Date:** 2026-08-02  
**Scope:** Global runtime freezes only (shell / nav / deferred chrome / smooth runtime).  
**Rules followed:** No features, no redesign, no broad refactors, diagnosis before fix.

---

## Step 1 — Recent changes (regression baseline)

### Last known smooth-ish baseline

`5db62a7` — *polish: overnight scrub — hardware gate, Exit Host split…*  
At that point the audited shell set did **not** include `SmoothRuntime`, `AppShell`, or `src/lib/smooth.ts`.

### HEAD at audit start

`0eb9ca3` — *fix(picks): always load — kill stuck spinner…*

### Commits since baseline that touch the global shell

| Commit | Summary | Global shell impact |
|--------|---------|---------------------|
| `e52795c` | Keep Nav mounted in layout | AppShell pattern; stops tab remount storms |
| `12fa670` | Staged chrome, quieter gazette | Deferred / progressive work |
| `ed11eb5` | Remove global PullToRefresh | Good — removed a freeze source |
| **`70190f1`** | **smooth-runtime systemic “fix”** | **Introduced SmoothRuntime + smooth.ts + RoomDeferredChrome waves** |
| `598e747`…`0eb9ca3` | Home/commish/picks/tutorial | Route-level; can pile on first paint |

### Files changed (audited set) vs `5db62a7`

```
src/app/layout.tsx                    |  mounts SmoothRuntime + theme chrome
src/components/AppShell.tsx           |  NEW — persistent Nav
src/components/Nav.tsx                |  large — deferred chrome, progressive, body lock menu
src/components/RoomDeferredChrome.tsx |  NEW/expanded — wave 0/1/2 modals
src/components/SmoothRuntime.tsx      |  NEW — route unlock, 1s pulse, prefetch, click prep
src/lib/smooth.ts                     |  NEW — body lock refcount, hasVisibleModal, prefetch list
src/lib/session-drama.ts              |  minor — exclusive drama slot
```

### What runs on every route

1. **`SmoothRuntime`** (layout) — pathname effect: force unlock, scroll top, timers; capture click; previously **prefetch on every pathname**.
2. **`AppShell`** — bare-route check; Nav mount when not bare.
3. **`Nav`** — pathname closes menus; does **not** re-arm deferred (good).
4. **`RoomDeferredChrome`** — increments route hops; may arm wave 1 after 2 hops.

### Changes that introduced effects / timers / listeners / locks

| System | Effects | Timers | Listeners | Body lock | Nav prep |
|--------|---------|--------|-----------|-----------|----------|
| SmoothRuntime (70190f1) | 4 | rAF + 3 timeouts **+ setInterval 1s** | vis/pageshow/focus/pointerdown/click | force unlock | prepareNavigation on every in-app link |
| smooth.ts | — | — | — | refcount lock/unlock | prepareNavigation |
| RoomDeferredChrome | wave arm | 12s, 14s, 8s retry, 600ms | — | via modals | — |
| Nav | progressive, unread, deferred arm | idle 2–2.8s, staff/profile/unread | many custom events | menu open | closeChrome / menu close |
| session-drama | — | — | — | — | exclusive modal claim |

---

## Step 2 — Diagnostics (dev-only)

**Module:** `src/lib/runtime-iso.ts`

### Enable

```js
localStorage.setItem("warroom-runtime-debug", "1")
// hard refresh
window.__WR_RUNTIME__.help()
window.__WR_RUNTIME__.counters()
```

### Log prefixes

| Prefix | Meaning |
|--------|---------|
| `[WR-RUNTIME]` | Mounts, effects, intervals |
| `[WR-NAV]` | Routes, prefetch, prepareNavigation |
| `[WR-DEFERRED]` | Wave arming / deferred chrome |
| `[WR-MODAL]` | session-drama claim/deny/clear |
| `[WR-BODYLOCK]` | lock / unlock / force / orphan |

Production: no logs unless `warroom-runtime-debug=1` is set.  
Development: logs on by default for isolation work.

---

## Step 3 — Isolation flags

Central config: `localStorage.warroom-iso` (JSON).

```js
localStorage.setItem("warroom-iso", JSON.stringify({
  deferred: false,      // A RoomDeferredChrome
  navProgressive: false,// B Nav progressive/unseen
  wave1: false,         // C modal wave 1
  wave2: false,         // D ceremonies wave 2
  realtime: false,      // E (pages that honor it)
  themeDecor: false,    // F ThemeDecorGate
  smoothPrep: false,    // G prepareNavigation + route unlock
  smoothPrefetch: false,
  smoothPulse: false,
}))
// hard refresh
```

Reset:

```js
localStorage.removeItem("warroom-iso")
localStorage.removeItem("warroom-runtime-debug")
```

### Recommended subtraction order

1. Bare AppShell + page (`deferred:false`, `themeDecor:false`, `smoothPrefetch:false`, `smoothPulse:false`)
2. Add Nav progressive (`navProgressive:true`)
3. Add hydrator only (`deferred:true`, `wave1:false`, `wave2:false`)
4. Wave 1 (`wave1:true`)
5. Wave 2 (`wave2:true`)
6. Full smooth prep/prefetch/pulse

**Expected freeze return point (from code analysis):**  
With full product flags on, freezes should **ease after the SmoothRuntime fix below** even before disabling deferred chrome. If freezes remain, wave 1 (many dynamic modals) is the next suspect.

---

## Step 4 — Failure pattern checklist

| # | Pattern | Finding |
|---|---------|---------|
| 1 | useEffect dependency loops | **Yes — SmoothRuntime prefetch deps `[router, pathname]` re-ran warm on every hop** |
| 2 | setState in own deps | Nav `deferredReady` early-return OK; RoomDeferred `wave` arms wave2 once |
| 3 | Unstable deps | router object stable enough; pathname was the storm trigger |
| 4 | Timers without cleanup | Cleaned; interval was over-aggressive not leaked |
| 5 | Listener leaks | Cleanups present |
| 6 | Supabase channels repeated | Not in shell files; deferred hydrator possible secondary |
| 7 | localStorage → refresh cycle | Progressive events can re-run; not every route |
| 8 | Prefetch/prepareNavigation thrash | **Yes — 10-route prefetch every pathname + capture click prep** |
| 9 | Body lock never zero | forceUnlock on route mitigates; orphan pulse was expensive |
| 10 | Multiple drama claims | session-drama denies second slot; logged now |
| 11 | Hidden modals heavy work | Wave 1 mounts many dynamics when armed |
| 12 | Full modal catalog mounted | Only after wave gates — good design, still heavy |
| 13 | Dynamic import hang | Picks had this earlier (0eb9ca3); out of shell scope |
| 14 | Realtime refresh storms | Not primary in audited shell |
| 15 | Nested replace loops | Not found in shell |
| 16 | Idle waves after route change | Wave timers not cancelled on unmount of whole tree (Nav persists) — OK |

---

## Step 5 — Diagnosis (before fix)

### Primary suspected cause

**`SmoothRuntime` (commit `70190f1`) re-prefetched ~10 primary routes on every pathname change and ran `unlockIfOrphanedLock` every 1 second forever.**

`unlockIfOrphanedLock` → `hasVisibleModal` walks **all** `[role=dialog]` / `[aria-modal]` nodes with `getComputedStyle` + `getBoundingClientRect` — main-thread tax under load, especially once wave-1 modals mount.

### Supporting evidence

1. Introduced **today** relative to yesterday’s smooth baseline (`5db62a7` had no SmoothRuntime).
2. Prefetch effect dependency array explicitly included `pathname`:

```tsx
// BEFORE (bug)
}, [router, pathname]);
```

3. Watchdog:

```tsx
const pulse = window.setInterval(unlockIfOrphanedLock, 1_000);
```

4. Layout mounts SmoothRuntime on **every** authenticated/unauthenticated page.

### Exact file / lines (pre-fix)

- `src/components/SmoothRuntime.tsx` — prefetch effect deps `[router, pathname]` (~line 125)
- `src/components/SmoothRuntime.tsx` — `setInterval(unlockIfOrphanedLock, 1_000)` (~line 85)
- `src/lib/smooth.ts` — `hasVisibleModal` style/rect walk (~lines 106–126)

### Secondary contributing causes

1. **RoomDeferredChrome wave 1** mounts ~10 dynamic modal modules after 12s or 2 hops — JS parse + effects while user navigates.
2. **Triple forceUnlock + rAF + 80/400/1200ms timers** on every route (overkill; reduced).
3. **Capture-phase click + Nav prepareNavigation** both force-unlock (acceptable, noisy).
4. **Picks/tutorial work** (`efca764`, `0eb9ca3`) can make `/picks` feel stuck — **not** Group 1 shell; separate if still bad after this fix.

### Safest minimal fix

1. Prefetch primary routes **once per session** (ref guard; drop `pathname` from deps).
2. Orphan pulse **8s**, and only call expensive unlock when body style looks locked.
3. Soften pointerdown handler with the same cheap body-lock gate.
4. Slim route-change unlock timers (one delayed orphan check).

### Risk of the fix

| Risk | Level | Notes |
|------|-------|-------|
| Stuck body scroll returns | Low | Route change + visibility still unlock; pulse slower not gone |
| Soft-nav feels cold | Low | Once-per-session prefetch still warms desks; Nav link `prefetch` remains for primaries |
| Orphan lock lasts ≤8s | Low–Med | User click on nav still unlocks when locked |

### How to verify

1. DevTools console: `localStorage.setItem("warroom-runtime-debug","1")` → refresh.
2. Hop `/` → `/picks` → `/standings` → `/locker-room` → `/commissioner` → `/crew` → `/account` for several minutes.
3. Confirm logs show **one** `prefetchPrimaryRoutes once`, not per hop.
4. Confirm `interval-tick:orphan-lock-pulse` ~every 8s, not 1s, and only meaningful when locked.
5. Open/close mobile menu and a welcome modal — body scroll recovers.
6. `window.__WR_RUNTIME__.counters()` — no runaway `mount:SmoothRuntime`, mount counts stay ~1.

### How to roll back

```bash
git revert <this-commit-sha>
# or restore SmoothRuntime.tsx / smooth.ts from 70190f1
```

Isolation-only rollback of product behavior:

```js
localStorage.setItem("warroom-iso", JSON.stringify({
  smoothPrefetch: false,
  smoothPulse: false,
  smoothPrep: true,
}))
```

---

## Step 6 — Fix applied (minimal)

### Files touched

| File | Change |
|------|--------|
| `src/lib/runtime-iso.ts` | **NEW** — flags, counters, wrLog, interval wrappers |
| `src/components/SmoothRuntime.tsx` | Once-prefetch, 8s gated pulse, diagnostics, iso gates |
| `src/lib/smooth.ts` | Body lock logging, `getBodyLockCount`, orphan logs |
| `src/lib/session-drama.ts` | Claim/deny/clear modal logs |
| `src/components/RoomDeferredChrome.tsx` | Wave flags + deferred logs |
| `src/components/Nav.tsx` | deferred + progressive iso + mount logs |
| `src/components/AppShell.tsx` | Mount/route diagnostics |
| `src/components/ThemeDecorGate.tsx` | **NEW** — flag F |
| `src/app/layout.tsx` | ThemeDecorGate wrap |
| `docs/RUNTIME-FREEZE-AUDIT.md` | This report |

### Behavioral product change

None intended except:

- Prefetch no longer repeats on every navigation (should feel **smoother**, not different).
- Orphan body-lock recovery may take up to ~8s if no click/visibility event (rare).

---

## Step 7 — Verification

### Automated

| Command | Result |
|---------|--------|
| `npm run lint` | Exit 1 — **pre-existing** project errors (`@typescript-eslint/*` rule defs, picks `<a>`, etc.). **No new errors** in Group 1 files after removing unused eslint-disable in `runtime-iso.ts`. |
| `npm run build` | **PASS** (Next.js 15.1.9, 37 routes) |

### Manual checklist (operator)

- [ ] Fresh login
- [ ] Existing session
- [ ] Route switching 10 minutes: `/` `/picks` `/standings` `/locker-room` `/commissioner` `/crew` `/account`
- [ ] Open/close modals
- [ ] Background tab → return
- [ ] Mobile viewport
- [ ] Slow network throttling

### Confirm

- [ ] No frozen pages
- [ ] No stuck loading shell
- [ ] No permanent body lock
- [ ] No duplicate realtime channels (out of shell; watch Network if needed)
- [ ] No runaway effect counts (`__WR_RUNTIME__.counters()`)
- [ ] No navigation loop
- [ ] No uncaught console errors

---

## Remaining risks

1. **Wave-1 modal catalog** can still hitch after 12s / 2 hops — if freezes persist, set `wave1:false` to confirm, then stage fewer modals (separate PR).
2. **`realtime` iso flag** is defined but not yet wired into every Supabase subscribe site (Group 1 shell only).
3. **Picks practice / tutorial** paths may still feel stuck independently of shell — track as Group 2 if still reported after this fix.
4. **Lint debt** project-wide remains; not introduced by this work.

---

## Quick reference — isolation order for live repro

```js
// 1 bare
localStorage.setItem("warroom-iso", JSON.stringify({
  deferred:false, navProgressive:false, wave1:false, wave2:false,
  themeDecor:false, smoothPrefetch:false, smoothPulse:false, smoothPrep:true
}))

// 2 + progressive nav
// … set navProgressive:true

// 3 + hydrator only
// … deferred:true, wave1:false, wave2:false

// 4 + wave1
// 5 + wave2
// 6 full defaults — remove warroom-iso
```

---

*End of Group 1 audit report.*
