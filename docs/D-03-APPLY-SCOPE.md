# D-03 apply scope — FINAL (authorization pending)

**Preflight:** COMPLETE / PASS  
**Helper gate:** COMPLETE / PASS — reuse `is_league_member` **unchanged**  
**SQL file:** `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql`  
**Status:** **NOT APPLIED** · not claimed repaired  

---

## End-to-end SQL file audit

| Statement / object | In file? | In D-03 scope? |
|--------------------|----------|----------------|
| `CREATE OR REPLACE record_league_first_join(uuid, uuid)` | **Yes** | **Yes** |
| `COMMENT ON` that function | Yes (metadata) | Yes (same object) |
| `REVOKE … record_league_first_join … FROM public` | **Yes** | **Yes** |
| `REVOKE … record_league_first_join … FROM anon` | **Yes** | **Yes** |
| `GRANT EXECUTE … record_league_first_join … TO authenticated` | **Yes** | **Yes** |
| `DROP POLICY "Users insert own first join"` | **Yes** | **Yes** |
| `CREATE POLICY "Users insert own first join"` with self + `is_league_member(league_id)` | **Yes** | **Yes** |
| `NOTIFY pgrst, 'reload schema'` | **Yes** | **Yes** |
| `CREATE OR REPLACE is_league_member` | **No** | Must stay **No** |
| Helper REVOKE/GRANT | **No** | Must stay **No** |
| `DELETE`/`UPDATE` of `league_first_joins` history rows | **No** | Must stay **No** |
| Other policies / tables / functions | **No** | Must stay **No** |
| App code | **No** | Must stay **No** |
| H-01 / D1B / D1C | **No** | Must stay **No** |

### Body behavior (RPC only)

| Behavior | Present |
|----------|---------|
| Auth required | Yes |
| `p_user_id` null → self; else must equal `auth.uid()` | Yes |
| `if not public.is_league_member(p_league_id)` → raise `Not a member of this league` | Yes |
| `ON CONFLICT DO NOTHING` (earliest `first_joined_at` preserved) | Yes |
| `UPDATE memberships.joined_at` only for matching membership | Yes |

---

## Exact apply scope (for Mike authorization)

When authorized, run **only** `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql`, which does:

1. **`CREATE OR REPLACE FUNCTION public.record_league_first_join(uuid, uuid)`**  
   - Calls **existing** `public.is_league_member` (no helper redefine)  
2. **`REVOKE ALL` on that RPC from `PUBLIC` and `anon`**  
3. **`GRANT EXECUTE` on that RPC to `authenticated`**  
4. **Replace only** policy `"Users insert own first join"` on `league_first_joins`  
   - `auth.uid() = user_id AND public.is_league_member(league_id)`  
5. **`NOTIFY pgrst, 'reload schema'`**

### Explicitly out of scope

| Item |
|------|
| Any change to `is_league_member` definition or grants |
| Historical first-join row mutation/deletion (73 rows clean) |
| Other RLS policies (`card_games`, `week_cards`, `memberships` SELECT, etc.) |
| App `cloud.ts` direct-insert fallback (P4 — later) |
| H-01 helper grant hardening |
| D1B / D1C / postseason / D-02 |

---

## Confirmations

| Claim | Status |
|-------|--------|
| No helper changes | **Confirmed** in revised SQL |
| No historical row mutation | **Confirmed** |
| No other policy/function/grant changes | **Confirmed** |
| No app changes | **Confirmed** |
| No H-01 / D1B / D1C | **Confirmed** |
| Production applied | **No** |

---

## Authorization gate

Mike must explicitly authorize **D-03 apply** of the audited file only.  
Until then: **hold**.
