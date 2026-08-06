# D1B-B — Membership join authority

**Status:** **CONFIRMED HIGH AUTHORIZATION DEFECT / COORDINATED DESIGN REQUIRED**  
**Apply:** **NOT AUTHORIZED** · **no executable join SQL in this package**  
**Date:** 2026-08-06  

---

## Locked findings

- Direct authenticated `memberships` INSERT is the **product join mechanism**.  
- Join-by-code validation is **browser-only** (`leagues` by `code`).  
- Open-room seats by **league UUID** + capacity; **does not enforce `is_open` at DB write**.  
- Authenticated caller with a UUID can attempt self-INSERT outside intended UI (RLS self-only).  
- Removing direct INSERT **now** breaks create, join-by-code, open-room, rejoin, sport-pool seating.  
- No historical membership mutation.  
- Guarded bot RPCs (`seed_trial_bots`) preserved.

---

## Architecture — three narrow transactional RPCs (recommended)

**Do not** use one mode-switching mega-RPC.

### A. `create_league_with_commissioner_seat` (name TBD)

```
auth.uid() required
INPUT: league settings + sport_id (immutable at insert)
TX:
  INSERT leagues (…) commissioner_id = auth.uid()
  INSERT memberships (league_id, auth.uid(), role=commissioner, division=…)
  optional: record first join (after seat)
RETURN: league_id, code
```

| Concern | Rule |
|---------|------|
| Auth | Authenticated only |
| Duplicate | Unique code; fail closed |
| Rollback | Single transaction |
| App files | `src/app/join/page.tsx` create path (~200–350) |

### B. `join_league_by_code`

```
auth.uid() required
INPUT: p_code text (normalized upper)
TX:
  SELECT league FOR keyshare by code
  IF not found → error
  IF full → error
  IF already member → return existing (rejoin/idempotent)
  ELSE INSERT membership player + division + fair-entry points as today
  optional first-join stamp
RETURN: league_id, role, …
```

| Concern | Rule |
|---------|------|
| Code validation | **Server-side only** (not browser alone) |
| Capacity | Server count vs max 32 |
| Rejoin | Unique (league_id, user_id) → no-op / return existing |
| App files | `src/app/join/page.tsx` join path (~473–565) |

### C. `join_open_league_by_id`

```
auth.uid() required
INPUT: p_league_id uuid
TX:
  SELECT league WHERE id = p_league_id
  IF not found → error
  IF is_open is not true → error (server-side closed-league)
  IF full → error (optionally auto-unlist)
  IF already member → return existing
  ELSE INSERT membership …
RETURN: …
```

| Concern | Rule |
|---------|------|
| UUID bypass | **Blocked** without `is_open` |
| Capacity | Same as code join |
| App files | `src/lib/open-room.ts` `seatPlayerInLeague` (~141–270) |

### Sport-pool / multi-seat

- Seating **other** user IDs must be **service_role / security definer server-only** path (cron or edge with service key), **not** browser self-INSERT loop for others.  
- File: `src/lib/sport-pool.ts` (~529–536).

---

## After RPCs verified

1. Drop or restrict `"Users insert own membership"` (self INSERT) for clients.  
2. Keep bot DEFINER seed paths.  
3. App: replace direct inserts with RPC calls; remove insecure fallbacks only after RPC green.  
4. Rollback: re-enable self INSERT policy; drop RPCs if needed (prefer leave RPCs).

---

## Compatibility / test matrix (future)

| Case | Expect |
|------|--------|
| Create league | Commissioner seated in TX |
| Join valid code | Seated |
| Join bad code | Error |
| Join full | Error |
| Rejoin | Idempotent |
| Open UUID when open | Seated |
| Open UUID when closed | Error |
| Capacity race | One fails on unique/capacity |
| Bot seed | Still works |

---

## Exact app files affected (eventual)

| File | Change type |
|------|-------------|
| `src/app/join/page.tsx` | Create + join-by-code → RPC |
| `src/lib/open-room.ts` | Seat → RPC with server is_open |
| `src/lib/sport-pool.ts` | Multi-seat → server-only |
| Possibly `src/lib/session-restore.ts` | Leave stays client delete (or later RPC) |
| New SQL | Three RPCs + membership INSERT policy change (**not in this package**) |

---

## Product decisions (open until design freeze)

| # | Decision |
|---|----------|
| B1 | Exact RPC names / arg shapes |
| B2 | Fair-entry points computed in RPC vs client-passed (prefer server) |
| B3 | Auto-unlist full open rooms inside RPC? |
| B4 | Sport-pool seating authority (service only) |

---

## Explicit non-actions now

- No executable join SQL  
- No membership INSERT removal  
- No app deploy  
- No bundling with D1B-A/C apply  

---

*End D1B-B architecture design.*
