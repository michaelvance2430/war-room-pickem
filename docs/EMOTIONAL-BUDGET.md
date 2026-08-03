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

## Weight levels

| Level | Meaning | Typical animation | Examples |
| ----- | ------- | ----------------- | -------- |
| ⭐⭐⭐⭐⭐ | Once-a-season goosebumps | Full ceremony (confetti/fireworks allowed) | Sport Opening, Championship / Season Finale |
| ⭐⭐⭐⭐ | Major milestone | Light → rare full | Ring Ceremony, First Week Scored peak, Season Winner callout |
| ⭐⭐⭐ | Weekly excitement | Light | Gazette Reveal, Card Goes Live |
| ⭐⭐ | Small delight | Light or none | Board Unlock, Soft Unlock, First Cheevo |
| ⭐ | Tiny feedback | None | Checkmarks, lock confirmation, “saved” |

---

## Spending rules

1. **Match animation to weight.** Full ceremony only for ⭐⭐⭐⭐⭐ (and rarely ⭐⭐⭐⭐ if on the peak list).  
2. **Season-scale peaks are finite.** Default max **four** full-ceremony Moments per season arc (see rarity law).  
3. **Weekly rituals stay weekly.** Never promote “Card Live” to ⭐⭐⭐⭐⭐.  
4. **Earned ≠ fireworks.** First cheevo is delight (⭐⭐), not Opening Day.  
5. **Trust moments are not spend.** Empty Board / empty Standings are honesty, not celebration — they cost **0** Emotional Budget.  
6. **Skip is free.** Skip must never punish or re-spend.  
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
| CFB Opening 5s ritual | ⭐⭐⭐⭐⭐ | full_ceremony | **Yes** |
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
