# Production Schema Drift Report

**Project:** `dorhjepugsjpmnuzdzck` (Supabase URL from app env)  
**Method:** Live REST probes with production anon key + frontend query audit + SQL file map  
**Date:** 2026-08-02  
**App commit at audit:** main includes `0797a33` theme fix (independent of this drift)

**Rule:** No guesses — existence claims are from HTTP status + PostgREST error bodies.

---

## Root cause summary

Production Postgres is **behind** the frontend. The app selects columns and calls RPCs that exist in repo SQL migrations but were **never applied** (or not reloaded into PostgREST) on this Supabase project.

That produces:

| Browser symptom | HTTP | PostgREST |
|-----------------|------|-----------|
| `platform_status` | **404** | `PGRST205` table not in schema cache |
| `rpc/get_league_roster` | **404** | `PGRST202` function not found |
| `memberships?select=...leagues(home_tagline_id,...)` | **400** | `42703` `column leagues_1.home_tagline_id does not exist` |
| `leagues?select=...home_tagline...` | **400** | same missing columns |

`session-restore` and roster loaders re-run on route/session activity → **repeated failures on every hop**. This is schema drift, not a frontend “storm bug” by itself.

---

## STEP 1 — Failing requests (exact)

### A. `GET /rest/v1/platform_status`

| Field | Detail |
|-------|--------|
| **Frontend** | `src/lib/platform-status.ts` → `loadPlatformIncident()` / `setPlatformIncident()` |
| **Exact query** | `.from("platform_status").select("incident_active, incident_message, updated_at").eq("id", 1)` |
| **Required object** | Table `public.platform_status` (singleton row `id=1`) + SELECT RLS for anon/authenticated |
| **Production** | **MISSING** — `PGRST205` “Could not find the table 'public.platform_status'” |
| **Migration** | `supabase/platform-status.sql` |

---

### B. `POST /rest/v1/rpc/get_league_roster`

| Field | Detail |
|-------|--------|
| **Frontend** | `src/lib/cloud.ts` → `loadLeagueRosterFresh()` |
| **Exact query** | `supabase.rpc("get_league_roster", { p_league_id: leagueId })` |
| **Required object** | Function `public.get_league_roster(uuid)` granted to `authenticated` |
| **Production** | **MISSING** — `PGRST202` even with `p_league_id` body |
| **Migrations (newest wins if all run)** | `supabase/moderation.sql` (mod flags) → `supabase/deputy-ops.sql` (**includes `is_deputy`**, preferred) → `supabase/trial-bots.sql` / `trial-bots-roster-fix.sql` (bots; thinner return shape) |

**Preferred production definition:** `deputy-ops.sql` version (moderator + locker_muted + deputy + bots).

---

### C. `GET /rest/v1/memberships?...` → 400

| Field | Detail |
|-------|--------|
| **Frontend** | `src/lib/session-restore.ts` → `fetchMyMembershipsFresh()` |
| **Exact query (first attempt)** | ```role, is_moderator, is_deputy, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id, is_open)``` |
| **Required** | Membership columns + **embedded** `leagues(...)` FK relationship + listed league columns |
| **Production** | Membership base cols **OK**; embed relationship **OK**; fails on **missing league columns** in embed:  
  Live error: `column leagues_1.home_tagline_id does not exist` |
| **Migrations for missing league fields** | `home-tagline.sql`, `season-theme.sql` (embed also uses columns that **do** exist: id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, crystal_ball_enabled, sport_id, is_open) |

#### Memberships columns (probed)

| Column | Production |
|--------|------------|
| `role` | **OK** |
| `is_moderator` | **OK** |
| `is_deputy` | **OK** |
| `league_id` | **OK** |
| `division`, `total_points`, `locker_muted`, `joined_at`, `is_bot` | **OK** |
| `display_name` on memberships | N/A (app uses `profiles.display_name`) |
| FK embed `memberships → leagues` | **OK** (`leagues(id,name)` works) |

---

### D. `GET /rest/v1/leagues?...` → 400

| Field | Detail |
|-------|--------|
| **Frontend** | `src/lib/league-sync.ts` → `fetchLeagueFromCloud()` uses `.select("*")`; others select specific settings columns |
| **Exact probe that 400s** | select including `home_tagline_id` (and related) |
| **Production column matrix** | See table below |

#### Leagues columns (probed live)

| Column | Production | Migration if missing |
|--------|------------|----------------------|
| `id` | OK | `schema.sql` |
| `name` | OK | `schema.sql` |
| `code` | OK | `schema.sql` |
| `commissioner_id` | OK | `schema.sql` |
| `created_at` | OK | `schema.sql` |
| `cut_percent` | OK | `schema.sql` |
| `regular_season_weeks` | OK | `schema.sql` |
| `games_per_week` | OK | `schema.sql` |
| `crystal_ball_enabled` | OK | `crystal-ball-toggle.sql` |
| `sport_id` | OK | `sport-id.sql` |
| `is_open` | OK | `open-rooms.sql` |
| **`home_tagline_id`** | **MISSING** | `home-tagline.sql` |
| **`home_tagline_custom`** | **MISSING** | `home-tagline.sql` |
| **`season_theme_id`** | **MISSING** | `season-theme.sql` |
| **`open_room_nudge_pending`** | **MISSING** | `blue-falcon-open-nudge.sql` |
| **`open_room_nudge_left_name`** | **MISSING** | `blue-falcon-open-nudge.sql` |
| **`open_room_nudge_at`** | **MISSING** | `blue-falcon-open-nudge.sql` |
| `settings` (json blob) | MISSING (app does not require this column; uses discrete cols) | n/a |

---

## STEP 2 — Missing inventory

### Missing tables

| Object | Migration |
|--------|-----------|
| `public.platform_status` | `platform-status.sql` |

### Missing functions

| Object | Migration (apply this version) |
|--------|--------------------------------|
| `public.get_league_roster(uuid)` | **`deputy-ops.sql`** (full flags). Alternate older: `moderation.sql`, `trial-bots-roster-fix.sql` |

### Missing columns

| Table.column | Migration |
|--------------|-----------|
| `leagues.home_tagline_id` | `home-tagline.sql` |
| `leagues.home_tagline_custom` | `home-tagline.sql` |
| `leagues.season_theme_id` | `season-theme.sql` |
| `leagues.open_room_nudge_pending` | `blue-falcon-open-nudge.sql` |
| `leagues.open_room_nudge_left_name` | `blue-falcon-open-nudge.sql` |
| `leagues.open_room_nudge_at` | `blue-falcon-open-nudge.sql` |
| `profiles.blue_falcon_count` | `blue-falcon-open-nudge.sql` (related leave flow; not in browser 400 list but same file) |

### Missing foreign keys / relationships

| Item | Status |
|------|--------|
| `memberships.league_id → leagues.id` (PostgREST embed) | **Present** (probe OK) |
| Other FKs for these calls | Not implicated |

### Missing RLS (for new objects only)

| Object | From migration |
|--------|----------------|
| `platform_status` SELECT anon+authenticated | `platform-status.sql` |
| `platform_status` UPDATE authenticated id=1 | `platform-status.sql` |
| `get_league_roster` EXECUTE authenticated | `deputy-ops.sql` |

Existing `memberships` / `leagues` RLS assumed working (200 on narrow selects with anon; authenticated paths work for logged-in users).

---

## Safe execution order

1. **Backup** (Supabase dashboard → backups / snapshot) — optional but recommended.  
2. Run consolidated patch: **`supabase/FIX-PRODUCTION-SCHEMA-DRIFT.sql`** in SQL Editor (service role / postgres).  
3. Confirm `NOTIFY pgrst, 'reload schema';` ran (included at end of patch).  
4. If PostgREST still 404s after ~30s: Project Settings → API → **Reload schema** (or restart).  
5. Hard-refresh app; recheck Network:
   - `platform_status` → 200  
   - `get_league_roster` → 200 (or empty array, not 404)  
   - memberships embed with tagline cols → 200  

**Do not** run full `PASTE-ME-all-pending.sql` unless you intend broader features; it is a large multi-feature bundle, not the minimal drift fix.

---

## STEP 4 — React #418 (separate; do not fix yet)

**Likely independent of schema drift.** Minified hydration mismatch.

### Highest-probability shell candidates

| Location | Pattern | Why #418 |
|----------|---------|----------|
| `ThemeDecorGate` | SSR/`useState(true)` then effect may hide children | Usually post-hydration; lower risk if effect-only |
| `SmoothRuntimeGate` | same | lower risk |
| `Nav.tsx` `isoEnabled("deferred")` / `isoEnabled("navProgressive")` **during render** | Reads `localStorage` on client; SSR uses defaults | **If** `warroom-iso` differs from defaults, first client render can diverge from SSR HTML |
| `SportThemeApplier` / `applySportTheme` | sets `document.documentElement` `data-sport` after mount | Attribute not in SSR HTML; usually not React tree mismatch |
| `SeasonThemeApplier` | `data-season-theme` on `<html>` after mount | same |
| Page-level | date strings / random / `window` branches | possible but not proven in this audit |

**Recommendation:** Fix schema first. Re-test #418 after Network is clean. If #418 remains, next isolation is Nav `isoEnabled` only inside `useEffect` (do not do that in this change set).

---

## Will repeated route errors stop after patch?

**Yes, for these four classes**, if patch applies cleanly and schema cache reloads:

- No more 404 on `platform_status`  
- No more 404 on `get_league_roster`  
- No more 400 on memberships/leagues selects that need tagline/theme/nudge columns  

**May remain:** other 400/404s for unrelated missing objects (crews, crystal_ball tables, etc.) not in this browser list.

---

## Remaining risks

1. Running SQL without service role / wrong project.  
2. PostgREST cache delay after apply.  
3. RPC return shape: if an old thinner `get_league_roster` is created without mod/deputy columns, app still works but loses flags — patch uses **deputy-ops** shape.  
4. `record_early_leave` and other blue-falcon RPCs not fully expanded in this minimal patch (columns only + table/RPC for reported errors).  
5. React #418 may persist after schema fix.

---

## Artifacts

| File | Purpose |
|------|---------|
| `docs/PRODUCTION-SCHEMA-DRIFT.md` | This report |
| `supabase/FIX-PRODUCTION-SCHEMA-DRIFT.sql` | One consolidated idempotent patch (**do not auto-execute**) |

---

**END OF DRIFT REPORT**
