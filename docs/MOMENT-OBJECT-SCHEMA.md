# Phase 1 — The Moment Object

**Status:** Design-only reference · **no code**  
**Date:** 2026-08-03  
**Package:** War Room Moments (with Timeline + Emotional Budget)  
**Parent:** `WAR-ROOM-MOMENTS-ARCHITECTURE.md` · Constitution chapter *War Room Moments*

---

## Purpose of this page

Define **what a Moment is** — one reusable object — so future traditions plug into a system instead of inventing new popup/ceremony machinery.

---

## Definition

> **A Moment is a player-facing emotional beat that players might remember a month later.**

Not a settings panel.  
Not a toast for every save.  
Not a Foundry lab tool (Foundry *previews* Moments; customers *live* them).

**Gate (Moment Gate):**

> Will players remember this a month later?

If no → it is feedback, not a Moment. Demote to ⭐ / ⭐⭐ Emotional Budget and keep it out of the Moments catalog.

---

## One-page schema

Every Moment object **must** define:

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| **id** | string | yes | Stable machine id, e.g. `season_open_cfb` |
| **name** | string | yes | Player-facing name |
| **category** | enum | yes | `season_begins` · `weekly_ritual` · `milestone` · `season_finale` |
| **purpose** | string | yes | One sentence: what tradition this builds |
| **emotional_weight** | 1–5 | yes | See *Emotional Budget* — never invent at ship time |
| **supported_sports** | sportId[] | yes | Empty = none; never “generic all sports” without identity packs |
| **sport_identity** | per-sport pack | if multi | Visual + voice so sport is obvious before copy |
| **trigger** | description | yes | World-state truth (e.g. official opening week **published**) |
| **eligibility** | rules | yes | Who, when, not Practice, not Foundry eyes unless preview |
| **priority** | number | yes | ExperienceQueue order among Moments |
| **animation** | enum | yes | `none` · `light` · `full_ceremony` — must match emotional weight |
| **copy** | object | yes | Speech bank and/or fixed lines; personal garnish rules |
| **replay_policy** | enum | yes | `once_per_user_league_season` · `once_ever` · `once_per_week` · `every_occurrence` · `foundry_only` |
| **claim_identity** | key recipe | if one-shot | e.g. `moment_type:user:league:sport:season` |
| **foundry_preview** | yes/no + notes | yes | How Mike previews without customer discovery |
| **analytics** | events | recommended | claimed · completed · skipped · speech_id |
| **performance_budget** | notes | yes | No provider APIs; no DeferredChrome; cleanup on exit |
| **blocks_navigation** | boolean | yes | Full-screen vs non-blocking |
| **duration_target** | ms | if blocking | e.g. ~5000 for season open |
| **related_trust_rules** | links | optional | Never invent history / achievement / reality |

---

## Categories (permanent)

| Code | Label | Role |
|------|--------|------|
| `season_begins` | 🏈 Season Begins | Once; establish the season’s feeling |
| `weekly_ritual` | 📅 Weekly Rituals | Heartbeat of the season |
| `milestone` | 🏆 Milestones | Earned by the player |
| `season_finale` | 👑 Season Finale | Emotional close |

---

## Animation vs weight (hard rule)

| Emotional weight | Max animation |
|------------------|---------------|
| ⭐⭐⭐⭐⭐ | `full_ceremony` allowed |
| ⭐⭐⭐⭐ | `full_ceremony` rare; prefer `light` unless listed as peak |
| ⭐⭐⭐ | `light` max |
| ⭐⭐ | `light` or `none` |
| ⭐ | `none` |

Violating this table is a Constitution violation, not a style preference.

---

## Example (schema filled — not implemented)

```text
id:                 season_open_cfb
name:               College Football Opening
category:           season_begins
purpose:            Mark that CFB season has officially begun in this room
emotional_weight:   ⭐⭐⭐⭐⭐
supported_sports:   [cfb]
trigger:            Official opening week (0) card published for this league
eligibility:        Real member · not Practice · not Foundry eyes · moment unclaimed · after onboarding
priority:           3 (after required onboarding)
animation:          full_ceremony
copy:               15–20 speech bank + personal garnish
replay_policy:      once_per_user_league_season
claim_identity:     official_season_open:user:league:cfb:season_key
foundry_preview:    yes — Season Opening Lab
blocks_navigation:  true (~5s, skip allowed)
```

---

## Non-examples (not Moments)

| Thing | Why |
|-------|-----|
| Lock confirmation checkmark | ⭐ feedback |
| SoftUnlock banner | Borderline — catalog only if it passes Moment Gate |
| Foundry hop bar | Creator tool, not player tradition |
| Empty Board state | Trust/honesty UI, not a celebration Moment |

---

## Source of truth

When code exists later: one registry module.  
Until then: this schema + Timeline + Emotional Budget are the source of truth for design.

**No implementation in this pass.**
