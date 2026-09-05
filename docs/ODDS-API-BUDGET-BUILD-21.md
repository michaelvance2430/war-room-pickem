# Build 21 Odds API budget

Status: local review package. No Edge Function or cron deployment is authorized by this document.

## Cost controls

- CFB, NFL, NCAAM, and NCAAW each use one shared live-score cache per sport.
- Native football boards may request that cache every 15 seconds without forcing a provider request.
- During an active game window, the cache can claim a paid provider refresh at most once every 300 seconds per sport.
- Outside the live window, football backs off to 15 minutes and then six hours while an unresolved card remains.
- Fieldhouse tournament scoring backs off to 15 minutes after the live window.
- Commissioner odds pulls remain intentional button actions. One US region and one market are requested.
- Every provider response records `x-requests-used`, `x-requests-remaining`, and `x-requests-last` in `platform_odds_api_usage`.

## Expected football-season envelope

The exact total depends on the earliest and latest games selected across all unresolved cards. At the five-minute live cadence, CFB and NFL together should normally consume roughly 1,400 to 1,800 score credits per week, plus commissioner odds pulls and postgame retries. The provider headers and the usage ledger are the authority; this estimate is not a billing guarantee.

Run `scripts/verify-odds-api-budget-build21.mjs` before deploying any scoring function.
