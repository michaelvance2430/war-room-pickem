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

## Scrub order (reminder)

1. Usability / framework scrub across core desks  
2. Capture cold/warm baselines (table above + PB-1 matrix)  
3. Only then: chunk-split / dynamic import / reduce Account module graph if Bottom-Up proves chunk eval  

---

## Out of scope for this backlog entry

- Re-enabling DeferredChrome  
- Restoring eager profile details  
- Removing WR-PERF instrumentation (separate cleanup after scrub)  
- Schema / query redesign for “feel snappier” without profiles  
