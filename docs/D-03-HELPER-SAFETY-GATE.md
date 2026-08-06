# D-03 shared-helper safety gate — `is_league_member`

**Status:** OPEN · SELECT only · D-03 apply **held**  
**Reason:** Query 6 confirmed presence only; body, grants, and consumers not inspected.

## Design preference (Mike)

- If live body already correctly checks `memberships` for `auth.uid()`, **do not** `CREATE OR REPLACE` unnecessarily.
- Limit D-03 to `record_league_first_join`, its grants, and first-join INSERT policy unless helper change is proven necessary.
- Do **not** fold H-01 into D-03.
- Preserve unrelated policies/anon behavior until consumers understood.

---

## Query 1 — Live definition + EXECUTE ACL

**Verdict:** **PASS** — reuse helper **unchanged**

| Field | Live |
|-------|------|
| Body | Correct `memberships` EXISTS for `p_league_id` + `auth.uid()` |
| SECURITY DEFINER / STABLE | Yes |
| `search_path` | `public` |
| Owner | `postgres` |
| EXECUTE | PUBLIC, anon, authenticated, postgres, service_role |

**Decision:** Do **not** `CREATE OR REPLACE` helper. Do **not** change helper grants in D-03. Broad grants = **H-01 inventory only**.

**Narrowed D-03 apply scope:**
1. `record_league_first_join` body  
2. `record_league_first_join` EXECUTE grants  
3. `league_first_joins` INSERT policy  
4. PostgREST reload  

---

## Query 2 — RLS policies referencing `is_league_member`

**Status:** PENDING

---

## Repo call sites (static)

- App/TS: **no** direct `is_league_member` callers  
- Museum uses `museum_is_league_member`  
- D-03 proposal SQL (pending rewrite to call existing helper only)
