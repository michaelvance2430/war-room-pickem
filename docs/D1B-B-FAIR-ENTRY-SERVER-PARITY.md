# D1B-B — Fair Entry server parity (revised)

**Status:** **SERVER DESIGN + SQL REVIEW-ONLY IMPLEMENTED (02b) / DISPOSABLE PARITY TS FIXTURES / NOT PROD-APPLIED**  
**Source:** `src/lib/fair-entry.ts` (authoritative browser algorithm)  
**SQL:** `supabase/review-only/D1B-B/02b-fair-entry.sql`  

### Separation of concerns

| Decision | Mechanism |
|----------|-----------|
| **Division** | `d1b_b_next_division` — least-populated N/S/E/W |
| **Starting total_points** | `d1b_b_fair_entry_points` — band/percentile Fair Entry |

Always on. Preseason → 0. Midseason → server calculation. Client cannot supply points.

---

## 1. Line-level browser algorithm map

### Constants (`FAIR_ENTRY_BANDS`)

| band_id | minScored | maxScored | percentile | freezeAfterWeek |
|---------|-----------|-----------|------------|-----------------|
| 1-2 | 1 | 2 | 75 | 2 |
| 3-4 | 3 | 4 | 60 | 4 |
| 5-6 | 5 | 6 | 50 | 6 |
| 7-8 | 7 | 8 | 30 | 8 |
| 9+ | 9 | +∞ | 15 | 9 |

### `percentileValue(values, percentile)`

1. If `!values.length` → **0**  
2. Map each to `Number(v) || 0` (note: **negative numbers kept** — `Number(-5)||0` is `-5`)  
3. Sort ascending  
4. If length 1 → `Math.round(s[0])`  
5. Clamp percentile to [0, 100]  
6. `rank = (p/100) * (n-1)`  
7. `lo = floor(rank)`, `hi = ceil(rank)`  
8. If lo===hi → `Math.round(s[lo])`  
9. Else linear interpolate, `Math.round`  

### `bandForLatestScoredWeek(latest)`

- null / non-finite / `< 1` → null (treated as preseason → 0 points)  
- Else first band where `latest ∈ [min, max]`  
- Else last band (`9+`)

### `loadHumanStandingsPoints(leagueId)`

- SELECT memberships total_points, is_bot for league  
- Filter `!is_bot`  
- Map to numbers  

### `resolveFairEntryForJoin(leagueId)`

1. Hydrate freezes from `leagues.sport_settings.fair_entry` into **localStorage** (browser only — **not** server authority)  
2. `latest = max(listScoredWeekNumbers() ≥ 0)`  
3. If no scored week ≥ 1 → `{ points: 0, midSeason: false }`  
4. Resolve band  
5. If frozen[band] in local/cloud hybrid store → use it  
6. Else compute percentile from humans; if empty humans → 0 / not midSeason  
7. Else freezeBandIfNeeded (idempotent, never overwrite) + persist to sport_settings best-effort  
8. Return `points = max(0, round(pts))`, midSeason true when band path active  

### Freeze after score

After week W scored: for each band with freezeAfterWeek ≤ W and no freeze, freeze percentile of current humans.

### Rejoin

No re-resolve for existing member (join short-circuits).

### Commissioner create

Not midseason join — points **0**.

### Season reset

Browser freezes in localStorage + sport_settings may linger. **Server law:** freezes keyed by `(league_id, season_year, band_id)`; season reset should **DELETE** freezes for that league/season (explicit ops path — not auto in join). Document for reset_league_season follow-on.

### Product quirks (do not silently change)

| Quirk | Behavior |
|-------|----------|
| Negative total_points in data | Coerced with `Number(v)||0` keeps negatives |
| localStorage freeze authority | Multi-device drift; server table replaces as sole authority |
| Empty humans mid-season | 0 points |

---

## 2. Server freeze schema — **normalized table**

### Choice: `public.fair_entry_band_freezes`

| Column | Purpose |
|--------|---------|
| league_id | Scope |
| season_year | Competitive season key (ET year or active_competition_season_year) |
| band_id | 1-2 … 9+ |
| points | Frozen starting total_points |
| latest_scored_week | Provenance |
| human_sample_size | Provenance |
| percentile | Provenance |
| frozen_at | Audit |

**PK:** `(league_id, season_year, band_id)` — **ON CONFLICT DO NOTHING** / select-first = idempotent.

### Why not sport_settings JSON alone

| Concern | JSON sport_settings | Normalized table |
|---------|---------------------|------------------|
| Atomic freeze under league lock | Fragile jsonb merge races | Insert + PK conflict |
| Validation | Ad hoc | CHECK constraints |
| Provenance | Nested free-form | Explicit columns |
| Season scoping | Easy to clobber | season_year in PK |
| RLS | Whole settings blob | Per-row member read |

**Rationale:** Prefer **normalized table** for concurrency and audit. Optional mirror to sport_settings deferred (not required for join).

### Concurrency

Join RPCs hold `SELECT league FOR UPDATE` then call `d1b_b_fair_entry_points` → freeze insert serialized per league.

### Corrections

No client path. Future ops: audited UPDATE/DELETE on freezes — separate design. **No historical mutation in this review stage.**

### Season reset

Explicit: when season is reset, delete freezes for that `league_id` (+ season_year). Not implemented in join package.

---

## 3. SQL functions (02b)

| Function | Role |
|----------|------|
| `d1b_b_fair_entry_season_year` | Season key |
| `d1b_b_latest_scored_week` | max week_results.week_number ≥ 1 |
| `d1b_b_fair_entry_band` | Band table |
| `d1b_b_percentile_value` | TS percentile parity |
| `d1b_b_human_points_array(league, exclude_uid)` | Humans only; exclude joiner |
| `d1b_b_freeze_band_if_needed` | Idempotent freeze |
| `d1b_b_fair_entry_points(league, exclude)` | Full resolve |
| `d1b_b_fair_entry_points(league)` | exclude auth.uid() |

Join RPCs call 2-arg form with `v_uid` under league lock.

Create commissioner RPC: **does not** call fair-entry (points 0).

---

## 4. TypeScript fixtures

`scripts/verify-fair-entry-parity.mjs` — run:

```bash
node scripts/verify-fair-entry-parity.mjs
```

Then on disposable SQL, compare `d1b_b_percentile_value(ARRAY[...], pct)`.

Behavioral mid-season with week_results: see disposable guide FE cases — **execute on disposable only**.
