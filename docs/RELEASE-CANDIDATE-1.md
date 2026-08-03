# Release Candidate 1 — Stabilization

**Branch:** `release/candidate-1`  
**Base:** `340431a` (P0 production pass / `stable-p0-2026-08-03`)  
**Mode:** Stabilization — not feature development

---

## Goals on this branch

1. **Stop repeated `league_first_joins` 404s** (client negative-cache + memberships fallback).
2. **Reduce practical duplicate network** (join-at single-flight + 60s TTL).
3. **Keep** DeferredChrome off, identity-first profile, nav guard.
4. **Keep** debug instrumentation (debug-gated) until regression pass is green.
5. **No new features** until Mike confirms core regression.

---

## `league_first_joins` repair

### Client (this RC)

- First 404 / `PGRST205` → set `leagueFirstJoinsAvailable = false` for the session.
- Subsequent roster/profile hops **skip** the table; use `memberships.joined_at` only.
- `recordLeagueFirstJoin` no-ops when table known missing (no insert/select spam).
- Join-time map: single-flight + 60s cache per league.

### Server (optional full repair)

Apply when convenient in Supabase SQL Editor:

```text
supabase/join-order.sql
```

Creates `league_first_joins` + `record_league_first_join` RPC. After apply, hard refresh (capability flag resets on full reload).

---

## Debug instrumentation

**Status:** Leave in place (opt-in via `localStorage warroom-runtime-debug=1`).

Remove only after regression pass (separate PR on this RC or follow-up):

- Board/standings per-await marks  
- Event-loop probe (can stay opt-in forever)  
- Profile-route markers  

Do **not** remove containment or safe-mode logs required for ops.

---

## Core regression gate (before features)

Copy from `docs/STABILIZATION-CLEANUP-PLAN.md` §3 or Notepad checklist.

Minimum:

- [ ] Home hard refresh — no #418  
- [ ] Home → Standings → Profile  
- [ ] Home → Picks → Board  
- [ ] Account, Locker  
- [ ] Network: **no repeated** `league_first_joins` 404 after first miss  
- [ ] `[WR-DEFERRED] production safe mode — disabled`  
- [ ] No multi-second freezes  

---

## Feature development rule

**Normal feature work starts only after** Mike signs the regression pass on a build from this RC (or main after RC merges).

DeferredChrome reintro and eager profile sections remain **separate experiment branches**, measured one child at a time.
