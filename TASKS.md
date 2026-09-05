# Tasks

## Active

## Waiting On

## Someday

## Done

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
