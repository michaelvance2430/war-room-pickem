# D1B-B — Application cutover (review / implementation phase)

**Date:** 2026-08-06  
**Package commit (SQL):** `20cfd5c`  
**Phase:** Application wrappers + ordinary human flow cutover in repo  

### Binding classification

```text
D1B-B APP CUTOVER IN PROGRESS /
DATABASE PACKAGE PASS /
PRODUCTION UNCHANGED /
FILE 07 NOT AUTHORIZED /
NOT YET REPAIRED
```

### Explicit non-actions (this phase)

| Action | Status |
|--------|--------|
| Production SQL applied | **NO** |
| Production schema / policies / grants / functions / data | **UNCHANGED** |
| Application deployed to production | **NO** |
| File 07 applied | **NO** |
| Membership INSERT policy removed | **NO** |
| D1B-A / D1B-C / D1C / H-01 | **UNTOUCHED** |

---

## 1. Before / after call-site map

### 1.1 Ordinary human membership creation

| ID | Surface | Before | After (this phase) |
|----|---------|--------|--------------------|
| I1 / L1 | `src/app/join/page.tsx` `handleCreate` | Direct `leagues.insert` + `memberships.insert` (role=commissioner) + client `recordLeagueFirstJoin` | **`create_league_with_commissioner_seat` RPC** via `createLeagueWithCommissionerSeat`; first-join inside RPC; session hydrate via `fetchLeagueRowForMember` |
| I2 | `src/app/join/page.tsx` `handleJoin` | Browser `leagues.select * by code` → capacity → division → client Fair Entry → `memberships.insert` → `recordLeagueFirstJoin` | **`join_league_by_code` RPC** via `joinLeagueByCode`; FE + first-join + capacity inside RPC; member hydrate by id |
| I3 | `src/lib/open-room.ts` `seatPlayerInLeague` | Direct capacity/div/FE + `memberships.insert` | **`join_open_league_by_id` RPC** via `joinOpenLeagueById` |
| S1 | `src/lib/open-room.ts` `listOpenRooms` | `leagues.select` including **`code`** + client membership counts | **`list_open_leagues_public` RPC** — **no codes**, human counts / seats_left server-side |

### 1.2 Still direct INSERT (intentionally not ordinary cutover)

| ID | Surface | Status |
|----|---------|--------|
| I4 / L2 | `src/lib/sport-pool.ts` `spinUpLeagueFromPoll` | **Privileged multi-seat** — mapped; **not** cut over; proposed DEFINER path below |
| Bots | `seed_trial_bots` / Foundry | Unchanged DEFINER / ops |

### 1.3 Fair Entry writers

| Surface | Before | After |
|---------|--------|-------|
| Join-by-code / open-join | Client `resolveFairEntryForJoin` + INSERT/UPDATE points | **Server** `d1b_b_fair_entry_points` inside join RPCs |
| `applyFairEntryToMembership` | Client UPDATE total_points | **Not used** by ordinary cutover; retained for sport-pool / legacy only |
| FE notice chrome | Client mark after points known | Still client **notice only** using RPC `total_points` |

### 1.4 `record_league_first_join`

| Surface | After |
|---------|--------|
| Ordinary create / join-by-code / join-open | Called **inside** D1B-B RPCs (R4 — failure rolls back) |
| Client rejoin paths | No longer required for ordinary join; rejoin is idempotent on membership |
| `cloud.recordLeagueFirstJoin` | Remains for other surfaces; not the join authority |

### 1.5 League code exposure

| Surface | Before | After |
|---------|--------|-------|
| Open discovery list | Selected and stored `code` on `OpenRoomListing` | **Removed** from listing type + RPC payload |
| Open-room UI cards | Name + counts (code not rendered, but present in state) | Counts only; **no code in listing state** |
| Join-by-code input | User supplies code | Unchanged (private input) |
| Member session after seat | Code in session for invite | **OK** — member-scoped hydrate by league id after seat |
| Commissioner invite UI | Shows own code | Unchanged |
| Founder health | May show codes for ops | Unchanged (Founder scoped — not public discovery) |

### 1.6 New module

| File | Role |
|------|------|
| `src/lib/d1b-b-membership.ts` | Wrappers: create / join-by-code / join-open / list-open + error map + member hydrate |

---

## 2. Changed-file list (application)

| File | Change |
|------|--------|
| `src/lib/d1b-b-membership.ts` | **NEW** — RPC wrappers + error mapping |
| `src/app/join/page.tsx` | Create + join-by-code cut over to RPCs |
| `src/lib/open-room.ts` | List + seat cut over; listing type drops `code` / `commissionerId` |
| `src/app/open-room/page.tsx` | Display uses `maxHumanMembers` when present |
| `src/lib/sport-pool.ts` | Authority comments only (no ordinary cutover) |
| `src/lib/fair-entry.ts` | Comment: do not use client apply on ordinary join |
| `docs/D1B-B-APP-CUTOVER.md` | **NEW** — this document |
| `docs/D1B-B-FAIR-ENTRY-LIFECYCLE.md` | **NEW** — freeze retention design |
| `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md` | Status pointer (if updated) |
| `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md` | Classification update |
| `docs/D1B-B-DISPOSABLE-BASELINE-AND-HARNESS.md` | Cutover status pointer |

---

## 3. Application error mapping

| Server (`d1b_b:<code>`) | User-facing message |
|-------------------------|---------------------|
| `not_authenticated` | Sign in to continue. |
| `invalid_code` | Invalid league code |
| `league_full` | `leagueFullMessage()` (existing product copy) |
| `not_open` | That room isn’t open for matchmaking… |
| `not_found` | Context: open join → room vanished; else League not found. |
| `validation_failed` + `name` | Name your room… |
| `validation_failed` + `sport` | Pick a live sport (CFB or NFL)… |
| `validation_failed` + `cut_percent` | Cut percent must be between 10 and 75. |
| `validation_failed` (other) | Create: could not create… / generic |
| RPC missing (`PGRST202`) | Clear “D1B-B RPCs not installed” message (disposable/prod gate) |

Navigation preserved:

| Flow | After success |
|------|----------------|
| Create | `/league-build?new=1` (+ `&open=1` if listed open) |
| Join by code | `/` or sport allegiance gate |
| Open seat | `/` or sport allegiance gate (existing delay) |

---

## 4. Sport-pool — authority map + proposed privileged path

### Actual authority today

| Step | Who | Mechanism |
|------|-----|-----------|
| Open poll | Source-league commissioner | Insert poll row |
| Vote | Humans (and bots in pool) | Vote rows |
| Spin-up | Poll commissioner only | Direct `leagues.insert` + **N×** `memberships.insert` for yes-voters; optional `commissioner_id` transfer |

This seats **other users**, not only `auth.uid()`. Ordinary join RPCs **must not** accept arbitrary user_id lists.

### Proposed narrow path (design only — not implemented)

```text
spin_up_sport_pool_league(p_poll_id uuid, p_new_commissioner_id uuid default null)
```

| Rule | Law |
|------|-----|
| Auth | `auth.uid()` = poll.commissioner_id |
| Inputs | poll id; optional new commissioner **must be a yes-voter** |
| Seats | Only yes-voters ∪ host; forced roles/defaults; human capacity |
| Not allowed | Arbitrary UUID seating, bot flags from client, open code list |
| Grants | authenticated EXECUTE; body enforces commissioner |
| Ordinary RPCs | Unchanged — no privileged params added |

Until that RPC exists and is verified: **keep** `spinUpLeagueFromPoll` client path; treat as residual privileged INSERT.

---

## 5. Fair Entry freeze lifecycle

See **`docs/D1B-B-FAIR-ENTRY-LIFECYCLE.md`**.

Summary:

- Season isolation already proven on disposable package.
- Freezes are **retained** across seasons unless a future authorized archive job runs.
- **No** automatic destructive cleanup in app cutover.
- **No** production data mutation in this phase.

---

## 6. Rollback plan

| Layer | Rollback |
|-------|----------|
| App only (SQL never applied) | Redeploy prior app revision; production still has legacy INSERT policies |
| App + disposable SQL | App rollback + disposable branch delete; prod untouched |
| After future prod RPC apply, before INSERT drop | Redeploy prior app; legacy INSERT still works |
| After INSERT policy drop (file 07 — **not now**) | Restore `"Memberships insert own"` from archive **only with Mike auth** |
| File 07 | **Never auto-apply**; not part of this phase |

Prefer reverse order of B6 stages.

---

## 7. Disposable application test plan

**Environment:** Fresh empty Supabase branch + D1B-B package `00→00b→01→02→02b→03→04→05→06` (never 07). Point a **local** app build at branch URL/keys.

| ID | Case | Expect |
|----|------|--------|
| A1 | Create league (CFB) | Commissioner seat; code returned; land league-build |
| A2 | Create listed open | `is_open` true; appears in open list **without code** |
| A3 | Join valid code | Player seat; forced defaults; first-join row |
| A4 | Rejoin same code | Idempotent; no second membership |
| A5 | Invalid code | `Invalid league code` |
| A6 | Full league final seat race | Already DB-proven; app still maps `league_full` |
| A7 | Open list | Cards: name + seats; **no code** in network/UI state |
| A8 | Open claim | Seated; session has code only after member hydrate |
| A9 | FE mid-season join | Notice may show; points from server |
| A10 | Sport-pool spin | Still works via legacy path (privileged) |
| A11 | Source audit | Ordinary create/join/open: no `memberships.insert` |
| A12 | RPC missing | Friendly rpc_unavailable — no silent direct INSERT |

**Do not claim REPAIRED until A1–A9 + A11 pass on disposable.**

---

## 8. Production sequencing proposal

```text
1. Disposable app verification (this plan)     ← next
2. Explicit Mike auth: apply REVIEW-ONLY 01–06 on production (stage-6)
3. Deploy app cutover (this branch) to production
4. Confirm live traffic hits RPCs (logs / PostgREST)
5. Disposable re-verify + smoke create/join/open
6. Separate auth: file 07 / INSERT deny (only after green)
7. Later: sport-pool DEFINER; UPDATE narrow; leagues SELECT tighten
```

**Never** apply file 07 before RPC + app cutover is green.  
**Never** bundle sport-pool redesign into ordinary join RPCs.

---

## 9. Blockers and unresolved decisions

| # | Item | Status |
|---|------|--------|
| B1 | Production does **not** have D1B-B RPCs yet | **Blocker for prod deploy** |
| B2 | App create/join/open **require** RPCs (no legacy INSERT fallback) | Intentional; deploy only after stage-6 SQL |
| B3 | Sport-pool multi-seat still direct INSERT | **Accepted residual** until privileged RPC |
| B4 | Member league SELECT still uses broad authenticated leagues policy | OK until B3 SELECT tighten phase |
| B5 | `max_human_members` not on production until SQL apply | RPC create requires it |
| B6 | Season-reset freeze archive job | Design only — see lifecycle doc |
| B7 | Disposable app E2E not yet executed in this session | **Required before repair claim** |
| B8 | File 07 | **Not authorized** |
| B9 | Client `applyFairEntryToMembership` still exists | Must not be wired into ordinary join |

---

## 10. Source-audit expectations (this phase)

| Check | Expectation after this cutover |
|-------|--------------------------------|
| Ordinary `handleCreate` / `handleJoin` / `seatPlayerInLeague` | **No** `memberships.insert` |
| `listOpenRooms` | **No** `code` in select or listing type |
| `sport-pool` spin-up | Still may INSERT (privileged residual) |
| Production DB | Unchanged |

---

## 11. Related archives

- Product decisions + original map: `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md`
- Run 2 sequential: `docs/D1B-B-DISPOSABLE-RUN-2-EVIDENCE.md`
- Run 3 final-seat race: `docs/D1B-B-DISPOSABLE-RUN-3-FINAL-SEAT-RACE-EVIDENCE.md`
- Fair Entry lifecycle: `docs/D1B-B-FAIR-ENTRY-LIFECYCLE.md`
- Defect register: `docs/STRUCTURAL-SECURITY-DEFECT-REGISTER.md`
