# CFB variable-card finalization

Three and Out Week 5 had 30 published CFB games, all final, but no official
week result. The deployed autonomous-football-results v14 only accepted CFB
cards of 5–10 games. isScheduleEligible rejected the card before prop evaluation.
Publishing already permits 5–30 CFB games.

The fix accepts 5–30 CFB games, matching publishing and the existing NFL rule.
It still requires every published game to have a valid kickoff and a final score,
a supported prop, and a successful atomic scoring receipt. Championship and
basketball behavior is unchanged.

This source also synchronizes the existing deployed v14 baseline, including its
NFL variable-card support and prior prop/schedule/cache handling. Relative to
that live baseline, only the CFB upper bound and its explanatory comment change.
JWT verification must remain enabled when deploying.

Run with Node 24:

```sh
node scripts/verify-autonomous-football-finalization.mjs
```

The handler-level regression uses a fake database and never writes production.
It covers all CFB/NFL sizes 5–30, invalid bounds and dates, unchanged championship
and basketball rules, 29-of-30 incomplete finals, a decisive prop on game 30,
unsupported props, already-scored weeks, and RPC failures.

Deployment and production verification are separate from source persistence.
After deployment, verify the scheduled job creates one week result, all 30 game
results, scores all four locked picks, and advances Three and Out to Week 6.
