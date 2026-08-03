# The War Room Constitution

*Stubborn. Not optional. Not marketing.*

> **Architecture freeze (2026-08-03):** Philosophy phase complete.  
> Source of truth and working agreement: `docs/PRODUCT-ARCHITECTURE-FREEZE.md`  
> Execute the vision. Do not quietly redefine it.

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
   Not “don’t confuse people” alone — **don’t insult their intelligence.**

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

> **War Room never invents or implies a history the player has not actually earned.**

If something hasn’t happened, say so with confidence and personality.  
Trust is more important than filling space.

The Board’s promise: *it reveals what happened this season.*  
Zero scored weeks → empty state, not placeholder weeks, not demo cards, not practice artifacts.  
The first scored week is when The Board comes alive.

**Every empty state should feel exciting, not unfinished.**  
Not “0 points.” Prefer “Your first great Saturday is still ahead.”  
Same honesty on Profile “Plot so far,” Standings, Stats, and every story surface.

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

Every destination (League, The Room, The Board — and Practice when it is a temporary state) should answer:  
*Does this feel like something that happens in a real season with real people?*  
If it only feels like software, cut or redesign.

### Reality principle

> **War Room should never make the user question whether their actions are real.**

Confidence builds trust. Ambiguity destroys it.

> **There is only one reality visible to customers.**

Either:

- 🏈 **Live League**
- 🎮 **Practice** (a *state* — not a product that constantly announces itself)

Never both. Never ambiguous. Never leaking developer concepts.

Trust promise while practicing: *Nothing here affects your real league.*  
One calm indicator. One obvious way back. No six reminders of the same fact.

### Teach-once principle

> **Teach once. Then trust the player.**

Applies everywhere: onboarding, Practice, Guest, League, future tutorials.

- Teach the mechanic. Hold the hand when it is first needed.
- After that, get out of the way.
- Do not re-explain a choice the player already made.
- Helpful copy that repeats itself becomes noise — and noise destroys confidence.

The best onboarding systems are almost invisible.  
They give just enough confidence for the next step, then quietly disappear.

**Practice’s job is to disappear.**  
If players stop thinking about Practice and only remember *“War Room was easy to learn,”* it was built correctly.

### Season calendar principle

> **War Room should change with the football calendar.**  
> Not only its content. Its experience.  
> Players should feel the season changing.

### Authentic spectacle (Moments)

> **Optimize for authentic spectacle — not software celebration.**

**Tier I Traditions** (Season Opening, Championship, etc.) **spend** the Emotional Budget.  
They may feel like television Opening Day: stadium lights, haze, crowd energy, a sound cue, a held silence.

They must **not** feel like: random confetti, particle spam, or the app congratulating itself.

The test: *Does this feel worthy of Opening Day?*  
If removing an effect makes it more authentic, remove it.  
If the room still feels cheap for a once-a-season peak, add **football** atmosphere — not sparkles.

Moments are **television production** for the season — not rewards for the user.  
You celebrate **the season**. Not the login.

### Tradition protection law

> **Tier I Traditions may only change by unanimous approval.**

Who must agree before any change ships:

1. The founder (Mike)  
2. Implementation partner (Grok / engineering)  
3. Product counsel when involved (ChatGPT / design steward)

If anyone says no — **do not touch it.**

Why: once players see a Tradition, it becomes sacred.  
You do not redesign ESPN’s Monday Night open, College GameDay’s open, or the Masters theme every week.  
Familiarity is the product.

**Freeze means freeze.** Preview until everyone smiles — then stop polishing. Let it age.  
Year one: “That was cool.”  
Year five: “It’s football season.”

### War Room calendar (experience, not features)

War Room has **seasons of its own**:

```
Offseason → “I’m Bored”
    ↓
Season Opening (“The room is open.”)
    ↓
Week rhythm (card · locks · board · paper)
    ↓
Rivalry / peak weeks
    ↓
Championship
    ↓
Offseason → “I’m Bored” returns
```

That is a calendar of feeling — not a feature list.

### Sacred copy (do not casually rewrite)

These lines are brand. Changing them requires Tradition protection law:

- **Practice is over. The season is here.**  
- **The room is open.** / **The room is live.** (sport variants)

### Offseason Practice principle

> **Practice exists until football exists.**  
> **Practice belongs to the offseason.**  
> **When real football begins, War Room stops pretending.**

- **Preseason:** “I’m Bored” is visible — fun, low stakes, confidence only.  
- **Official kickoff:** gone. Not buried in a menu. Not “advanced.” **Gone.**  
- **In season:** the season *is* the tutorial. Week 1 teaches confidence, locks, the Board.  
- **Next August:** “I’m Bored” returns — an offseason ritual, not a permanent mode.

Any need to practice *after* kickoff is Foundry / creator tooling — never normal player chrome.

Season Opening may end with one quiet line, then silence:

> Practice is over. The season is here.

No explanation. No settings dump. The button simply isn’t there anymore.

Guest tour remains a separate reality (conversion before membership).  
League members live this calendar: offseason practice → live football.

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

### Consistent chrome

> **Consistency builds confidence. Players should never wonder if they're in a different version of War Room.**

The app shell (nav, header hierarchy, spacing, frame) stays familiar across CFB, NFL, Guest, Practice, player, and host.

- ✅ Different **leagues** may have different personalities (names, taglines).  
- ✅ Different **roles** may change page *content* (host job vs player job).  
- ❌ Different **sports** must not feel like different applications.

Switching sports should feel like changing channels — not opening a new product.  
See `docs/CONSISTENT-CHROME-AUDIT.md`.

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
