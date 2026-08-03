# Guest Mode Experience Audit + Contract

**Status:** Audit + design only — **saved for later; no implementation yet**  
**Date:** 2026-08-03  
**Related:** Practice Mode (separate), Live League, login conversion  
**Trigger:** Friend guest hit Locker **Post** and experienced a silent / confusing failure

---

## Purpose of this document

Guest Mode is **not** Practice Mode and **not** a real league seat.

It has an **identity problem**:

| Party | Belief |
|-------|--------|
| Guest | “Am I a real player? Can I try everything?” |
| App | “No.” |
| UI | Often never says the rules clearly |

That mismatch reads as **broken**, not **preview**.

---

## Purpose of Guest Mode (product)

> **Convince someone in five minutes that War Room is worth joining.**

Not:

> Simulate every feature.

Not:

> Be an anonymous permanent free tier.

**Conversion emotion:**

> “I want to see what this is like with my friends.”

If guest leaves thinking “the app is broken,” Guest Mode failed.

---

## Guest contract (proposed — post on entry)

The moment someone enters guest / demo, War Room should make **one simple promise**:

> **You’re exploring War Room as a guest.**  
> You can look around, try the pick experience, and feel the room.  
> Social features like the Locker become available when you join a **real league**.

Sticky chrome should reinforce the same contract (not only “DEMO · Week 9”).

---

## Theme-park model

| Can (preview rides) | Cannot (real ownership) |
|---------------------|-------------------------|
| ✅ Walk around (Home, Board, Standings, Picks, Gazette views) | ❌ Own a permanent locker identity |
| ✅ Feel atmosphere (bots, mock drama, demo board) | ❌ Post real Locker messages |
| ✅ Try local picks / demo card flows | ❌ Earn permanent rewards / career |
| ✅ Tour host tools in demo role | ❌ Affect real players or real rooms |
| ✅ Switch demo Player / Commish seat | ❌ Cloud social / real memberships |

OK — **as long as it’s obvious.**

---

## Current implementation (traced)

### Entry

| Item | Detail |
|------|--------|
| Login CTA | “Guest demo (bots, no account)” — `login/page.tsx` |
| Entry API | `enterGuestDemo()` → seeds local world (`guest-demo-seed`), sets `warroom-guest-mode-v1` |
| Session | Synthetic `GUEST_PLAYER_ID` / `GUEST_LEAGUE_ID` — **not** a real Supabase auth user for social |
| Chrome | `GuestDemoChrome`: sticky **“DEMO · Simulated through Week 9”** + switch role + Exit → Account |
| Onboarding | `GuestOnboarding`: welcome → role → short tutorial |

### Welcome copy (identity risk)

Guest welcome currently includes:

> “Safe to click everything — reset anytime”

That **overpromises**. Guest expects full agency.  
Restrictions that fail without a guest-specific explanation feel like **bugs**.

---

## Capability matrix (audit)

### Generally allowed (local / demo)

| Capability | How | Explains guest? |
|------------|-----|-----------------|
| Browse Home | Demo seed + local session | Partial (DEMO bar) |
| My Picks local | `cloud.loadMyPicks` / saves branch to localStorage when guest | Weak — feels real |
| Standings / players load | `loadLeaguePlayers` → local store | Weak |
| Cards / scored weeks | Guest seed helpers | Weak |
| Commish demo tools | Role switch + local paths | Demo bar only |
| Guest tutorial | Role-specific steps | Yes for picks/host path |

### Blocked or no-op (often without guest framing)

| Capability | Behavior today | Explains *why*? | Conversion CTA? |
|------------|----------------|-----------------|-----------------|
| **Locker Post** | `postLockerMessage` → Supabase insert with guest session/auth mismatch | **No** — errors like muted / policy / not signed in / raw SQL | **No** |
| Locker reactions / cloud social | Same family | No | No |
| Real cloud memberships | Not real user | Silent | No |
| Permanent badges / career bank | Guest skipped from many ceremonies | Silent | No |
| Live Moments / onboarding host | `isGuestMode()` early return | Silent | No |
| Soft unlock / ring / finale / cold open | Skipped for guest | Silent | No |
| Touch last-seen | Skipped | N/A | N/A |
| Practice Mode chrome | Off for guest | N/A | N/A |

**Critical finding (friend’s screenshot class):**

`postLockerMessage` has special-case copy for **Foundry eyes** preview:

> “PREVIEW mode — Locker posts stay off the real room…”

It has **no equivalent guest branch**.  
Guest hits real Supabase path → RLS/auth failure → sounds like “you’re muted” or “not signed in” or schema error → **broken**, not **preview**.

---

## Contract violations today

| Promise implied | Reality | Impact |
|-----------------|---------|--------|
| “Safe to click everything” | Locker post fails | Trust hit |
| DEMO bar = simulated | UI still looks like a full league | Identity blur |
| Fake locker energy | Can open Locker and type | Dead end |
| Exit → Account | Exists | Good conversion path, under-taught |

---

## Desired restriction UX (design)

Never fail silently or with wrong story.

### Example — Locker Post

```text
🔒 Locker messages are part of a real league.

Join a league to start talking trash.

[ Join a League ]   [ Create My League ]
```

Optional tertiary: “Keep exploring demo”

### Pattern for every blocked action

1. **What** is blocked (human language)  
2. **Why** (guest / real league)  
3. **Next step** toward conversion  
4. Never “muted,” “RLS,” “not set up,” “Not signed in” unless literally true for a real account

---

## Guest Mode vs Practice Mode vs Live (three realities)

| Reality | Who | Goal |
|---------|-----|------|
| **Guest** | No account / demo tour | Convert to join |
| **Practice Mode** | Real user, bored / onboarding practice | Learn picks safely |
| **Live League** | Real membership | Season + Moments |

Rules:

- Guest is not Practice.  
- Guest is not Live.  
- Never invent that guest social is real.  
- Never invent that guest standings are *their* friends.

---

## Audit questions (scorecard)

| Question | Current score | Notes |
|----------|---------------|-------|
| What can a guest do? | Partial | Demo seed broad; not documented as contract |
| What can’t they do? | Unclear | Scattered `isGuestMode()` skips + cloud fails |
| Does every restriction explain *why*? | **Fail** | Locker is the smoking gun |
| Does every restriction lead to join/create? | **Fail** | Mostly dead ends |
| 5-minute conversion goal clear? | Partial | Welcome is tour-oriented, not join-oriented |
| Identity clear on every social surface? | **Fail** | DEMO bar only |

---

## Recommended design work (later — not this pass)

| Priority | Work |
|----------|------|
| P0 | Guest contract copy on entry + sticky bar |
| P0 | `postLockerMessage` (+ any social write) guest branch with join CTAs |
| P1 | Capability map in chrome (“Exploring · social unlocks when you join”) |
| P1 | Soften “click everything” → accurate promise |
| P2 | Guest Locker read-only with sample trash + “Join to reply” |
| P2 | Conversion moments after first demo lock / after touring Board |
| P3 | Foundry: Guest Mode lab (preview contract, blocked actions list) |

**Do not implement until Mike approves.**  
Saved for return.

---

## Relationship to War Room Moments

Guest Mode is **outside** Moments.  
Moments are Live League traditions.  
Guest’s job is to make someone want a real seat so Moments matter.

---

## Files relevant to future implementers

| Area | Path |
|------|------|
| Guest state / entry | `src/lib/guest-mode.ts`, `guest-demo-seed.ts` |
| Chrome / onboarding | `GuestDemoChrome.tsx`, `GuestOnboarding.tsx` |
| Login CTA | `src/app/login/page.tsx` |
| Locker write (broken guest path) | `src/lib/locker-room.ts` → `postLockerMessage` |
| Locker UI | `src/app/locker-room/page.tsx` |
| Cloud guest branches | `src/lib/cloud.ts` (`isGuestMode` local play) |

---

## North-star test

After five minutes as guest, the person should think:

> “I want this with my friends.”

Not:

> “Is the app broken?”
