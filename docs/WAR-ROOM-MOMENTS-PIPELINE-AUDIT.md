# War Room Moments — Pipeline Audit

**Date:** 2026-08-03  
**Verdict:** Moments are **incomplete as a system**. Season Opening is partial. Ring + Gazette were **stubs** in production (presentation only mounted via DeferredChrome, which is hard-off).

---

## 1. Current architecture

```
Triggers (login / Foundry jump / calendar)
        ↓
Ad-hoc per feature (no shared queue)
        ↓
Event bus or localStorage claim
        ↓
Presentation component (often only in RoomDeferredChrome)
        ↓
Completion localStorage
```

**Production layout host (`MomentHost`):** Season Opening only (pre-fix).  
**DeferredChrome (prod off):** RingCeremonyModal, GazetteModal, Cold Open, Card Published, Birthday, Finale, BadgeUnlock (badges moved to layout separately).

### Ideal pipeline (target)

```
trigger → eligibility → queue → priority → safe screen
  → resolve league → validate target → present → acknowledge
  → persist → dedupe → next moment (delay)
```

---

## 2. Full moment inventory

| Moment | Trigger | Eligible | Required data | Destination | Presentation | Implemented? | Works in prod? | Failure | Persist | Dedupe | Training conflict |
|--------|---------|----------|---------------|-------------|--------------|--------------|----------------|---------|---------|--------|-------------------|
| **Season Opening** | Home + calendar open + unclaimed | Members | Sport, claim key | Stay Home (ceremony) | Full screen | Partial | Yes (MomentHost) | Too fast / weak fade | Claim localStorage | Yes | Skips if onboarding |
| **Ring Ceremony** | Opening week + defending champ | Members once | Trophy champ | Ceremony overlay | Full modal | Built | **No** — DeferredChrome only | Foundry → `router.push("/")` w/ no host | Seen key | Yes | Session drama claim |
| **Weekly Cold Open** | Pre-open week | Members | Champ | Overlay | Modal | Built | **No** — DeferredChrome | Same | Seen | Yes | — |
| **Gazette paper** | Week scored / Foundry force | Members | Edition | Should be paper modal or `/gazette` | Modal + archive page | Built | **No** modal in prod | Foundry → Home | Seen week | Yes | Pre-lock calm |
| **Gazette shelf unlock** | Week 3 progressive | Members | Progressive | Popup then nav | Modal | Built | **No** DeferredChrome | — | Progressive | — | — |
| **Card published** | Host publishes | Players | Week | Overlay | Modal | Built | **No** DeferredChrome | — | Session | — | — |
| **Season Finale** | Hardware engraved | Members | Champ/toilet | Overlay | Modal | Built | **No** DeferredChrome | — | Seen | Yes | — |
| **Birthday Gazette** | Month birthday | Members | DOB | Overlay | Modal | Built | **No** DeferredChrome | — | Seen | Yes | — |
| **Story doors** (cut/trophy) | Foundry force | — | — | Board routes | Modal | Partial | Dev only | Foundry → Home | — | — | — |
| **Badge unlock** | Earn / lore pending | Members | Badge | Overlay | Modal | Built | **Yes** (layout) | — | Celebrated ids | Yes | Pre-lock calm |

A moment is **complete** only if trigger → present → acknowledge works in production. By that bar, only **Season Opening** and **Badge unlock** were production-complete (with Season Opening quality issues).

---

## 3. Root causes

1. **No shared ExperienceQueue** — each feature fires independently.  
2. **Presentation trapped in DeferredChrome** (production never loads).  
3. **Foundry “Flash a moment” = `router.push("/")`** without ensuring the listener is mounted.  
4. **Gazette force event** never reaches a mounted modal; user lands on Home.  
5. **Season Opening** under-timed (~7.5s) and fade CSS too short / weak.  
6. **No destination payload** on queued moments (route/target_id).  
7. **No production hide** for unfinished moments — Foundry pretends they work.

---

## 4. Broken routes (Foundry)

| Button | Code path | Actual result |
|--------|-----------|---------------|
| Ring ceremony | `jumpRingCeremony` + `router.push("/")` | Home; ring modal not mounted |
| Gazette paper | `jumpGazettePaperAndCheevos` + `router.push("/")` | Home; paper event lost |
| Cut / Trophy doors | force door + Home | Home / partial |
| Season Opening preview | event only (stay Foundry) | Works if MomentHost up |

---

## 5. Missing components

| Need | Status |
|------|--------|
| Shared queue + priority | Not fully built (doc + host mount first) |
| Production MomentHost for Ring + Gazette | **Fixing this ship** |
| Ring data model | Exists (trophies + seen key) |
| Gazette issue deep link `/gazette?week=N` | Partial (archive page) |
| Not-implemented production guard | Foundry should not claim success |

---

## 6. Schema

No new tables required for this pass. Existing:

- Ring: localStorage seen key + trophies table  
- Season open: local claim keys  
- Gazette: archive + seen  

Future queue table optional: `user_season_moments` (already designed in Opening Sequence doc).

---

## 7. Implementation plan (this ship + next)

1. ✅ Inventory + audit doc  
2. ✅ Mount Ring + Gazette on MomentHost (prod-safe)  
3. ✅ Foundry: ring stays; paper → `/gazette`  
4. ✅ Season Opening ~10s pacing + stronger fade + duration presets  
5. Next: full ExperienceQueue with payload destinations  
6. Next: Gazette deep-link week + mark read after load  
7. Next: re-enable ceremonies one-by-one with test matrix  

---

## 8. Test results (this ship)

| Test | Result |
|------|--------|
| Season open phase total ~10s default | Code preset |
| Fade longer / black hold | CSS + phase |
| Ring modal can open from Foundry without dead route | Mounted + no forced Home |
| Gazette Foundry → /gazette | Routing fix |
| Season open still Home-only production path | Unchanged |
| No fake championship without trophy data | Ring still requires defending champ |

Manual: Foundry → Season Opening / Ring / Gazette paper after deploy.
