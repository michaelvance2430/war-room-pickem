# D1B-B — Disposable Application E2E evidence (A1–A12)

**Status:** PASS
**Generated:** 2026-08-06T22:17:09.246Z
**Repo commit:** `c21385f0f044ea55f285a00c66a00c4da911cd39`

### Classification

```text
D1B-B DISPOSABLE APP E2E PASS /
A1–A12 PASS /
DATABASE PACKAGE PASS /
SPORT-POOL CUTOVER PENDING /
PRODUCTION NOT AUTHORIZED /
FILE 07 NOT AUTHORIZED /
NOT YET REPAIRED
```

## Branch

| Field | Value |
|-------|--------|
| Project ref | `uihlexzpeofaiipcgynw` |
| URL host | `uihlexzpeofaiipcgynw.supabase.co` |
| Production data copied | NO |
| Parent production | `dorhjepugsjpmnuzdzck` (not used for tests) |
| Auth method | signUp via anon/publishable key (no service_role) |
| Package | Assumed pre-applied 00–06 (sentinel present earlier) |
| File 07 | NOT APPLIED |

## A1–A12

| ID | Status | Detail |
|----|--------|--------|
| A1 | **PASS** | unauth blocked: permission denied for function create_league_with_commissioner_seat |
| A2 | **PASS** | league=0f301bb1-215a-4e37-9179-5547b25f68aa code=MWDEKX commissioner pts=0; nav→league-build |
| A3 | **PASS** | empty_name:rej, long_name:rej, bad_sport:rej, cut_9:rej, cut_76:rej, max_1:rej, max_65:rej |
| A4 | **PASS** | joined; pts=0; first_join; no leagues SELECT on join path |
| A5 | **PASS** | safe reject (invalid_code); no mem change |
| A6 | **PASS** | already_member; no dup; first_joined_at stable |
| A7 | **PASS** | rooms=1; no code/commissioner_id; invite not in payload |
| A8 | **PASS** | open join ok; membership+first_join; code omitted |
| A9 | **PASS** | not_open (not_open) |
| A10 | **PASS** | league_full; humans=2 max=2 |
| A11 | **PASS** | no ordinary membership/league INSERT; missing RPC errors; runtime insert count=0 |
| A12 | **PASS** | nav contracts; member hydrate can see code; discovery never returns invite code |
| INTEGRITY | **PASS** | {"visibleLeagues":12,"visibleMemberships":19,"duplicateMembershipsVisible":0,"oversubscribedVisible":0,"ordinaryLeagueOrMembershipInserts":0,"rpcsInvoked":["create_league_with_commissioner_seat","join_league_by_code","list_open_leagues_public","join_open_league_by_id","d1b_b_definitely_missing_rpc_xyz"]} |
| SPORT-POOL | **PASS** | residual privileged multi-seat INSERT unchanged (not executed) |
| NETWORK | **PASS** | rpcs=create_league_with_commissioner_seat,join_league_by_code,list_open_leagues_public,join_open_league_by_id,d1b_b_definitely_missing_rpc_xyz league/membership inserts=0 |

## Network / RPC

```json
{
  "rpcs": [
    "create_league_with_commissioner_seat",
    "join_league_by_code",
    "list_open_leagues_public",
    "join_open_league_by_id",
    "d1b_b_definitely_missing_rpc_xyz"
  ],
  "inserts": []
}
```

## Integrity (RLS-visible + network)

```json
{
  "visibleLeagues": 12,
  "visibleMemberships": 19,
  "duplicateMembershipsVisible": 0,
  "oversubscribedVisible": 0,
  "ordinaryLeagueOrMembershipInserts": 0,
  "rpcsInvoked": [
    "create_league_with_commissioner_seat",
    "join_league_by_code",
    "list_open_leagues_public",
    "join_open_league_by_id",
    "d1b_b_definitely_missing_rpc_xyz"
  ]
}
```

## Non-actions

| Item | Status |
|------|--------|
| Production SQL | NO |
| Production deploy | NO |
| File 07 | NOT LOADED |
| Sport-pool executed | NO |
| Tracked .env.local overwritten | NO |

## Teardown note

Branch `uihlexzpeofaiipcgynw` still exists — **delete in Supabase Dashboard** to stop billing after review.
Credentials were process-env only; not written to tracked files.
