# Tasks

## Active

## Waiting On

## Someday

## Done

- [x] ~~Restore the Fieldhouse Home report rail~~ (2026-09-05)
  - Preserved the simplified upper Home hierarchy for NCAAM and NCAAW, then restored a collapsed More from War Room section with the real Patreon destination plus Field Reports cards for the data-backed Fieldhouse Dispatch, Locker Wire, and support-email workflow. The isolated preview switcher remains intentionally limited to Fieldhouse sports; CFB/NFL state was not mixed into the preview.

- [x] ~~Make the simplified Home-to-You hierarchy universal~~ (2026-09-05)
  - Removed Crystal Ball, room/player/game/submission metrics, Standings, Locker Room, and Announcements from the shared CFB/NFL Home above the Field Reports boundary and relocated them into the real shared You hierarchy. Applied the same rule to NCAAM and NCAAW, while preserving last scorecards, More from War Room, postseason/Dispatch, latest Locker report, and Help Shape the War Room on Home. Enlarged only the actionable command-box titles. The native build and full unit/UI test suite pass; no upload or production change was made.

- [x] ~~Replace the Build 21 football personnel board with a game-first scoreboard~~ (2026-09-05)
  - Removed the league-wide player dossiers and per-team player-name columns from the shared CFB/NFL Board. Every matchup now remains visible and is grouped Final, Live Now, or Waiting to Play with its kickoff and locked spread. A completed game illuminates the actual ATS winner—not merely the straight-up winner—with a green outline and glow. The native simulator build and full WarRoomTests suite pass; no upload or production change was made.

- [x] ~~Harden Build 21 privileged database functions~~ (2026-09-05)
  - Pinned every review-only Fieldhouse `SECURITY DEFINER` function—including the live-board reader—to an empty search path and hardened the existing NFL publish, bracket-save, reset, and result-scoring functions before they can bypass direct-write restrictions. Added regression checks that fail if a mutable public search path returns. All three Build 21 authority/scoring verifiers, the full native iOS test suite, the 21-part CFB regression gate, and the diff integrity check pass; nothing was executed against production.

- [x] ~~Add the Build 21 multi-sport season-closeout authority~~ (2026-09-05)
  - Replaced the CFB-only receipt contract with a review-only sport-aware closeout RPC for CFB, NFL, NCAAM, and NCAAW. It preserves the legacy CFB entry point, supports honest co-champion arrays, requires an Official-season receipt, validates each sport's trophy catalog, and checks final evidence against the correct football or Fieldhouse authority. The existing CFB consumer now uses the generic RPC. Multi-sport, CFB regression, Fieldhouse authority, and targeted lint checks pass; production was inspected read-only and not changed. Attaching the NFL ceremony remains separate because the current code has no authoritative rule mapping Final Thirteen results to league and Toilet Bowl winners.

- [x] ~~Protect career championships from demo-room farming~~ (2026-09-05)
  - Every permanent hardware write now creates a durable Official-season qualification receipt first. Only championship trophies from production rooms with that receipt count toward the new three-, five-, and ten-title career milestones. The native profile merges those milestone awards without duplicating the base championship achievement. Focused native tests and the Build 21 authority verifier pass; the SQL remains review-only and has not been executed against production.

- [x] ~~Make eight active players the official-league threshold~~ (2026-09-05)
  - Build 21 defines an active human as a non-bot player who locked at least 75% of completed eligible regular-season cards, rounded up, with a four-card minimum. Eight qualifying humans make a season official; smaller rooms remain fully playable demos but cannot create permanent hardware. Career promotion points and the visible Cheevo cabinet now count each achievement code once even when historical league-scoped rows contain duplicates. Fieldhouse final awards are filtered through the server-owned qualification receipt. Native tests and the Build 21 authority verifier pass; the database migration remains review-only and production is untouched.

- [x] ~~Lock Fieldhouse postseason tie law~~ (2026-09-05)
  - Selection Sunday now expands the Championship or Toilet Bowl field for every player tied at its four-player regional boundary. Regional, league, and Toilet Bowl awards use postseason points, then regular-season points; exact ties produce co-champions with hardware for every winner and never use UUID ordering. A Fieldhouse-specific multi-winner trophy projection preserves the existing CFB/NFL one-winner storage contract. Boundary fixtures, co-champion fixtures, the Build 21 authority verifier, and the native iOS build pass. Database changes remain review-only and production is untouched.

- [x] ~~Build 21 weapon scoring parity~~ (2026-09-05)
  - NFL postseason JDAM now uses a server-authored 8-of-13 decision threshold, applies 1.5× or 0.5× to weighted raw playoff points, records a detailed permanent receipt, and updates standings atomically. Direct client writes to the guarded postseason records are revoked by the review-only upgrade. Seven/eight boundary tests, the native simulator build, and the focused regression suite pass. Fieldhouse Hellfire rules remain unchanged and covered by the existing Build 21 authority verifier. The SQL remains review-only and has not touched production.

- [x] ~~Build the isolated Fieldhouse Championship Week bridge~~ (2026-09-05)
  - Added one four-game straight-up card after the 18-week regular season for ACC, Big 12, Big Ten, and SEC champions; confidence 4–3–2–1, one Best Bet, no prop, and no Hellfire. Certified points enter regular-season totals before Selection Sunday. Native tests, focused UI tests, and the Build 21 static authority audit pass. Database and scorer files remain review-only and the live Fieldhouse gate remains off.

- [x] ~~Fieldhouse authenticated persistence foundation~~ (2026-09-04)
  - Reused the shared league, card, pick, favorite-team, Crystal Ball, and trophy records; translated Fieldhouse team names to the shared home/away contract; scoped cached state by account and league; and required server read-back after every authenticated save. The live route remains gated off until scoring and real basketball feeds are complete.

- [x] ~~Match Fieldhouse You page to the shared profile standard~~ (2026-09-03)
  - Replaced the separate Fieldhouse personnel-file layout with the shared CFB/NFL You-page hierarchy, retaining only Fieldhouse skin, basketball statistics, trophies, and copy.
- [x] ~~Apply the collected Fieldhouse correction batch~~ (2026-09-03)
  - Made the open Week XX Make Picks control bright red, clarified the four conference trophies, moved Bracket Hellfire to the top, and replaced the obsolete 68-team/67-decision placeholder with the official 2027 76-team/75-decision structure plus bracket History.
