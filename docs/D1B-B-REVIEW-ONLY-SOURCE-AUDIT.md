# D1B-B — REVIEW-ONLY package source audit

**Date:** 2026-08-06  
**Package:** `supabase/review-only/D1B-B/`  
**Authorization:** Source audit + disposable design only — **no production apply**  
**Final classification:** **BLOCKED BY FAIR-ENTRY PARITY**  

### Explicit non-actions

| Action | Status |
|--------|--------|
| Production SQL / live RPCs / schema / policies | **No** |
| App deploy | **No** |
| Membership/league mutation | **No** |
| D1C / H-01 | **No** |

**D1B-B remains NOT REPAIRED.**

---

## Executive summary

| Area | Verdict |
|------|---------|
| Core join/create security shape (DEFINER, forced defaults, FOR UPDATE capacity, no privileged client columns) | **Largely sound** for disposable exercise |
| File 07 separation (no early INSERT/UPDATE/SELECT strip) | **PASS** |
| Concurrency final human seat | **PASS** (with notes) |
| Open discovery without codes | **PASS** |
| Fair-entry points vs live browser mid-season | **FAIL / production blocker** — stub returns 0 |
| App response-shape compatibility | **REVISION REQUIRED** (field names + create args + cut_percent) |
| Several SQL correctness nits | **REVISION REQUIRED** before any prod stage-6 |

**Overall:** Do **not** authorize production use of join RPCs until fair-entry server parity is implemented and proven. Package is **not** “disposable ready” for full mid-season parity tests without that design landed in SQL.

---

## 1. SQL correctness

### 1.1 Signatures & returns

| Function | Signature | Returns | Notes |
|----------|-----------|---------|--------|
| `create_league_with_commissioner_seat` | 7 args (name, sport, list_open, cb, week, cut_percent, max_human) | `json` | `p_cut_percent` **unused** in body |
| `join_league_by_code` | `(text)` | `json` | OK |
| `join_open_league_by_id` | `(uuid)` | `json` | OK |
| `list_open_leagues_public` | `(text, int)` | `json` | OK |
| Helpers | various | int/division/text/void | OK |

PostgREST: app must call with **named parameters** for create (many defaults). Overloads not defined — good.

### 1.2 SECURITY DEFINER / search_path

All create/join/list RPCs and capacity helpers: `SECURITY DEFINER` + `set search_path = public` — **PASS**.

`d1b_b_raise` marked `immutable` but raises exceptions — should be **`volatile`** (nit / revision).

### 1.3 Qualification

Membership inserts use explicit columns. League lock uses `public.leagues`. Helpers use qualified tables. **PASS** for forced inserts.

### 1.4 Grants

RPCs: `REVOKE` public + anon; `GRANT` authenticated — **PASS** intent.  
Helpers: revoke public only; not granted to authenticated — correct for internal use.  
Does not touch `is_league_member` grants — **PASS** (H-01 separate).

### 1.5 Transactions

PL/pgSQL function body is a single transaction with caller — **PASS**. Create inserts league then membership; failure after league rolls back both unless autonomous (none). **PASS** for atomic create.

### 1.6 Idempotent rejoin

Join paths: pre-check existing membership → success JSON `already_member: true`. Unique race → re-check membership. **PASS**.

### 1.7 Error contracts

Uses `d1b_b:<code>` via `P0001`. Codes: not_authenticated, invalid_code, not_found, not_open, league_full, validation_failed.  
**Note:** empty code and unknown code both `invalid_code` — good for not distinguishing existence of short codes; unknown code also `invalid_code` — **does not** distinguish “exists” for invalid vs missing beyond same code (good).

### 1.8 Ambiguous columns / variables

`join_league_by_code` unique_violation handler references `v_league` — only reached after league loaded — **OK**.  
Create unique_violation does not distinguish code vs other uniques — maps to validation_failed — **OK**.

### 1.9 Sport validation bug — **REVISION REQUIRED**

```sql
if v_sport not in ('cfb', 'nfl') then
  if v_sport is null or v_sport = '' then
    v_sport := 'cfb';
  end if;
end if;
```

Any non-empty sport outside `{cfb,nfl}` (e.g. `soccer_wwc`) is **accepted unchanged**. Should either allowlist all product sports or reject.

### 1.10 Rollback completeness

File 11 covers stage-6 drop RPCs/helpers; stage-10 restore INSERT; stage-12/14 restore policies.  
**Gap:** does not archive exact live policy text to restore (operator must pre-archive). Document as process requirement.

---

## 2. Concurrency

| Requirement | Assessment |
|-------------|------------|
| `SELECT … FOR UPDATE` on league before capacity | **PASS** (join-by-code, join-open) |
| Final seat → one membership | **PASS** under lock + unique (league_id, user_id) |
| Duplicate/retry → existing membership | **PASS** |
| Bots excluded from max_human_members | **PASS** (`is_bot = false` count) |
| Commissioner counts as human | **PASS** (not bot) |
| Deadlock / lock order | Single league row locked first; no multi-league locks — **low risk** |

Create path does not lock for capacity (new league empty) — **OK**.

---

## 3. Forced membership defaults

| Field | Create commissioner | Join player | Client can supply? |
|-------|---------------------|-------------|-------------------|
| user_id | auth.uid() | auth.uid() | **No** |
| role | commissioner | player | **No** |
| is_bot / is_deputy / is_moderator / locker_muted | false | false | **No** |
| total_points | 0 | fair-entry helper | **No** (but helper = stub) |
| weeks_played | 0 | 0 | **No** |
| division | North (create) | least-populated | **No** |
| joined_at | DB default `now()` | DB default | **No** (not explicitly set — OK if column default) |

**Other scoring columns** (weekly_points, ats_*, etc.): rely on table defaults — **PASS** if defaults are zero/empty (schema defaults exist).

**Caller privilege spoof:** no RPC params for privileged columns — **PASS**.

---

## 4. Atomic creation

| Check | Result |
|-------|--------|
| Auth required | **PASS** |
| Validate name / max | **PASS** |
| Unique private code | **PASS** (generate + unique constraint) |
| League + commissioner in one function TX | **PASS** |
| Force commissioner role | **PASS** |
| max_human_members range | **PASS** |
| Rollback both on failure | **PASS** (single TX) |
| Code collision | Retry in generator; unique_violation → error | **PASS** |
| cut_percent | **Not applied** — app may expect it — **REVISION** |
| Opening week | Caller-supplied p_current_week default 0 — app uses sport-specific opening week — **app must pass** |

---

## 5. Join-by-code privacy

| Check | Result |
|-------|--------|
| Does not use general SELECT of codes | **PASS** (DEFINER lookup) |
| Normalize upper/trim | **PASS** — matches app `code.trim().toUpperCase()` |
| Existence oracle | Same `invalid_code` for empty/missing — **PASS** |
| Locks league | **PASS** |
| Capacity transactional | **PASS** |
| Idempotent rejoin | **PASS** |
| Returns code on success | **OK** for joiner session (not bulk list) |

---

## 6. Open-league join

| Check | Result |
|-------|--------|
| FOR UPDATE | **PASS** |
| is_open = true | **PASS** (`is distinct from true`) |
| Capacity after lock | **PASS** |
| Closed/not-found/full | **PASS** |
| Already member | **PASS** (omits code in response — good) |
| Auto-unlist when full | **PASS** best-effort |

---

## 7. Safe discovery

| Check | Result |
|-------|--------|
| Never returns code | **PASS** |
| Approved fields only | **PASS** (id, name, sport, commissioner_id, times, counts) |
| is_open only | **PASS** |
| Capacity without identities | **PASS** (aggregates) |
| Does not rely on unrestricted client SELECT | **PASS** (DEFINER reads leagues) |

**Note:** Still exposes `commissioner_id` — approved as public display field? Mark as product-acceptable for open rooms (matches current open-room list).

---

## 8. Fair-entry — **PRODUCTION BLOCKER**

See **`docs/D1B-B-FAIR-ENTRY-SERVER-PARITY.md`**.

Stub `d1b_b_fair_entry_points` always returns **0**. Live app mid-season sets non-zero `total_points` via band percentile of human standings. **Do not approve production join RPC with stub.**

Division assignment is **separate** (least-populated) — implemented; do not conflate with fair-entry points.

---

## 9. App compatibility (no implement)

| Flow | Today | RPC package | Required app changes |
|------|-------|-------------|----------------------|
| Create `join/page.tsx` | leagues.insert + memberships.insert commissioner | `create_league_with_commissioner_seat` | Map name, sport_id, list_as_open, crystal_ball, **opening week**, max; handle json + `d1b_b:*` errors; then `set_my_league_display_name` nick; `writeSessionAndLeague` from response **code** |
| Join by code | select leagues by code + insert | `join_league_by_code` | Pass upper code; stop client capacity/division/fair-entry; session from response |
| Open room | seatPlayerInLeague insert | `join_open_league_by_id` | Stop client insert; list via `list_open_leagues_public` (**no code** — UI must not show code from list; invite code only after join via member fetch) |
| sport-pool | multi insert | **Out of scope / service path** — not covered by three human RPCs | Separate server seating later |
| record_league_first_join | client after insert | Called inside RPCs (swallowed if missing) | Remove redundant client call or keep idempotent |
| Session refresh | select memberships + leagues embed | Unchanged until SELECT tighten | Later: member-scoped league fetch including code |

**Open-room product break if discovery cutover early:** `listOpenRooms` currently returns `code` for display — B3 forbids codes in open discovery; UI must change before Stage 13/14.

---

## 10. File 07 — first-stage RPC migration safety

| Must not happen in stage-6 (01–06) | Confirmed |
|-----------------------------------|-----------|
| Remove membership INSERT | **Yes** — only in commented 07 stage 10 |
| Remove broad UPDATE | **Yes** — stage 12 comments |
| Tighten leagues SELECT | **Yes** — stage 14 comments |
| Change client behavior | **N/A** until app deploy |

**PASS** for separation.

---

## 11. Blocker list

| ID | Severity | Blocker |
|----|----------|---------|
| **FE-1** | **P0 production** | Fair-entry stub = 0; mid-season parity unproven |
| **SQL-1** | Medium | Sport allowlist logic accepts arbitrary non-empty sports |
| **SQL-2** | Low | `p_cut_percent` unused |
| **SQL-3** | Low | `d1b_b_raise` should be VOLATILE |
| **APP-1** | Medium | Create/join response mapping + error parsing |
| **APP-2** | Medium | Open-room UI uses `code` from list — conflicts with code-free discovery |
| **APP-3** | Medium | sport-pool multi-seat not in RPC set |
| **OPS-1** | Low | Rollback needs archived live policy text before stage 10/12/14 |

---

## 12. Final classification

```text
BLOCKED BY FAIR-ENTRY PARITY
```

Secondary: **REVISION REQUIRED** for SQL-1/SQL-2/SQL-3 and app contracts before production stage-6, even after fair-entry lands.

Disposable early-season-only testing (always 0 points) is possible **only** if explicitly scoped and not treated as mid-season parity certification.
