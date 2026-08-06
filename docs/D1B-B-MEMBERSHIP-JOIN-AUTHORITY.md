# D1B-B — Membership join authority

**Status:** **LIVE PREFLIGHT COMPLETE / DEFECT CONFIRMED / SCOPE EXPANDED / PRODUCT + TECHNICAL FREEZE REQUIRED / NOT REPAIRED**  
**Apply:** **NOT AUTHORIZED** · **no production SQL** · **no executable join RPC package yet**  
**Date:** 2026-08-06  
**Live preflight archive:** `docs/D1B-B-PREFLIGHT-AND-DESIGN-SCOPE.md` §0  

---

## Classification

```text
D1B-B:
LIVE DEFECT CONFIRMED / AUTHORIZATION SURFACE BROADER THAN ORIGINAL JOIN-ONLY DESIGN /
PRODUCT + TECHNICAL FREEZE REQUIRED / NOT REPAIRED
```

**Data:** clean (role/commissioner integrity). **Authorization surface:** broader than join-only.

---

## Priority

After D1B-A + D1B-C (structurally repaired). Larger coordinated track.

| Later (not bundled) |
|---------------------|
| H-01A / H-01B |
| Disposable behavioral D-01–D-03 |
| D1C parked |

Connected Supabase for SELECT-only and later authorized migrations (no manual paste when available).

---

## Live findings (summary)

| Surface | Live defect |
|---------|-------------|
| `"Memberships insert own"` | `user_id = auth.uid()` only — caller may set role/bot/staff/division/scores |
| `"Memberships update by commissioner or self"` | Self OR commissioner; **WITH CHECK null** — row-wide self-update |
| `"Leagues readable authenticated"` | `USING true` — **all join codes** readable to any authenticated user |
| `"Users create leagues"` | Create not atomic with commissioner seat |
| Capacity | **No** server max_members column; one league has **33** seats |
| Join RPCs | **None** (only `record_league_first_join` for history) |

Full evidence: preflight scope doc §0.

---

## Product + technical decision table (B1–B6)

| ID | Topic | Recommendation |
|----|--------|----------------|
| **B1** | Membership creation | RPC-only after cutover: create+commissioner · join-by-code · join-open-by-id |
| **B2** | Capacity | Server-owned per-league `max_members` (or explicit global rule); freeze bot vs human accounting; concurrency-safe last seat |
| **B3** | Code privacy / discovery | Codes not general SELECT; DEFINER join-by-code; safe open list without codes; tighten leagues SELECT only after app map |
| **B4** | Membership UPDATE | No broad player self-update; narrow preference fields only; role/staff/bot/scores server/commish |
| **B5** | Atomic create | League + commissioner membership in one TX |
| **B6** | Cutover order | RPCs → app → drop INSERT → narrow UPDATE → tighten code visibility (see phased plan) |

Mike must freeze these before any REVIEW-ONLY production SQL is authored.

---

## Revised architecture (phased)

### Phase 1 — Three creation RPCs (still required)

1. **Create league + commissioner seat** (atomic)  
2. **Join by code** (DEFINER code resolution; force player defaults)  
3. **Join open by UUID** (`is_open` + capacity + same defaults)  

Server forces: `role=player` (except create commissioner), `is_bot=false`, staff flags false, controlled stats/division.

### Phase 2 — App cutover

`join/page.tsx`, `open-room.ts`, `sport-pool.ts` (+ any other membership insert/update sites).

### Phase 3 — Restrict INSERT

Remove authenticated self-INSERT; keep bot DEFINER seed.

### Phase 4 — Narrow UPDATE

Separate design/apply OK; do not fold silently into join-only migration.

### Phase 5 — Discovery / code privacy

Safe open listing; then leagues SELECT tighten.

### Phase 6 — Capacity column (if B2 requires)

Backfill + RPC enforcement; interpret 33-seat league under product law.

**Binding:** Never drop membership INSERT before RPCs and app are green.

---

## Compatibility / future test matrix

| Case | Expect |
|------|--------|
| Create league | Commissioner seated atomically |
| Join valid code | Seated; no privilege self-assign |
| Join bad code | Error |
| Join full | Error per B2 |
| Rejoin | Idempotent |
| Open UUID when open | Seated |
| Open UUID when closed | Error |
| Self-INSERT with role=commissioner | Denied after cutover |
| Self-UPDATE role/scores | Denied after Phase 4 |
| List leagues as authenticated | No closed codes after Phase 5 |
| Bot seed | Still works |
| Capacity race | Safe under B2 |

---

## Exact app files affected (eventual)

| File | Change type |
|------|-------------|
| `src/app/join/page.tsx` | Create + join-by-code → RPC |
| `src/lib/open-room.ts` | Seat → open RPC |
| `src/lib/sport-pool.ts` | Multi-seat → server-only |
| League list / discovery callers | Map before SELECT tighten |
| Membership preference updates | Narrow RPC/policy |

---

## Explicit non-actions now

- No executable join/UPDATE/SELECT SQL  
- No membership INSERT/UPDATE removal  
- No app deploy  
- No production apply  
- No H-01 / D1C bundling  

---

*End D1B-B architecture (reconciled with live preflight).*
