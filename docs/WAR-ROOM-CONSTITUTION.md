# The War Room Constitution

*Stubborn. Not optional. Not marketing.*

---

## The War Room Promise

Every player should leave their **first session** believing:

1. **I know what to do.**  
2. **I can’t accidentally ruin anything.**  
3. **My friends are going to love this.**  
4. **I want Week 1 to start today.**  
5. **This feels like it was built by someone who actually plays this game with friends.**  

If a feature makes **any** of those weaker — **it doesn’t ship.**

Line 5 is the unfair advantage: building for real people — dads, wives, group chats — not engagement metrics.

---

## The Founder Rule

> **If I wouldn’t be excited to invite my own family league to use this, it isn’t ready.**

Brutal. Honest.

That is exactly how War Room has been built from day one — not for an abstract “user,” for the people you’d actually put in the group chat.

If it fails the Founder Rule, **it doesn’t ship** — even if it passes technical QA.

---

## Values

1. **Confidence over complexity.**  
   People should feel smart. Never overwhelmed.

2. **Community over competition.**  
   Competition creates stories. Community keeps people coming back.

3. **Delight in the details.**  
   The Gazette. Crews. Cheevos. The little things matter.

4. **Never punish curiosity.**  
   Let people explore. Celebrate it. Reward it.

5. **Football is the excuse. Relationships are the product.**  
   The NFL schedule is not the competitive advantage. **The memories are.**

### Investment principle

> **Every screen should leave the player feeling slightly more invested than when they arrived.**

Not more *informed*.

**More invested.**

That is the magic. Information without investment is documentation. Investment is why people open the league again next August.

### Guest Mode principle

> **Convince someone in five minutes that War Room is worth joining.**

That is the **mission** of Guest Mode — not “simulate every feature.”

> **Guests observe. Members belong.**

Restrictions are intentional membership, not broken software.  
Every blocked guest action answers: *Why? What am I missing? How do I unlock it?*  
Never permission-denied language. Always an invitation into a real league.

Don’t only list what guests can’t do. Tell them what they’re **missing** — Locker, rivalries, crews, titles, everything that makes a league *theirs* — and how to unlock it by joining or creating.

Quiet conversion close (no fireworks): *You’ve seen the app. The best part is your people.*

See `docs/GUEST-MODE-EXPERIENCE-AUDIT.md`.

---

## Immersion principle

> **They need to feel like they are IN the experience. Not viewing it from above.**

Bigger than onboarding. How **every** future feature should feel.

- The **Gazette** shouldn’t feel like reading a report — it should feel like opening this week’s paper.
- The **Locker Room** shouldn’t feel like a chat page — it should feel like walking into the room where everyone is talking.
- The **Board** shouldn’t feel like a leaderboard — it should feel like the wall where everyone checks who’s on top.

Design from **inside the world**, not from outside explaining the world.

### History principle

> **War Room never invents history.**

If something hasn’t happened, say so with confidence and personality.  
Trust is more important than filling space.

The Board’s promise: *it reveals what happened this season.*  
Zero scored weeks → empty state, not placeholder weeks, not demo cards, not practice artifacts.  
The first scored week is when The Board comes alive.

### Achievement principle

> **War Room never awards what hasn't been earned.**

Never invent champions, losers, rankings, or statistics.

If nobody has won — nobody wears the crown.  
If nobody has lost — there is no Wall of Shame.  
If nobody has points — everybody is undefeated, and the UI says so without faking a leaderboard.

Gate: official scored weeks (`listScoredWeekNumbers`), not leftover membership fields.  
If War Room says something happened, the player must be able to trust that it actually happened.

### Anticipation principle

> **War Room celebrates anticipation as much as history.**

Before kickoff there is excitement, trash talk, predictions, and nerves.  
The app should not rush through that phase. It should enjoy it.

Empty is not a hole to fill. Empty is the truthful experience of *not yet*.  
Curiosity can be rewarded (a second take, a third joke) without inventing a season that hasn’t started.

### Season, not software

> **War Room should feel like football season — not a football app.**

Apps are about information. Season is about anticipation, inside jokes, waiting for Thursday, checking the wall, wondering who forgot picks, celebrating, and giving your buddy grief.

Every destination (League, The Room, Practice Mode, The Board) should answer:  
*Does this feel like something that happens in a real season with real people?*  
If it only feels like software, cut or redesign.

### Reality principle

> **War Room should never make the user question whether their actions are real.**

Confidence builds trust. Ambiguity destroys it.

> **There is only one reality visible to customers.**

Either:

- 🏈 **Live League**
- 🎮 **Practice Mode**

Never both. Never ambiguous. Never leaking developer concepts.

### Foundry backstage principle

> **Customers should never know Foundry exists.**

Foundry is backstage. War Room is the show.

If a customer ever sees Sandbox, Dry Run, Hop, Lab, Shop, Through Their Eyes, or internal state names — the curtain has been pulled back.

Disney doesn’t let guests see maintenance tunnels. War Room doesn’t let players see Foundry.

Keep Foundry ridiculously powerful for the creator. Make every lab tool **impossible for customers to discover** — not hidden, not collapsed, not “advanced.” **Gone** from the customer product.

### Host Dashboard corollary

> **The Commissioner page should feel like opening the door to your league—not opening league software.**

Permission is “commissioner.” Identity is **host**. This is the headquarters of someone’s football season — not a settings desk.

- ESPN Commissioner feels like: “I need to do admin.”  
- War Room should feel like: “Let’s see what my idiots are up to.”  

### Navigation naming

> **People return because of the league. The navigation should reflect the world they're entering, not the permissions they have.**

Bottom nav destination: **League** (not Commish / Host / Admin).  
Labels answer *“Where am I going?”* — not *“What role am I?”*  
Permissions stay exactly as they are; only the language of the destination changes.

### Onboarding corollary

The coach should **illuminate** War Room — never interrupt it or replace it with a course.

- Home is the front door. Foundry stays invisible.
- Teach by pointing. The player drives. Never only watches.
- Every requested action produces: recognition → confirmation → explanation → next.
- One emotional peak. One memorable finish. Never duplicate the ending.
- Slim guide. App is always center stage. If the tutorial becomes what they’re looking at — we failed.

---

## Feature filter

Not: *Can we build it?*  

First: **Does it make War Room feel more like War Room?**  

If no — **it waits.**

---

## What is (and isn’t) War Room

SQL, freezes, hydration, traces — **necessary**. Not the product.

**War Room** is the feeling when someone texts eight friends:

> **“I’m opening the league again this year.”**

Everything else is in service of that moment.

---

## The compliment that matters

Not: cool features.  

> **“You have to try our league. It’s become the best part of football season.”**

Five years on, if thousands of group chats say that every August — people won’t be talking about implementation.

They’ll be talking about **their league**.

That’s the highest compliment this product can earn.

---

## War Room Moments

*Sacred product architecture. Not a Foundry rename. Not optional.*

> **Moments become traditions. Traditions keep leagues together.**

Football is the excuse. Relationships are the product.  
War Room Moments are how those relationships become annual traditions.

War Room should not be remembered because of features.  
It should be remembered because of **moments**.

### Purpose

A **Moment** is a player-facing emotional beat that players might remember a month later.

Foundry is the studio.  
The Live League is the stage.  
Customers never see lab language.

### Categories (permanent)

| Category | Role |
|----------|------|
| 🏈 **Season Begins** | Once — establish the new season (sport identity first) |
| 📅 **Weekly Rituals** | Heartbeat — card, paper, board, weekly earned delight |
| 🏆 **Milestones** | Earned — ring, cheevos, trophies, Hall of Fame |
| 👑 **Season Finale** | Close — champion, wrap, trophy presentation |

### Emotional Budget

> **Every celebration spends emotional currency. Spend carefully.**

| Level | Meaning | Examples |
| ----- | ------- | -------- |
| ⭐⭐⭐⭐⭐ | Once-a-season goosebumps | Sport Opening, Championship |
| ⭐⭐⭐⭐ | Major milestone | Ring Ceremony, First Week Scored peak |
| ⭐⭐⭐ | Weekly excitement | Gazette, Card Goes Live |
| ⭐⭐ | Small delight | Board Unlock, First Cheevo |
| ⭐ | Tiny feedback | Checkmarks, lock confirmation |

Full ceremony / fireworks only when weight allows.  
If everything has fireworks, nothing has fireworks.

### Rarity Law

Default max **four** season-scale goosebumps peaks:

1. Season Opening  
2. First Week Scored (if used as a peak)  
3. League Champion Crowned  
4. New Season Begins Again  

A fifth peak requires demoting another.

### Moment Gate

Before cataloging anything as a Moment:

> **Will players remember this a month later?**

If not, it is feedback — not a Moment.

### Sport Identity

Season Begins Moments are **per sport**.  
CFB feels like Saturdays and GameDay.  
NFL feels like prime time and Opening Weekend.  
No generic celebration with swapped week numbers.  
The sport should be recognizable before a single word is read.

### Replay Policy

One-shot Moments (open, finale) are once per user · league · sport · season (cloud claim).  
Weekly rituals may repeat by week.  
Foundry may preview without spending customer rarity.

### Foundry Preview

Creator-only.  
War Room Moments is the permanent home for major player-facing beats.  
Not “previews” as toys — emotional beats verified before production.

### Performance Budget

Moments must not revive DeferredChrome freezes:  
no multi-wave modal catalogs, no DOM scanning, no fetch storms, no body-lock orphans.  
Emotional peaks still obey technical cheapness.

### Design package (reference)

| Doc | Role |
|-----|------|
| `docs/WAR-ROOM-MOMENTS-ARCHITECTURE.md` | Architecture decision |
| `docs/MOMENT-OBJECT-SCHEMA.md` | What a Moment is |
| `docs/SEASON-MOMENT-TIMELINE.md` | Full-season emotional arc |
| `docs/EMOTIONAL-BUDGET.md` | Weight / spend rules |
| `docs/OFFICIAL-SEASON-OPENING-SEQUENCE.md` | First Season Begins Moment design |

---

*Onboarding blueprint (player first session): `docs/NEW-PLAYER-ONBOARDING-REDESIGN.md`*
