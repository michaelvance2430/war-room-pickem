# D1B-B — Fair Entry freeze lifecycle (design)

**Status:** DESIGN LOCKED FOR APP CUTOVER / **NO PRODUCTION DATA MUTATION**  
**Date:** 2026-08-06  
**Depends on:** disposable FE season isolation **PASS** (Run 2)

### Classification

```text
FAIR ENTRY LIFECYCLE: DESIGN ONLY /
NO AUTOMATIC DESTRUCTIVE CLEANUP /
NO PRODUCTION MUTATION THIS PHASE
```

---

## 1. What freezes are

Server path (D1B-B package `02b`):

- Table: `fair_entry_band_freezes` (league_id, season_year, band_id, frozen_points, …)
- Join RPCs call `d1b_b_fair_entry_points(league_id, joiner_uid)` under league row lock
- Client may still keep local mirrors in `sport_settings.fair_entry` / localStorage for chrome

Product law: same band + same season → same frozen points for all joiners in that window.

---

## 2. Season isolation (already proven)

Disposable Run 2: freezes for season A do **not** apply when season_year = B.

**Implication:** Old freezes can remain stored without polluting a new season **as long as** all reads are season-scoped.

---

## 3. Retention policy (approved for cutover)

| Phase | Action |
|-------|--------|
| Active season | **Retain** all freezes for that `(league_id, season_year)` |
| Season rollover / reset | **Retain** prior-year freezes by default (audit / dispute / mid-window edge cases) |
| Archive (optional future) | Soft-archive flag or copy to archive table — **not** implemented now |
| Delete | **Only** via explicitly authorized ops job after product sign-off |

### Forbidden in this phase

- App code that `DELETE FROM fair_entry_band_freezes` on season reset  
- Cron that purges freezes without Mike authorization  
- Bundling freeze wipe into ordinary membership join RPCs  
- Production data mutation of freeze rows as part of app cutover  

---

## 4. Season reset interaction

Prefer:

1. Scoring wipe / `reset_league_season` (or equivalent) clears **membership stats**, not freezes.
2. New season uses new `season_year` key → isolation holds.
3. If product later wants “fresh FE math every year,” implement **authorized** archive job:

```text
-- CONCEPT ONLY — do not run
-- archive prior season freezes where season_year < current
-- never hard-delete without dual review
```

---

## 5. Client lifecycle

| Client artifact | Policy |
|-----------------|--------|
| `localStorage` fair-entry store | Ephemeral UX; may clear on logout |
| `sport_settings.fair_entry` mirror | Best-effort; **server freezes win** after RPC cutover |
| Fair Entry notice | Notice-only; never shows raw points math |

After ordinary join cutover: **do not** call `applyFairEntryToMembership` from create/join/open paths.

---

## 6. Open decisions (not blocking ordinary cutover)

| # | Decision | Default until decided |
|---|----------|------------------------|
| D1 | Years of freeze history to keep | **Indefinite retain** |
| D2 | Archive table vs soft flag | Undecided — retain raw rows |
| D3 | Founder UI to inspect freezes | Nice-to-have; not required |
| D4 | Wipe freezes on league delete | Follow league FK / cascade policy when league delete is redesigned |

---

## 7. Verification checklist (future disposable)

| Check | Expect |
|-------|--------|
| Join mid-season season A | Points from A freeze |
| After season_year bump to B | New freeze path; A rows still present |
| No app DELETE on freezes | Grep clean for ordinary flows |
| Production | Untouched until authorized SQL |

---

*No production apply. No automatic cleanup.*
