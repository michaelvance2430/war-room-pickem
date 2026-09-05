# Build 21 Supabase branch rehearsal

Date: 2026-09-05  
Production project: `dorhjepugsjpmnuzdzck`  
Disposable branch: `build-21-release-rehearsal-20260905` (`mvlxpqziykkdlmjgcrto`)

## Safety boundary

- Production received SELECT-only preflight queries. No production write was made.
- The rehearsal branch was created without production data.
- Synthetic fixtures ran inside a transaction that ended with `rollback`.
- Fieldhouse scheduling cron and Edge Functions were deliberately excluded.

## Branch bootstrap finding

Supabase created the branch database but reported `MIGRATIONS_FAILED` because the
production project has no tracked migration history. The empty branch initially
contained zero public tables. For this rehearsal only, the current production
schema was reconstructed from read-only PostgreSQL catalog metadata. The rebuilt
baseline matched production at 54 public tables, 282 non-trigger constraints,
146 public functions, 138 indexes, 37 non-internal triggers, and 158 public RLS
policies before the Build 21 package was applied.

This is a release-process gap, not a Build 21 schema failure. Future Supabase
branches will remain unreliable until the production baseline is captured in a
real migration history.

## Package result

All eleven release steps applied in the documented order. A second application
of the Fieldhouse postseason package initially failed because its named RLS
policies were not dropped before recreation. The package was corrected and then
reapplied successfully.

The advisor pass also found and prompted these corrections:

- fixed `search_path` on `fieldhouse_round_weight`;
- added covering indexes for new Fieldhouse and career-hardware foreign keys;
- added explicit NFL publish/bracket RPC grants after converting the publish RPC
  to `security definer`;
- made every Fieldhouse postseason RLS policy safe to reapply.

After correction, the Build 21 subset had no mutable-search-path warning, no
anonymous `security definer` execution warning, and no unindexed-foreign-key
warning.

## Behavioral result

`supabase/build21-branch-rehearsal-ROLLBACK-ONLY.sql` returned `PASS` for:

- member-only competitive-status RPC access;
- seven active humans remaining Demo;
- eight active humans becoming Official;
- bots excluded from both human totals;
- four locked scored cards as the hard floor;
- at least 75 percent of eligible cards required;
- Demo play/scoring allowed while permanent hardware is rejected;
- exact Official champion receipt creation;
- repeated season closeout producing one receipt and rejecting changed evidence;
- native sport IDs `cfb`, `nfl`, `ncaam`, and `ncaaw`.

Post-run counts confirmed that every synthetic profile, league, membership,
competitive receipt, closeout, championship receipt, and Fieldhouse tournament
was rolled back to zero.

The disposable paid branch was deleted after verification and is no longer
present in the project's branch list.

## Release boundary

This rehearsal does not authorize production deployment, Fieldhouse routing,
Edge Function deployment, cron scheduling, TestFlight upload, or App Store
submission. Those remain separate approval and verification gates.
