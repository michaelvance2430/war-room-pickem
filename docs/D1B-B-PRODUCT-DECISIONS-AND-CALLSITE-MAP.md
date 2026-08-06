# D1B-B — Product decisions locked · Call-site map · RPC contracts · Phased transitions

**Status:** **B1–B6 LOCKED / REVIEW-ONLY ARCHITECTURE / NOT REPAIRED / NO PRODUCTION SQL**  
**Date:** 2026-08-06  
**Live preflight:** `docs/D1B-B-PREFLIGHT-AND-DESIGN-SCOPE.md` §0  
**Architecture:** `docs/D1B-B-MEMBERSHIP-JOIN-AUTHORITY.md`  

### Explicit non-actions (this package)

| Action | Status |
|--------|--------|
| Production SQL / RPC creation on live | **No** |
| REVIEW-ONLY SQL package (repo) | **Yes** — not applied |
| Live `max_human_members` schema / backfill | **No** |
| Policy remove/replace | **No** |
| App deploy | **No** |
| Membership mutation | **No** |
| Code-visibility change | **No** |
| D1C / H-01 | **No** |

**D1B-B remains NOT REPAIRED.**

---

## 1. Product decisions B1–B6 — LOCKED

### B1 — Membership creation — **APPROVED**

After staged app cutover, **all human membership creation is RPC-only** via:

1. Create league + commissioner seat  
2. Join closed league by code  
3. Join open league by league UUID  

RPCs **force** server-owned defaults. Callers cannot choose: role, is_bot, is_deputy, is_moderator, division authority, joined_at, or scoring/stat values.

**Do not** remove direct membership INSERT until all RPCs and app call sites are deployed and verified.

### B2 — Capacity — **APPROVED**

| Rule | Law |
|------|-----|
| Column | Server-owned per-league **`max_human_members`** (name exact TBD in SQL design; product: human seat cap) |
| Default | **32** |
| Commissioner | Counts as **one human** member |
| Human/player rows | Count toward limit |
| Bot rows | **Do not** count toward human limit |
| Bot creation | Server/Foundry-controlled only |
| Concurrency | Lock league row (or equivalent) in TX; final seat → **exactly one** success |
| Existing leagues | Default via **separately reviewed backfill** (not this package) |
| 33-total-seat league | Not auto-invalid (bots excluded from human count) |
| Deletes | **No** existing memberships deleted |

### B3 — Join-code privacy and discovery — **APPROVED**

- Closed-league codes = private authorization inputs  
- After app replacement reads ready: general authenticated league reads **must not** expose closed codes  
- Join-by-code resolution = **SECURITY DEFINER RPC** only  
- Open discovery = safe RPC/view; **approved public fields only**; **no codes**  
- **Do not** tighten leagues SELECT until every production league-read call site is mapped and migrated  

### B4 — Membership UPDATE — **APPROVED**

Ordinary players: **no broad direct membership UPDATE**.

| Player-editable | Path |
|-----------------|------|
| `display_name_override` only | Existing narrow `set_my_league_display_name` RPC (or equally narrow replacement) |

**Not player-controlled:** locker_muted, role, is_bot, is_deputy, is_moderator, division, joined_at, all scoring/stat fields, weeks_played, league_id, user_id.

`locker_muted` = moderation authority, not self-service.

Before removing broad UPDATE: map all legitimate writers; provide narrow RPCs/server paths for each.

### B5 — Atomic league creation — **APPROVED**

One TX: authenticate → validate → create league → commissioner membership (`role=commissioner`) → safe defaults → first-join if required → return league → full rollback on failure.

A committed league must never lack its commissioner seat.

### B6 — Cutover order — **APPROVED**

```text
1. Archive B1–B6 decisions                          ✅ this document
2. Complete static app call-site map                ✅ this document
3. Design RPC signatures, errors, grants, concurrency, rollback  ✅ §3–§5
4. Author REVIEW-ONLY SQL only                      ✅ `supabase/review-only/D1B-B/` · `docs/D1B-B-REVIEW-ONLY-SQL-PACKAGE.md`
5. Source and unit verification                     ⏳
6. Apply RPCs while legacy client paths remain      ⏳ separate auth
7. Deploy app create/join via RPCs                  ⏳
8. Disposable-identity behavioral tests             ⏳
9. Confirm production traffic uses RPCs             ⏳
10. Remove direct membership INSERT                 ⏳
11. Post-verify create/join/rejoin                  ⏳
12. Replace broad membership UPDATE                 ⏳
13. Cut over safe league discovery                  ⏳
14. Tighten league-code visibility                  ⏳
15. Re-run structural + behavioral verification     ⏳
```

**Never** combine every stage into one irreversible production migration.

---

## 2. Complete app / database call-site map

### 2.1 Human membership **INSERT** (must move to RPCs)

| # | File | Approx | Authority intent | Today |
|---|------|--------|------------------|-------|
| I1 | `src/app/join/page.tsx` | ~309 | Create: commissioner seat after league INSERT | Direct `memberships.insert` role=commissioner |
| I2 | `src/app/join/page.tsx` | ~545 | Join-by-code: player seat | Direct insert after browser code lookup, capacity, division, fair-entry |
| I3 | `src/lib/open-room.ts` | ~246 | Open-room seat by UUID | Direct insert; browser capacity; **no RLS is_open** |
| I4 | `src/lib/sport-pool.ts` | ~529 | Sport-pool multi-seat | Direct insert for other/self seating |

### 2.2 Bot / DEFINER membership creation (preserve server paths)

| # | Surface | Notes |
|---|---------|--------|
| B1 | `seed_trial_bots` RPC (+ cloud pad paths) | SECURITY DEFINER; not human join |
| B2 | Foundry / clear-trial-bots SQL | Ops; not browser self-INSERT |

Human RPCs must not open bot-create; bot paths stay Foundry/server-controlled (B2).

### 2.3 Membership **UPDATE** writers (categorize authority)

| # | File | Fields written | Intended authority | Post-D1B-B path |
|---|------|----------------|--------------------|-----------------|
| U1 | `src/lib/league-display-name.ts` → RPC `set_my_league_display_name` | `display_name_override` | **Player self** | **Keep** narrow RPC (B4 sole player write) |
| U2 | `src/lib/cloud.ts` score week ~2789 | total_points, weekly_points, ATS, streaks, best/worst, perfect, best-bet, prop, weeks_played | **Ops scoring** (client uses isOps) | Narrow **score/standings RPC** or DEFINER scoring path — **not** player self-update |
| U3 | `src/lib/cloud.ts` ~2712 | total_points (week score path) | Ops scoring | Same as U2 |
| U4 | `src/lib/cloud.ts` `setMemberModeration` ~3837 + RPC `set_member_moderation` | is_deputy, is_moderator, locker_muted | Commissioner / staff | **Keep** RPC; remove reliance on broad table UPDATE for players |
| U5 | `src/lib/cloud.ts` division change ~4814 | division | Ops (isOps check in app) | Narrow **set_member_division** RPC or ops-only policy |
| U6 | `src/lib/cloud.ts` auto-balance ~5113 | division | Ops | Same as U5 / batch ops RPC |
| U7 | `src/lib/cloud.ts` season reset wipe ~5387 | zero all scoring fields | Commissioner reset / DEFINER reset preferred | Prefer `reset_league_season` DEFINER; avoid client bulk UPDATE |
| U8 | `src/lib/cloud.ts` ~3545 | joined_at restore from first-join | System / first-join recover | Server-only in first-join / join RPC |
| U9 | `src/lib/fair-entry.ts` ~389 | total_points after join | Join-time fair entry | **Inside join RPC** (not separate client UPDATE) |
| U10 | `src/lib/cloud.ts` ~3994 | total_points, weeks_played for new mid-season bots | Bot pad | Bot DEFINER / seed path only |
| U11 | `src/lib/auto-publish-card.ts` ~396–402 | role player/commissioner on transfer | Transfer commissioner | **transfer_commissioner** RPC or equivalent — not broad self-update |
| U12 | `src/lib/admin-test-cleanup.ts` | memberships select/cleanup | Founder/admin tools | Foundry / service only |

**Legitimate categories:**

| Category | Writers | Future authority |
|----------|---------|------------------|
| Player preference | U1 | `set_my_league_display_name` only |
| Scoring / standings | U2, U3, U7, U9, U10 | DEFINER score/reset/bot RPCs |
| Staff / moderation | U4 | `set_member_moderation` |
| Division ops | U5, U6 | Ops RPC |
| Commissioner transfer | U11 | Dedicated RPC |
| Admin/Foundry | U12 | Service / isolated |

**Broad policy today** (`Memberships update by commissioner or self` + WITH CHECK null) over-authorizes **player self** for all columns. Phase 12 replaces it after narrow paths exist for U2–U11.

### 2.4 Membership **SELECT** (read — not creation)

Examples (non-exhaustive; do not block D1B-B create RPCs): roster load, session-restore, crystal-ball no-pick names, locker, fair-entry, nudge, founder health, profile. These need **member/ops-scoped reads**, not public all-memberships. Separate from join RPCs; note if future SELECT tighten needed.

### 2.5 Membership **DELETE**

| # | File | Intent |
|---|------|--------|
| D1 | `cloud.ts` removeLeagueMember | Commish remove |
| D2 | leave-league paths | Self leave (if present) |
| D3 | trial bot clear DEFINER | Bot cleanup |

Out of B1 create path; do not expand scope into leave/delete redesign unless required by cutover.

### 2.6 Leagues **INSERT** (create)

| # | File | Notes |
|---|------|--------|
| L1 | `join/page.tsx` ~212–231 | Direct `leagues.insert` then I1 membership — **non-atomic** (B5) |
| L2 | `sport-pool.ts` ~467 | League create for pool |

→ **create_league_with_commissioner_seat** (and pool variant if needed).

### 2.7 Leagues **SELECT** consumers (fields needed)

| # | File | Select / use | Needs `code`? | Post-B3 target |
|---|------|--------------|---------------|----------------|
| S1 | `open-room.ts` `listOpenRooms` | id, name, **code**, sport_id, commissioner_id, created_at, is_open, open_listed_at | **Today yes** (lists codes for open rooms) | Safe open discovery RPC **without** code (or code only if product requires share — **B3 says no codes in open discovery**) |
| S2 | `join/page.tsx` join-by-code | `select *` by code | Yes (lookup) | **Inside join_by_code RPC** — client never bulk-lists codes |
| S3 | `join/page.tsx` create verify | sport_id, current_week, crystal_ball | No | Create RPC return payload |
| S4 | `league-sync.ts` `fetchLeagueFromCloud` | `select *` by id | **Yes today** (full row → local League) | Member-scoped league fetch RPC/view **with code only if member/commissioner** |
| S5 | `session-restore.ts` | memberships embed leagues(…) | code often for display/invite | Member embed: code OK **for own leagues**; not global browse |
| S6 | `cloud.ts` / settings / active week | various league fields | Sometimes code | Member/ops scoped |
| S7 | `CommissionerClient` / `ManageLeagueClient` | league settings | code for invite UI | Commissioner: code OK |
| S8 | `fair-entry.ts` | sport_settings etc. | No | Member/ops |
| S9 | `nudge-picks.ts`, `founder-league-health.ts` | health/nudge | Maybe code | Ops/Founder scoped |
| S10 | `api/health` | `select id` limit 1 | No | Keep minimal |
| S11 | `api/founder/odds-usage` | leagues | Founder | Founder scoped |

**B3 migration rule:** Map complete → introduce `list_open_leagues_public` (no code) + `get_my_league` / member fetch (code if member) → stop client `select *` from leagues for anonymous discovery → then tighten `"Leagues readable authenticated"`.

### 2.8 Leagues **UPDATE** (not join creation; inventory)

Settings (`league-sync`), open listing (`open-room` is_open), current_week, auto-publish, sport_settings, commissioner transfer — **commissioner/ops**. Out of membership INSERT scope; do not block join RPCs; ensure open-room RPC may set `is_open=false` when full (optional B3 product).

### 2.9 Existing RPCs related to membership

| RPC | Role in D1B-B |
|-----|----------------|
| `record_league_first_join` | Post-seat history (D-03); call from create/join RPCs; **not** a join authority |
| `set_my_league_display_name` | B4 player preference — **keep** |
| `set_member_moderation` | Staff flags / mute — **keep / prefer over table UPDATE** |
| `seed_trial_bots` | Bot seats — **keep** DEFINER |
| `reset_league_season` | Wipe stats — prefer over client bulk UPDATE |
| `transfer_commissioner` (if live) | Prefer over auto-publish dual role UPDATE |

**No** live create/join/open membership RPCs (preflight confirmed).

---

## 3. Proposed RPC contracts (REVIEW-ONLY design — not implemented)

Names are proposals; freeze exact names in SQL package.

### 3.1 `create_league_with_commissioner_seat`

| | |
|--|--|
| **Auth** | `auth.uid()` required |
| **Input (sketch)** | name, sport_id, rules subset, list_as_open?, cut_percent?, … (server-validated allowlist) |
| **TX** | INSERT league (`commissioner_id = auth.uid()`, `max_human_members` default 32 when column exists) → INSERT membership (user=auth, **role=commissioner**, division server default, is_bot/staff false, stats 0) → optional `record_league_first_join` → RETURN league_id, code, … |
| **Errors** | not_authenticated, validation_failed, code_collision, insert_failed |
| **Grants** | EXECUTE authenticated only; revoke PUBLIC if H-01 aligned later |
| **Concurrency** | Unique code; single TX |

### 3.2 `join_league_by_code`

| | |
|--|--|
| **Auth** | required |
| **Input** | `p_code text` (trim/upper server-side) |
| **TX** | Lock league row by code → not found → full (human count ≥ max_human_members) → already member → return existing → INSERT player defaults only → fair-entry points server-side → first-join optional |
| **Forced columns** | role=player, is_bot=false, is_deputy=false, is_moderator=false, locker_muted=false, division=server, stats=server |
| **Errors** | invalid_code, league_full, not_authenticated |
| **Privacy** | Code never listed in SELECT; only accepted as input |

### 3.3 `join_open_league_by_id`

| | |
|--|--|
| **Auth** | required |
| **Input** | `p_league_id uuid` |
| **TX** | Lock league → exists → **is_open = true** → capacity → already member → insert player defaults (same as 3.2) → optional auto `is_open=false` if full after insert |
| **Errors** | not_found, not_open, league_full |

### 3.4 Discovery (Phase 13)

| RPC / view | Returns |
|------------|---------|
| `list_open_leagues_public` | id, name, sport_id, member human counts or seats_left, open_listed_at, created_at — **no code** |
| `get_league_for_member` | Full member-needed fields **including code** only if `is_league_member` |

### 3.5 Preference / ops (existing or future narrow)

| RPC | Purpose |
|-----|---------|
| `set_my_league_display_name` | B4 only player write |
| `set_member_moderation` | deputy/mod/mute |
| Future: `set_member_division` | ops division |
| Future: scoring DEFINER paths | replace client standings UPDATE |

### 3.6 Grants & security posture

- All new join/create RPCs: SECURITY DEFINER, `search_path = public`, body auth checks, **no** client-supplied privileged columns  
- Prefer revoke PUBLIC when applied (coordinate H-01 without bundling mass revoke)  
- Rollback: keep RPCs; re-enable legacy INSERT policy if needed  

---

## 4. Phased policy transitions (target end-state)

| Phase | memberships INSERT | memberships UPDATE | leagues SELECT |
|-------|--------------------|--------------------|----------------|
| **Now (live)** | Self any row (`user_id=auth.uid()`) | Self or commissioner, WITH CHECK null | All rows, USING true (codes exposed) |
| **After RPC apply, before app cutover** | Still open (legacy) | Still open | Still open |
| **After app cutover verified** | **Deny** authenticated direct INSERT (bots via DEFINER) | Still open until Phase 12 | Still open |
| **After UPDATE paths mapped** | Denied | **No player broad UPDATE**; commissioner/ops via RPC or narrow policies; player only via display-name RPC | Still open |
| **After discovery cutover** | Denied | Narrow | **Tightened**: no closed codes for non-members; open list without codes |

**Do not** jump to final row in one migration.

---

## 5. Test plans (REVIEW-ONLY — execute later)

### 5.1 Source / unit (CI)

- Grep: no production `memberships.insert` outside allowed Foundry/tests after cutover  
- Grep: join paths call RPCs  
- Grep: open-room list does not select `code` after discovery cutover  

### 5.2 Disposable-identity behavioral

| ID | Case | Expect |
|----|------|--------|
| T1 | Create league | Commissioner seat exists; role commissioner |
| T2 | Create failure mid-TX | No orphan league |
| T3 | Join valid code | Player seat; forced defaults |
| T4 | Join bad code | Error; no membership |
| T5 | Join full (32 humans) | Error; bots ignored in count |
| T6 | Concurrent last seat | Exactly one success |
| T7 | Rejoin | Idempotent |
| T8 | Open UUID when open | Seat |
| T9 | Open UUID when closed | Error |
| T10 | Direct membership INSERT after Phase 10 | Denied |
| T11 | Player UPDATE role/scores | Denied after Phase 12 |
| T12 | set_my_league_display_name | Still works |
| T13 | set_member_moderation | Still works for commish |
| T14 | List open leagues | No code field |
| T15 | Authenticated SELECT all leagues codes | Denied after Phase 14 |
| T16 | Bot seed | Still works |
| T17 | 33-seat league with bots | Humans ≤ max_human_members |

### 5.3 Structural post-verify

- Policy catalog match phase  
- `max_human_members` present + backfill defaults (when applied)  
- Zero historical membership deletes  
- Helper grants untouched unless H-01 authorized  

---

## 6. Rollback principles

| Stage failed | Rollback |
|--------------|----------|
| RPC apply | Drop RPCs or leave unused; no INSERT drop yet |
| App cutover | Redeploy prior app (legacy INSERT still present if step 10 not done) |
| INSERT removed | Restore `"Memberships insert own"` from archive |
| UPDATE narrowed | Restore prior UPDATE policy (security regression — last resort) |
| SELECT tightened | Restore leagues SELECT true (code exposure returns) |

Prefer reverse order of B6.

---

## 7. Status declarations

| Statement | True? |
|-----------|-------|
| B1–B6 frozen | **Yes** |
| Call-site map complete (static) | **Yes** (this doc) |
| Production SQL authored | **No** |
| Production changed | **No** |
| D1B-B repaired | **No** |
| D1C / H-01 worked | **No** |

---

## 8. Next authorized work (when Mike says so)

~~Author REVIEW-ONLY SQL package~~ **Done** — `docs/D1B-B-REVIEW-ONLY-SQL-PACKAGE.md`.  

Next: disposable DB apply of 01–06 + harness; or source/unit verification; **production stage-6 apply only with separate Mike auth**.
