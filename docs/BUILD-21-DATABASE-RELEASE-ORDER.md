# Build 21 database release order

Status: production schema applied and read back on 2026-09-06 after Mike's explicit approval.

## Production deployment record

The guarded package was applied to Supabase project `dorhjepugsjpmnuzdzck` in
the order below. Supabase recorded migrations `build21_01_fieldhouse_schema`
through `build21_11_fieldhouse_worker_authorization`, including the three
shared atomic-definition reapplications (`09a` through `09c`).

Fresh production preflight passed before the release. Post-release readback
confirmed:

- all eight Fieldhouse postseason tables and all three competitive-hardware
  tables exist;
- the NFL postseason awards table exists;
- the competitive-status, Fieldhouse live-board, Fieldhouse scoring, and
  multi-sport closeout RPC signatures exist;
- anonymous and authenticated execution were removed from the trigger-only
  `advance_league_after_week_score()` function while `service_role` execution
  remains available;
- all new Fieldhouse tournament, bracket, round, award, competitive-season,
  career-receipt, and NFL-award tables contained zero rows immediately after
  deployment.

The `fieldhouse-odds` and `fieldhouse-tournament-results` Edge Functions were
then deployed with JWT verification enabled. `football-scores` version 11 was
deployed after release hardening exposed that production version 9 still forced
basketball requests onto the CFB feed and used a 50-second provider gate. The
version 11 readback confirms distinct NCAAM/NCAAW provider mappings, strict
league/sport membership binding, JWT verification, and a five-minute shared
live-score provider gate. Build 21 requests the exact week being scored so an
open future Fieldhouse card cannot suppress refreshes for the live board;
requests from older production clients remain compatible through the guarded
newest-card fallback. Production `autonomous-football-results` version 10 was
then deployed with JWT verification enabled. Its first scheduled run returned
`200`, inspected nine unfinished live cards, scored none prematurely, and
reported each card's incomplete final count. The worker now shares the
five-minute provider gate, supports distinct NCAAM/NCAAW feeds and ten-game
cards, handles the four-game Championship Week card without a prop, and sends
official final scores into the atomic scoring receipt. Its candidate-card scan
also holds 500 cards so the live and next-open cards for 100 active leagues can
coexist without the newer cards starving live scoring. The tournament worker was hardened
with a random Supabase Vault credential and a service-role-only authorization
RPC. A request without that private credential returned `403`; a Vault-backed
request returned `200` with zero published tournaments. The paid odds endpoint
also rejected an anonymous request with `403` before contacting the provider.
The tournament cron remains unscheduled until a real manual scoring cycle can
be verified against a published tournament.

This production release did **not** enable Fieldhouse routing, schedule the
tournament cron, upload TestFlight, or submit an App Store build.

## Native release validation record

After the production schema and Edge Function readback, the complete native
iOS test target passed on an iPhone 17 Pro simulator. That run covered the
shared CFB/NFL/Fieldhouse unit and UI suites, including the 75-decision
Fieldhouse bracket, NCAAM/NCAAW parity, regular- and postseason weapon rules,
active-board refresh behavior, strike presentations, bottom-navigation return
behavior, Patreon connection, and NFL JDAM scoring.

A fresh unsigned Release archive of native source through commit `9f7acdd` then completed
successfully at `/private/tmp/WarRoom-Build21-Unsigned.xcarchive`.
Packaged-app inspection confirmed:

- marketing version `3.3` and build `21`;
- `PrivacyInfo.xcprivacy` at the archived app root;
- CFB nuclear, NFL JDAM, NCAAM Hellfire, and NCAAW Hellfire strike movies;
- the War Room weekly-opening movie.

The weekly-opening presentation key has a focused native test proving that it
is scoped to the signed-in user, sport, and current week—not the selected
league. Switching between leagues in the same sport therefore cannot replay the
film, while a new week or a different sport can present its own opening.

Because the authenticated Fieldhouse route remains disabled, the Create League
sport picker is now governed by that same release gate. Build 21 cannot expose
NCAAM/NCAAW room creation while routing those rooms into the football
experience. Enabling the live route will enable those creation choices in the
same release.

This proves that the current source can produce a complete local Release
archive. Because code signing was intentionally disabled, it is **not** proof
of distribution signing, App Store validation, upload, TestFlight processing,
review submission, or release.

## Stop conditions

Do not continue if any preflight check fails. In particular, stop if a legacy NFL JDAM scorecard exists, because Build 21 requires an explicit recalculation rather than silently relabeling old points.

## Required baseline

Confirm production already contains the committed foundations below before applying any Build 21 file:

1. `supabase/cfb-season-closeout-v1.sql`
2. `supabase/postseason-authority-v1.sql`
3. `native-ios/Database/nfl-postseason-command.sql`
4. `supabase/atomic-card-publish.sql`
5. `supabase/atomic-pick-save.sql`
6. `supabase/atomic-week-scoring.sql`
7. `supabase/live-football-score-cache.sql`
8. `supabase/platform-odds-api-usage.sql`
9. The existing push-notification event table and delivery functions

Run `supabase/build21-production-preflight-SELECT-ONLY.sql` first. It performs no writes.

The historical `cbb` sport key is allowed only on a room whose mode is
`foundry`. It is an isolated preview compatibility row, not a live Fieldhouse
league. Any production-mode `cbb` row still fails preflight and must be
explicitly migrated to `ncaam` or `ncaaw` before this release can proceed.

## Build 21 schema order

Apply the review package as one guarded release window in this order:

1. `supabase/fieldhouse-build21-schema-REVIEW-ONLY.sql`
2. `supabase/competitive-league-qualification-build21-REVIEW-ONLY.sql`
3. `supabase/fieldhouse-postseason-build21-REVIEW-ONLY.sql`
4. `supabase/nfl-jdam-scoring-build21-REVIEW-ONLY.sql`
5. `supabase/nfl-postseason-awards-foundation-build21-REVIEW-ONLY.sql`
6. `supabase/multi-sport-season-closeout-build21-REVIEW-ONLY.sql`
7. `supabase/nfl-postseason-closeout-build21-REVIEW-ONLY.sql`
8. `supabase/fieldhouse-live-standings-build21-REVIEW-ONLY.sql`
9. `supabase/fieldhouse-tournament-worker-auth-build21-REVIEW-ONLY.sql`
10. Reapply `supabase/atomic-card-publish.sql`, `supabase/atomic-pick-save.sql`, and `supabase/atomic-week-scoring.sql` so their latest shared-card definitions win.

The tournament cron is deliberately excluded. Schedule `supabase/fieldhouse-tournament-results-cron-REVIEW-ONLY.sql` only after the Fieldhouse Edge Functions are deployed, secrets are verified, and a manual tournament-result cycle succeeds.

## Sport-schedule authority extension

Status: applied to production and read back on 2026-09-06 after Mike's
approval. This extension replaces guessed weekly opening dates with the
earliest eligible provider event inside each reviewed War Room week. The
guarded release used this order:

1. `supabase/sport-season-windows-build21-REVIEW-ONLY.sql`
2. `supabase/sport-season-window-seeds-build21-REVIEW-ONLY.sql`
3. `supabase/sport-schedule-usage-action-build21-REVIEW-ONLY.sql`
4. `supabase/sport-schedule-worker-auth-build21-REVIEW-ONLY.sql`
5. Deploy `supabase/functions/sport-schedule-sync/index.ts`, then invoke it once manually and inspect its response and usage receipt.
   - The first guarded production run exposed and repaired an empty-ingestion marker bug. `supabase/sport-schedule-empty-ingestion-repair-build21-REVIEW-ONLY.sql` is a one-time production correction, not a prerequisite for clean environments running the corrected worker.
6. Deploy the updated `football-odds` and `fieldhouse-odds` functions so paid pulls use the same server-owned boundaries.
7. Only after that readback passes, apply `supabase/sport-schedule-sync-cron-build21-REVIEW-ONLY.sql`.
8. Run `supabase/sport-schedule-sync-postverify-build21-SELECT-ONLY.sql` and require every `passed` value to be true.

The worker makes one provider `/events` request per active sport, not per
league. That endpoint is currently zero-credit schedule metadata; the usage
ledger still records every scan and fails closed if the audit receipt cannot be
written. CFB schedule ingestion and paid odds pulls share the same FBS filter.
Neither worker accepts product-week boundaries from the iOS client.

Production evidence: the first manual worker request exposed that empty future
scans were incorrectly being marked as ingested. Cron and paid-odds deployment
were held. The worker was corrected, the 32 false empty markers were cleared by
the one-time repair migration, and worker version 2 was deployed. The repeated
manual request returned `200`, scanned CFB, NFL, NCAAM, and NCAAW, found 52
candidate windows, verified 20 provider-backed windows, and reported no waiting
sport or provider-credit charge. `football-odds` version 18 and
`fieldhouse-odds` version 3 were then deployed with JWT verification enabled.
The daily `war-room-sport-schedule-sync` job was enabled only after that
readback. All eight post-verification checks passed, and a request without the
private worker credential returned `403`.

## Required post-verification

1. A league member can call `league_competitive_status`; a nonmember and anonymous user cannot.
2. A room with seven qualifying humans remains Demo; a room with eight becomes Official.
3. Four locked scored cards satisfy the floor only when they also represent at least 75% of that player's eligible cards.
4. Bots never count.
5. A Demo room can still play and score but cannot write a permanent trophy winner.
6. An Official room can write the exact authorized winner and produces one durable receipt.
7. Repeating the closeout is idempotent and does not duplicate receipts or milestones.
8. NCAAM, NCAAW, NFL, and CFB status calls decode in the native client.

Do not enable live Fieldhouse routing, schedule its cron, or upload Build 21 merely because the schema applies. App archive validation and the complete regression checklist remain separate release gates.
