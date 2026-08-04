# Design postmortem: View Profile freeze (Standings → peer)

**Date:** 2026-08-04  
**Status:** Fixed and production-validated  
**Fix commits (main):** `ad4f96b` (badge loop), `7d554d2` (LLP stampede), related instrumentation  
**Validated by:** Mike — ~half a dozen peer profiles, phone + desktop, no freezes  

---

## What users saw

```text
Standings → tap another player's name → app freezes (17s … 83s+)
Own profile / some peers sometimes OK; local guest harness could not reproduce
```

---

## 1. Why did this survive until now?

1. **Profiles were product-hidden** for a long stretch. The route never got the same “shell first / no global storms” hardening as Home, Picks, and Standings after the smooth-runtime work.

2. **The failure needed production conditions:** authenticated session, real league roster, layout-mounted `BadgeUnlockModal`, and the legacy-grant + pending-celebration path. Guest / local isolation often stayed on a warm `loadLeaguePlayers` cache-hit and never entered the loop.

3. **Symptoms looked like “heavy profile UI.”** Prior theory work (badges catalog size, trophies, SmoothRuntime) was directionally adjacent but not the self-triggering loop. That made it easy to keep optimizing the wrong layer.

4. **No call-graph discipline until late.** Timing logs showed longtasks and `current_week` timeouts (victims). Only `WR-LLP-GRAPH` with explicit `caller=` proved **who** was re-entering.

---

## 2. What architectural assumption allowed it?

### Bad assumption A — “Unlock check is free and idempotent”

We treated `findNewBadgeUnlocksForSession` as a quiet background scan:

```text
load league → apply legacy grants → queue pending celebration → force re-check
```

**Reality:** `queuePendingBadgeCelebration` always fired `warroom-force-badge-check`, and `BadgeUnlockModal` handled that with `tryCelebrate({ force: true })`, which **bypassed** “already checked / already scanning.” Combined with `applyLegacyBadgeGrants` re-queueing the same pending id, this became:

```text
findUnlocks → loadLeaguePlayers → applyLegacy → queuePending
  → force-check → findUnlocks → …  (1,500+ times, msSincePrev=0)
```

### Bad assumption B — “League-wide load is OK for one profile”

`loadLeaguePlayers` loads **the whole standings list**. Identity paint only needs one user_id match. Using the full league loader for celebration + profile identity made any fan-out catastrophically expensive.

### Bad assumption C — “In-flight coalesce is enough”

Single-flight on the network hop still allowed **200+ waiters** to attach. When the hop resolved, the microtask / `setState` / log cascade monopolized the main thread (depth ~215 `inflight-join` ENDs). Coalesce without bounding callers still freezes.

### Bad assumption D — “Local clean path ⇒ production clean”

Guest + fake league + settled Standings never recreated the force-check loop. Binary isolation on a non-reproducing path cannot close a production-only architecture bug.

---

## 3. How do we prevent the next feature from hiding a similar problem?

### Rules for unlock / celebration / hydrators

1. **Single-flight** any “scan whole league for me” path (`findNewBadgeUnlocksForSession` now is).  
2. **Idempotent pending queues** — dispatch UI events only when the pending set **grows**.  
3. **Never `force: true` re-entry while a scan is in flight.**  
4. **Prefer identity / session data** for one player; do not pull full standings unless peers are required for ranking cheevos, and then once, idle.

### Rules for `loadLeaguePlayers`

1. **Stale-while-revalidate** after Standings has warmed the list (do not cold-stampede on profile).  
2. **Longer fresh TTL** than a single desk hop (15s was too short).  
3. **Do not attach per-waiter finally side effects** that scale with joiner count (console, heavy work).  
4. **Name callers** in code (`loadLeaguePlayers("Desk.reason")`) so the next graph is one grep away.

### Rules for unhiding desks (Crews, Museum, Hardware, Loading Dock)

1. **Reproduce on real auth + real league** before declaring “works.”  
2. **If local isolation is clean and production freezes, instrument production** (trace id, caller graph)—do not guess-remove features.  
3. **Ask “what global listener re-fires on route change?”** before “what is expensive to render?”  
4. **Ship a design note** when a route depends on layout-global modals (BadgeUnlock, hydrators, deferred chrome).

### Optional field debug (opt-in)

```js
localStorage.setItem("warroom-profile-nav", "1");
// Filter console: WR-PROFILE-NAV | WR-LLP-GRAPH
```

Default production: **off**.

---

## Fix summary (kept in product)

| Layer | Fix |
|-------|-----|
| `queuePendingBadgeCelebration` | Dispatch force-check only if pending set grows |
| `applyLegacyBadgeGrants` | Skip queue if already pending |
| `findNewBadgeUnlocksForSession` | Single-flight |
| `BadgeUnlockModal` | Ignore force-check while scanning; don’t clear checked into a re-entry storm |
| `loadLeaguePlayers` | Longer TTL + stale-while-revalidate; quiet inflight join |
| `CrownAndShame` | Stable prop key (not array identity) |

---

## Verification checklist (passed)

- [x] Multiple peer profiles (production)  
- [x] Phone  
- [x] Desktop  
- [x] No freeze observed after fix  
- [x] MarilynnsMum path no longer special-cased  

---

## Lesson in one line

**A global “force unlock check” event that re-enters a league-wide loader is a freeze architecture, not a badge.**
