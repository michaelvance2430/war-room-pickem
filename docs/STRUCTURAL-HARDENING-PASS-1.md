# War Room Structural Hardening — Pass 1 (H0 + H1)

**Date:** 2026-08-05  
**Scope:** Production safety baseline + crown-jewel data map only  
**Mode:** Read-only audit · no production mutations · no application code changes  

---

## 1. Executive assessment

War Room’s **application layer** has meaningful hard freezes (delete league fails closed; sport writes stripped; career mode gate; SAFE NAV default on). **Database enforcement is partially documented in-repo** and sport immutability is **claimed applied in production** (product fact) but **not re-probed live in this pass**. Environment is **UNSAFE for destructive testing**: local and Vercel both resolve to the **same production Supabase project**, with **no staging project**, **no local Supabase**, and **no proven service-role isolation on the client machine**.

Backups/PITR: **UNKNOWN** (no dashboard evidence).  
Foundry isolation: **PARTIAL / historically FAILED** (documented production hardware grants; mode gate is app-layer).  
Quality baseline: pure verify suites pass; `tsc` has known `PASSWORD_RECOVERY` error; ESLint config noise; `build` green.

**Overall Pass 1 posture: PARTIAL protection · production is the only reality · treat every write path as nuclear.**

---

## 2. H0 — Production safety baseline

### A. Repository and deployment identity

| Item | Value | Evidence |
|------|--------|----------|
| Local HEAD | `dc239f173a0a6b1e3d37057b6ee74ad14df70525` | `git rev-parse HEAD` |
| origin/main HEAD | `dc239f173a0a6b1e3d37057b6ee74ad14df70525` | equal |
| Dirty tracked files | **None** | `git status` clean for tracked |
| Untracked ops-relevant | `scripts/patch-account-identity.mjs` (**write patterns**), `probe-nfl-allegiance.mjs` (**write patterns**), readonly probes, SQL inspect scripts | untracked |
| Latest commit | lightbox lock · auto-balance UI · global trophy room · Maria UUID | `git log` |
| Deployed commit | **UNKNOWN** live Vercel deploy SHA not verified this pass | `.env.local` has `VERCEL_GIT_COMMIT_SHA` present (value not printed) · project `war-room-pickem` |
| Node | v24.18.0 | local shell |
| Next.js | 15.1.9 | package.json |
| @supabase/supabase-js | ^2.49.1 | package.json |
| @supabase/ssr | ^0.6.1 | package.json |
| npm | 11.16.0 | local shell |

Hardening commits present on `main` (local = origin): auto-balance refresh, global hardware, ID-only conference seeds, trophy lightbox lock. Whether **production Vercel** has finished deploying HEAD: **UNKNOWN** without dashboard.

### B. Environment separation

| Check | Finding |
|-------|---------|
| Supabase project | **Production-shaped** · ref present · `VERCEL_ENV=production` · `VERCEL_TARGET_ENV=production` |
| Staging project | **Not found** in repo/env |
| Local Supabase | **No** `supabase/config.toml` |
| In-memory harness | **No** ephemeral DB harness for integration |
| Tests vs production | Pure static/unit scripts OK · any script using anon env hits **production** |
| Scripts default env | `.env.local` loads production URL for Next |
| Destructive guard | **No** universal production write-block for scripts |
| Service role (local `.env.local`) | **Absent** key names |
| Service role (app code) | **Referenced** for cron/auto-publish/odds (`SUPABASE_SERVICE_ROLE_KEY`) — may exist on Vercel only |
| Preview → production | Vercel project present; preview vs prod DB split **UNKNOWN** — likely same URL if only one project |

**Environment safety classification: UNSAFE** for any mutating test or “try it on staging.”

### C. Backup and recovery

| Item | Status |
|------|--------|
| Supabase plan / backup | **UNKNOWN** |
| PITR | **UNKNOWN** |
| Scheduled backups | **UNKNOWN** |
| Last backup | **UNKNOWN** |
| Restore tested | **UNKNOWN** / no evidence |
| Documented restore procedure | **Missing** in repo |
| Table-level recovery docs | **Missing** |
| Export without mutation | Possible via SQL Editor / dashboards (operator) — not automated |
| Restore authority | Mike / Supabase project owner (product assumption, not verified) |
| RPO / RTO | **UNKNOWN** |

### D. Database protections (repository + product facts)

| Protection | Status | Evidence layer |
|------------|--------|----------------|
| `leagues.sport_id` immutable | **VERIFIED LIVE** (product fact: applied) · SQL in repo | DB trigger `league-sport-immutable.sql` · app strips sport updates · pure verify PASS |
| Authenticated league deletion blocked | **APPLICATION ONLY** fail-closed · **DB may still allow** | `deleteLeague` returns false · `leave-delete-policies.sql` still has “Commissioner deletes league” |
| Membership uniqueness `(league_id, user_id)` | **PRESENT IN REPOSITORY** | `schema.sql` |
| Profile favorite uniqueness `(user_id, sport_id)` | **PRESENT IN REPOSITORY** | `profile-favorite-teams.sql` PK |
| Pick uniqueness | **PRESENT IN REPOSITORY** | picks unique `(league_id, user_id, week_number)` · pick_games `(pick_id, card_game_id)` |
| Late-pick prevention | **UNKNOWN / APPLICATION + possible RLS** | app lock checks · not fully audited live |
| Duplicate scoring | **UNKNOWN** | no complete DB unique inventory this pass |
| Trophy uniqueness `(league_id, season_year, trophy_type)` | **PRESENT IN REPOSITORY** | `trophy-room.sql` · FIX upsert SQL |
| Postseason snapshots | **REVIEW ONLY / NOT APPLIED** | `postseason-snapshots-REVIEW-ONLY.sql` header forbids run |
| Announcement reads | **PRESENT IN REPOSITORY** | schema announcement_reads PK |
| Role / commissioner auth | **PARTIAL** | RLS patterns in SQL · RPC staff helpers · app `isOps` |
| League / user RLS isolation | **PRESENT IN REPOSITORY · LIVE STATE UNKNOWN** | schema enables RLS · not re-audited live |

### E. Deployment and migration safety

| Item | Finding |
|------|---------|
| How migrations applied | **Manual** Supabase SQL Editor paste files under `supabase/` |
| Versioned migrations | **No** formal migration runner · flat SQL files · FIX-* ad hoc |
| Auto-run SQL on deploy | **No** evidence in Vercel config · app deploy ≠ SQL |
| Rollback SQL | **Manual** · no automated down migrations |
| Review-only SQL accident | **Risk HIGH** if operator pastes REVIEW-ONLY file · filename is only guard |
| App deploy reversible | **Vercel rollback** likely available · not verified this pass |
| Old code / new schema | **Untested tolerance** |
| Maintenance / global write freeze | **Not found** as product control |
| Kickoff/scoring deploy guard | **Not found** |

### F. Quality baseline (non-mutating only)

**Ran (safe):** pure static/unit verifiers · `tsc` · `lint` · `build`

| Check | Result |
|-------|--------|
| verify-no-production-league-delete | PASS |
| verify-league-sport-immutability | PASS (static) |
| verify-trophy-lightbox-lock | PASS |
| verify-auto-balance-ui | PASS |
| verify-legacy-hardware-ids | PASS |
| verify-profile-hardware-matrix | PASS |
| verify-nfl-cfb-home-mission | PASS |
| verify-postseason-ps1 | PASS (273 pure) |
| verify-auto-balance-planner | PASS |
| verify-crystal-ball-states | PASS |
| `tsc --noEmit` | **FAIL** pre-existing `PASSWORD_RECOVERY` vs auth event types |
| `npm run lint` | **FAIL** mass `@typescript-eslint/no-require-imports` rule-definition missing (config debt) |
| `npm run build` | **PASS** (skip typecheck/lint in Next config path) |

**Skipped for safety:** any script with Supabase network writes; untracked `patch-account-identity.mjs` / `probe-nfl-allegiance.mjs`; all SQL execution; Foundry sim paths; production probes that mutate.

**Missing categories:** no automated RLS integration suite; no backup restore test; no multi-tenant isolation CI; no deploy-SHA assertion.

### G. Emergency controls

| Control | Status |
|---------|--------|
| Delete League UI / helper | **Green (app)** — frozen fail-closed |
| Delete League RLS | **Red risk** — repo still ships commissioner DELETE policy |
| Sport immutability | **Green (claimed live DB + app)** |
| SAFE NAV | **Green (app default ON)** · localStorage override |
| Foundry production access | **Amber** — creator UUID gate · mode gate · history of bleed |
| Disable scoring/publish global | **Missing / UNKNOWN** |
| Read-only maintenance mode | **Missing** |
| Revoke deputy/commish | **Partial** — transfer RPC / membership fields · not audited end-to-end |
| Feature flag without redeploy | **Partial** — SAFE NAV localStorage · no remote flags |
| Incident / audit log | **Partial** — console / runtime-iso · no central SIEM |

### H0 safety dashboard

| Area | Status | Evidence |
|------|--------|----------|
| Git main aligned | **Green** | local = origin HEAD |
| App build | **Green** | build exit 0 |
| Sport immutable (DB) | **Green*** | *product fact applied; not re-probed |
| Delete league app | **Green** | fail-closed + pure tests |
| Delete league DB | **Red** | leave-delete policy still grants DELETE |
| Environment isolation | **Red** | production-only Supabase |
| Service role local | **Green** | absent in .env.local |
| Service role Vercel | **Amber** | code expects key · presence unknown |
| Backups / PITR | **Amber** | UNKNOWN |
| Migrations process | **Amber** | manual SQL · REVIEW-ONLY risk |
| Foundry isolation | **Red / Amber** | historical failure · app gate only |
| Typecheck clean | **Amber** | known tsc fail |
| Lint clean | **Amber** | config debt |
| Postseason snapshots | **Green (not applied)** | REVIEW-ONLY respected |

**Top five immediate safety gaps**

1. **No staging / single production Supabase** — any live test is production.  
2. **Commissioner league DELETE may still be allowed by RLS** while app freezes UI.  
3. **Backup/PITR unverified** — no restore drill.  
4. **Foundry not proven isolated** — career integrity is application gate.  
5. **Manual SQL apply path** — REVIEW-ONLY / FIX scripts can be mis-run.

---

## 3. H1 — Crown-jewel data map

### Crown-jewel ownership table (summary)

| # | Domain | Authority | PK / identity | League | Sport | Season/week | Owner | Writers (layer) | Confidence |
|---|--------|-----------|---------------|--------|-------|-------------|-------|-----------------|------------|
| 1 | Auth identities | Supabase Auth | `auth.users.id` UUID | — | — | — | Personal | Auth service | High |
| 2 | Profiles | `profiles` | `id` = auth UUID | — | — | — | Personal | Client + RLS own row | Med |
| 3 | Favorite teams | `profile_favorite_teams` | `(user_id, sport_id)` | — | **sport_id** | — | Personal | Client upsert | Med–High |
| 4 | Leagues | `leagues` | `id` UUID · `code` unique | self | **sport_id immutable** | `current_week` | League | Insert create · update settings | High |
| 5 | Memberships | `memberships` | `(league_id, user_id)` | yes | via league | season stats fields | League seat | Join / ops / bots | High |
| 6 | Roles / deputy | memberships flags + `commissioner_id` | user UUID | yes | — | — | League | Commish RPC / update | Med |
| 7 | Divisions | `memberships.division` | membership id | yes | labels sport-aware | — | League seat | Ops Auto Balance | Med |
| 8 | League settings | `leagues` columns / settings jsonb | league id | yes | — | — | League | Commish | Med |
| 9 | Week cards | `week_cards` | `(league_id, week_number)` unique | yes | via league | week | League | Commish / auto-publish **service** | High |
| 10 | Card games | `card_games` | id · week_card_id | yes | — | week | League | Commish | High |
| 11 | Publication | `week_cards.published_at` | card id | yes | — | week | League | Publish paths | High |
| 12 | Picks | `picks` | `(league_id, user_id, week_number)` | yes | — | week | Personal-in-league | Client | High |
| 13 | Lock timestamps | `picks.locked_at` · game `start_time` | pick / game | yes | — | week | Hybrid | Client lock · deadlines | Med |
| 14 | Weekly results | `week_results` / `game_results` | unique week | yes | — | week | League | Score paths · service | Med |
| 15 | Season points | `memberships.total_points` etc. | membership | yes | — | season | League seat | Scoring | Med |
| 16 | Standings inputs | derived memberships + results | — | yes | — | season | Derived | No separate table | Med |
| 17–19 | Postseason field | **intended** snapshots tables | league+season_key | yes | sport_id | cut week | League | **Not applied** · pure PS1 engine only | High (not live) |
| 20–21 | Champ / Toilet result | `league_trophies` + brackets | unique type/year | yes | — | year | League | auto-trophies / awardTrophy | Med |
| 22 | Career hardware | `league_trophies` + **profile legacy seeds** | trophy id · **user UUID seeds** | multi | sport on plaque | year | Person + league | Engravers · client seeds (read) | Med |
| 23 | Achievements / titles | permanent badges local+cloud · equip fields | badge id · user | multi | — | — | Personal | badge eval · RLS | Low–Med |
| 24–25 | Announcements / reads | announcements + reads | composite PK | yes | — | — | League | Commish insert · user read ack | Med |
| 26 | Locker messages | locker tables | message id | yes | — | week purge | League | members | Med |
| 27 | Gazette | gazette archive tables / local | league+week | yes | — | week | League | publish paths | Med |
| 28–29 | Moments / seen | localStorage + cloud eggs | user · moment id | mixed | — | — | Personal UX | client · SAFE NAV gated | Low |
| 30 | Season identity | `canonicalSeasonYear()` | date rule | — | — | year | App pure | none | High |
| 31 | Account preferences | profiles + localStorage | user | — | theme | — | Personal | client | Low |
| 32 | Foundry fixtures | localStorage · test leagues | session sticky | **must not** prod career | — | — | Lab | creator-only UI | Low isolation |

### Personal vs league vs season matrix

| | Personal (UUID) | League (`league_id`) | Season/week |
|--|-----------------|----------------------|-------------|
| Allegiance | yes | no | no |
| Picks | yes (in league) | yes | week |
| Points / standings | seat | yes | season |
| Trophies engraved | winner_user_id optional | **yes** | year |
| Profile legacy NFC/AFC | **UUID only** | no | year label |
| Gazette / announcements | reader ack | **yes** | week |
| Ceremony | experience | league context | moment |

### Cache / local-copy inventory (non-exhaustive)

| Store | Contents | Stale risk |
|-------|----------|------------|
| `warroom-session` / league localStorage | active league, playerId, sport stamp | **High** if treated as authority |
| Roster / players / card caches in `cloud.ts` | TTL maps | Stale divisions/points until invalidate |
| `warroom-active-week:*` | week UX | Must not override cloud week truth |
| Practice / bored keys | disposable | Bleed if not cleared |
| Badge celebration / seen keys | UX | Double celebrate |
| Foundry sticky | lab | Mis-mode if left on |
| sessionStorage peek cards | card paint | Stale card art |

**Law:** production data outranks browser state.

### Remaining name-based identity list

| Path | Status |
|------|--------|
| Conference NFC/AFC seeds | **UUID only** (good) |
| Excel Kahmann / Strayer / Ben | **Name / alias** |
| Maria Super Bowl / Vonnagio legacy | **Name / alias** |
| `resolveLiveTrophyHolder` fallback to name | **Name** |
| Standings hardware flair | **Name** + activeSportOnly |
| prior-season seed matchPlayerId patterns | **Name patterns** |
| Vonnagio Maria title rewrite | **Name** |

### Boundary traces

**A. UUID** — Auth `profiles.id` authoritative. Viewed profile route uses `params.id`. Conference hardware UUID-bound. Excel-era still name-bound.

**B. League isolation** — Core tables require `league_id` in schema. Session localStorage can **scope** which league is active; risk if writer omits league and uses session only (Pass 2 write inventory).

**C. Sport isolation** — `leagues.sport_id` cloud authority; trigger blocks UPDATE; app strips sport from save. Local sport stamps presentation-only when restored correctly (verify suite). No intentional post-create sport path in app tests.

**D. Season/week** — `canonicalSeasonYear` pure. CFB week 0 vs NFL week 1 enforced in hub mission tests. Hardcoded 2025/2026 remain in legacy seeds and copy.

**E. Permanent history** — Results: trophies + membership stats. Presentation: Museum, Profile, ceremony, Gazette, Moments. Viewing must not grant (lightbox OK). Host Trophy Room sync **can** write.

**F. Foundry** — Creator-gated lab UI; `canWritePermanentCareer` mode gate; historical career bleed documented. Paths can touch scoring/ceremony when sticky. **Classification: PARTIAL (historically FAILED).**

### Foundry isolation verdict: **PARTIAL**

### Recovery-capability matrix

| Asset | Backup known? | Export? | Restore drill? |
|-------|---------------|---------|----------------|
| Auth users | UNKNOWN | UNKNOWN | UNKNOWN |
| leagues / memberships | UNKNOWN | SQL possible | UNKNOWN |
| picks / results | UNKNOWN | SQL possible | UNKNOWN |
| league_trophies | UNKNOWN | SQL possible | UNKNOWN |
| profile favorites | UNKNOWN | SQL possible | UNKNOWN |

### Top ten data-integrity risks

1. Single production database for all testing.  
2. Possible live RLS still allowing league DELETE.  
3. Foundry / mode gate only app-layer for career.  
4. Name-based legacy hardware grants.  
5. Session/localStorage treated as league/sport truth.  
6. Manual SQL migrations without runner/versioning.  
7. Postseason durability not live (REVIEW-ONLY).  
8. Host auto-engrave / seed on Trophy Room open.  
9. Cache races (mitigated for roster; other domains open).  
10. Unverified backups + no RPO/RTO.

### Questions for Mike / ChatGPT

1. Confirm Supabase plan, PITR, last backup, restore owner.  
2. Confirm production deploy SHA vs `dc239f1`.  
3. Should commissioner DELETE RLS be **revoked** now?  
4. Staging project timeline?  
5. Is Foundry allowed any write to production-mode leagues?  
6. Excel-era name grants: freeze as historical or force UUID map?  
7. Maintenance / global write freeze product?  
8. Who may run SQL in production (allowlist)?  
9. Saturday Situation Room CFB: residual local stamps to purge?  
10. Accept PASSWORD_RECOVERY tsc debt or fix in Pass 2?

---

## 4. Verified protections

- App delete-league fail-closed + UI removed (pure tests).  
- Sport_id immutability SQL + app no post-create sport write (product: applied live).  
- Membership / week_card / pick / trophy uniques **in repository SQL**.  
- Favorite teams PK `(user_id, sport_id)` in repository.  
- SAFE NAV default ON.  
- Career write gate `canWritePermanentCareer` for production mode.  
- Conference hardware UUID-only + global profile career shelf.  
- Build green; pure postseason / hub / balance / hardware verifiers green.

## 5. Unknown protections

- Live RLS matrix; live delete policy state; service role on Vercel; backup/PITR; deploy SHA; late-pick DB enforcement; scoring idempotency DB; announcement RLS live; feature flags remote.

## 6. Known unsafe gaps

- Production-only environment.  
- Repo still contains commissioner DELETE league policy SQL.  
- Foundry historical bleed + app-only isolation.  
- REVIEW-ONLY SQL human-error path.  
- Name-based legacy grants.  
- Untracked write-capable scripts in workspace.

## 7. Top five P0 candidates (for later passes — not fixing now)

1. Revoke/confirm league DELETE at database.  
2. Staging project or hard script guard against production writes.  
3. Backup verification + restore runbook.  
4. Foundry hard quarantine proof (DB + app).  
5. Service-role inventory on Vercel + least privilege.

## 8. Top ten next audit targets (Pass 2 write inventory)

1. `awardTrophy` / auto-engrave / prior-season seed  
2. Score week / closeout  
3. Publish card / auto-publish service  
4. Join / leave membership  
5. Auto Balance + division updates  
6. Pick lock / submit  
7. Season reset / start next season  
8. Pass commissioner / deputy  
9. Favorite team upsert  
10. Foundry score / drama / scrub paths  

## 9. Recommended Pass 2 scope

Complete **write inventory** (every INSERT/UPDATE/DELETE/RPC): client vs server vs service role; authz; idempotency; transaction; caches. Still **no production mutation**. Optional: read-only SQL catalog of live constraints if Mike authorizes dashboard SELECT of `pg_constraint` / policies only.

## 10. Explicit confirmation

- Production data **unchanged**.  
- **No schema executed**.  
- **No application runtime code changed** (this document only if committed).  
- **No destructive tests**.  
- Skipped: network write scripts, untracked mutators, SQL apply, Foundry execution, live mutation probes.

---

*End Pass 1.*
