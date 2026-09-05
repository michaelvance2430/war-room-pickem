# Build 21 database release order

Status: local review package only. Nothing in this document authorizes a production change.

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
9. Reapply `supabase/atomic-card-publish.sql`, `supabase/atomic-pick-save.sql`, and `supabase/atomic-week-scoring.sql` so their latest shared-card definitions win.

The tournament cron is deliberately excluded. Schedule `supabase/fieldhouse-tournament-results-cron-REVIEW-ONLY.sql` only after the Fieldhouse Edge Functions are deployed, secrets are verified, and a manual tournament-result cycle succeeds.

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
