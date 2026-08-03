# Guest Mode Experience Audit + Contract

**Status:** Audit + design only — **saved for later; no implementation yet**  
**Date:** 2026-08-03  
**Related:** Practice Mode (separate), Live League, login conversion, Constitution  
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

## Mission of Guest Mode (permanent product principle)

> **Convince someone in five minutes that War Room is worth joining.**

This is not a tagline for one screen.  
It is the **mission** of the entire guest experience.

Not:

> Simulate every feature.

Not:

> Be an anonymous permanent free tier.

**Conversion emotion:**

> “I want to see what this is like with my friends.”

If guest leaves thinking “the app is broken,” Guest Mode failed.  
If guest leaves thinking “I want this with my people,” Guest Mode succeeded.

---

## Guiding philosophy

> **Guests observe. Members belong.**

Apply everywhere:

| Surface | Guest | Member |
|---------|-------|--------|
| **Locker** | Can read / feel the vibe | Talk trash |
| **Board** | See how it works | Become part of the story |
| **Standings** | See examples | Earn their place |
| **Titles / trophies** | Browse | Earn |
| **Crews / rivalries** | Glimpse | Live them |

Every restriction should feel **intentional membership**, not a broken feature.

---

## Guest contract (aspirational — backstage pass)

Don’t only say what they *are*.  
Create aspiration: what they’re *getting a taste of*, and what **unlocks with real people**.

### Entry welcome (proposed)

```text
👋 Welcome to War Room

You're checking out War Room as a guest.

Look around.
Make some practice picks.
See what football season feels like here.

The social side—Locker, rivalries, crews, titles, and everything
that makes your league yours—unlocks when you join or create
a real league.

[ Join a League ]    [ Create My League ]
```

**Copy law:**

- Don’t lead with what they **can’t** do.  
- Tell them what they’re **missing** — and how to unlock it.  
- Frame as invitation into tradition, not account wall.

Sticky chrome should reinforce: **Guest · exploring** (not only “DEMO · Week 9”).

---

## Blocked-action triad (required)

Every blocked guest action answers **three questions**:

1. **Why can’t I do this?**  
2. **What am I missing?**  
3. **How do I unlock it?**

### Example — Locker Post (no error language)

```text
🔒 The Locker comes alive with real league members.

You're exploring as a guest, so posting is disabled.

Join a league and start the trash talk.

[ Join a League → ]
```

**Never:**

- Red “permission denied”  
- Supabase / RLS / muted (unless truly muted as a real member)  
- “Not signed in” as the only story  
- Raw schema / SQL messages  

A block is **another invitation into the experience**, not an error.

---

## Quiet conversion close (not fireworks)

After they’ve explored a while (time and/or key surfaces visited), offer a **quiet** screen — no confetti, no Moments fireworks:

```text
You've seen the app.

The best part isn't the app.
It's your people.

Ready to start your own War Room?

[ Create My League ]
[ Join a League ]
```

Matches constitution:

> **Football is the excuse. Relationships are the product.**

You’re not asking them to “create an account.”  
You’re inviting them to **start a tradition with their friends**.

---

## Theme-park model

| Can (preview rides) | Belonging (members) |
|---------------------|---------------------|
| ✅ Walk around (Home, Board, Standings, Picks, Gazette views) | Own a locker identity |
| ✅ Feel atmosphere (bots, mock drama, demo board) | Post real Locker messages |
| ✅ Try local picks / demo card flows | Earn permanent rewards / career |
| ✅ Tour host tools in demo role | Affect real friends / real rooms |
| ✅ Switch demo Player / Commish seat | Cloud social / real memberships |

OK — **as long as the contract is obvious and every block is an invitation.**

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

See **Blocked-action triad** above. Summary:

1. Why can’t I?  
2. What am I missing?  
3. How do I unlock?  

Optional tertiary: “Keep exploring” — never only a dead end.

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
| P0 | Aspirational guest contract on entry (backstage pass + Join/Create) |
| P0 | Sticky: Guest · exploring (not only DEMO week) |
| P0 | `postLockerMessage` (+ social writes) guest triad UI — invitation, not error |
| P1 | Apply triad pattern to every guest write path |
| P1 | Kill “Safe to click everything” overpromise |
| P2 | Guest Locker: observe (read) · members belong (post) |
| P2 | Quiet conversion close after explore (relationships framing) |
| P3 | Foundry: Guest Mode lab (contract, blocked list, conversion funnel) |

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

War Room’s differentiator vs typical apps:

- Not broken demo.  
- Not forced signup wall first.  
- **“Come in. Look around. See what makes this place special.”**  
- Convert because they *want* to join a tradition — not because they hit a paywall or an error.

---

## Design amendment log

| Date | Note |
|------|------|
| 2026-08-03 | Initial audit (identity problem, Locker path) |
| 2026-08-03 | Mission elevated; *Guests observe. Members belong.*; aspirational contract; blocked-action triad; quiet conversion close |
