# NFL variable-size board finalization

On September 22, 2026, three nine-game NFL boards stayed on Week 2 because the automatic finalizer assumed exactly five games. The publishing RPC already accepts 5–30 games for NFL. All nine official finals were present in the shared score cache.

The finalizer now validates NFL boards against the same 5–30 range and requires a final result for every published game before calling the atomic scoring RPC. It never advances the league directly or fabricates a score. Previously scored weeks remain skipped.

This source is synchronized with production `autonomous-football-results` version 14. It also preserves the preexisting deployed schedule eligibility, score-cache retention, provider usage accounting, and other-sport behavior that had not reached main. Do not replace it with an older release-checkout copy when deploying.

Run `node scripts/verify-autonomous-nfl-finalization.mjs` with Node 24. The same check is available as `npm run verify:autonomous-nfl-finalization`. Adding a GitHub Actions workflow requires a GitHub credential with workflow permission; the current connection lacks that permission. It covers valid and invalid NFL sizes, missing kickoff dates, other-sport size contracts, nine completed games, an incomplete ninth game, and already-scored weeks.

Production verification: Department of Football-DOF, All Jokes Aside, and Saturday Situation Room · NFL advanced to Week 3 through the normal scheduled finalizer. All 14 locked cards scored; all 25 membership totals and weeks-played values matched the scored-pick ledger.
