# D-03 apply scope — final review (not authorized)

**Preflight:** `docs/D-03-PREFLIGHT-EVIDENCE.md` — **COMPLETE / PASS**  
**SQL file:** `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql`  
**Status:** Not applied · not claimed repaired  

---

## Preflight summary (closed)

| Check | Result |
|-------|--------|
| Function vulnerable baseline | MATCH (no membership gate) |
| EXECUTE includes anon | MATCH (to revoke) |
| INSERT policy self-only | MATCH (to tighten) |
| Orphan first-join rows | **0** |
| Total first-join rows | **73** |
| `is_league_member(uuid)` exists | **Yes** (DEFINER, search_path=public) |

---

## Exact production objects (when Mike authorizes)

**Helper:** `public.is_league_member(uuid)` — **REUSE UNCHANGED** (no CREATE OR REPLACE, no grant changes; broad grants = H-01 only).

| # | Object | Operation |
|---|--------|-----------|
| 1 | `public.record_league_first_join(uuid, uuid)` | `CREATE OR REPLACE` — call existing `is_league_member`; raise if not member; keep signature; idempotent insert; `joined_at` align |
| 2 | Same function EXECUTE | REVOKE PUBLIC + anon; GRANT authenticated |
| 3 | Policy `"Users insert own first join"` | DROP + CREATE: `auth.uid() = user_id` **and** `is_league_member(league_id)` |
| 4 | PostgREST | `NOTIFY pgrst, 'reload schema'` |

### Preserved behavior

| Behavior | |
|----------|--|
| Earliest `first_joined_at` | Never overwritten (`ON CONFLICT DO NOTHING`) |
| Idempotent re-stamp | Yes |
| `memberships.joined_at` alignment | Only existing membership rows |
| `p_user_id` | Null → self; else must equal `auth.uid()` |
| Historical first-join rows | **No DELETE / no UPDATE** of data rows |

---

## Explicitly out of scope

| Item |
|------|
| App `cloud.ts` direct-insert fallback removal (P4 — separate) |
| Historical orphan cleanup (none found) |
| H-01, D1B, D1C, postseason, D-02 |
| Mutating the 73 legitimate first-join rows |

---

## SQL content confirmation (file audit)

| Contains | |
|----------|--|
| `DELETE FROM league_first_joins` | **No** |
| `UPDATE league_first_joins` (history) | **No** |
| Membership gate | **Yes** via `is_league_member` |
| Raise non-member | **Yes** — `Not a member of this league` |

---

## Post-apply verify (one statement at a time, when authorized)

1. Function body contains `is_league_member` + non-member exception  
2. EXECUTE grantees lack anon/PUBLIC  
3. INSERT policy with_check includes `is_league_member`  
4. Behavioral (disposable): non-member denied; member stamp OK; re-stamp same timestamp  

---

## Authorization gate

Mike must explicitly authorize **D-03 apply** before any executable SQL is run in production.
