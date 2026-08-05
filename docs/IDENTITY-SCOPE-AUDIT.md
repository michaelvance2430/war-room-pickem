# Identity-scope audit — Account name vs league alias

**Status:** Read-only audit. **No fix implemented.**  
**Date:** 2026-08-04  
**Verdict:** Confirmed bug — UI promises per-league nickname; code mutates global `profiles.display_name`.

---

## Intended model (product)

| Concept | Scope | Storage (desired) |
|---------|--------|-------------------|
| **Account name** | Global War Room identity | `profiles.display_name` |
| **League alias** | One membership only | e.g. `memberships.display_name_override` (does not exist yet) |

Resolution in league context: `league alias ?? account display name`.

---

## Part 1 — What changed (exact write path)

### 1. Route and component

| Item | Value |
|------|--------|
| **Route** | `/join` |
| **File** | `src/app/join/page.tsx` |
| **Handlers** | `handleCreate()` (create league), `handleJoin()` (join by code) |
| **Related** | `src/lib/open-room.ts` → `seatPlayerInLeague()` (open lobby join) |

Same class of bug exists on open-room seating.

### 2. Label and copy (create)

- **Label:** `Your name in this room` (`#create-display-name`)
- **Placeholder:** `How will this room know you?`
- **Helper:** *“Nickname for this league only. Career, trophies, and cheevos stay on your War Room account.”*

### 3. Intended meaning vs actual

| Claimed | Actual write |
|---------|----------------|
| League-specific player alias | **Global account name** |

UI text is correct product intent. Implementation is wrong.

### 4. Function called on create

`handleCreate()` in `src/app/join/page.tsx` (inline; not a shared lib function).

### 5–6. Every write on create

| Target | What is written |
|--------|-----------------|
| **`profiles`** | `upsert({ id: userId, display_name: nick })` — **global** |
| **`leagues`** | Room name, code, commissioner, sport, week, etc. — not player name |
| **`memberships`** | `league_id`, `user_id`, `role: commissioner`, `division` — **no name column** |
| **Auth metadata** | **Not** updated by join/create path (unlike Account Settings `updateMyDisplayName`) |
| **localStorage session** | `writeSessionAndLeague(..., displayName: nick)` → `session.playerName = nick` |
| **localStorage league** | League metadata via same write |
| **Sandbox state** | No separate sandbox name store — same Supabase path |

Join path (`handleJoin`) does the **same** `profiles` upsert with nick.

Open lobby: `seatPlayerInLeague` also:

```ts
await supabase.from("profiles").upsert({
  id: userId,
  display_name: displayName.trim() || "Player",
});
```

### 7. Why every league shows the new name

Almost all league surfaces resolve names via:

```text
memberships ⋈ profiles.display_name
```

There is **one** global `profiles.display_name` per auth user. Changing it changes Standings, Board, Locker, roster, Nav (after profile load), etc. in **every** league that user is in.

Local session `playerName` also updates for the active session, reinforcing the UI immediately.

### 8. Commit that introduced / last shaped this behavior

| Commit | Role |
|--------|------|
| **`eaff441`** (`fix(join): empty room and nickname fields invite new identities`) | **Last major change** — empty nickname field, copy claims “this league only”, but **still** upserts `profiles.display_name` with the nickname. Tightened copy without fixing storage. |
| Earlier join code | Already wrote `profiles.display_name` on create/join; pre-filled from account meta. |

The **bug is architectural** (nickname → profile row). `eaff441` made the UX promise explicit while leaving the global write.

### 9. Was the global production profile mutated?

**Yes.**  
`profiles.display_name` is the production profile table. Sandbox calendar mode does not use a separate profile row.

### 10. Logout / login

**Preserves the unintended name.**  
Restored from `profiles.display_name` (and memberships joins). Auth `user_metadata.display_name` may still hold the old value if never synced by Account Settings, but primary app paths use `profiles`.

### 11. Other devices

**Yes.**  
Cloud `profiles.display_name` is shared across devices.

### 12. Sandbox only or all modes?

**All modes that use `/join` create/join or open-room seat.**

- “Sandbox” in this product is largely **preseason dry-run calendar / career gating** (`season-mode.ts`), not a separate identity database.
- Creating a league from `/join` always inserts a **real Supabase league** under the real `auth.uid()` / `profiles` row.
- **Production** create/join has the **same** `profiles.display_name` overwrite.

Not limited to Foundry/demo-only rooms.

---

## Part 2 — Schema support for league alias

### `memberships` (current)

From `schema.sql` + later migrations: role, division, points, streaks, `is_bot`, `is_deputy`, `is_moderator`, `locker_muted`, `joined_at`, etc.

| Candidate | Exists? |
|-----------|---------|
| `display_name` on memberships | **No** |
| `nickname` | **No** |
| `alias` | **No** |
| `league_display_name` | **No** |
| `player_name` | **No** |
| Membership name metadata JSON | **No** |

### `profiles.display_name`

| Property | Value |
|----------|--------|
| Type | `text not null` |
| Scope | Global (1 per user id) |
| RLS | Own profile update (standard) |
| Readers | Nearly all name surfaces |
| Writers | Signup trigger, Account Settings (`updateMyDisplayName`), **join/create/open-room**, trial bots |
| Safe as league alias? | **No** |

### Proposed additive field (do not create yet)

```text
memberships.display_name_override text null
```

| Concern | Notes |
|---------|--------|
| Nullability | null = use `profiles.display_name` |
| Uniqueness | Optional later: unique (league_id, lower(trim(override))) if product wants no duplicate aliases |
| RLS | Same as memberships: member can update own row; ops may not need to edit others’ aliases |
| Safe reuse of existing field | **None available** |

---

## Part 3 — Name-resolution audit (surfaces)

**Current source (almost everywhere):** `profiles.display_name` via join or `loadLeaguePlayers` / standings cloud map.  
**Session fallback:** `session.playerName` (local, set from last writeSessionAndLeague / profile update).

| Surface | Current source | Desired class |
|---------|----------------|---------------|
| **Home / Nav** | Session + `loadMyProfile` → `profiles.display_name` | Global account (chrome) **or** active-league alias if showing “you in this room” |
| **League Hub** | Profile / session name | League: `alias ?? account` |
| **Picks** | Self via session/profile; others via roster | League |
| **Completed Picks summary** | Self labels; others from board loads | League |
| **Standings** | `Player.name` from cloud `profiles.display_name` | League |
| **Board** | Same player list | League |
| **Locker Room** | Profile map + session override | League |
| **Commissioner roster** | `profiles.display_name` | League |
| **League members / players list** | `profiles.display_name` | League |
| **Profile page** | `profiles` + trophies | **Global** account identity (with league context only for league-scoped flair) |
| **Account Settings** | `updateMyDisplayName` → `profiles` + auth meta + session | **Global** only |
| **Gazette** | Player names from standings/profile | League (edition snapshot is historical once archived) |
| **Announcements** | Author from profile | League or global (author at post time → prefer snapshot if permanent) |
| **Trophies / hardware** | `winner_name` snapshot + `winner_user_id` | **Historical snapshot** (already partially snapshotted) |
| **Achievements / badges** | Local + profile linkage | Global identity; display can use account name |
| **Museum** | Timeline from trophies + players; future events use `display_name_snapshot` | **Historical** for events; live roster for non-permanent timeline bits |
| **Crew** | Local names / trophies | Historical / membership at chapter time |
| **Brackets** | Player list names | League |
| **Stats** | Player list | League |
| **Notifications / emails** | e.g. nudge uses `profiles.display_name` | League if league-scoped; else global |
| **Moderation** | Roster `display_name` | League |
| **Invite / join** | Input nick → **wrongly writes global** | Should write **alias only** |

### Desired resolution helpers (future)

```text
// League context
displayName = membership.display_name_override?.trim() || profile.display_name

// Global context  
displayName = profile.display_name

// Historical
displayName = stored snapshot at event creation
```

Do **not** rewrite Museum / trophy `winner_name` / Gazette archive payloads when account name or alias changes.

---

## Part 4 — Sandbox boundary

### Classification: **Sandbox-to-production identity leak** (and production self-leak)

| Question | Answer |
|----------|--------|
| Mode of new league | Real Supabase league; “Sandbox” = season dry-run gates, not a fake profile |
| Real Supabase league? | **Yes** |
| Shared real authenticated profile? | **Yes** (`auth.uid()` → `profiles.id`) |
| Write path | Direct `profiles.upsert` in join/create — **not** gated by `isProductionMode` / career integrity |
| Same class of leak for other fields? | **Avatar:** not written on join. **Favorite team:** separate Account/declare path. **Birthday:** Account only. **Titles/borders:** equip stores. **Trophies/achievements:** not rewritten by join name. **Vulnerable pattern:** any join/create field that upserts `profiles.*` without meaning to be global |

**Other profile fields** are not currently set by the nickname field, but the **pattern** (create/join mutates global profile) is the leak class.

### Actual stored values (how to inspect — do not change yet)

Run as yourself in Supabase (read-only):

```sql
select id, display_name, avatar_url
from public.profiles
where id = auth.uid();  -- or your user uuid

select raw_user_meta_data->>'display_name' as auth_meta_name
from auth.users
where id = auth.uid();
```

Expect: `profiles.display_name` equals the **league nickname** you typed, not necessarily your prior account name. Auth meta may still show the older name.

---

## Part 5 — Desired future behavior (design only)

### Creating an account

- Ask once for **default War Room account name** → `profiles.display_name` only.

### Creating a league

- **Room name** → `leagues.name`
- **Optional: Your name in this league** → `memberships.display_name_override`
- Copy: *Leave blank to use your War Room account name.*
- **Never** write alias into `profiles.display_name`.

### Joining a league / open room

- Same optional alias on membership insert/update for **that** row only.

### Changing league alias

- Account Settings → memberships list → “Name in this league” (or league identity panel).
- Updates **only** that membership.

### Changing global account name

- Separate Account Settings control → `profiles.display_name` (+ auth meta if desired).
- Leagues **without** alias: show new global name.
- Leagues **with** alias: unchanged.
- Historical snapshots: unchanged.

### Museum / history

- Snapshot `display_name` at event/trophy time (already partially true for trophies / Phase 1A allegiance).
- Never re-resolve live alias into permanent plaques.

### Sandbox / Foundry / Eyes

- Must not casually mutate global production profile for “room nicknames.”
- If Foundry needs fake names, keep them Foundry-local or membership-scoped test data, not `profiles` overwrite without intent.

---

## Root-cause summary

```
UI: "Nickname for this league only"
        ↓
Code: profiles.display_name = nick   ← GLOBAL
        ↓
All leagues read profiles.display_name
        ↓
Every room shows the new name
```

**Mismatch:** product copy and comments describe per-league identity; storage has only a global display name; memberships have no override column.

---

## Recommended fix shape (not implementing)

1. Add nullable `memberships.display_name_override`.
2. Stop `profiles` upsert of nick on create/join/open-room (keep profile name untouched; only ensure profile row exists with existing name if missing).
3. Central helper `resolveMemberDisplayName(profile, membership)`.
4. Point roster/standings/board/locker/gazette readers at helper.
5. Account Settings: global rename vs per-league alias editors.
6. Optional one-time UX: offer restore of previous global name if detected (manual; do not auto-guess).

---

## Do not implement yet

Await approval before migrations or behavior changes.  
Do not restore the user’s name without their explicit request after they review stored values.
