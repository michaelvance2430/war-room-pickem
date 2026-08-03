# Host Dashboard — Implementation prep (pre-code)

**Status:** Information architecture **FROZEN (Rev 3)**. Catalogs below required before production code.  
**Date:** 2026-08-03  
**Route (engineering):** `/commissioner` may remain.  
**Nav label:** **League** (destination, not role).  
**Emotion:** Host Dashboard (door to the league).

---

## Freeze line (do not revisit hierarchy lightly)

```
HOST DASHBOARD
  Hero
  This Week
  The Room
  League Settings
```

**Do not** reopen Hero → This Week → The Room → League Settings unless a proposed change **better** satisfies Host Dashboard identity.

Tabs / four-pill nav remain **HOLD** — navigation follows IA; IA does not follow tabs.

---

## Principles (top of implementation)

### 1. Door, not software

> **The Commissioner page should feel like opening the door to your league—not opening league software.**

### 2. Object permanence

> **A host should never have to remember where something is. The dashboard should always remind them.**

### 3. Host, not admin

Permission = commissioner. Identity = **host**.  
ESPN feel: “I need to do admin.”  
War Room feel: “Let’s see what my idiots are up to.”

### 4. Anti-feature (dashboard hygiene)

Before adding anything to the Host Dashboard homepage:

> **Would a commissioner miss this if it wasn't on the homepage?**

If “probably not” → **League Settings** (or nowhere).

### 5. Ages with the host

Year 1: more coaching. Year 3: almost pure information. Guidance fades; hierarchy stays.

---

## Section rules (frozen)

### Hero is not a summary

**One** most important thing the host should do **right now**. Never a stack of competing facts.

| Priority | Meaning | Examples |
|----------|---------|----------|
| **1. 🚨 Blocked** | Season can’t move without the host | Card not published; results need scoring; season blocked |
| **2. ⚠️ Attention** | Host should act, room is waiting | One (or few) players haven’t locked; invite gap hurting the room |
| **3. 🎉 Celebrate** | Worth a smile, no admin burden | Everyone locked; week scored; room full |
| **4. ℹ️ Quiet** | Nothing urgent | Countdown to kickoff; healthy quiet |

Higher priority always wins. Only **one** hero story + **one** primary CTA (or none when quiet/celebrate).

### This Week owns everything that disappears today

If it’s about **this week’s football**, it lives here.  
Host never asks “Where did my card go?” → always **This Week**.

### The Room is never a stats panel

Answers only:

> **How are my people doing?**

People and social pulse — not a metrics wall.

### League Settings is calm, not scary

Rules · Deputies · Bots · Reset · Pass Gavel · Danger Zone — collapsed, rare.

---

# 1. Hero priority / state catalog

### Evaluation order (implementation must use this order)

```
1. Blocked?
2. Else Attention?
3. Else Celebrate?
4. Else Quiet
```

Stop at the first match. **Single** hero.

### State catalog

| ID | Priority | When (logic sketch — data contract later) | Host-facing story (direction) | Primary CTA |
|----|----------|-------------------------------------------|-------------------------------|-------------|
| `H_BLOCK_NO_CARD` | 1 🚨 | Active week has no published card (0 games live) | Friends can’t pick until there’s a card. | Publish this week’s card → |
| `H_BLOCK_NEEDS_SCORE` | 1 🚨 | Card exists; week’s games done / host path says scoreable; week not scored | Games are final. Time to crown this week’s winner. | Score this week → |
| `H_ATTN_HOLDOUTS` | 2 ⚠️ | Card live; lock window open; ≥1 incomplete human lock | {Name} still hasn’t submitted picks. / {N} still out. | Call out the holdouts → |
| `H_ATTN_INVITES` | 2 ⚠️ | Early season / low human count; invite still critical (first-season or empty-ish room) | The room’s thin — friends still need a way in. | Share invite → |
| `H_CELEB_ALL_LOCKED` | 3 🎉 | Card live; all humans fully locked (or only bots left) | Everyone is locked. Kickoff is {when}. | Preview as player → / none |
| `H_CELEB_SCORED` | 3 🎉 | Active week just scored / scored and no next action | This week’s written. Standings and paper did their job. | Open Standings → / Open Gazette → |
| `H_QUIET_COUNTDOWN` | 4 ℹ️ | Card live; locks fine; waiting on kickoff | Kickoff {countdown}. Nothing’s on fire. | none or Preview |
| `H_QUIET_HEALTHY` | 4 ℹ️ | Fallback healthy | The room’s ready. | none |

**Rules**

- Never show “Week N is live” alone as hero — that is a **summary**, not a reason to open.  
- Prefer **named people** in Attention when one holdout; plural only when many.  
- Celebrate is allowed to have a soft secondary link, not a second competing “task.”  
- Personality copy variants (warmth) are **optional overlays** on the same state ID — not new priorities.

**Non-goals for Hero**

- Multi-bullet dashboard  
- Equal weight for three alerts  
- Checklist completion %  

---

# 2. “This Week” data contract

**This Week** is THE object. A “card” is one facet inside it.

### Identity

| Field | Type / source (sketch) | Notes |
|-------|------------------------|--------|
| `weekNumber` | number | Active host week (`loadLeagueActiveWeek` / resolve) |
| `sportId` | `cfb` \| `nfl` | League |
| `weekLabel` | string | `weekTitle(week)` |
| `status` | enum below | Derived, single source of truth for badges |

### Status enum

| Status | Meaning |
|--------|---------|
| `draft` | No published card (or empty games) for this week |
| `live` | Published card; not yet scored; window open or games not all final |
| `needs_score` | Published; host should score (games final / score path ready; unscored) |
| `scored` | Week scored in cloud |

### Card facet (always present as an object — even if draft)

| Field | Source sketch |
|-------|----------------|
| `published` | boolean — games length > 0 on week card |
| `games[]` | published card games |
| `prop` | published prop |
| `firstKickoff` | earliest commence / display |
| `kickoffCountdown` | derived label |
| `gameCount` | number |
| `canEdit` | owner/ops + status rules |
| `canPreviewAsPlayer` | always for host when published (or always) |

### Locks facet

| Field | Source sketch |
|-------|----------------|
| `expectedHumans` | roster non-bot count (or pick-status rows) |
| `completeLocks` | full cards locked |
| `partialLocks` | submitted incomplete |
| `missing[]` | `{ userId, name }[]` still out |
| `allHumansLocked` | boolean |

### Actions (object permanence — always addressable from This Week)

| Action | When enabled |
|--------|----------------|
| Edit card | draft or live (pre-score); opens build/edit flow |
| Preview as player | when published |
| See who’s out / call out | when live + holdouts |
| Score this week | when `needs_score` |
| (Future) History / Archive | later |

### Data loaders (existing code map — implement later)

| Need | Existing |
|------|----------|
| Active week | `loadLeagueActiveWeek` / `resolvePlayerActiveWeek` |
| Card | `loadWeekCard` |
| Locks | `loadPickSubmissionStatus` |
| Scored? | `listScoredWeekNumbers` (dedupe later; not this prep) |
| Publish | `publishWeekCard` path in CommissionerClient |
| Score | results tab path / `saveResultsAndScoreWeek` |

**Contract rule:** UI reads a **single ThisWeekViewModel** — widgets do not each invent status.

---

# 3. “The Room” content inventory

**Question only:** How are my people doing?

### In (people / social pulse)

| Item | Example | Cadence |
|------|---------|---------|
| Lock social summary | 24/25 locked — *as people context, not a KPI wall* | Pre-kickoff |
| Holdout names (light) | Mike still out — deep detail stays This Week | Pre-kickoff |
| Join pulse | 3 new players joined | Early season / when true |
| Locker pulse | Locker is active / quiet | Soft |
| Gazette pulse | Paper dropped / waiting | Soft |
| Relational doors | Open Standings · Locker · Gazette | Always |
| Invites object | Code + share — “friends can still walk in” | Always owned |

### Out (not The Room)

| Item | Why | Where instead |
|------|-----|----------------|
| Cut % / theme / Crystal Ball toggle | Config | League Settings |
| Odds credits | Ops | Foundry |
| Bot fill tools | Ops | League Settings |
| Full lock roster table | This Week detail | This Week |
| Score entry UI | This week’s football | This Week / Hero |
| Checklist steps | Software | Coaching only / nowhere |

### Anti-pattern

The Room must **not** become:

- Win% tables  
- Long metric grids  
- “League health score 87/100”  

If it’s a number without a person or social story, it doesn’t belong.

---

# 4. League Settings inventory

**Tone:** Calm. Clear. Rare. Not a danger dungeon.

| Item | Frequency | Notes |
|------|-----------|--------|
| League name | Rare | |
| Invite code / regenerate | Occasional | Also linked from The Room |
| Season rules (cut %) | Rare | |
| Crystal Ball on/off | Rare | |
| Home tagline | Rare | |
| Season theme | Rare | |
| Fill seats / bots | Rare / preseason | Fairness lock awareness |
| Deputies | Rare | |
| Pass gavel (host role) | Rare | |
| Start next season | Yearly | Typed confirm |
| Danger zone (delete league) | Almost never | Clearly separated |
| Sport pool (if any) | Rare | |
| Lab / Foundry / demo tools | **Never for normal hosts** | Creator surfaces only |

**Anti-feature:** If they wouldn’t miss it on the homepage every Wednesday → it stays here or is deleted from primary forever.

---

# 5. Object permanence map

> A host should never have to remember where something is. The dashboard should always remind them.

| Object | One obvious home | Always available actions (concept) |
|--------|------------------|-------------------------------------|
| **This Week** (the week) | Host Dashboard → This Week | See status, enter edit, locks, score when due |
| **Week card** (slate) | Inside This Week | Edit, preview, publish path — never “task complete → gone” |
| **Locks / holdouts** | This Week (+ light pulse in The Room) | Call out missing |
| **Results / score** | Hero when blocked; scoring UI from This Week | Score when due |
| **Invites / code** | The Room (and Settings for regenerate) | Share, copy |
| **Players / roster identity** | The Room + PlayerLink profiles | View people |
| **Standings drama** | Link from The Room | Open Standings |
| **Locker talk** | Link from The Room | Open Locker |
| **Gazette paper** | Link from The Room | Open Gazette |
| **Season rules / theme** | League Settings | Edit |
| **Deputies / pass host** | League Settings | Manage |
| **Bots / seats** | League Settings | Manage |
| **Next season / delete** | League Settings | Confirm |
| **First-season coaching** | Soft overlay / empty states — not a permanent object | Dismiss / fade |

**Implementation test:** For every major host action, a new host can answer “where does that live?” in one sentence pointing at Hero, This Week, The Room, or League Settings.

---

## What is explicitly deferred

| Item | When |
|------|------|
| Four-tab nav redesign | After IA is built in product |
| Warm rotating status copy | After core states ship |
| Unpublish / archive card | Product decision; home remains This Week |
| PB-1/PB-2 performance work | Separate scrub |
| Production React rebuild of CommissionerClient | After this prep is approved |

---

## Go criteria for production code

Implementation may start only when Mike confirms:

1. Hero priority table is accepted  
2. This Week status enum is accepted  
3. The Room in/out inventory is accepted  
4. League Settings list is accepted  
5. Object permanence map has no missing “where did it go?” holes  

Then: build Host Dashboard shell against this prep — **do not** reintroduce checklist homepage or three-jobs framing.

---

## Related

- `docs/COMMISSIONER-CONTROL-ROOM-REDESIGN.md` (Rev 3 narrative)  
- `docs/WAR-ROOM-CONSTITUTION.md` (Host Dashboard corollary)  
- `docs/COMMISSIONER-REVIEW-3-FLOWS.md` (legacy engineering map)  
