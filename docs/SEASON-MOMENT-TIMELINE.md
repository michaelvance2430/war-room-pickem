# Phase 2 — The Season Moment Timeline

**Status:** Design-only reference · **no code**  
**Date:** 2026-08-03 · **Updated:** 2026-08-05 (orchestrator binding fully locked)  
**Package:** War Room Moments  
**Parent:** `WAR-ROOM-MOMENTS-ARCHITECTURE.md` · `MOMENT-OBJECT-SCHEMA.md` · `EMOTIONAL-BUDGET.md`  
**Binding overrides:**  
- Moments / cinema: `docs/EXPERIENCE-ORCHESTRATOR-BINDING-DECISIONS.md`  
- Postseason fields / cut freeze: `docs/POSTSEASON-COMPETITION-LAW.md` + `docs/POSTSEASON-SNAPSHOT-DESIGN.md` (Stage PS0)

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
├── 📺 COLD OPEN  ·························  ⭐⭐⭐⭐⭐  🔒 BINDING
│     = sole user-facing SEASON OPENING cinematic
│     “Now defend it.” · launch · recap · defending champ · rivalries · Home mission
│     Window: first_kickoff − 7d → first_kickoff (authoritative kickoff clock)
│     Once per user·league·upcoming season · multi-visit until seen · dies at kickoff
│     Gates: auth · join · allegiance first · must not block picks
│     One automatic fullscreen per session · exit Home · no makeup after kickoff
│     Do NOT queue a separate “Season Opening” fullscreen with this
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
├── 👑 SEASON FINALE / AUTHORITATIVE RESULT · ⭐⭐⭐⭐⭐
│     Crown the Champion · hardware / standings / league history
│     (mutation path — independent of ceremony view)
│
├── 💍 RING CEREMONY  ·····················  ⭐⭐⭐⭐  🔒 BINDING 2026-08-05
│     Close completed season · honor the champion · “You won.”
│     Window: starts when result is authoritative · exactly 7 days
│     Once per user · league · completed season · max one display
│     Seen vs expired; miss = miss cinema only (result never expires)
│     Winner still via Trophy Room / hardware / Final Gazette / standings /
│     Home reigning identity / next Cold Open — NOT ceremony auto-replay
│     Presentation only — does NOT grant trophy
│     No fullscreen stack immediately after · return Home
│
└── OFFSEASON
      Rest · next season’s Cold Open (new season_key)
```

---

## CFB flavor (Saturday / campus)

```text
Preseason
│
├── 📺 Cold Open (= Season Opening cinematic)  ⭐⭐⭐⭐⭐
│     Identity: GameDay, campuses, rivalries — NOT generic fireworks
│     Window: first kickoff − 7d → first kickoff · “Now defend it.”
│
├── 📣 Week 0 Card Live  ⭐⭐⭐
├── (optional practice dies at Week 0 kickoff)
│
├── 🏆 First Week Scored peak?  ⭐⭐⭐⭐  (optional; protect rarity)
│     If used: only first official score of season
│
├── 📰 First Gazette  ⭐⭐⭐
├── 🚪 Board comes alive  ⭐⭐
│
├── Weekly rhythm (Week 1–13, Conf, CFP…)
│     Card · Paper · Board · Cheevos
│
├── Cut week drama (standings matter) — usually ⭐⭐⭐ narrative, not full ceremony
│
├── 👑 Championship / Toilet / Season Wrap  ⭐⭐⭐⭐⭐
│
└── 💍 Ring Ceremony (7-day post-result window)  ⭐⭐⭐⭐
      “You won.” · presentation only · see binding decisions
```

---

## NFL flavor (prime time / Opening Weekend)

```text
Preseason
│
├── 📺 Cold Open (= Season Opening cinematic)  ⭐⭐⭐⭐⭐
│     Identity: stadium lights, prime time, Opening Weekend
│     Window: first kickoff − 7d → first kickoff · “Now defend it.”
│
├── 📣 Week 1 Card Live  ⭐⭐⭐
├── 📰 First Gazette  ⭐⭐⭐
├── 🚪 Board comes alive  ⭐⭐
│
├── Weekly rhythm (regular season → playoffs)
│
├── 👑 Super Bowl / Toilet / Season Wrap  ⭐⭐⭐⭐⭐
│
└── 💍 Ring Ceremony (7-day post-result window)  ⭐⭐⭐⭐
      “You won.” · presentation only · see binding decisions
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
| Cold Open | Season Begins (**sole** Season Opening cinematic) | ⭐⭐⭐⭐⭐ | **Fully locked 2026-08-05** — see binding decisions; code window mostly aligned |
| Ring Ceremony | Season Finale family (close / honor) | ⭐⭐⭐⭐ | **Binding:** post-result 7-day cinema · result never expires · not opening-week; code still opening-week-shaped until orchestrator |
| Separate Season Opening Moment | — | — | **Do not dual-queue** with Cold Open; reconcile/retire auto path at orchestrator |
| Weekly Cheevos | Milestone | ⭐⭐–⭐⭐⭐ | Badge path |
| Soft Unlock | Borderline | ⭐⭐ | Banner on Home |
| Crown Champion / hardware | Season Finale (mutation + truth) | ⭐⭐⭐⭐⭐ | Authoritative result path; independent of ceremony view; permanent surfaces name champion |
| First Week Scored peak | Milestone | ⭐⭐⭐⭐ | Not yet designed as Moment |

---

## How to use this document

1. Before shipping any new Moment, place it on this timeline.  
2. Check Emotional Budget against neighbors.  
3. Fill a Moment Object row.  
4. If the timeline feels crowded, cut before coding.

**No implementation in this pass.**
