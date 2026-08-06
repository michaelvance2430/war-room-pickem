# D1B-B — REVIEW-ONLY SQL package

**Status:** **REVIEW-ONLY SQL AUTHORED / NO PRODUCTION APPLY / NOT REPAIRED**  
**Date:** 2026-08-06  
**Authorization:** `D1B-B REVIEW-ONLY SQL package authorized — no production apply`  
**Product freeze:** B1–B6 — `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md`  
**SQL root:** `supabase/review-only/D1B-B/`  

### Explicit non-actions

| Action | Status |
|--------|--------|
| Production apply of any file | **No** |
| Live RPC creation | **No** |
| Live policy change | **No** |
| Live `max_human_members` backfill | **No** |
| App deploy | **No** |
| D1C / H-01 | **No** |

---

## 1. Package inventory

| File | Contents |
|------|----------|
| `00-README.md` | Gate + stage rules |
| `01-schema-max-human-members.sql` | Column, check, backfill proposal |
| `02-helpers.sql` | Errors, human count, division, code gen, fair-entry stub |
| `03-rpc-create-league.sql` | `create_league_with_commissioner_seat` |
| `04-rpc-join-by-code.sql` | `join_league_by_code` + `FOR UPDATE` capacity |
| `05-rpc-join-open.sql` | `join_open_league_by_id` + `is_open` |
| `06-rpc-list-open-leagues.sql` | `list_open_leagues_public` (**no codes**) |
| `07-policy-transitions-FUTURE.sql` | Stages 10/12/14 sketches (commented) |
| `08-preflight-SELECT-ONLY.sql` | Pre-stage catalog |
| `09-disposable-test-harness.sql` | Ephemeral only |
| `10-postverify-SELECT-ONLY.sql` | Post-stage verify |
| `11-rollback-scripts.sql` | Per-stage rollback sketches |

---

## 2. Schema: `max_human_members`

| Item | Design |
|------|--------|
| Table | `public.leagues` |
| Column | `max_human_members integer` |
| Default law | **32** |
| Check | 2–64 when not null |
| Backfill | `UPDATE … SET max_human_members = 32 WHERE NULL` (separate review when applying) |
| Counting | `d1b_b_human_member_count` = rows with `coalesce(is_bot,false)=false` |
| Bots | Excluded from human cap |
| 33-total seat league | Valid if humans ≤ max |

---

## 3. Three transactional RPCs

| RPC | Locks | Forces |
|-----|-------|--------|
| `create_league_with_commissioner_seat` | Single TX league+membership | role=commissioner, staff/bot false, stats 0 |
| `join_league_by_code` | `SELECT … FOR UPDATE` on league | role=player, staff/bot false, server division, fair-entry stub |
| `join_open_league_by_id` | `FOR UPDATE` + `is_open` | same player defaults; may set `is_open=false` when full |

### Error contract (`d1b_b:<code>`)

| Code | Meaning |
|------|---------|
| `not_authenticated` | No auth.uid() |
| `invalid_code` | Code missing/unknown |
| `not_found` | League UUID missing |
| `not_open` | Open join when not open |
| `league_full` | Human count ≥ max (incl. race) |
| `validation_failed` | Bad inputs / unique exhaustion |

### Concurrency (final seat)

1. `SELECT league FOR UPDATE`  
2. Count humans  
3. If `humans >= max` → `league_full`  
4. INSERT membership  
5. On `unique_violation` → rejoin if now member else `league_full`  

Exactly one winner for last human seat under row lock.

### Grants

- New RPCs: `REVOKE` PUBLIC + anon; `GRANT EXECUTE` to **authenticated** only  
- Helpers: not granted to clients (internal DEFINER)  
- Do not change `is_league_member` grants (H-01)

---

## 4. Safe open discovery

`list_open_leagues_public(p_sport_id, p_limit)` returns JSON rooms:

- id, name, sport_id, commissioner_id, created_at, open_listed_at  
- human_count, max_human_members, seats_left  
- **no `code`**

Filters: `is_open`, seats available, optional sport.

---

## 5. Future policy transitions (file 07 — later stages only)

| Stage | Change |
|-------|--------|
| **10** | Drop membership self-INSERT |
| **12** | Drop broad self-or-commish UPDATE; ops/commissioner paths via RPC |
| **14** | Replace leagues SELECT true with member/commissioner read |

**Never** apply 07 with first RPC apply.

---

## 6. Staged apply order (when authorized later)

```text
A. 08 preflight SELECT-only on prod
B. Disposable: 01–06 + 09 harness
C. Prod stage 6 (separate Mike auth): 01–06 only
D. 10 post-verify
E. App cutover
F. Disposable identity tests
G. Stage 10 INSERT remove (separate auth)
H. Stage 12 UPDATE (separate auth)
I. Stage 13–14 discovery + SELECT (separate auth)
```

---

## 7. Fair-entry note

`d1b_b_fair_entry_points` is a **stub returning 0**. Before mid-season production hardening, replace body with server band logic from `fair-entry` product (no client-trusted points).

---

## 8. Status

| Statement | True? |
|-----------|-------|
| REVIEW-ONLY SQL package exists | **Yes** |
| Production apply | **No** |
| D1B-B repaired | **No** |
| B1–B6 still locked | **Yes** |
