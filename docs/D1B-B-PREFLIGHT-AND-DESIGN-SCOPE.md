# D1B-B — Membership/Join Authority: Preflight & Design Scope

**Status:** **LIVE PREFLIGHT COMPLETE / B1–B6 LOCKED / CALL-SITE MAP COMPLETE / NOT REPAIRED / NO PRODUCTION SQL**  
**Date:** 2026-08-06  
**Architecture:** `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md`  
**Product freeze + call-site map + RPC contracts:** `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md`  
**Preflight SQL:** `supabase/D1B-B-preflight-SELECT-ONLY.sql`  

### Classification

```text
D1B-B:
LIVE DEFECT CONFIRMED / AUTHORIZATION SURFACE BROADER THAN ORIGINAL JOIN-ONLY DESIGN /
PRODUCT + TECHNICAL FREEZE REQUIRED / NOT REPAIRED
```

### Explicit non-actions (this archive and current phase)

| Action | Status |
|--------|--------|
| Author executable production join/apply SQL | **No** |
| Create join RPCs | **No** |
| Change membership INSERT/UPDATE policies | **No** |
| Change leagues SELECT | **No** |
| App changes / deploy | **No** |
| Historical membership/league mutation | **No** |
| Bundle H-01 / D1C / D1B-A/C | **No** |

**Production changed: NO.**

---

## 0. Fresh live preflight archive (production — SELECT-only)

**Execution:** Connected production Supabase · SELECT-only catalog and aggregates · no identities or join codes retrieved · no production SQL changes · no memberships/leagues/Auth/app modified.

### 0.1 Live schema

**`public.leagues`** includes: id, name, code, commissioner_id, sport/rules fields, `is_open`, `open_listed_at`, crystal-ball and presentation fields.

**Important:** No server-owned capacity column (`capacity` / `max_members` / `max_seats` / `member_limit`).

**`public.memberships`** includes: id, league_id, user_id, role, division, scoring/stat fields, joined_at, is_bot, is_moderator, locker_muted, is_deputy, display_name_override.

| Enum | Values |
|------|--------|
| `member_role` | commissioner, player |
| `division` | North, South, East, West |

### 0.2 RLS

| Table | enabled | forced |
|-------|---------|--------|
| `public.leagues` | true | false |
| `public.memberships` | true | false |

### 0.3 Membership INSERT defect — confirmed

| Field | Live |
|-------|------|
| Policy | `"Memberships insert own"` |
| Command | INSERT |
| Role | authenticated |
| WITH CHECK | `user_id = auth.uid()` |

**Finding:** Only proves the inserted user is the caller. Does **not** validate: join code, `is_open`, capacity, fair-entry, approved role, is_bot, is_deputy, is_moderator, division, scoring defaults, commissioner authority.

Because INSERT authorizes **rows** (not columns), an authenticated caller can attempt caller-selected values for all writable membership columns while satisfying `user_id = auth.uid()`.

**Scope expansion:** Broader than “join any league UUID” — includes **privilege and bot/staff flag self-assignment** and **scoring field injection** at insert time.

### 0.4 Membership UPDATE defect — coordinated scope required

| Field | Live |
|-------|------|
| Policy | `"Memberships update by commissioner or self"` |
| Command | UPDATE |
| USING | `user_id = auth.uid() OR is_league_commissioner(league_id)` |
| WITH CHECK | **null** |

**Finding:** Player self-update is **row-wide**. Does not independently protect role, league_id, is_bot, is_deputy, is_moderator, score/stat fields, division, joined_at.

**Do not** silently fold UPDATE repair into a join-only apply. Design must freeze which fields players may change.

| Likely player-owned (product) | Server / commissioner / ops |
|-------------------------------|-----------------------------|
| `display_name_override` | role, league_id, is_bot, is_deputy, is_moderator |
| possibly `locker_muted` (intent TBD) | scoring/stats, division (unless product says player), joined_at |

### 0.5 League code visibility

| Field | Live |
|-------|------|
| Policy | `"Leagues readable authenticated"` |
| Command | SELECT |
| USING | `true` |

**Finding:** Every authenticated user can query every league row, including **every join code**, unless another API layer intervenes. Join-by-code is **not** a DB-boundary secret today.

**Recommended direction (not applied):**

- Closed-league codes resolved inside SECURITY DEFINER join-by-code RPC  
- Open-league discovery via narrow RPC/view of **safe public fields only** (no code)  
- App cutover before tightening leagues SELECT  
- **Do not** alter leagues SELECT until app read paths are mapped  

### 0.6 League creation

| Field | Live |
|-------|------|
| Policy | `"Users create leagues"` |
| WITH CHECK | `auth.uid() = commissioner_id` |

**Finding:** League create and commissioner membership seat are **separate client operations** — not atomic. Create-league + commissioner seat RPC remains warranted. **Do not** remove client league INSERT until RPC + app cutover verified.

### 0.7 Open-room join

Live columns: `is_open`, `open_listed_at`.  
No join RPC performs server-side `is_open` check. Membership INSERT ignores `is_open`.  
Caller with league UUID can bypass browser open-room logic.

Open-room RPC must TX-verify: auth, league exists, `is_open = true`, not already member, capacity/fair-entry, server-owned defaults, concurrency-safe.

### 0.8 Join RPC inventory

**Absent:** atomic create + commissioner seat · join by code · join open by UUID with server gates.

**Present (not a join RPC):** `public.record_league_first_join(uuid, uuid)` — first-join history after membership exists; D-03 hardened; **leave unchanged**.

### 0.9 Helpers (unchanged)

| Helper | Meaning |
|--------|---------|
| `is_league_member` | membership for p_league_id + auth.uid() |
| `is_league_commissioner` | leagues.commissioner_id = auth.uid() |
| `is_league_ops` | commissioner OR is_deputy |
| `is_league_staff` | commissioner OR is_moderator |

All SECURITY DEFINER, search_path=public. Grants cleanup = **H-01** (not bundled).

### 0.10 Constraints / indexes

Present: memberships PK; unique (league_id, user_id); FKs to leagues/profiles; leagues unique code; useful indexes (league_id, user_id, code, open listing, sport_id, bot rows).

These prevent duplicates / support lookups; they **do not** authorize joins or enforce capacity.

### 0.11 Live aggregate data

| Metric | Value |
|--------|------:|
| leagues | **7** |
| memberships | **77** |
| human | **46** |
| bot | **31** |
| open leagues | **0** |
| memberships missing league/profile | **0** |
| leagues missing commissioner seat | **0** |
| multiple commissioner seats / wrong role / privileged bots / deputies / moderators | **0** |
| min seats / max total / max human / max bot | **1** / **33** / **30** / **31** |
| average total seats | **11** |
| leagues with bots / without | **1** / **6** |

**Capacity interpretation:** Do **not** treat the 33-seat league as invalid without product rules. No server capacity column; bots may differ from humans. Historical cleanup **not authorized / not indicated** by role integrity.

---

## 1. Scope expansion vs original join-only design

| Original D1B-B framing | Live evidence adds |
|------------------------|--------------------|
| Self-INSERT any league_id | + caller-selected **role, bot, deputy, mod, division, scores** on INSERT |
| Browser code / is_open | + **row-wide self UPDATE** with null WITH CHECK |
| Three join RPCs | + **league code public to all authenticated** |
| Capacity as count-in-RPC | + **no max_members column**; 33-seat league exists; bot vs human rules undefined |
| Join RPCs to author | + **UPDATE field ownership** + **league SELECT / discovery contract** + **atomic create** as first-class tracks |

**Data integrity:** clean. **Authorization surface:** not.

---

## 2. Product + technical decision table (freeze before SQL)

| ID | Topic | Recommendation | Alternatives / notes |
|----|--------|----------------|----------------------|
| **B1** | Membership **creation** authority | After cutover: **RPC-only** for all human membership creation | Paths: create+commissioner seat · join-by-code · join-open-by-id |
| **B2** | Capacity authority | Persist server-owned **`max_members` (or equivalent) per league**; enforce in TX | Global fixed 32; format-derived; decide **bots count?** **commissioner counts?** last-seat concurrency (unique + count check) |
| **B3** | Join-code privacy & discovery | **No** general authenticated SELECT of closed-league codes | DEFINER join-by-code; safe open listing without code; map app reads before tightening `"Leagues readable authenticated"` |
| **B4** | Membership **UPDATE** ownership | Remove broad player self-UPDATE after replacement exists | Narrow RPC or column-limited policy for `display_name_override` (+ locker_muted TBD); role/staff/bot/scores/division/timestamps server/commish |
| **B5** | Atomic create | Single RPC: league + commissioner membership (+ optional first join); fail closed | Do not leave orphan league without commissioner seat |
| **B6** | Cutover order | Strict sequence in §4 | Never drop INSERT before RPCs + app green |

---

## 3. Revised phased architecture

### Phase 0 — Freeze (current)

- Archive live preflight (this §0)  
- Freeze B1–B6 product answers  
- Map every app create / join / membership update / league list call site  

### Phase 1 — Server join/create RPCs (REVIEW-ONLY → later apply)

| RPC | Responsibility |
|-----|----------------|
| Create + commissioner seat | Validate inputs; INSERT league; INSERT commissioner membership (role forced); optional first-join; one TX |
| Join by code | Resolve code **inside DEFINER**; capacity; not already member; force role=player, is_bot=false, staff flags false; server division + fair-entry; first-join optional |
| Join open by id | Require `is_open`; same seating rules as code join |

**Server-owned defaults on human player insert (recommended):**  
`role = player`, `is_bot = false`, `is_deputy = false`, `is_moderator = false`, stats zero or fair-entry only, division server-chosen.

### Phase 2 — App cutover

- `join/page.tsx`, `open-room.ts`, `sport-pool.ts` (and any other insert sites) → RPCs only  
- Dual-path only if temporary; remove insecure client INSERT fallbacks when RPC green  
- Sport-pool multi-seat: **service/DEFINER**, not browser  

### Phase 3 — Restrict membership INSERT

- Drop or deny authenticated direct INSERT (bots remain DEFINER)  
- Post-verify create/join with disposable identities  

### Phase 4 — Membership UPDATE narrowing

- Separate from join apply if needed (own auth OK)  
- Replace broad self-update with narrow preference RPC/policy  
- Commissioner/ops update paths preserved via existing helpers  

### Phase 5 — League discovery / code privacy

- Safe open-league list (no code)  
- Join-by-code remains sole closed-league resolver  
- Then tighten leagues SELECT (never before app read map)  

### Phase 6 — Capacity schema (if B2 chooses column)

- Add `max_members` (or sport default) + backfill  
- Enforce in all three RPCs; define bot accounting  

**Parallel (not D1B-B body):** H-01A/B on helper EXECUTE; D1C parked; D-01–D-03 behavioral disposable only.

---

## 4. Required cutover sequence (binding)

```text
1. Freeze product rules (B1–B6)
2. Map every app create/join/update/list call site
3. Author REVIEW-ONLY RPC and policy SQL (not production apply yet)
4. Automated unit/source checks
5. Apply RPCs while old client paths still work
6. Deploy app using only RPC join/create paths
7. Verify production RPC with disposable identities
8. Remove direct membership INSERT
9. Replace broad self-update safely
10. Tighten league-code visibility only after safe discovery reads exist
11. Post-verify policies, grants, RPC bodies, concurrency, historical counts
12. Retain rollback path
```

**Never drop membership INSERT before RPCs and app are green.**

---

## 5. Compatibility with original three-RPC design

| Original | Status after live preflight |
|----------|-----------------------------|
| create + commissioner seat | **Still required** (+ atomicity emphasis) |
| join_league_by_code | **Still required** (+ DEFINER code privacy; force column defaults) |
| join_open_league_by_id | **Still required** (+ is_open in TX) |
| Restrict INSERT after cutover | **Still required** |
| **New first-class tracks** | UPDATE field ownership · leagues SELECT/discovery · capacity column decision |

---

## 6. Status declarations

| Statement | True? |
|-----------|-------|
| Production changed | **No** |
| Join RPCs created | **No** |
| Membership INSERT/UPDATE changed | **No** |
| League SELECT/code visibility changed | **No** |
| Historical rows changed | **No** |
| App changed | **No** |
| D1B-A/C changed | **No** |
| D1C / H-01 changed | **No** |
| D1B-B repaired | **No** |
| Live preflight complete | **Yes** |
| Apply SQL authorized | **No** |

---

## 7. Next action

1. ~~Freeze B1–B6~~ **Done** — `docs/D1B-B-PRODUCT-DECISIONS-AND-CALLSITE-MAP.md`  
2. ~~Call-site map~~ **Done** (static)  
3. Next authorized package: **REVIEW-ONLY** RPC/policy SQL design (still **not** production apply)  
4. **Do not** apply production SQL until Mike separately authorizes
