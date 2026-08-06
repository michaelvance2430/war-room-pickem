# D1B-B — REVIEW-ONLY package source audit (post fair-entry revision)

**Date:** 2026-08-06  
**Package:** `supabase/review-only/D1B-B/`  
**Prior audit:** blocked by fair-entry stub  
**This audit:** fair-entry implemented in REVIEW-ONLY SQL + SQL-1/2/3 fixes  

### Final classification

```text
REVIEW-ONLY PACKAGE REVISED / DISPOSABLE READY
```

**Caveats:** Disposable suite still **NOT_RUN** on a live ephemeral project in this session. Classification means: package is **ready to execute** on disposable after 01→02→02b→03–06; production still **not authorized**. Mid-season FE fixtures require week_results + freezes on disposable.

**D1B-B remains NOT REPAIRED. No production apply.**

---

## 1. Exact fair-entry algorithm

See `docs/D1B-B-FAIR-ENTRY-SERVER-PARITY.md` §1 (line map of `fair-entry.ts`).

**Summary:** If no scored week ≥ 1 → 0. Else band by latest scored week; use frozen points if present; else percentile of human total_points (bots excluded, joiner excluded); freeze idempotently; return max(0, points).

**Division:** independent least-populated (`d1b_b_next_division`).

---

## 2. Server freeze schema and rationale

**Table:** `public.fair_entry_band_freezes` (normalized).  

**Why not sport_settings alone:** atomic insert under league lock, CHECK constraints, provenance columns, season_year PK component, clean RLS.  

**Season year:** `active_competition_season_year` if present else ET calendar year.  

**Reset:** delete freezes on season reset (follow-on ops; not auto in join).

---

## 3. Revised SQL paths

| File | Change |
|------|--------|
| `02-helpers.sql` | VOLATILE raise; sport allowlist; cut unused stub FE |
| `02b-fair-entry.sql` | **New** — freeze table + full FE |
| `03-rpc-create-league.sql` | Sport allowlist reject; **cut_percent** 0–100 persist default 50; commissioner points 0 |
| `04` / `05` | FE via `d1b_b_fair_entry_points(league, uid)` under lock |
| `06` | Unchanged intent (no codes) |
| `07` | Still future-only |
| `scripts/verify-fair-entry-parity.mjs` | TS fixtures |

Apply order: **01 → 02 → 02b → 03 → 04 → 05 → 06**.

---

## 4. RPC signatures (final)

### `create_league_with_commissioner_seat`

```
(p_name text,
 p_sport_id text default 'cfb',
 p_list_as_open boolean default false,
 p_crystal_ball_enabled boolean default true,
 p_current_week integer default 0,
 p_cut_percent integer default 50,
 p_max_human_members integer default 32)
→ json { ok, league_id, code, sport_id, name, cut_percent, max_human_members, is_open, current_week }
```

### `join_league_by_code(p_code text)` → json  

### `join_open_league_by_id(p_league_id uuid)` → json  

### `list_open_leagues_public(p_sport_id text, p_limit int)` → json rooms **without code**

---

## 5. Sport allowlist source

**Source:** `src/lib/sports/registry.ts` packs with `status: "live"` → **`cfb`, `nfl` only**.  

`d1b_b_normalize_sport_id`: blank → `cfb`; cfb/nfl (case-insensitive) accepted; else **null** → `validation_failed sport`.  

coming_soon (`soccer_wwc`, `nba`, `nhl`, …) **rejected**.

---

## 6. p_cut_percent resolution

**Keep and persist.** App/settings use cut_percent (default 50, product 0–100).  

Validated 0–100 inclusive; written to `leagues.cut_percent` on create. Fallback insert path if column missing (disposable base).

---

## 7. d1b_b_raise volatility

**VOLATILE.** Allowed codes only. Client message: `d1b_b:<code>` + optional short `[a-z0-9_]+` token. No join codes, UUIDs, or SQL text.

PostgREST: surfaces as error message string; app maps prefix.

---

## 8. App mapping resolution (design only)

| Flow | Mapping |
|------|---------|
| join create | `create_league_with_commissioner_seat` with name, sport, list_as_open, crystal_ball, **openingWeek**, cut 50 or settings, max 32 → session from json.code |
| join code | `join_league_by_code(upper(code))` — drop client capacity/FE/division |
| open-room seat | `join_open_league_by_id(id)` |
| open-room list | `list_open_leagues_public` — **UI must not require code**; remove code from OpenRoomListing or fetch after join |
| sport-pool | **Separate privileged/server seating** — not human self-join RPC; keep Foundry/service for multi-bot seat |
| first-join | Inside RPCs; client call optional/idempotent |
| session | writeSessionAndLeague after RPC success (same as today) |
| errors | parse `d1b_b:league_full` etc. to existing copy helpers |
| retry | rejoin returns already_member |

No app deploy authorized.

---

## 9. Static / parity test results

| Test | Result |
|------|--------|
| File 07 still not in stage-6 | **PASS** |
| Forced defaults / no privilege params | **PASS** |
| FOR UPDATE capacity | **PASS** |
| list_open no code | **PASS** |
| Fair-entry no longer stub-only | **PASS** (SQL present) |
| `node scripts/verify-fair-entry-parity.mjs` | Run in package commit / CI |
| Disposable JWT suite | **NOT_RUN** |
| SQL↔TS on disposable DB | **NOT_RUN** |

---

## 10. Remaining blockers

| ID | Severity | Item |
|----|----------|------|
| DISP-1 | Process | Disposable project execution still required before prod |
| APP-OPEN | Product/UX | Open-room UI currently shows codes — must change before discovery cutover |
| SPORT-POOL | Design | Multi-seat not in three human RPCs |
| RESET-FE | Design | Season reset must clear freezes (explicit follow-on) |
| NEG | Product quirk | Negative total_points preserved in percentile input (TS) |

**No P0 algorithm blocker remaining for early+mid-season if 02b applied on disposable and FE fixtures pass.**

---

## 11. Disposable readiness verdict

```text
REVIEW-ONLY PACKAGE REVISED / DISPOSABLE READY
```

Meaning: package is consistent enough to apply **01–06 including 02b** on a **disposable** project and run the guide. Not a claim that tests already passed. Production stage-6 still needs separate Mike authorization after disposable green.
