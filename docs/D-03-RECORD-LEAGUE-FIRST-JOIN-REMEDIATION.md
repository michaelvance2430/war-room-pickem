# D-03 — `record_league_first_join` remediation design

**Status:** REVIEW ONLY — **not authorized to apply** · **not claimed repaired**  
**Defect:** STRUCTURAL-SECURITY-DEFECT-REGISTER **D-03** · P17  
**Severity:** Medium (integrity / spoofed first-join rows)

---

## 1. Findings and call-site map

### 1.1 Function (repo sources of truth)

| File | Role |
|------|------|
| `supabase/join-order.sql` | Canonical schema + RPC |
| `supabase/FIX-LEAGUE-FIRST-JOINS.sql` | Additive prod paste (same body) |

| Property | Value |
|----------|--------|
| Signature | `record_league_first_join(p_league_id uuid, p_user_id uuid default null)` → `timestamptz` |
| SECURITY DEFINER | **Yes** |
| `search_path` | `public` |
| Auth | Raises if `auth.uid()` is null |
| Self-only | `v_uid := coalesce(p_user_id, auth.uid())`; rejects if `v_uid is distinct from auth.uid()` |
| Membership gate | **Missing** (defect) |
| Insert | `ON CONFLICT (league_id, user_id) DO NOTHING` — **idempotent** |
| Timestamp | Inserts `now()` only on first insert; never overwrites existing `first_joined_at` |
| Side effect | `UPDATE memberships SET joined_at = v_at` when membership exists and differs |
| Grants (repo) | `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO authenticated` |
| Grants (live P16 pattern) | May also include `anon` / broader roles — preflight must re-check |

### 1.2 Table `public.league_first_joins`

| Item | Definition |
|------|------------|
| PK | `(league_id, user_id)` |
| FK | `league_id → leagues(id) ON DELETE CASCADE` |
| FK | `user_id → profiles(id) ON DELETE CASCADE` |
| Column | `first_joined_at timestamptz NOT NULL DEFAULT now()` |
| Index | `(league_id, first_joined_at)` |
| RLS | Enabled |
| SELECT | `"Members read first joins"` — caller must be a **member** of that league |
| INSERT | `"Users insert own first join"` — `auth.uid() = user_id` only (**no membership**) |
| UPDATE/DELETE | None for clients (permanent first join) |

### 1.3 App call sites (all post-membership in legitimate flows)

| Location | When | Order |
|----------|------|--------|
| `src/lib/cloud.ts` → `recordLeagueFirstJoin` | **Only** app wrapper around RPC (+ direct-insert fallback) | N/A |
| `src/app/join/page.tsx` create room | After `memberships.insert` commissioner | **Membership → first join** |
| `src/app/join/page.tsx` join by code (new) | After `memberships.insert` player | **Membership → first join** |
| `src/app/join/page.tsx` re-enter (existing mem) | When membership already exists | **Membership present → first join** |
| `src/lib/open-room.ts` open room join | After `memberships.insert` | **Membership → first join** |

**No other TS/TSX call sites** found.

### 1.4 App wrapper behavior (`recordLeagueFirstJoin`)

1. Prefer RPC `record_league_first_join` with `{ p_league_id, p_user_id: uid }`.  
2. On RPC error (not missing schema): fall through to **direct client insert** into `league_first_joins` (same RLS gap as insert policy).  
3. Then best-effort `memberships.update({ joined_at })`.  

**Note:** Direct-insert fallback is a parallel integrity surface (like D-02 upsert). Design should close it or require membership in policy.

### 1.5 Relationship to `memberships.joined_at`

| Fact | Detail |
|------|--------|
| Column | `memberships.joined_at` used for roster/profile “when they entered” |
| Product law | **Permanent first join** survives leave/rejoin; titles (OG / cool / …) use first-join order |
| RPC side effect | When membership exists, sets `joined_at = first_joined_at` so rejoin does not look “new” |
| Dependency | Titles prefer `league_first_joins`; fall back to `memberships.joined_at` in `loadJoinedAtByUser` |
| Does membership **require** this RPC? | **No** — membership insert works alone; first-join is best-effort optional |

### 1.6 Attack / integrity model today

Authenticated user can call RPC with **any** `p_league_id` (valid UUID for an existing league, due to FK) and insert a first-join row **without ever joining**, polluting join-order titles if they later join or if readers see the table. SELECT RLS still limits who **reads** peers’ first-joins (members only), but the **row exists** and can affect backfill / future membership alignment.

---

## 2. Historical orphan inventory (SELECT only — operator)

**Cannot run live from this agent without SQL session.** Mike should run in SQL Editor and archive.

### Block A — Orphan first-join rows (no matching membership)

```sql
-- D-03 PREFLIGHT: first-join rows without current membership
SELECT
  f.league_id,
  f.user_id,
  f.first_joined_at,
  l.name AS league_name,
  p.display_name
FROM public.league_first_joins f
LEFT JOIN public.memberships m
  ON m.league_id = f.league_id AND m.user_id = f.user_id
LEFT JOIN public.leagues l ON l.id = f.league_id
LEFT JOIN public.profiles p ON p.id = f.user_id
WHERE m.id IS NULL
ORDER BY f.first_joined_at DESC;
```

### Block B — Counts

```sql
SELECT
  (SELECT count(*) FROM public.league_first_joins) AS total_first_join_rows,
  (
    SELECT count(*)
    FROM public.league_first_joins f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.league_id = f.league_id AND m.user_id = f.user_id
    )
  ) AS orphan_first_join_rows,
  (
    SELECT count(DISTINCT f.user_id)
    FROM public.league_first_joins f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.league_id = f.league_id AND m.user_id = f.user_id
    )
  ) AS users_with_orphan_first_joins;
```

### Interpretation notes

- **Orphan ≠ always spoof.** Legitimate leavers keep first-join forever while membership is gone — product-intended.  
- Inventory is for **evidence**, not auto-delete.  
- Cleanup of true spoofs (never had membership history) needs separate forensic criteria + Mike auth.

**Status:** Live inventory **PENDING** operator paste.

---

## 3. Compatibility analysis

| Flow | Today | After membership gate |
|------|--------|------------------------|
| Create league (commish membership then stamp) | Works | Works |
| Join code (insert membership then stamp) | Works | Works |
| Re-enter existing member | Works | Works |
| Open-room join | Works | Works |
| Leave then rejoin | First-join row kept; stamp idempotent | Works if membership exists before stamp (app already does) |
| Transfer commissioner | No call site | Unaffected |
| Returning user stamp without membership | Would succeed today | **Fails** — correct |
| RPC before membership (hypothetical race) | Insert without member | **Fails** — app must keep order (already does) |
| `p_user_id` param | Self-only enforced | Keep param; still force `auth.uid()` |
| Direct client insert fallback | Bypasses membership | Close or policy-tighten |
| `joined_at` restore | UPDATE when member | Unchanged when member; no-op if no member |

**Risk if gate applied without app order:** low — all call sites already membership-first.  
**Risk to historical orphans:** security apply should **not** delete them (leavers are valid).

---

## 4. Recommended design

### 4.1 RPC body (core)

```text
require auth.uid()
v_uid := auth.uid()   -- ignore untrusted other users; p_user_id only accepted if = auth.uid()
if p_user_id is not null and p_user_id is distinct from auth.uid() → raise
require exists memberships (league_id = p_league_id AND user_id = auth.uid())
  else raise 'Not a member of this league' (or return null / exception — product choice)
insert on conflict do nothing
select first_joined_at
update memberships.joined_at when present (already gated)
return first_joined_at
```

### 4.2 Grants

- `REVOKE ALL … FROM PUBLIC`  
- `REVOKE ALL … FROM anon`  
- `GRANT EXECUTE … TO authenticated`  

### 4.3 Client INSERT policy (defense in depth)

Tighten `"Users insert own first join"` **or** drop client insert and force RPC-only (like D-02):

**Recommended:** require membership in WITH CHECK:

```sql
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.memberships m
    where m.league_id = league_first_joins.league_id
      and m.user_id = auth.uid()
  )
);
```

### 4.4 App (optional same release)

- Remove direct-insert fallback in `recordLeagueFirstJoin` after RPC is trusted (honest failure if RPC down).  
- Keep call order: membership first.

### 4.5 Explicit non-scope

- No DELETE of historical first-join rows  
- No H-01 global grant sweep  
- No D1B/D1C/postseason  
- No leave/rejoin product change (still permanent first join)

---

## 5. Exact affected files

### This REVIEW-ONLY package

| File | Role |
|------|------|
| `docs/D-03-RECORD-LEAGUE-FIRST-JOIN-REMEDIATION.md` | This design |
| `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql` | Proposed SQL |
| `supabase/D-03-preflight-SELECT-ONLY.sql` | Orphan inventory + function/grants catalog |
| `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md` | Status pointer |

### On authorized apply

| Object | Change |
|--------|--------|
| `record_league_first_join` | CREATE OR REPLACE + membership EXISTS |
| EXECUTE grants | REVOKE PUBLIC/anon; GRANT authenticated |
| INSERT policy on `league_first_joins` | Membership-correlated WITH CHECK |

### Optional later app

| File | Change |
|------|--------|
| `src/lib/cloud.ts` | Remove direct insert fallback |

---

## 6. REVIEW-ONLY SQL proposal

See `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql`.

**Does not:** delete/update historical first-join data; change PK; change app.

---

## 7. Test plan

### Preflight (SELECT)

- Function def + grants  
- Policies on `league_first_joins`  
- Orphan inventory A/B  
- Confirm `is_league` membership exists for sample join path  

### Behavioral (disposable league / user)

| # | Scenario | Expect |
|---|----------|--------|
| T1 | Unauthenticated RPC | Deny |
| T2 | Auth, no membership, random league | Deny; no new row |
| T3 | Auth, member, first stamp | Insert; returns timestamp |
| T4 | Auth, member, second stamp | Same `first_joined_at`; no overwrite |
| T5 | `p_user_id` other user | Deny |
| T6 | `p_user_id` null / self | OK when member |
| T7 | Create league flow (mem then stamp) | OK |
| T8 | Join flow (mem then stamp) | OK |
| T9 | Direct insert without membership | Deny after policy tighten |
| T10 | anon EXECUTE | Absent preferred |

### Post-verify

Body contains membership EXISTS; grants lack anon/PUBLIC; insert policy has membership.

---

## 8. Product decisions for Mike

| # | Decision | Recommendation |
|---|----------|----------------|
| **P1** | Fail mode when not a member: `raise exception` vs soft null? | **Raise** (clear; app already try/catch optional) |
| **P2** | Keep `p_user_id` for PostgREST compat? | **Yes** — must equal `auth.uid()` or null |
| **P3** | Close client insert / require membership on INSERT policy? | **Yes** membership WITH CHECK (or RPC-only) |
| **P4** | Remove app direct-insert fallback same release? | Prefer **SQL first**, app fallback removal next (like D-02 P7) |
| **P5** | Historical orphans | **No delete** in D-03; inventory only; leavers are valid |
| **P6** | Should first-join be allowed for left members re-stamping without re-join? | **No** — must re-join (membership) first; existing row already permanent |

---

## 9. Authorization gate

| Item | Status |
|------|--------|
| Design | This document |
| SQL | `supabase/D-03-record-league-first-join-REVIEW-ONLY.sql` |
| Apply | **Blocked** |
| Production | Unchanged by this package |

---

*End D-03 REVIEW ONLY.*
