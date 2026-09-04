# Tasks

## Active

- [ ] **Build 21 weapon scoring parity** - Repair NFL postseason JDAM risk/reward scoring and preserve the verified Fieldhouse Hellfire rules when Fieldhouse is integrated. Full acceptance criteria are recorded in `native-ios/PARKING_LOT.md`.

## Waiting On

## Someday

## Done

- [x] ~~Fieldhouse authenticated persistence foundation~~ (2026-09-04)
  - Reused the shared league, card, pick, favorite-team, Crystal Ball, and trophy records; translated Fieldhouse team names to the shared home/away contract; scoped cached state by account and league; and required server read-back after every authenticated save. The live route remains gated off until scoring and real basketball feeds are complete.

- [x] ~~Match Fieldhouse You page to the shared profile standard~~ (2026-09-03)
  - Replaced the separate Fieldhouse personnel-file layout with the shared CFB/NFL You-page hierarchy, retaining only Fieldhouse skin, basketball statistics, trophies, and copy.
- [x] ~~Apply the collected Fieldhouse correction batch~~ (2026-09-03)
  - Made the open Week XX Make Picks control bright red, clarified the four conference trophies, moved Bracket Hellfire to the top, and replaced the obsolete 68-team/67-decision placeholder with the official 2027 76-team/75-decision structure plus bracket History.
