# Phase 2 — The Season Moment Timeline

**Status:** Design-only reference · **no code**  
**Date:** 2026-08-03  
**Package:** War Room Moments  
**Parent:** `WAR-ROOM-MOMENTS-ARCHITECTURE.md` · `MOMENT-OBJECT-SCHEMA.md` · `EMOTIONAL-BUDGET.md`

---

## Purpose

One visual map of an **entire season** of player-facing Moments.

Use this to spot:

- **Missing** traditions (gaps players feel)  
- **Overdone** fireworks (too many peaks)  
- Wrong **order** (crown before first score, etc.)  
- Sport-specific openings that must stay distinct  

This is not a feature backlog. It is the **emotional arc** of War Room season.

---

## Canonical season arc (generic)

```text
PRESEASON
│  Anticipation · Practice Mode · invite · build room
│  (no invented history / achievement)
│
├── 🏈 SEASON BEGINS  ·····················  ⭐⭐⭐⭐⭐
│     CFB Opening  ·or·  NFL Kickoff  ·or·  future sport
│     once · per user · league · sport · season
│
├── 📣 First Card Goes Live  ··············  ⭐⭐⭐
│     Weekly Ritual (first instance of the season)
│
├── 📰 First Gazette  ·····················  ⭐⭐⭐
│     Weekly Ritual — paper drops after first score
│
├── 🚪 First Board Unlock / Board Comes Alive · ⭐⭐
│     Trust: only after real scored week (never invent)
│
├── 💍 Ring Ceremony (if defending champ) · ⭐⭐⭐⭐
│     Milestone / lore — opening-week family, not every week
│
├── 📅 WEEKLY RITUALS (repeat)  ···········  ⭐⭐ – ⭐⭐⭐
│     │
│     ├── Card Goes Live
│     ├── Gazette Reveal
│     ├── Board Unlock (per week as appropriate)
│     ├── Weekly Cheevos (earned)
│     └── Locker / room energy (usually not Moments catalog)
│
├── 🏆 MILESTONES (earned, scattered)  ····  ⭐ – ⭐⭐⭐⭐
│     First Cheevo · stacks · trophies · Hall of Fame
│
├── 👑 SEASON FINALE  ·····················  ⭐⭐⭐⭐⭐
│     Crown the Champion · Championship Ceremony
│     Toilet / wrap · Trophy Presentation
│
└── OFFSEASON
      Rest · next season’s Season Begins (new season_key)
```

---

## CFB flavor (Saturday / campus)

```text
Preseason
│
├── 🏈 College Football Opening  ⭐⭐⭐⭐⭐
│     Identity: GameDay, campuses, rivalries — NOT generic fireworks
│     Trigger: Week 0 card published
│
├── 📣 Week 0 Card Live  ⭐⭐⭐
├── (optional practice dies at Week 0 kickoff)
│
├── 🏆 First Week Scored peak?  ⭐⭐⭐⭐  (optional; protect rarity)
│     If used: only first official score of season
│
├── 📰 First Gazette  ⭐⭐⭐
├── 🚪 Board comes alive  ⭐⭐
├── 💍 Ring Ceremony (defending champ)  ⭐⭐⭐⭐
│
├── Weekly rhythm (Week 1–13, Conf, CFP…)
│     Card · Paper · Board · Cheevos
│
├── Cut week drama (standings matter) — usually ⭐⭐⭐ narrative, not full ceremony
│
└── 👑 Championship / Toilet / Season Wrap  ⭐⭐⭐⭐⭐
```

---

## NFL flavor (prime time / Opening Weekend)

```text
Preseason
│
├── 🏈 NFL Kickoff  ⭐⭐⭐⭐⭐
│     Identity: stadium lights, prime time, Opening Weekend
│     Trigger: Week 1 card published
│
├── 📣 Week 1 Card Live  ⭐⭐⭐
├── 📰 First Gazette  ⭐⭐⭐
├── 🚪 Board comes alive  ⭐⭐
├── 💍 Ring Ceremony (if applicable)  ⭐⭐⭐⭐
│
├── Weekly rhythm (regular season → playoffs)
│
└── 👑 Super Bowl / Toilet / Season Wrap  ⭐⭐⭐⭐⭐
```

---

## Gap / overfill audit (use every season design review)

Ask:

| Question | If yes |
|----------|--------|
| Two ⭐⭐⭐⭐⭐ within a few days without reason? | Demote one |
| Opening looks the same for CFB and NFL? | Fail sport identity |
| Board / crown before any scored week? | Trust violation |
| Weekly cheevo with full confetti? | Overspend Emotional Budget |
| Finale weak relative to opening? | Rebalance — both are peaks |
| Missing “first paper” or “first card live”? | Add weekly ritual |
| Practice Mode triggering any of these? | Block |

---

## Mapping existing / planned systems (catalog, not implement)

| Moment (design name) | Category | Weight | Status |
|----------------------|----------|--------|--------|
| CFB Opening | Season Begins | ⭐⭐⭐⭐⭐ | Designed (opening sequence doc) |
| NFL Kickoff | Season Begins | ⭐⭐⭐⭐⭐ | Designed |
| First Card Goes Live | Weekly Ritual | ⭐⭐⭐ | Partial (CardPublished exists; Deferred off) |
| Gazette Reveal | Weekly Ritual | ⭐⭐⭐ | Exists (paper path) |
| Board Comes Alive | Weekly Ritual / Trust | ⭐⭐ | Empty state when no history |
| Ring Ceremony | Milestone / Season Begins family | ⭐⭐⭐⭐ | Code exists; Deferred off in prod |
| Weekly Cheevos | Milestone | ⭐⭐–⭐⭐⭐ | Badge path |
| Soft Unlock | Borderline | ⭐⭐ | Banner on Home |
| Crown Champion / Finale | Season Finale | ⭐⭐⭐⭐⭐ | Finale modal exists; Deferred off |
| First Week Scored peak | Milestone | ⭐⭐⭐⭐ | Not yet designed as Moment |

---

## How to use this document

1. Before shipping any new Moment, place it on this timeline.  
2. Check Emotional Budget against neighbors.  
3. Fill a Moment Object row.  
4. If the timeline feels crowded, cut before coding.

**No implementation in this pass.**
