# League display-name (alias) — handoff

**Separate from Museum Phase 1A** (`7407872`).  
**Do not restore any profile automatically.**

## Migration (run in Supabase before testing)

`supabase/membership-display-name-override.sql`

Transactional. Adds:

- `memberships.display_name_override text null`
- `set_my_league_display_name(league_id, alias)`
- Updated `get_league_roster` (resolved names)
- Museum rebuild uses alias when creating **new** pre-lock snapshots only

## Root-cause paths removed

| Path | Before | After |
|------|--------|--------|
| `/join` create | `profiles.upsert({ display_name: nick })` | `ensureProfileRowExists` + `setMyLeagueDisplayName` |
| `/join` join | same | same |
| `open-room` / `seatPlayerInLeague` | same | same |

## Central resolver

`src/lib/display-name.ts` → `resolveLeagueDisplayName({ membershipOverride, profileDisplayName })`

Client write: `src/lib/league-display-name.ts` → `setMyLeagueDisplayName`

## Surfaces updated

- Standings map (`cloud.ts`)
- Board slips, pick submission status, no-lock names
- Roster fallback selects
- Locker Room name resolve (league-scoped)
- Session restore membership list (per-league resolved `displayName`)
- Account Settings: **War Room account name** + **Name in this league**
- Join UI: optional “Name in this league”

## Session

`writeSessionAndLeague` sets `playerName` to **active-league resolved** name only.  
Switching leagues reloads memberships with that league’s override.  
Global account rename re-resolves active league (keeps alias if set).

## Confirmations

- No existing profile rows changed by migration
- No historical Museum/trophy/Gazette rewrites
- `MUSEUM_EVENT_GENERATION_ENABLED = false` still
- No broad membership UPDATE policy for clients

## Verify

```bash
node scripts/verify-league-display-name.mjs
```

ESLint: pass · Build: pass · tsc: only pre-existing reset-password
