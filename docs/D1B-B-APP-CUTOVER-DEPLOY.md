# D1B-B — App cutover production deploy

**Date:** 2026-08-06  
**Commit:** `122ed28` — `feat(d1b-b): app cutover create/join/open to membership RPCs`

### Classification

```text
DATABASE REPAIRED (four RPCs present on production) /
APP CUTOVER DEPLOYED /
DISPOSABLE APP E2E PASS /
SPORT-POOL PATH SEPARATE /
FILE 07 NOT APPLIED /
MEMBERSHIP INSERT POLICY STILL OPEN /
NOT FULLY STRUCTURALLY CLOSED
```

---

## Pre-deploy production RPC probe

Project: `dorhjepugsjpmnuzdzck`  
Method: unauthenticated `rpc()` (expect present + anon denied)

| RPC | Result |
|-----|--------|
| `create_league_with_commissioner_seat` | **PRESENT** (42501 permission denied for anon) |
| `join_league_by_code` | **PRESENT** |
| `join_open_league_by_id` | **PRESENT** |
| `list_open_leagues_public` | **PRESENT** |

None returned PGRST202 (missing function).

---

## Deploy

| Field | Value |
|-------|--------|
| Platform | Vercel |
| Project | emerald-hills / war-room-pickem |
| Command | `npx vercel --prod --yes` |
| Build | Next.js 15.1.9 — success |
| Production alias | https://www.war-room-picks.com |
| Deployment URL | https://war-room-pickem-ejx7nsb1o-emerald-hills.vercel.app |

---

## App paths now on production

| Flow | Implementation |
|------|----------------|
| Create league | `create_league_with_commissioner_seat` via `d1b-b-membership.ts` |
| Join by code | `join_league_by_code` |
| Open discovery | `list_open_leagues_public` (no codes) |
| Open join | `join_open_league_by_id` |

**Not cut over:** sport-pool multi-seat (`sport-pool.ts` direct INSERT residual).

**Not applied:** file 07 / membership INSERT policy drop.

---

## Recommended live smoke (Mike)

1. Sign in on www.war-room-picks.com  
2. Create a test CFB room → lands League Build; commissioner seat exists  
3. Join with a private code on a second account  
4. Open-room lobby: listings show name/seats, **no code**  
5. Join open room by matchmaking  
6. Confirm Network tab shows `rpc/create_league_with_commissioner_seat` etc., not REST insert to memberships  

---

## Still open

| Item | Status |
|------|--------|
| File 07 / deny direct membership INSERT | **Not authorized** |
| Sport-pool privileged DEFINER path | **Separate** |
| Git push to origin | Local main **ahead** of origin (deploy used local Vercel upload) |
| Disposable branch delete | Confirm billing stopped if still open |
