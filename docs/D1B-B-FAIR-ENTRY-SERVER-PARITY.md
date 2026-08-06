# D1B-B — Fair Entry server parity design

**Status:** **DESIGN ONLY / PRODUCTION BLOCKER until implemented & tested**  
**Date:** 2026-08-06  
**Source of truth (browser today):** `src/lib/fair-entry.ts`  
**SQL stub (must not ship to prod join):** `d1b_b_fair_entry_points` → always `0`  

### Clarification

| Concern | Owner |
|---------|--------|
| **Starting `total_points` (bands/percentiles)** | Fair Entry (this document) |
| **Division (North/South/East/West)** | Separate: least-populated seats — already `d1b_b_next_division` |

Product join sets **both**. Do not call division “fair-entry band.”

---

## 1. Exact browser algorithm

### 1.1 Band table (fixed product)

| Band id | latest scored week range | Percentile of human standings | freezeAfterWeek |
|---------|--------------------------|-------------------------------|-----------------|
| `1-2` | 1–2 | 75 | 2 |
| `3-4` | 3–4 | 60 | 4 |
| `5-6` | 5–6 | 50 | 6 |
| `7-8` | 7–8 | 30 | 8 |
| `9+` | ≥9 | 15 | 9 |

### 1.2 Resolve at join (`resolveFairEntryForJoin`)

```
inputs:
  leagueId
  listScoredWeekNumbers() → scored weeks for league
  memberships.total_points for humans (is_bot false)
  optional cloud freeze: leagues.sport_settings.fair_entry.{frozen, frozenAt}
  optional localStorage freeze (browser-only — NOT authoritative for multi-device)

steps:
  1. Hydrate freezes from sport_settings.fair_entry into local (browser)
  2. latest = max(scored weeks ≥ 0); if none or latest < 1 → points=0, midSeason=false
  3. band = bandForLatestScoredWeek(latest)
  4. if frozen[band.id] exists → points = frozen[band.id]
     else:
       humans = human total_points list
       if empty → points=0, midSeason=false
       else points = percentileValue(humans, band.percentile)
            freezeBandIfNeeded (idempotent; never overwrite freeze)
  5. return points (int ≥ 0), band, midSeason=true when scored season active
```

### 1.3 Percentile (`percentileValue`)

- Sort ascending human points  
- Empty → 0  
- Single value → round that value  
- Else nearest-rank: `rank = (p/100)*(n-1)`, linear interpolate, **Math.round**

### 1.4 Freeze after score

When week W is scored: for each band with `freezeAfterWeek <= W` and no freeze yet, freeze percentile of current human standings.

### 1.5 Apply to membership

Join inserts with `total_points: startPts` from resolve; optional post-update if 0 then re-apply.

---

## 2. Inputs (must be server-readable)

| Input | Source today | Server equivalent |
|-------|--------------|-------------------|
| League id | session | RPC param / lock row |
| Scored weeks | `listScoredWeekNumbers` / week_results | `SELECT max(week_number) FROM week_results WHERE league_id = ?` (confirm live table) |
| Human points | memberships total_points where not bot | Same query under DEFINER |
| Frozen bands | sport_settings.fair_entry + localStorage | **Only** `leagues.sport_settings->fair_entry` (authoritative); drop localStorage for authority |
| Band table | FAIR_ENTRY_BANDS constant | SQL table or immutable function constants |

---

## 3. Server design (proposed)

### 3.1 Storage

Prefer extend existing:

```text
leagues.sport_settings.fair_entry = {
  "frozen": { "1-2": 120, "3-4": 95, ... },
  "frozenAt": { "1-2": "<timestamptz iso>", ... }
}
```

Optional dedicated columns later — not required if JSONB already used.

### 3.2 Functions (REVIEW-ONLY future)

| Function | Role |
|----------|------|
| `d1b_b_latest_scored_week(p_league_id)` | max week_results.week_number or null |
| `d1b_b_human_points_array(p_league_id)` | human total_points |
| `d1b_b_percentile(points[], pct)` | mirror percentileValue |
| `d1b_b_band_for_week(week int)` | return band id + percentile |
| `d1b_b_freeze_band_if_needed(...)` | idempotent write into sport_settings |
| `d1b_b_fair_entry_points(p_league_id)` | **replace stub** with full resolve |

### 3.3 Output type

- **`integer`** `total_points` ≥ 0 — compatible with memberships.total_points  
- Not a division enum  

### 3.4 Behaviors

| Case | Behavior |
|------|----------|
| No scored weeks / latest &lt; 1 | 0 points (day-one) |
| Empty human standings mid-season | 0 (browser returns empty → 0) |
| Tie in percentile interp | round as browser |
| Freeze exists | never overwrite |
| Rejoin | no new fair-entry; existing membership returned |
| Commissioner create | 0 points (not mid-season join) |
| Bots | never define freezes; never consume fair-entry for bot seed |
| Concurrency | freeze write under league row lock already held by join RPC |
| Deterministic tests | fixture week_results + human points + empty freezes → expected integer |

### 3.5 Division (not fair-entry)

| Case | Behavior |
|------|----------|
| Algorithm | Least-populated among N/S/E/W; ties → first in order North…West (SQL loop) |
| Empty league | North |
| Commissioner create | North (matches app create) |
| Rejoin | no change |
| Bots | count toward division population today if inserted with division — product OK |

---

## 4. Parity risk if stub ships

| Risk | Impact |
|------|--------|
| Mid-season join at 0 points | Unfair standings vs current product |
| Dual path during cutover | Browser fair-entry then RPC 0 if mixed |
| Cloud freeze ignored | Cross-device band drift already weak; server must fix |

---

## 5. Production gate

**BLOCKED BY FAIR-ENTRY PARITY** until:

1. Stub replaced with server resolve matching §1–§3  
2. Disposable fixtures prove band points match TypeScript fixtures  
3. Freeze-on-score path either server cron/score hook or accepted deferred (document)  
4. Join RPCs call real helper under league lock  

---

## 6. Status

| Statement | True? |
|-----------|-------|
| Browser algorithm mapped | **Yes** |
| Server stub acceptable for prod | **No** |
| Server design sketched | **Yes** |
| Implemented in REVIEW-ONLY SQL | **No** (still stub) |
