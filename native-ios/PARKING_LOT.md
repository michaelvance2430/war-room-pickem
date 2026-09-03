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
