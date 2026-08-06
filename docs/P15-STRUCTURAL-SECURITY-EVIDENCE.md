# P15 — Structural / security evidence archive

**Mode:** Live catalog SELECT only · no production mutations  
**SQL:** `supabase/P15-structural-security-evidence-SELECT-ONLY.sql`  
**Complements:** `supabase/D0-rls-preflight-SELECT-ONLY.sql` (P0–P14)

---

## Q1 — RLS on `public.leagues`

| Field | Live result | Expected (repo) | Verdict |
|-------|-------------|-----------------|--------|
| `table_name` | `leagues` | `leagues` | — |
| `rls_enabled` | **true** | true (`ENABLE ROW LEVEL SECURITY` in schema) | **PASS** |
| `rls_forced` | **false** | false (no `FORCE ROW LEVEL SECURITY` in repo) | **PASS** |

**Recorded:** 2026-08-06 (operator paste)

**Binding notes (do not change):**

- Match against expected repository state — **no corrective DDL**.
- Do **not** enable `FORCE ROW LEVEL SECURITY` as part of P15/D1.
- **Service role continues to bypass RLS** regardless of FORCE status; treat all service-role paths as outside client RLS.

**Status:** CLOSED (PASS)

---

## Q2 — Sport-immutability triggers on `leagues`

| Field | Live result | Expected (repo) | Verdict |
|-------|-------------|-----------------|--------|
| Trigger | `leagues_sport_id_immutable_trg` | same (`league-sport-immutable.sql`) | **PASS** |
| `tgenabled` | **`O`** (enabled / origin) | O or A | **PASS** |
| Timing | `BEFORE UPDATE` `FOR EACH ROW` | same | **PASS** |
| Function | `public.leagues_sport_id_immutable()` | same | **PASS** |
| Guard | blocks `sport_id` change via `IS DISTINCT FROM` | same | **PASS** |
| Error | `check_violation` + intended migration hint | same | **PASS** |

**Recorded:** 2026-08-06 (operator paste)

**Binding notes (do not change):**

- Sport immutability is **live and intact**.
- Do **not** modify the trigger or function as part of P15 / D1A / D1B.
- D1A post-verify must still see this trigger present and enabled after any DELETE-policy drop.

**Status:** CLOSED (PASS)

---

## Q3 — Public UNIQUE constraints

**Verdict:** **PASS** for the D1A integrity gate.

**Recorded:** 2026-08-06 (operator paste)

### Core unique protections (confirmed live)

| Table | Columns |
|-------|---------|
| `leagues` | `code` |
| `memberships` | `league_id, user_id` |
| `week_cards` | `league_id, week_number` |
| `picks` | `league_id, user_id, week_number` |
| `pick_games` | `pick_id, card_game_id` |
| `week_results` | `league_id, week_number` |
| `game_results` | `week_result_id, card_game_id` |
| `league_trophies` | `league_id, season_year, trophy_type` |
| `gazette_editions` | `league_id, week_number` |
| `game_final_scores` | `league_id, week_number, game_identity_key` |

### Additional unique protections (confirmed present)

Reactions, milestone flexes, and sport-pool votes (and any other non-core UNIQUE rows returned by the catalog query).

### Scope note

- This inventory is **UNIQUE constraints only** — not PRIMARY KEY constraints.
- PKs (e.g. `profile_favorite_teams (user_id, sport_id)`, crystal-ball composite keys) are outside Q3; use D0 P7 if PK + UNIQUE together is required.

**Binding notes (do not change):**

- Do **not** modify, drop, or rename any constraints as part of P15 / D1A.
- D1A remains DROP of verified `leagues` DELETE policy only; uniques stay untouched.

**Status:** CLOSED (PASS)

---

## Q4 — Postseason / playoff / bracket tables

| Field | Live result | Expected | Verdict |
|-------|-------------|----------|---------|
| Rows matching `%postseason%` / `%playoff%` / `%bracket%` | **zero** | zero (REVIEW-ONLY / not applied) | **PASS** |

**Recorded:** 2026-08-06 (operator paste)

**Interpretation:**

- No live postseason, playoff, or bracket tables exist in `public`.
- Matches Pass 1 / PS0: `postseason-snapshots-REVIEW-ONLY.sql` not applied.
- Durable cut freeze remains **app / pure engine only** until Mike authorizes PS SQL separately.

**Status:** CLOSED (PASS)

---

## P15 overall

| Check | Verdict |
|-------|---------|
| Q1 leagues RLS | **PASS** |
| Q2 sport immutability | **PASS** |
| Q3 UNIQUE constraints | **PASS** (D1A integrity gate) |
| Q4 postseason tables | **PASS** |

**Archive status: COMPLETE** (2026-08-06)

**Do not:** modify RLS FORCE, sport trigger/function, unique constraints, or apply D1A without Mike’s explicit authorization.

---

## Production confirmation

| Claim | Status |
|-------|--------|
| Schema/RLS altered from this archive | **No** |
| FORCE RLS applied | **No** |
| Sport trigger/function modified | **No** |
| Constraints modified | **No** |
| D1A applied | **No** |
| App runtime changed | **No** |
