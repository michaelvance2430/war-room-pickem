# War Room Foundry — Product Definition

**Status:** Engineering contract (philosophy, not a feature list)  
**Audience:** Creators, agents, and anyone shipping War Room  
**Related:** `docs/FOUNDRY-HUB-NOTES.md` (implementation notes), `docs/DESIGN-PRINCIPLES.md`, `docs/WAR-ROOM-CONSTITUTION.md`, `docs/PRODUCT-ARCHITECTURE-FREEZE.md`

---

## Purpose

Foundry is **not** part of the War Room player experience.

Foundry is the internal workshop where War Room is **built, tested, validated, and trusted** before anything reaches a real league.

| Who | Relationship to Foundry |
|-----|-------------------------|
| **Players** | Never think about it |
| **Commissioners** | Rarely think about it |
| **Creators** | Live in it |

---

## Philosophy

Foundry exists so the production product can remain **beautifully simple**.

Every debugging tool…  
Every reset…  
Every simulator…  
Every experimental button…  
Every creator shortcut…

**Belongs in Foundry.**  
Not in the live product.

---

## Mission

Foundry has one responsibility:

> **Prove that production will work before production uses it.**

If Foundry cannot reliably execute a workflow, question whether production can.

Foundry is not a demo.  
It is the **validation environment**.

---

## Rule #1 — Never confuse audiences

Never add creator convenience to the player experience.

| Need | Place |
|------|--------|
| Mike needs a button | **Foundry** |
| Commissioner needs a button | **War Room** (host tools only) |
| Player needs a button | **War Room** (play surface only) |

Never confuse the two.

---

## Rule #2 — Foundry must execute real code

Simulation must never use fake logic that only exists for the lab.

### Wrong

```text
simulateWeek()
  → fabricates standings
```

### Correct

```text
simulateWeek()
  → real scoring engine
  → real standings
  → real achievements
  → real Gazette
  → real Moments
```

The simulation should drive the **exact production pipeline** whenever possible.

**Testing fake code proves nothing.**

---

## Rule #3 — Foundry exposes state; production hides it

### Foundry (examples)

- Reset tutorial  
- Reset achievements / coaching  
- Trigger Moment  
- Simulate week  
- Simulate championship / CFP final  
- Skip to Week 8  
- Test Gazette  
- Force close league  
- Test Trophy Ceremony  
- API failure / zero winners / ties  

### Production

**None of those exist.**

Production presents only the **current reality**.

---

## Rule #4 — Foundry may be ugly; War Room may not

| Surface | Standard |
|---------|----------|
| **Foundry** | Tool — dense controls OK |
| **War Room** | Product — clarity and calm |

Never compromise production simplicity because Foundry needs more controls.

---

## Rule #5 — Every major feature needs a Foundry test

If a feature cannot be exercised inside Foundry, **it is incomplete**.

| Feature | Foundry should be able to… |
|---------|----------------------------|
| **Build Card** | Reset, simulate, validate publish path |
| **Trophy Ceremony** | Simulate CFP final, ties, zero winners, API failure |
| **Moments** | Trigger every Moment, replay, reset claims |
| **Gazette** | Generate / regenerate stories, simulate schedule |
| **Scoring / standings** | Post + score through the real pipeline; prove points land |
| **Week archive** | Skip ahead, score mid-season, confirm history still navigable |

---

## Rule #6 — Foundry validates assumptions

Whenever Mike asks:

> “What happens if…?”

The answer should be:

> **“Let’s test it.”**

Not:

> “I think…”

---

## Success criteria

A perfect Foundry means:

Every important production workflow can be executed **safely**…  
…without harming real leagues (use isolated test rooms when engraving / closing seasons).

If Foundry says **PASS**, Mike should have confidence production will **PASS**.

---

## Product vision (two curves)

```text
War Room  ────────────────────────────→ simpler over time
Foundry   ────────────────────────────→ more powerful over time
```

Those curves move in **opposite** directions.

As Foundry grows, War Room should shrink.  
Every creator tool moved into Foundry is one less distraction for players and commissioners.

---

## Design principle

> **Foundry exists so War Room can stay magical.**

Players should see the **experience**.  
Creators should see the **machinery**.

Never let the machinery leak into the experience.

---

## Engineering contract (for every ship)

After every major feature, ask:

> **How do we prove it works in Foundry before we trust it in War Room?**

| Step | Requirement |
|------|-------------|
| 1 | Implement production path |
| 2 | Wire Foundry entry (trigger / simulate / reset) |
| 3 | Drive **real** production code (no lookalike gallery) |
| 4 | Isolate test leagues when state is permanent |
| 5 | Document how to re-run the proof |
| 6 | Ship only when Foundry PASS is believable |

This contract scales with multi-sport (NFL, basketball, soccer, and beyond): each sport pack inherits the same Foundry → production proof loop.

---

## What Foundry is not

- Not a second product  
- Not a player onboarding surface  
- Not permission to invent standings, trophies, or history outside the real engines  
- Not a dump of unfinished UI that “might ship later” into `/commissioner` or Home  

---

## Code map (implementation anchors)

| Concern | Typical home |
|---------|----------------|
| Foundry hub UI | `src/app/founder/page.tsx` |
| Creator gate | `src/lib/creator.ts`, `src/lib/foundry-preview.ts` |
| Sticky return chrome | `src/components/FoundrySessionChrome.tsx` |
| One-click week sim | `src/lib/founder-one-click.ts` |
| Auto-finish season | `src/lib/sandbox-auto-finish.ts` |
| Eyes / first-hour | `src/lib/creator-eyes.ts` |
| Moments preview | `src/lib/moments/*`, Foundry hub buttons |
| Trophy ceremony sim | `src/lib/cfb-championship-result.ts`, `src/lib/creator-sandbox.ts` |

Implementation notes and backlog live in `docs/FOUNDRY-HUB-NOTES.md`.  
**This document is the philosophy and contract.** Hub notes are the checklist.

---

*Foundry used to be a place to mess around. It is now the engineering contract for the entire product.*
