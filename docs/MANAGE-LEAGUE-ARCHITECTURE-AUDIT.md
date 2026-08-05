# Manage League — Architecture & UX Audit

**Status:** Audit only. **No implementation.**  
**Date:** 2026-08-04  
**Governing rule:** *Home runs the league. Manage League changes the league.*

---

## Preflight: Museum 1A & league-alias isolation

| Item | Status |
|------|--------|
| Working tree | Clean of Museum/alias implementation work; only unrelated untracked scripts |
| Museum Phase 1A | Separate commits: `ba28de2`, `7407872` on `main` |
| League alias | Separate commits: `baa73ad`, `033ec94` on `main` |
| This redesign | **Must not** mix into those commits or migrations |

Safe to plan Manage League as a **new** workstream.

---

## Current route / component architecture

| Route | Role |
|-------|------|
| `/commissioner` | Thin shell `page.tsx` → dynamic `CommissionerClient.tsx` (~5k lines) |
| Tabs | `card` \| `results` \| `settings` \| `picks` (internal) |
| Host shell | `HostDashboardShell` + `host-dashboard.ts` on same page |
| `/week-ops` | Intended weekly spine (build/publish/score) — Home missions deep-link here |
| `/players` | **Players & Divisions** — roster, manual division select, Auto-balance, remove |
| `/league-build` | Constitution / name / cut / CB / open / bots |
| `/moderation` | Mods / mute (separate) |
| `/founder` | Foundry / creator lab |
| Nav | “Manage League” → `/commissioner` |

**Product inventory already documented** in `commish-home-mission.ts`: weekly jobs → Home CTA → `/week-ops`; settings stay secondary on `/commissioner`.

**Reality gap:** `/commissioner` still hosts full **Build card** + **Score week** workbenches, not only Manage settings.

---

## 1. Complete control inventory (Commissioner page + related)

Classification codes:  
`1` Weekly Home/week-ops · `2` Persistent setting · `3` People · `4` Preseason alignment · `5` Season/history · `6` Production recovery · `7` Foundry/test · `8` Duplicate · `9` Stale · `10` Dangerous

### A. Host Dashboard / weekly ops (same page as settings)

| Label | Class | File | Reads | Writes | Auth | Visibility | Functional | Home handles? | Recommend |
|-------|-------|------|-------|--------|------|------------|------------|---------------|-----------|
| Host hero / This Week CTA | 1, 8 | HostDashboardShell, host-dashboard.ts | card, week, locks | none | ops | ops on `/commissioner` | Y | **Yes** (Home mission) | Keep deep-link targets; **remove weekly primary UI** from Manage landing |
| Build card tab | 1, 8 | CommissionerClient `tab=card` | odds, draft, interest | week_cards, card_games | ops | always for ops | Y | Yes → week-ops | **Remove from Manage landing**; keep route/components |
| Score week tab | 1, 8 | CommissionerClient `tab=results` | scores, boxes | week_results, game_results | ops | ops | Y | Yes → week-ops?score | Same |
| Build card / Score week chips | 1, 8 | workbench header | — | — | ops | when not settings | Y | Yes | Remove from Manage |
| Pull Odds / select 5 / prop / publish | 1 | CommissionerClient card | Odds API | publishWeekCard | ops | card tab | Y | Yes | week-ops only in product IA |
| Who’s locked / Community Pulse | 1, 3 | CommissionerClient + loadPickSubmissionStatus | picks, memberships | none | ops | pulse | Y | Partial (Home pulse?) | Compact summary on Manage **or** Home only |
| League Interest filters (ALL/RANKED/FAN) | 1 | card builder | favorites RPC | none | ops | card tab | Y | week-ops | Stay on weekly surface |

### B. Settings tab (owner)

| Label | Class | File | Reads | Writes | Auth | Visibility | Functional | Home? | Recommend |
|-------|-------|------|-------|--------|------|------------|------------|-------|-----------|
| League name | 2 | settings | league | leagues.name via save | owner | settings | Y | No | **1 Identity** compact Edit |
| Commissioner name display | 3 | settings | session | none | — | settings | Y | — | People summary |
| Cut line % | 2 | settings | settings | cut_percent | owner | settings | Y | No | **2 Rules** — freeze midseason? |
| Season length blurb | 2 | settings | sportId | none (read-only) | — | settings | Y | — | Read-only Rules |
| League Build → | 2, 4 | link | — | — | owner | settings | Y | No | Collapse into Identity + Rules |
| Crystal Ball toggle | 2 | settings | crystal_ball_enabled | leagues | owner | settings | Y | No | **2 Rules** — freeze after CB lock |
| Drama calendar / Test walk-out | 7, 9 | settings | ring ceremony | local preview | owner | settings | Preview only | No | **Remove from production**; Foundry or drop |
| Open room listing | 2 | settings | is_open | leagues.is_open | owner | settings | Y | Share on Home | **1 Access** |
| Home page tagline | 2 | settings | home_tagline_* | leagues | owner | settings | Y | No | **1 Identity** motto |
| Fill empty seats / trial bots | 3, 7 | settings | bots | trial bot RPCs | owner; bots gated | settings | Y | No | People (bots) or Advanced; production caution |
| Creator bot lab details | 7 | settings | — | bots | creator | settings | Y | No | **Foundry only** |
| Trophy Room link | 5 | settings | — | — | owner | settings | Y | No | **4 Season & History** link |
| Deputy commissioners + Make deputy | 3 | settings | roster | is_deputy | owner | settings | Y | No | **3 People** overflow, not permanent bright list |
| Pass commissioner | 3, 10 | settings | roster | commissioner_id | owner | settings | Y | No | **3 People** / Danger with confirm |
| Start next season | 5, 10 | settings | — | reset_league_season RPC | owner | settings | Y | No | **4 Season** contextual, not Week 0 hero |
| Reset season (RESET) | 5, 10 | settings | — | same wipe | owner | settings | Y | No | **5 Advanced** collapsed |
| Delete league | 10 | settings | — | delete league | owner | settings | Y | No | **5 Danger Zone** |
| SportPoolCommishPanel | 2/9 | settings | sport pool | varies | owner, !simpleHost | settings | partial | No | Evaluate; not weekly |
| Foundry auto-score range / lab scoring | 7 | results | — | score path | creator | results | Y | No | **Foundry only** |
| Demo slate / Post week (Foundry) | 7 | card | — | demo card | creator/preseason | card | Y | No | Foundry |
| Replay Tools / unlock / re-score | 6/7 | results | week_results | delete/re-score | ops; often Foundry language | results | Y | No | Audit: recovery → Advanced creator; sim → Foundry |

### C. Alignment (not on Commissioner — on `/players`)

| Label | Class | File | Reads | Writes | Auth | Visibility | Functional | Home? | Recommend |
|-------|-------|------|-------|--------|------|------------|------------|-------|-----------|
| Division columns + select Move | 4 | players/page.tsx | roster | memberships.division | ops | always if ops | **Y** | No | **Manage → People & Alignment** (restore prominence) |
| Auto-balance divisions | 4 | players + cloud.autoBalanceDivisions | roster | memberships.division (all) | ops | canManageDivs | **Y but silent** | No | Preview/apply flow on Manage |
| Remove / Kick member | 3, 10 | players | roster | delete membership, picks | owner | commish | Y | No | People manage |
| InviteFriends | 2 | players | code | none | all | code present | Y | Home Share | Identity Access secondary |
| Blue Falcon preseason banner | 3 | players | falcon counts | none | preseason | preseasonKickOk | Y | No | People context |

**Critical finding:** Manual alignment + Auto-Balance **were not deleted from the product**. They live on **`/players`**, not on `/commissioner`. Regression is **discoverability / IA**, not missing backend.

### D. Write path for division (current)

| Layer | Behavior |
|-------|----------|
| Client | `updateMemberDivision` / `autoBalanceDivisions` in `cloud.ts` |
| Auth gate | Client `isOps()` only |
| DB | Direct `memberships.update({ division })` |
| RLS | Ops manage memberships (deputy-ops style) — **no first-kickoff lock** |
| Server lock | **Does not exist** |

### E. Auto-Balance logic (current)

| Item | Detail |
|------|--------|
| Pure plan | `planAutoBalance` in `divisions.ts` — sort by name, round-robin N/S/E/W (**deterministic**) |
| Apply | Immediate after `confirm()` — **no preview UI**, rebalances **everyone** |
| Modes | No “unassigned only” (schema has no unassigned — default North) |
| Git | Wired to Players in `1a302b6`; never primarily on modern Host Dashboard |

### F. First-kickoff / season lock (current truth)

| Claim | Code truth |
|-------|------------|
| Alignment lock at first published card kickoff | **Not enforced** |
| Preseason tools (`isPreseasonCommishToolsAllowed`) | Calendar sandbox before **global season open** (Aug 23 CFB / Sep 9 NFL) — **not** per-league first kickoff |
| Card lock for picks | `isCardLockDeadlinePassed` = first kickoff on **that week’s card** |
| `current_week > 0` | Used for many flows; **must not** be alignment lock |

**Desired lock:** first kickoff of league’s **first real published card of the season** — must be **new** server-side rule.

### G. Late entrants (current)

| Path | Behavior |
|------|----------|
| Join / open-room | Least-populated division (`pickLeastPopulatedDivision` / count) — **does not reshuffle others** |
| Fair Entry | Mid-season points band on join — **separate** from division |
| Auto-balance after lock | Client allows anytime ops runs it — **risk** |

Preferred product (post-lock assign new only) **partially matches** join path; **conflicts** with unrestricted Auto-Balance.

### H. Fair Entry

| Surface | Status |
|---------|--------|
| Join path | Implemented (`fair-entry.ts`) |
| Commissioner Manage UI | **Not a first-class settings card** on Commish settings; explained on join |
| Recommend | **2 Rules** read-only midseason; policy edit only if product allows pre-lock |

---

## 2. Duplicate map (Home / week-ops vs Commissioner)

| Job | Home | week-ops | Commissioner today |
|-----|------|----------|--------------------|
| Build / finish / publish card | Mission CTA | Primary | Full card tab **duplicate** |
| Score week | Mission CTA | ?score | Full results tab **duplicate** |
| Who locked | — | partial | Pulse **duplicate** |
| Invite | Share League | — | Players invite **secondary** |
| Settings / people / season | — | — | settings tab **correct home for Manage** |
| Alignment | — | — | **Players only** (orphaned from Manage brand) |

---

## 3. Foundry / Replay that must leave production Manage League

| Control | Class | Destination |
|---------|-------|-------------|
| Foundry demo slate / post week / all open games | 7 | Foundry only |
| Foundry auto-score range | 7 | Foundry |
| Advanced scoring lab details | 7 | Foundry |
| Creator bot lab | 7 | Foundry |
| Drama calendar “Test walk-out” | 7/9 | Foundry or remove |
| Sandbox host hop | 7 | Foundry (already mostly) |
| Unlock week / re-score mistaken results | 6 | Advanced · creator recovery **if** production-safe; else Foundry |
| Founder Moments link in bot lab | 7 | Founder/Foundry |

**Even for creator account:** do not render Foundry chrome on production Manage League.

---

## 4. Conference/division schema

| Field | Type | Notes |
|-------|------|-------|
| `memberships.division` | enum North/South/East/West | Required; default North |
| Display | CFB: SEC/Big Ten/ACC/Big 12; NFL: AFC/NFC East–West | Labels only in `divisions.ts` |
| Unassigned | **Not modeled** | Empty buckets possible; members always have a compass value |
| Conferences | No separate table | Four buckets only |

---

## 5. Alignment lock — recommended enforcement

| Layer | Action |
|-------|--------|
| Truth | `min(card_games.start_time)` over **first published week_card** of season (or first non-empty published card chronologically) |
| UI | Hide Move / Auto-Balance when `now >= firstKick` |
| Server | RPC `update_member_division` / `apply_division_plan` that rejects when locked; **stop trusting open client updates** for production lock |
| Today | Client-only `isOps` + direct update — **insufficient** |

---

## 6. Desired IA — MANAGE LEAGUE (5 areas)

| Section | Contents from current inventory |
|---------|----------------------------------|
| **1 Identity & Access** | League name, motto/tagline, open/private, code/access, sport/season read-only when unsafe |
| **2 Rules & Format** | Cut line, Crystal Ball, Fair Entry summary, postseason blurb, freezes |
| **3 People & Permissions** | Roster summary → Manage; deputies; divisions + Auto-Balance (pre-lock); remove; pass gavel |
| **4 Season & History** | Start next season; Trophy Room link; continuity |
| **5 Advanced / Danger** | Reset season; delete league; creator recovery only |

Weekly jobs: **out** of this landing. Deep links OK.

---

## 7. Controls: keep / move / collapse / remove

| Keep on Manage | Move / collapse | Remove from production Manage |
|----------------|-----------------|--------------------------------|
| League name, tagline, open room | League Build → absorbed | Build card / Score week UI |
| Crystal Ball, cut line | Deputies → People drawer | Foundry lab blocks |
| Next season, Danger | Community pulse → compact | Drama test walk-out |
| Trophy Room link | Bots → People or Advanced | Permanent Make Deputy row spam |
| — | Alignment from `/players` → Manage §3 | — |

**Do not delete** week-ops, card builder components, or `/players` routes without rehoming.

---

## 8. Files / migrations likely required (later)

| Stage | Artifacts |
|-------|-----------|
| 1 | CommissionerClient split; ManageLeague shell; strip weekly tabs from default; Foundry cull; CSS wider layout |
| 2 | Alignment UI on Manage; Auto-Balance preview; `league_first_kickoff` helper; RPCs for division updates with lock; optional `alignment_locked_at` |
| 3 | Rules freeze flags; rollover context; Danger Zone polish |

**No Museum / alias migrations.**

---

## 9. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auto-Balance after kickoff reshuffles standings/brackets peers | High | Server lock + remove post-lock UI |
| Instant Auto-Balance without preview | Medium | Preview/apply only |
| Moving weekly UI off Commish breaks bookmarks `?tab=card` | Medium | Redirect `?tab=card` → week-ops |
| Division labels vs stored enum | Low | Keep enum; labels already sport-aware |
| Late join least-full vs “rebalance everyone” | Medium | Document modes |
| Deputy can still move divisions forever today | High | Lock applies to ops |

---

## 10. Staged plan (evaluate)

### Stage 1 — Page structure
- Rename UX to **MANAGE LEAGUE**
- Five compact sections; summaries + Edit
- Remove weekly ops from default landing; deep-link Home → week-ops
- Strip Foundry from production Commish
- Wider desktop container; less permanent prose

### Stage 2 — People and alignment
- Surface manual move + Auto-Balance preview on Manage (from Players logic)
- Mobile select already exists — keep/enhance
- Authoritative first-kickoff lock (UI + server)
- Late-entrant assign-only policy verified against Fair Entry

### Stage 3 — Settings lifecycle
- Freeze competitive rules when appropriate (“Takes effect next season”)
- Contextual rollover (not Week 0 hero)
- Advanced/Danger + creator recovery separation

---

## 11. Alignment history (git)

| Finding | Detail |
|---------|--------|
| Auto-Balance / division moves | Live on **`/players`**, not deleted |
| Host Dashboard era | Commish became weekly desk; settings buried; **Players kept alignment** |
| Regression type | **Discoverability / IA** — users open Manage League and don’t see alignment |
| Logic | `planAutoBalance`, `updateMemberDivision` still functional |

Do **not** restore old Commissioner blobs blindly — rehome Players capabilities into Manage §3 with better UX + lock.

---

## 12. Late-entry proposal (do not implement until Stage 2 sign-off)

- Post-lock: assign new members only via least-populated division (already join path)
- Never call Auto-Balance post-lock
- Fair Entry points unchanged
- Mark late entrant only if product has a flag (today: none required)

---

## Approval gate

**No implementation in this turn.**

Await approval of:

1. Five-section Manage League IA  
2. Weekly ops exclusively Home → week-ops  
3. Alignment rehomed to Manage with kickoff lock + preview Auto-Balance  
4. Foundry out of production Manage  
5. Staged 1 → 2 → 3 order  

Then implement Stage 1 only after explicit go-ahead.
