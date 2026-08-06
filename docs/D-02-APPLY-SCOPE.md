# D-02 apply scope — final review (not authorized)

**Preflight:** `docs/D-02-PREFLIGHT-EVIDENCE.md` — **COMPLETE / PASS**  
**SQL file:** `supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql`  
**Status:** Not applied · not claimed repaired · no executable paste until Mike authorizes  

---

## Preflight summary (closed)

| Check | Result |
|-------|--------|
| Vulnerable function + grants | MATCH |
| Direct self-insert policy on finds | MATCH (bypass present) |
| Flex table client write policies | None (MATCH) |
| Catalog table/policies | Absent (MATCH pre-apply) |
| Proposed catalog | Exactly 20 unique IDs PASS |
| Invalid historical discovery IDs | **Zero** PASS |
| Inconsistent milestone flexes | **Zero** PASS |
| Historical cleanup | **Not needed · not authorized** |

---

## SQL content confirmation (file audit)

| Question | Answer |
|----------|--------|
| Any `DELETE FROM easter_egg_finds` / flexes? | **No** |
| Any `UPDATE` of historical find/flex rows? | **No** |
| Any mass data cleanup? | **No** |
| Catalog seed `ON CONFLICT DO UPDATE`? | **Yes** — only on `easter_egg_catalog` seed rows (`is_active`, `sort_order`), not finds/flexes |
| Touches only approved objects? | **Yes** (see below) |

---

## Exact production objects (when authorized)

| # | Object | Operation |
|---|--------|-----------|
| 1 | `public.easter_egg_catalog` | `CREATE TABLE IF NOT EXISTS` |
| 2 | `public.easter_egg_catalog` | `INSERT … ON CONFLICT` seed **exactly 20** IDs |
| 3 | `public.easter_egg_catalog` | `ENABLE ROW LEVEL SECURITY` |
| 4 | Policy `egg_catalog_select_authenticated` | `CREATE` SELECT for `authenticated` only |
| 5 | Catalog client INSERT/UPDATE/DELETE policies | **None created** (admin/migration only via SQL) |
| 6 | Policy `egg_finds_insert_self` on `easter_egg_finds` | **`DROP POLICY IF EXISTS`** (closes direct insert) |
| 7 | `public.record_easter_egg_find(text, text, int)` | `CREATE OR REPLACE` hardened body |
| 8 | Same function | `COMMENT ON` (deprecation of untrusted args) |
| 9 | Same function EXECUTE | `REVOKE` from `PUBLIC` + `anon`; `GRANT` to `authenticated` |
| 10 | PostgREST | `NOTIFY pgrst, 'reload schema'` |

### Function behavior after apply (summary)

- Auth required; self-only (`auth.uid()`)
- Allowlist via catalog
- Ignore deprecated `p_player_name` / `p_total_eggs`
- Name from `profiles.display_name`
- Total + milestones **7 / 10 / full** from server catalog count
- Idempotent finds + flexes
- Counts only catalog-valid finds

---

## Explicitly out of scope

| Item | Status |
|------|--------|
| Delete/update historical `easter_egg_finds` | **No** |
| Delete/update historical `egg_milestone_flexes` | **No** |
| App code / upsert fallback removal | **Later** (P7; separate change) |
| Catalog parity test in CI | **Later** (P6 app/tooling) |
| D-01, D-03, D1B, D1C, other grants | **No** |

---

## Post-apply verify (when authorized — one statement at a time)

1. Catalog row count = 20  
2. Function body contains catalog + `display_name`  
3. EXECUTE grantees lack `anon`/`PUBLIC`  
4. No `egg_finds_insert_self` policy  
5. Behavioral tests (fake id, spoof name/total, valid find, direct insert fails)

---

## Authorization gate

Mike must explicitly authorize **D-02 apply** before any executable SQL is run in production.  
This document is scope review only.
