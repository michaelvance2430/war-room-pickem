# Official Season Opening Ceremony + First-Login Sequence Control

**Status:** Design + audit only — **no implementation until Mike + ChatGPT approve**  
**Date:** 2026-08-03  
**Intent:** One ~5s “football is finally here” peak per user · league · sport · season — without reviving DeferredChrome freezes or stacking modals.

---

## Product principle

> This is a **meaningful season-opening peak**, not another popup.

It should feel like: **“Football is finally here.”**  
It must not block trust, navigation, picks, or normal league data.

---

# PART 1 — Current sequence audit (traced from code)

## Critical production fact

**`RoomDeferredChrome` is NOT mounted in production.**

| Mechanism | Behavior |
|-----------|----------|
| `DeferredChromeGate` | `NODE_ENV === "production"` → logs once, returns `null`, **never imports** `RoomDeferredChrome` |
| `Nav.tsx` | Still mounts `<DeferredChromeGate />` always; production path is inert |
| `RoomDeferredChrome.tsx` | Preserved for **dev isolation only** (wave 0/1/2 timers, 15+ dynamic modals) |

**Implication:** Almost all “ceremony catalog” components (LoginWelcome, RingCeremony, SeasonOpenWelcome, GazetteModal, WeeklyColdOpen, SeasonFinale, Birthday, PlatformAnniversary, BadgeUnlock, etc.) **do not run in production today** unless mounted elsewhere.

**What *does* still run on authenticated app shell / Home:**

| Surface | Mount path |
|---------|------------|
| `PracticeModeChrome` | Root `layout.tsx` |
| `FoundrySessionChrome` / `SandboxSessionChrome` / `LeagueBuildGate` | Root layout (ThemeDecorGate) |
| `SmoothRuntime` | Root layout (route unlock, orphan body-lock kill) |
| `AppShell` → `Nav` | Persistent chrome |
| `OnboardingHost` | Nav (always for non-guest) |
| `PlayerWalkthrough` | Nav (legacy; suppressed when new onboarding owns first session) |
| `GuestOnboarding` / `GuestDemoChrome` | Nav (guest only) |
| `SoftUnlockBanner` | **Home** `page.tsx` only |
| Progressive snapshot / first-week flags | Nav + Home boot (`progressive-disclosure`, `first-week`) |
| `IncidentBanner` (if present) | platform status path |

---

## Timeline — authenticated login → Home interactive (production)

```
[Auth complete] /login → redirect Home (or deep link)
        ↓
[Session + league resolved]  getSession / getLeague (local + cloud restore)
        ↓
[Root layout paint]
  SmoothRuntime
  Theme / Sport / Season appliers
  FoundrySessionChrome (creator only)
  SandboxSessionChrome (creator hop only; customers cleared)
  PracticeModeChrome (if bored-practice active)
  AppShell → Nav
        ↓
[Nav mount — single persistent instance]
  Progressive snapshot (scored weeks, first-week chrome, nav shelves)
  OnboardingHost → maybeStartOnboarding()
    · commissioner journey if first-time host
    · else player journey if incomplete
  PlayerWalkthrough (no-op if onboarding engine completed tutorial)
  DeferredChromeGate → null (production)
        ↓
[Home page mount]
  SoftUnlockBanner (if first lock just unlocked core loop)
  HomeWeekHero / first-week chrome tiles OR full secondary chrome
  CrownAndShame (empty if no official scored weeks)
  Practice CTA if pre-opening window
        ↓
[Home interactive]
  User can navigate freely
  No DeferredChrome wave-1/wave-2 modal catalog
```

**Sport + official week resolution today (scattered):**

| Concern | Source |
|---------|--------|
| First pick’em week index | `firstSeasonWeek(sportId)` in `season-calendar.ts` (CFB → 0, NFL → 1) |
| “Doors open” calendar moment | Hardcoded ms in `season-countdown.ts` (`CFB_SEASON_OPEN_AT_MS`, `NFL_SEASON_OPEN_AT_MS`) |
| Opening week kickoff | `hasOpeningWeekStarted` / ring-ceremony + `weekWindowMs` |
| Sport pack metadata | `sports/registry.ts` — **no `officialOpeningWeek` field yet** |

---

## Surface inventory (every first-login / first-week / ceremony-class UI)

### A. Live in production shell / Home

#### 1. OnboardingHost (player + commissioner journeys)

| Field | Detail |
|-------|--------|
| **Trigger** | `maybeStartOnboarding()` after session; host first-time → commissioner journey; else player if `needsJourney("player")` |
| **Priority** | Highest among *live* first-session experiences |
| **Blocking** | Soft-blocking (coach overlay; app stays visible; immersion rule) |
| **Persistence** | `localStorage` `warroom-onboarding-v1` (journey completed map, active step) |
| **Stacks?** | Should not stack with itself; can coexist with Home chrome |
| **Restart on refresh?** | Resumes active step if unfinished; completed journeys skip |
| **Mobile safe** | Yes (designed phone-first) |
| **Network before paint?** | Host path may call `listScoredWeekNumbers` for first-time host gate |

#### 2. PlayerWalkthrough (legacy)

| Field | Detail |
|-------|--------|
| **Trigger** | Nav mount; suppressed when new engine completes tutorial |
| **Priority** | Legacy / Account re-run |
| **Blocking** | Overlay coach |
| **Persistence** | `player-tutorial` localStorage keys |
| **Stacks?** | Risk if both engines fire — start.ts tries to complete legacy when starting player journey |
| **Restart** | If incomplete |
| **Mobile** | Yes |
| **Network** | Card published listeners; can probe live card |

#### 3. SoftUnlockBanner (Home only)

| Field | Detail |
|-------|--------|
| **Trigger** | `isCoreLoopUnlocked` + first lock (`hasLockedPicksOnce`) + not seen |
| **Priority** | Post-first-lock delight |
| **Blocking** | Non-blocking banner (not full-screen) |
| **Persistence** | `warroom-soft-unlock-seen-v1` (per playerId); session `warroom-soft-unlock-session-v1` |
| **Stacks?** | Claims `session-drama` slot `soft_unlock` to block full-screen drama same session |
| **Restart** | Once per player; session guard |
| **Mobile** | Yes |
| **Network** | No (local flags) |

#### 4. PracticeModeChrome

| Field | Detail |
|-------|--------|
| **Trigger** | Bored practice active / `practice=1` URL |
| **Priority** | Global chrome when practicing |
| **Blocking** | Sticky banner; not a modal |
| **Persistence** | `warroom-bored-practice-*` keys |
| **Stacks?** | Separate reality; must **block** season opening ceremony |
| **Restart** | Sticky until explicit exit |
| **Mobile** | Yes |
| **Network** | No |

#### 5. FoundrySessionChrome / eyes banners

| Field | Detail |
|-------|--------|
| **Trigger** | App creator + sticky Foundry session or eyes mode |
| **Priority** | Creator only |
| **Blocking** | Sticky bar |
| **Persistence** | `warroom-foundry-session-v1`, creator-eyes storage |
| **Stacks?** | Customer ceremony must not run unless Mike previews |
| **Restart** | While sticky |
| **Mobile** | Yes |
| **Network** | No |

#### 6. Progressive / first-week chrome (Home + Nav)

| Field | Detail |
|-------|--------|
| **Trigger** | `isFirstWeekChrome` = !hasLockedPicksOnce |
| **Priority** | Layout demotion, not a popup |
| **Blocking** | No |
| **Persistence** | `warroom-has-locked-picks-v1`, `warroom-season-alive-v1` |
| **Stacks?** | N/A |
| **Network** | Progressive snapshot can hit scored weeks / active week (PB-2) |

#### 7. SandboxSimBanner / Preseason board empties / achievement empties

| Field | Detail |
|-------|--------|
| **Trigger** | Season mode / zero scored weeks |
| **Priority** | Trust empty states |
| **Blocking** | No |
| **Persistence** | N/A |
| **Stacks?** | No |

---

### B. DeferredChrome catalog (code exists; **production-disabled**)

These **would** stack via waves if re-enabled. Document for risk / rehoming.

| Surface | Wave | Trigger (code intent) | Persistence | Session drama |
|---------|------|----------------------|-------------|---------------|
| LoginWelcomeModal | 1 | Post-login, not dismissed forever, not pre-lock calm conflicts | `warroom-login-welcome-v1-dismissed` | `welcome` |
| RulesOnboardingModal | 1 | Stub / demoted | rules seen | — |
| CrewWeekEightModal | 1 | Crew week 8 | crew keys | `crew_week8` |
| LeagueBuildLockReminder | 1 | Host build incomplete | local | — |
| CardPublishedModal | 1 | Just published session flag | session `warroom-just-published` | — |
| BoredPracticeDoneModal | 1 | Practice score pending | session | — |
| GazetteModal | 1 | Unread paper | gazette seen keys | — |
| GazetteShelfReveal | 1 | Progressive shelf | local | — |
| StoryDoorModal | 1 | Progressive doors | story-doors | — |
| BadgeUnlockModal | 1 | New badge unlocks | badge session | — |
| SeasonCountdownTicker | 2 | Before doors open | none | — |
| SeasonOpenWelcome | 2 | `isSeasonOpen` calendar + not seen | `warroom-season-open-welcome-2026-27:{leagueId}` | `season_open` |
| RingCeremonyModal | 2 | Opening week defending champ walk | `warroom-ring-ceremony-seen-v4` | `ring` |
| SeasonFinaleModal | 2 | Hardware engraved | finale keys | `finale` |
| WeeklyColdOpenModal | 2 | Week-before-open window | cold open seen | `weekly_cold_open` |
| Birthday / PlatformAnniversary | 2 | Calendar | seen keys | — |
| EasterEggHost / Mascot / EggFlex | 2 | Eggs | egg store | — |

**Wave mechanics (why freezes happened):**

- 12s idle **or** 2 route hops → wave 1 (mount many dynamic chunks)
- +14s → wave 2 if no visible modal; else retry +8s
- +600ms ceremonyOk stagger
- Multiple full-screen modals each call `claimSessionDrama` / body lock
- Route hop counting on **every** pathname change

---

### C. Session drama ownership (still valid for any remounted ceremony)

| Item | Detail |
|------|--------|
| **File** | `src/lib/session-drama.ts` |
| **Key** | `sessionStorage` `warroom-session-drama-v1` |
| **Slots** | welcome, ring, finale, season_open, soft_unlock, weekly_cold_open, crew_week8 |
| **Rule** | At most one claimed slot per tab session |
| **Gap** | Soft unlock is banner but claims slot; no priority queue — first claimer wins; no multi-device; no season identity |

---

### D. Conflict / stacking risks (current)

| Risk | Severity | Notes |
|------|----------|-------|
| Re-enabling DeferredChrome as-is | **Critical** | Known freeze path (chunk storm + route hops + body locks) |
| Onboarding + full-screen ceremony same session | High | No coordinator today |
| SoftUnlock + future ceremony | Med | Soft unlock claims drama slot |
| Practice Mode + ceremony | High | Must hard-block |
| Foundry eyes + ceremony | High | Must hard-block unless preview |
| SeasonOpenWelcome vs RingCeremony vs new Opening | High | Overlapping “season has begun” product jobs |
| Calendar open (`isSeasonOpen`) vs **published opening week card** | High | Today SeasonOpenWelcome is **date-based**, not “card published for Week 0/1” |
| localStorage-only “seen” | High | Replays on new device/browser |
| Progressive scored-week fan-out at login | Med | PB-2; ceremony must not add fan-out |

---

# PART 2 — Design: SeasonOpeningCeremony (isolated)

## Name

`SeasonOpeningCeremony` (component + eligibility module)

## Mount (preferred)

```
layout / AppShell (authenticated only)
  └── SeasonOpeningCeremonyHost  (tiny eligibility shell)
         └── dynamic import of visual module ONLY if claim succeeds
```

**Must NOT:**

- Mount via `RoomDeferredChrome`
- Restore wave system, polling intervals, or `hasVisibleModal` DOM scans
- Listen to every route change for eligibility
- Trigger data fetch storms
- Own body lock after exit
- Run on every page forever

**Display rule:**

- Prefer **Home only** (`pathname === "/"`)
- If user lands elsewhere, either: (a) wait until next Home visit in same eligibility window, or (b) soft-navigate to Home once after claim (product choice — recommend **wait for Home**)
- Unmount completely after complete / skip / failsafe

## UX timeline (~5s)

| Time | Visual |
|------|--------|
| **0.0–1.0s** | Home remains recognizable under soft dark scrim. Line: **“ATTENTION IN THE WAR ROOM…”** |
| **1.0–4.3s** | Confetti + fireworks (lightweight). Main announcement (chosen copy). |
| **4.3–5.0s** | Sport-specific closer: **“Week 0 is live.”** (CFB) / **“Week 1 is live.”** (NFL) / registry label for future sports. Fade. |
| **Skip** | Always visible; ends immediately, still marks claimed after successful start |

**Requirements:**

- One clear **Skip**
- `pointer-events`: scrim may catch taps only on Skip / dismiss — never trap Nav forever
- **No sound by default**
- `prefers-reduced-motion`: static celebration + short fade (≤2s), no particle loop
- Mobile-safe; cap particle DOM (CSS confetti / canvas few bursts, not hundreds of nodes)
- Timers cleaned on unmount
- No second “ending modal” after ceremony
- Failsafe auto-dismiss at 6s if timers glitch

## Visual budget

- Dynamic import ceremony CSS/JS only after **claim succeeds**
- Prefer CSS animations / single canvas layer
- No video required for v1
- No Lottie dependency unless already in bundle (prefer none)

---

# PART 3 — One-shot state model

## Identity

```
ceremony_type = official_season_open
user_id
league_id
sport_id
season_key   // e.g. "2026" or "2026-27" from league season config
```

**Key concept:**

```
official_season_open:<user_id>:<league_id>:<sport_id>:<season_key>
```

## Why not only localStorage

- New phone / browser would replay
- Two tabs can race
- Foundry “reset for Mike” needs a clear source of truth

## Recommended storage: additive table `user_season_moments`

Existing tables **do not** fit cleanly:

| Existing | Why not ideal |
|----------|----------------|
| `announcement_reads` | League announcements, not season moments |
| Onboarding localStorage | Browser-only, journey-shaped |
| Session drama | Tab session only |
| `warroom-season-open-welcome-*` | localStorage, date-based product, not publish-based |
| Ring ceremony seen keys | localStorage; different product (defending champ walk) |

### Proposed schema (non-destructive)

```sql
create table if not exists public.user_season_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id uuid not null,
  sport_id text not null,
  season_key text not null,
  moment_type text not null,  -- 'official_season_open'
  seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, league_id, sport_id, season_key, moment_type)
);

-- RLS: users select/insert/update only own rows
-- No service role required for ordinary claim
```

## Claim protocol (idempotent, two-tab safe)

1. **Local fast guard** (sessionStorage): if `claimed_this_session` for identity → never show  
2. **Cloud claim** (preferred):  
   `INSERT ... ON CONFLICT DO NOTHING RETURNING id`  
   - If row returned → **this tab owns the show**  
   - If no row (conflict) → already claimed → never show  
3. **Mark timing:** claim **after** eligibility confirmed and **as ceremony starts** (not on mere eligibility check)  
4. Optional: write localStorage after successful claim for offline skip  
5. Fail: no claim write → may retry next login (see failure section)

No write on every render. No poll.

---

# PART 4 — Eligibility rules

**ALL must be true:**

| # | Rule |
|---|------|
| 1 | Authenticated real user (`playerId`) |
| 2 | Valid real league membership |
| 3 | Not Practice Mode (`isBoredPracticeActive` / practice URL) |
| 4 | Not Foundry eyes / sticky Foundry session **unless** Mike explicit preview flag |
| 5 | League `sportId` known |
| 6 | `season_key` resolved |
| 7 | Active/published week **≥** registry `officialOpeningWeek` for sport |
| 8 | **Published card exists** for that official opening week (games length > 0) |
| 9 | Moment not already claimed for user+league+sport+season |
| 10 | No **blocking** onboarding active (`isOnboardingActive()`) |
| 11 | Pathname is Home (or product chooses redirect) |
| 12 | Not guest mode |

### Onboarding vs ceremony (Mike preferred — recommended)

| Audience | Behavior |
|----------|----------|
| **Brand-new user** | Onboarding owns first experience. Ceremony **queues** for immediately after onboarding completes **or** next clean Home. |
| **Returning user** | Ceremony after Home stable (session + league + sport resolved), no onboarding. |
| **Never** | Onboarding coach + ceremony stacked. |

**Rule code shape:**

```
if (isOnboardingActive()) → not eligible (queue for post-onboarding)
if (justCompletedOnboardingThisSession) → eligible next Home tick
```

---

# PART 5 — ExperienceQueue (stair-step coordinator)

## Concept

`ExperienceQueue` — **small**, known set of first-session experiences.  
Not a modal framework. Not DeferredChrome.

## Responsibilities

- Register few experiences with explicit priority  
- Run **one blocking** experience at a time  
- Advance only on complete / skip / failsafe  
- **No** poll, DOM scan, recursive global events  
- **No** eager load of future experience modules  

## Proposed priority

| P | Experience | Blocking |
|---|------------|----------|
| 1 | Critical account/session error | Yes |
| 2 | Required onboarding | Soft-yes |
| 3 | **Official season opening ceremony** | Yes (5s overlay) |
| 4 | Important host/player announcement (real league news) | Yes |
| 5 | Optional delight (soft unlock banner, etc.) | No |
| 6 | Everything else waits for later session | — |

## Experience descriptor

```ts
type QueuedExperience = {
  id: string;
  priority: number;
  blocking: boolean;
  routeRequirement?: string | ((path: string) => boolean);
  minDelayAfterPriorMs: number;
  eligibility: () => Promise<boolean> | boolean;
  oneShotIdentity?: string;
  run: () => Promise<"completed" | "skipped" | "failed">;
  timeoutMs: number; // failsafe
  skipLabel?: string;
};
```

## State diagram

```
IDLE
  │ resolve session/league/sport
  ▼
EVALUATE (once per stable session bootstrap + onboarding complete event)
  │ filter eligibility, sort priority
  ▼
WAIT_GAP (minDelayAfterPriorMs, no poll — single timeout)
  ▼
RUN_ONE (dynamic import only this experience)
  │ complete | skip | timeout
  ▼
EVALUATE again (remaining queue)
  │ empty
  ▼
DONE (for this session; non-blocking items may still show as banners)
```

## Avoiding DeferredChrome freeze path

| DeferredChrome failure | ExperienceQueue rule |
|------------------------|----------------------|
| Mount 15+ chunks at once | Import **one** module when its turn runs |
| 12s / 14s / hop timers | Explicit queue after stable session; no idle waves |
| Route hop arms wave 1 | No hop counter for eligibility |
| hasVisibleModal DOM walk | Queue ownership only |
| Body lock orphans | Ceremony uses short-lived lock or **none**; SmoothRuntime remains kill switch |
| Every route re-evaluates everything | Bootstrap + onboarding-complete + Home focus only |

---

# PART 6 — Foundry: Season Opening Lab

**Creator-only** (`isAppCreator`). Never customer-visible.

### Controls

- Preview CFB Week 0 ceremony  
- Preview NFL Week 1 ceremony  
- Choose league / season / sport  
- Force reduced-motion preview  
- Reset **Mike’s** ceremony claim only (delete own `user_season_moments` row)  
- Mark ceremony seen for Mike  
- Show eligibility **reason list** (debug strings, Foundry only)  
- Show ExperienceQueue order  
- Toggle individual first-session surfaces for testing  
- Set stair-step delay between surfaces  
- Run sequences:  
  - brand-new player login  
  - returning player official-week login  
  - new commissioner official-week  

**Language:** Foundry internal labels only. Customers never see lab / queue / reset.

---

# PART 7 — Performance & safety budget

| Budget | Target |
|--------|--------|
| Provider API | **Zero** (odds/scores) |
| Recurring intervals | **Zero** |
| Route prefetches | **Zero** from ceremony |
| Scored-week fan-out | **Zero** new callers; reuse existing session data if already loaded |
| Profile/badge imports | **Zero** |
| Picks/scoring impact | **None** |
| DB write before first Home paint | **None** (claim only when starting show after Home stable) |
| Animation setup longtask | **&lt; 100 ms** |
| After exit | No listener/timer leak; no body lock |

**Measure:**

- Additional JS chunk size (ceremony dynamic import)  
- Animation startup time  
- Largest longtask during 5s  
- Timer lag  
- Listener cleanup  
- Mobile FPS during 5s  
- Navigation responsiveness immediately after exit  

---

# PART 8 — Failure behavior

| Failure | Behavior |
|---------|----------|
| Eligibility error | Home normal; no spinner; single Foundry diagnostic |
| Claim network fail | Do not show; may retry **next login** if never claimed |
| Claim conflict (other tab) | Silent skip |
| Animation crash | Skip + mark claimed if claim already succeeded |
| Timeout | Auto-dismiss; claim stands if started |
| Practice / eyes mid-show | Abort; if not claimed, allow later; if claimed, do not replay |

No console storm. No retry loop. No infinite spinner.

---

# PART 9 — Deliverable answers

## 1. Current first-login sequence map

See Part 1 timeline. **Production is thin:** onboarding + progressive chrome + SoftUnlock; DeferredChrome catalog off.

## 2. Conflict / stacking risks

See Part 1.D. Biggest risks: re-enabling DeferredChrome; stacking onboarding + ceremony; calendar open ≠ published opening week; multi-device localStorage.

## 3. Proposed eligibility rules

Part 4 (all-must-be-true + onboarding queue preference).

## 4. Sport official-week registry design

Extend `SportPack` in `src/lib/sports/types.ts` + `registry.ts`:

```ts
officialOpeningWeek: number;      // CFB: 0, NFL: 1
officialOpeningWeekLabel: string; // "Week 0" / "Week 1"
seasonKeyResolver?: (league) => string; // default year from trophies/defaultSeasonYear
```

**Single source** for eligibility — no scattered `sportId === "nfl" ? 1 : 0` in ceremony code.  
Calendar doors (`season-countdown`) remain separate product (countdown hype); ceremony requires **published opening week card**.

## 5. One-shot cloud/local model

Part 3 (`user_season_moments` + session guard + claim-on-start).

## 6. Experience queue / state diagram

Part 5.

## 7. Foundry stair-step controls

Part 6.

## 8. Ceremony UX timeline

Part 2.

## 9. Ten announcement options (for Mike’s approval — not final)

1. “It took long enough. Football is finally back.”  
2. “Cancel your weekend plans. The War Room is open.”  
3. “The excuses start now. The season is officially live.”  
4. “ATTENTION: the group chat just became a competitive sport.”  
5. “Lock your phones. Lock your cards. Hide your dignity.”  
6. “We’re back. The board is hungry. Feed it picks.”  
7. “Preseason feelings are canceled. Real weeks only.”  
8. “If you forgot how this works: pick sides, take a Best Bet, get roasted.”  
9. “Welcome to the season. Your friends already think they’re smarter than you.”  
10. “Football is here. Try not to peak in the group chat before Thursday.”  

Sport closer line (separate from main joke):  
- CFB: “Week 0 is live.”  
- NFL: “Week 1 is live.”

## 10. Performance budget and verification

Part 7 + after ship: cold Home with ceremony eligible ×3, reduced-motion ×3, two-tab claim race, mobile mid-tier FPS.

## 11. Exact files / tables expected to change (when implemented)

| Area | Likely paths |
|------|----------------|
| Schema | `supabase/user-season-moments.sql` (new) |
| Eligibility | `src/lib/season-opening.ts` (new), sports registry/types |
| Claim | cloud helpers in `src/lib/cloud.ts` or `src/lib/season-moments.ts` |
| Ceremony UI | `src/components/SeasonOpeningCeremony.tsx` (+ visuals chunk) |
| Host mount | `AppShell` or layout host — **not** RoomDeferredChrome |
| Queue | `src/lib/experience-queue.ts` + thin host component |
| Onboarding hook | `onboarding/engine` complete → queue advance |
| Foundry | `src/app/founder/page.tsx` lab section |
| Docs | this file + constitution line if desired |

## 12. Phased implementation plan

| Phase | Work | Ship gate |
|-------|------|-----------|
| **A** | Sequence audit + state model (this doc) | Approve |
| **B** | Registry official week + eligibility + claim API + RLS | Unit tests for claim race |
| **C** | Lightweight visual ceremony (dynamic import, reduced-motion) | Perf budget |
| **D** | ExperienceQueue + onboarding handoff | No stack with onboarding |
| **E** | Foundry Season Opening Lab | Creator only |
| **F** | Production verification matrix | Mike sign-off |

---

## Relationship to existing “season open” products

| Existing | Job | Conflict with new ceremony? |
|----------|-----|------------------------------|
| **SeasonOpenWelcome** | Calendar doors open splash | Overlaps “season began” — **do not re-enable both** for same job; either retire/rehome or demote |
| **RingCeremony** | Defending champ walk in opening week | Different job (hardware lore). Can coexist **later** via queue priority *after* opening ceremony, never same session stack |
| **WeeklyColdOpen** | Week *before* open wanted poster | Precedes season; separate moment type |
| **SoftUnlock** | After first lock | Later priority 5; non-blocking |
| **LoginWelcome** | Forever sarcastic shop welcome | Lower priority / demote if reintroduced |

**Recommendation:** New `official_season_open` owns “football is here.” Do not revive SeasonOpenWelcome as a second peak for the same emotional beat.

---

## Approval checklist

- [ ] Eligibility (published opening week, not just calendar date)  
- [ ] Onboarding-before-ceremony rule  
- [ ] `user_season_moments` table  
- [ ] ExperienceQueue priorities  
- [ ] Ten copy lines (pick / edit)  
- [ ] Foundry lab scope  
- [ ] Explicit: **do not re-enable RoomDeferredChrome** for this feature  

**No implementation until Mike and ChatGPT approve this design.**

Then stop.
