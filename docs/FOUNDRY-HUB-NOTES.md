# Foundry Hub Notes

**Philosophy / product contract:** [`docs/WAR-ROOM-FOUNDRY.md`](./WAR-ROOM-FOUNDRY.md)  
*(Foundry is the validation workshop — not the player product. Real pipelines only.)*

War Room Pick'Em — collected **2026-08-01** (phone session).

## Navigation & context

- When viewing a page that shows what happens after scores are locked or posted, need **one-touch navigation back to Foundry**.
- Current pain: Accounts → scroll → Foundry again.
- When you enter Foundry, everything should stay inside the **Foundry test context** (similar to “view as player” mode).

## Health / status views

- Currently can view health/status of the **single league** you’re in.
- Need an **overall health view of all leagues combined**.
- Health view should include all leagues.

### Shipped

- [x] **Fleet · All leagues health** on Foundry — every membership, grouped by sport
- [x] Per-room lights (empty / behind / live), card week, scored weeks, humans/bots, active 7d
- [x] Enter room from fleet list
- [ ] Platform-wide “all leagues on the server” (not just founder memberships) when admin API exists

## Simulation / test buttons (to build)

- **“Start new player from beginning”** — experience exactly what a new player sees when joining a league.
- **“Join as new commissioner”** — full flow of starting your first league from scratch.

## Critical priority

> If the first hour is too busy or confusing, it can be a real issue.  
> **Hone in on that onboarding experience before anything else.**

The **first-hour player** and **first-hour commissioner** journeys should be the top focus.

---

## Build order (agreed)

1. **First-hour onboarding** (player + host) — critical  
2. Foundry sticky chrome (one-tap return)  
3. All-leagues health  
4. Full sim buttons (iterate)

## Shipped against these notes

- [x] Sticky **← Foundry** bar when eyes / Foundry session active  
- [x] First-hour entries: new player from beginning + new commissioner from beginning  
- [x] All-rooms health strip on Foundry (memberships by sport)  
- [ ] Deeper first-hour product polish (quiet chrome audit) — ongoing  
