# Phase 3 — Emotional Budget

**Status:** Design-only reference · **no code**  
**Date:** 2026-08-03  
**Formerly called:** Energy Budget (renamed — this is *emotional* currency)  
**Package:** War Room Moments  
**Parent:** Constitution chapter *War Room Moments*

---

## Purpose

Every celebration **spends emotional currency**.

If you spend it every day, you're broke.  
If you protect it, 🎆 becomes tradition.

This document is the rule set so nobody accidentally puts fireworks on a ⭐⭐ event.

---

## Core idea

> **Every Moment spends emotional currency. Spend carefully.**

Emotional Budget is not FPS or API cost (those are *Performance Budget*).  
It is how much of the player's *goosebumps allowance* a Moment spends.

---

## Named tiers (War Room language)

Talk in **tier names** with players and in product docs. Stars remain internal mapping only.

| Tier | Name | Job | Internal weight | Examples |
|------|------|-----|-----------------|----------|
| **I** | **Traditions** | Annual / once-a-season sacred peaks | ⭐⭐⭐⭐⭐ | Season Opening, Championship, Hall of Champions, Legacy |
| **II** | **Weekly Rituals** | Heartbeat of the season | ⭐⭐⭐ (sometimes ⭐⭐⭐⭐) | Card Live, Locks, Board, Gazette |
| **III** | **Recognition** | Personal delight / earned beats | ⭐⭐ · ⭐ | Achievement, Title, Birthday, first cheevo |

Legacy star table (engineers only):

| Level | Meaning | Typical animation |
| ----- | ------- | ----------------- |
| ⭐⭐⭐⭐⭐ | Tier I Tradition | Full ceremony (authentic spectacle) |
| ⭐⭐⭐⭐ | Major milestone (rare full) | Light → rare full |
| ⭐⭐⭐ | Tier II Weekly Ritual | Light |
| ⭐⭐ | Tier III Recognition | Light or none |
| ⭐ | Tiny feedback | None |

---

## Spending rules

1. **Match animation to tier.** Full ceremony only for **Tier I Traditions** (and rarely a listed peak).  
2. **Season-scale Traditions are finite.** Default max **four** full-ceremony Moments per season arc (see rarity law).  
3. **Weekly Rituals stay weekly.** Never promote “Card Live” to Tier I.  
4. **Earned ≠ Tradition.** First cheevo is Recognition, not Opening Day.  
5. **Trust moments are not spend.** Empty Board / empty Standings are honesty, not celebration — they cost **0** Emotional Budget.  
6. **Skip is free.** Skip must never punish or re-spend.  
7. **Tier I changes require explicit founder approval + unanimous partners** (Constitution: **Traditions Are Sacred**). Once frozen, prefer aging over polish. Founder test: *Will this make players feel more than they did before?*
7. **Practice Mode spends nothing.** No Moments in Practice.  
8. **Foundry preview does not spend customer budget.** Creator can replay; customers still once.

---

## Seasonal budget metaphor

Think of each player-league-season as a small wallet:

| Spend type | Rough allowance |
|------------|-----------------|
| ⭐⭐⭐⭐⭐ | 1–2 times (open + finale) |
| ⭐⭐⭐⭐ | 1–3 times (ring, first score peak, etc.) |
| ⭐⭐⭐ | Weekly as season runs |
| ⭐⭐ / ⭐ | As needed; never steal from peaks |

If design wants a fifth ⭐⭐⭐⭐⭐, **demote or remove** another peak first.

---

## Decision table (ship check)

| Proposal | Weight assigned | Animation | Allow? |
|----------|-----------------|-----------|--------|
| Confetti on lock | ⭐ | full_ceremony | **No** |
| Full fireworks on weekly Gazette | ⭐⭐⭐ | full_ceremony | **No** |
| CFB / NFL Opening (~7.5s, silence breath) | ⭐⭐⭐⭐⭐ | full_ceremony (authentic stadium / broadcast) | **Yes — spend the budget** |
| Soft unlock banner | ⭐⭐ | none/light | **Yes** |
| Second full-screen “season is open” same week | ⭐⭐⭐⭐⭐ | full | **No** (duplicate spend) |

---

## Relation to Performance Budget

| Budget | Question |
|--------|----------|
| **Emotional** | How special does this feel? |
| **Performance** | How cheap is it on the main thread / network? |

A Moment can be emotionally huge and still performance-cheap (short CSS, no API).  
A Moment can be performance-cheap and still **emotionally bankrupt** if overused.

Both budgets must pass.

---

## Constitution line

> **Every celebration spends emotional currency. Spend carefully.**

---

## How to use with the other two docs

1. Place Moment on **Season Timeline**.  
2. Assign **Emotional Budget** weight.  
3. Fill **Moment Object** (animation must match weight).  
4. Ship only if Moment Gate + budgets pass.

**No implementation in this pass.**
