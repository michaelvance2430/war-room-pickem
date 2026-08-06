# D1B-B — Membership/Join Authority: Preflight & Design Scope

**Status:** **REVIEW + PREFLIGHT PACKAGE READY / AWAIT LIVE SELECT PREFLIGHT / NO PRODUCTION CHANGES / NOT REPAIRED**  
**Date:** 2026-08-06  
**Architecture:** `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md`  
**Preflight SQL:** `supabase/D1B-B-preflight-SELECT-ONLY.sql`  

### Program position

| Track | Relation |
|-------|----------|
| **D1B-A** | Done — picks manage-own membership correlation |
| **D1B-C** | Done — achievements SELECT correlation |
| **D1B-B** | **Next** — larger coordinated RPC + RLS + app work |
| **H-01A / H-01B** | After D1B-B design freeze (or parallel when ready) |
| **D-01–D-03 behavioral** | Disposable identities only |
| **D1C** | Parked |

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Create join RPCs | **No** |
| Drop/restrict membership INSERT policy | **No** |
| App code changes / deploy | **No** |
| Historical membership mutation | **No** |
| Bundle with H-01 / D1C | **No** |
| Production apply of any kind | **No** |

**Connected Supabase path:** Prefer SELECT-only preflight via the connected production project (no manual paste required when that path is available).

---

## 1. Why D1B-B is larger than A/C

| Dimension | D1B-A / D1B-C | D1B-B |
|-----------|---------------|--------|
| Objects | 1–2 RLS policies | Policies **+** new RPCs **+** multi-file app |
| Risk if rushed | Write/read isolation | **Breaks all join/create flows** if INSERT removed first |
| Server enforcement today | Missing membership on picks / tautology on achievements | Join-by-code + open-room rules are **browser-only** |
| Rollback | Re-drop/recreate policy | App + RPC + policy must roll together |

**Rule:** Do **not** remove `"Users insert own membership"` until replacement RPCs are live and app is switched.

---

## 2. Confirmed defect (design + static call sites)

### Database

| Surface | Problem |
|---------|---------|
| `"Users insert own membership"` (schema) | `WITH CHECK (auth.uid() = user_id)` only — any authenticated user may self-INSERT for **any** `league_id` they know |
| No DB check | League code validity |
| No DB check | `leagues.is_open` on open-room seat |
| No DB check | Capacity 32 (except optional DB check constraints if present — preflight must confirm) |

### App (static)

| Path | File | Behavior |
|------|------|----------|
| Create league + commissioner seat | `src/app/join/page.tsx` | Client INSERT `leagues` then `memberships` |
| Join by code | `src/app/join/page.tsx` ~473–565 | Client SELECT league by `code`; capacity/division/fair-entry in browser; direct `memberships` INSERT |
| Open-room seat | `src/lib/open-room.ts` `seatPlayerInLeague` ~141–270 | Client SELECT by UUID; **UI may filter open** but INSERT does **not** re-require `is_open` at RLS |
| Sport-pool multi-seat | `src/lib/sport-pool.ts` ~529 | Client `memberships` INSERT for seating |
| First-join stamp | `record_league_first_join` | Already D-03 gated with `is_league_member` (after seat) |
| Bots | `seed_trial_bots` DEFINER | Preserve; separate from human join |

**Attack / misuse class (authorization, not proof of exploit):** Authenticated caller with a leaked/guessed league UUID can attempt self-INSERT without code or open-room product gates.

---

## 3. Target architecture (unchanged — three RPCs)

Do **not** implement in this package. Design freeze still needs product B1–B4.

| RPC (conceptual) | Enforces |
|------------------|----------|
| `create_league_with_commissioner_seat` | Auth; commissioner seat in one TX |
| `join_league_by_code` | Code server-side; capacity; rejoin idempotent; fair-entry server-side (prefer) |
| `join_open_league_by_id` | `is_open = true`; capacity; rejoin; no closed UUID seat |

**After RPCs + app green:** restrict client membership INSERT (drop or deny for authenticated except DEFINER paths).

---

## 4. Live preflight goals (SELECT-only)

Run `supabase/D1B-B-preflight-SELECT-ONLY.sql` on connected production:

1. Full `memberships` policy catalog  
2. Exact INSERT policy name + `with_check` / `qual`  
3. RLS on `memberships` / `leagues`  
4. Unique `(league_id, user_id)` and FKs  
5. Whether `is_open` column exists and null rates  
6. Aggregate membership/league counts (no PII lists)  
7. Leagues over 32 members (if any)  
8. Existing join-like RPCs (`seed_trial_bots`, `record_league_first_join`, …)  
9. Confirm D1B-B join RPCs **absent**  
10. Table/EXECUTE grant inventory (H-01 separate)  

### Stop conditions before any future apply design freeze

- Unexpected INSERT policy names (multiple self-INSERT paths)  
- Missing unique `(league_id, user_id)`  
- Missing `is_open` when open-room product depends on it  
- Capacity already enforced only in a way that conflicts with RPC design  

### Historical inventory rule

Evidence only — **no DELETE/UPDATE** of memberships.

---

## 5. Product decisions still open (B1–B4)

| # | Decision | Recommendation |
|---|----------|----------------|
| **B1** | Exact RPC names / arg shapes | Freeze before SQL authoring |
| **B2** | Fair-entry points in RPC vs client | **Server-side** (match current browser logic, no client trust) |
| **B3** | Auto-unlist full open rooms in RPC | Optional; app already best-effort sets `is_open=false` |
| **B4** | Sport-pool seating | **Service_role / DEFINER server-only**, not browser multi-insert |

---

## 6. Eventual file inventory (not now)

| Layer | Objects / files |
|-------|-----------------|
| SQL | Three RPCs; later membership INSERT policy change |
| App | `join/page.tsx`, `open-room.ts`, `sport-pool.ts` |
| Preserve | `seed_trial_bots`, leave/delete paths (separate), D1B-A/C policies |

---

## 7. Sequencing after live preflight

```text
1. Archive live preflight results (this doc §0 when filled)
2. Freeze B1–B4 product decisions
3. Author REVIEW-ONLY RPC SQL (still non-apply until Mike auth)
4. Ephemeral / disposable test of RPCs + app dual-path
5. App PR to call RPCs
6. Restrict client membership INSERT (separate auth)
7. Post-verify + rollback plan
```

**Never** do step 6 before 5 is green.

---

## 8. Status declarations

| Statement | True? |
|-----------|-------|
| Production changed by this package | **No** |
| D1B-B repaired | **No** |
| D1B-A / D1B-C still repaired | **Yes** |
| H-01 / D1C touched | **No** |
| Live preflight executed (this docs commit) | **Await operator / connected path** |

---

## 9. Gray box — live preflight results (for archive)

```text
D1B-B LIVE PREFLIGHT RESULTS

Environment: production Supabase connected project
Project: war-room-pickem
SELECT-only: YES
SQL mutations: NO

P1 memberships policies: (paste names + cmd)
P2/P3 INSERT policy name + with_check:
P4 RLS memberships/leagues:
P5 unique (league_id, user_id): yes/no
P6 indexes:
P7 is_open column present: yes/no
P8 counts memberships / leagues / open / closed:
P9 orphan memberships league/profile: 
P10 leagues_over_32: 
P11 open_null count:
P12 join-related functions present:
P15 D1B-B RPCs absent: yes/no (expected yes)

Operator verdict: PREFLIGHT PASS / DRIFT / STOP
```
