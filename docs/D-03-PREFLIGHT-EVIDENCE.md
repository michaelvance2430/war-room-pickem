# D-03 preflight evidence archive

**Mode:** SELECT only · no production mutations  
**SQL:** `supabase/D-03-preflight-SELECT-ONLY.sql` (one query at a time)

---

## Product decisions locked

P1–P6 approved (see design doc). RLS-safe membership helper planned for INSERT policy.

---

## Query 1 — Live function definition + signature

**Verdict:** **MATCH**

| Field | Live |
|-------|------|
| Signature | `record_league_first_join(uuid, uuid DEFAULT NULL)` |
| SECURITY DEFINER | Yes |
| `search_path` | `public` |
| Auth / self-only | Present |
| Idempotent first timestamp | Preserved |
| Membership check | **Missing** |

## Query 2 — EXECUTE grants

**Verdict:** **MATCH** (broad grants)

| Grantee |
|---------|
| `anon` |
| `authenticated` |
| `postgres` |
| `service_role` |

No drift · no production changes.

---

## Query 3 — Policies on `league_first_joins`

**Verdict:** **MATCH**

| cmd | policyname | Notes |
|-----|------------|--------|
| INSERT | Users insert own first join | authenticated; self-only; **no** membership |
| SELECT | Members read first joins | authenticated; matching league membership |

Direct-insert bypass confirmed. No production changes.

---

## Query 4 — Orphan inventory (first-join without current membership)

**Verdict:** **PASS** (zero rows)

| Consequence | Status |
|-------------|--------|
| Orphan first-join rows | **None** |
| Historical cleanup | **Not needed · not authorized** |

No production changes.

---

## Query 5 — Counts summary

**Verdict:** **PASS**

| Metric | Live |
|--------|------|
| `total_first_join_rows` | **73** |
| `orphan_first_join_rows` | **0** |
| `users_with_orphan_first_joins` | **0** |

### Informational adoption (operator; does not change D-03 scope)

| Metric | Live |
|--------|------|
| total league joins | 73 |
| unique accounts | 61 |
| human league joins | 42 |
| unique human accounts | 30 |
| bot league joins | 31 |

Historical data clean. No cleanup. No production changes.

---

## Query 6 — Existing membership helper functions

**Verdict:** **PASS**

| Function | SECURITY DEFINER | `search_path` |
|----------|------------------|---------------|
| `is_league_member(uuid)` | Yes | `public` |
| `is_league_ops(uuid)` | Yes | `public` |
| `is_league_staff(uuid)` | Yes | `public` |
| `museum_is_league_member(uuid)` | Yes | `public` |

Apply design may use `public.is_league_member(p_league_id)` (no direct memberships RLS recursion).

No drift · no production changes.

---

## Preflight overall

| Query | Result |
|-------|--------|
| 1 Function def / signature | **MATCH** (vulnerable: no membership gate) |
| 2 EXECUTE grants | **MATCH** (anon, authenticated, postgres, service_role) |
| 3 Policies | **MATCH** (insert self-only; select needs membership) |
| 4 Orphan inventory | **PASS** (0 rows) |
| 5 Counts | **PASS** (73 total, 0 orphans) |
| 6 Membership helpers | **PASS** (`is_league_member` present) |

**Archive status: COMPLETE / PASS**

**Query 7:** not required — preflight closed.

**Historical cleanup:** not needed · not authorized.  
**Apply:** blocked until Mike reviews apply scope and explicitly authorizes D-03.