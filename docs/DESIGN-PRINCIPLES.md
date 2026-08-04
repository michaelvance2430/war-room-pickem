# War Room design principles

**Source of truth for product depth vs simplicity.** Prefer this when “wouldn’t it be cool if…” competes with clarity.

**Foundry (creator workshop / engineering contract):** [`docs/WAR-ROOM-FOUNDRY.md`](./WAR-ROOM-FOUNDRY.md)  
Foundry gets more powerful so War Room can get simpler. Creator tools never leak into the player experience.

---

## The sentence

> **Simple to play. Rich to discover.**  
> **The surface should be simple. The depth should be endless.**

Not: don’t make it fun.  
**Don’t make it exhausting.** Fun ≠ clutter.

---

## Three layers

### Layer 1 — The Game (everyone)

What **100%** of users experience — and it must be a **10/10 alone**:

1. Join league  
2. Make picks  
3. Confidence  
4. Best Bet  
5. Gazette  
6. Standings  

If someone only ever does these six things, War Room still works.

### Layer 2 — Discovery

After a few weeks people notice:

- “I have achievements.”  
- “I have titles.”  
- “There’s a Trophy Room.”  

Nobody was forced to learn it. They **found** it.

### Layer 3 — Deep fans

Months or years later:

- “Did you know there’s a Museum?”  
- “There’s a World Cup passport?”  
- “There’s a Hall of Fame?”  

Not hidden. **Not required.** Like CoD, Nintendo, Pokémon, WoW.

---

## One question per screen

| Screen | Answers |
|--------|---------|
| **Home** | What should I do? |
| **Picks** | What do I need to submit? |
| **Board / Standings** | Who’s winning? |
| **Gazette** | What happened this week? |
| **Trophy Room** | What have I accomplished? |
| **Profile** | Who am I? |

Nothing should try to answer five questions at once.

### Gazette discipline

**Issue #6 can be:** Front page · standings · wall of shame · movers · one funny quote.

**Issue #6 must not dump:** weather + 8 classifieds + horoscope + word search + 12 side stories + comics + recipes.

Early weeks stay **slim** (see first-week flavor). Leave them wanting the next issue.

---

## Achievements / passport (example)

- **Build** hundreds of stamps over years. That’s the depth.  
- **Day 1 surface:** Recently earned + **one** next goal with progress.  
- **Not day 1:** 80–400 locked tiles in the user’s face.

Same pattern for Museum, Hall of Fame, AI docs: awesome → discoverable → never required for the weekly job.

---

## Two questions for every new feature

1. **Is it awesome?** If no → don’t build it.  
2. **Is it required to understand the app?**  
   - **Yes** → make it *incredibly* simple.  
   - **No** → hide it until players naturally discover it (Phase 2/3, profile depth, empty-state hints).

“Wouldn’t it be cool if…” needs a partner: **“Will 95% of players ever need this on day one?”**

---

## Longevity model

| Season of life | Relationship to the app |
|----------------|-------------------------|
| Year 1 | Just likes making picks |
| Later | Chases achievements / titles |
| Deep | World Cup Legend, passport, museum |
| Family | Multi-gen seasons, shared history |

We don’t only add features forever — people **discover** layers that were always there.

---

## Fun vs clutter (Disney / Mario Kart)

- **Disney** is maximum fun — but the entrance isn’t 87 rides at once.  
- **Mario Kart** is raceable at 5 and deep for competitive grind.  
- War Room: **same game, different layers.**

---

## Non-contradiction

| We are | We are not |
|--------|------------|
| 100% team fun | Anti-depth |
| 100% against clutter | Anti-achievement |
| Team “build the passport” | Team “show 80 locked stamps on signup” |

If you hear “don’t add that” it often means: **don’t require it on day 1** — not “never build it.”

---

## Sport packs + holiday backgrounds (always)

Every sport has:

1. **Its own default skin** (not college green for everyone)  
2. **Commissioner holiday / season backgrounds** shared across packs  

Holidays are Layer-2 fun (discoverable, optional) that still paint the whole room when the host turns them on. New seasons (Easter, July 4, etc.) get added to the shared catalog over time — never “NFL-only Christmas.”

See `src/lib/season-theme.ts` and `docs/MULTI_SPORT.md`.

---

*Locked as product law. Prefer this document when feature ambition and onboarding clarity fight.*
