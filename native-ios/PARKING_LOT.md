# War Room Parking Lot

## Notify Mike at these milestones

- Before outside phone testing: recommend creating and connecting Sentry for native crash and error reporting.
- When real users begin testing weekly flows: recommend creating and connecting PostHog for product analytics and usability signals.
- Before public release: reconsider Codex Security for a focused release audit.
- Figma remains optional; do not interrupt native development to add it unless Mike requests a separate design workspace.

These integrations are intentionally deferred. GitHub, Supabase, and Xcode are sufficient for the current native build.

## Saved review notes

- Championship cold open: announce Kahmann as last season's champion and visibly put a target on his back for the new season.

## Build 21

- Generalize `league_season_closeouts` beyond its CFB-only `sport_id` constraint. Support CFB, NFL, NCAAM, and NCAAW through one sport-aware closeout path; preserve existing CFB rows; validate trophy IDs against the correct sport catalog; enforce one closeout per league, season, and competition type; update champion/profile/commissioner consumers; and add CFB regression plus NFL/NCAAM/NCAAW coverage before migration deployment.
- Repair NFL postseason JDAM scoring. The current native flow generates a random 13-pick playoff bracket, permanently locks it, and records `used_jdam`, but `save_nfl_postseason_results` currently awards ordinary raw points with no JDAM risk/reward adjustment. Make the server-authoritative score follow the established postseason weapon rule: at or above the defined 60% success threshold, award 1.5x raw postseason points; below the threshold, cut raw points in half. Define the threshold against the NFL bracket's 13 decisions and weighted round scoring, show the exact rule in the irreversible confirmation and scorecard receipt, prevent edits/rerolls, update standings atomically, and add boundary tests on both sides of 60% before deployment.
- Preserve the Fieldhouse Hellfire rules when Fieldhouse enters a release build. Regular season: two uses, automatic posted-favorite card, immediate permanent lock, 2x every correct game-pick score including the Best Bet stack, zero penalty for misses, and no edits/reopen/rerolls. Postseason: one erratic 67-decision bracket override, permanent lock, 1.5x raw bracket points at 60% or better, and half raw points below 60%. The isolated preview implementation is committed at `55b7204` and `d327429`; production integration still requires real bracket persistence and server-authoritative scoring.
