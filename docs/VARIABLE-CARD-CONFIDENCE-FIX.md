# Variable-card confidence storage

The 2026-09-29 Three and Out CFB Week 5 card contained 30 games. Publishing and
`save_week_picks_atomic` accepted that size, but `pick_games_confidence_check`
still limited storage to 1..10. Both manual submissions and Tactical Nuke plans
failed when inserting confidence 11 or higher.

Apply `supabase/variable-card-confidence-range.sql` to existing databases.
`supabase/schema.sql` uses the same 1..30 boundary for new databases. The save RPC
continues to validate confidence against the actual card size, enforce unique
confidence values, authenticate membership, freeze at kickoff, limit weapons to
two uses, validate the targeting plan, and seal authorized weapon cards.

## Verification

`scripts/verify-variable-card-confidence.sql` exercises the real save RPC on an
open 30-game CFB card. Configure `warroom.test_league_id`,
`warroom.test_user_id`, and `warroom.test_week` in the same database session first.
Choose a member with an unused weapon authorization and no sealed card. Run the
whole script: its transaction and nested subtransactions roll back all saves,
receipts, and derived weapon totals.

Production verification on 2026-09-29:

- Reproduced the pre-fix Nuclear rejection at `pick_games_confidence_check`.
- Tested the proposed constraint inside a rolled-back transaction before applying.
- Applied the constraint and reran the regression against the deployed database.
- Manual and Nuclear 30-game saves both passed, storing 30 picks, confidence 1..30,
  and a confidence sum of 465.
- Nuclear generated its 30-decision receipt; subsequent edits were rejected.
- Confidence 0 and 31 remained rejected by the table constraint.
- Verified the new constraint is validated and no test picks, receipts, or weapon
  uses remained after rollback.
- Application TypeScript check passed with the separate Deno Edge Function tree
  excluded. The repository-wide check includes that tree and fails on its existing
  Deno globals and npm: imports; no application or Edge Function code changed.
- Supabase security advisor returned existing policy/function/configuration
  findings outside this constraint change. No grants, policies, or functions changed.

No client release is required. Players with a remaining authorization can retry.
