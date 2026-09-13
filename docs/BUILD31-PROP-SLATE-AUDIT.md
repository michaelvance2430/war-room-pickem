# Build 31 prop slate-size audit

Held source changes; no live cards, database rows, deployments, or Apple uploads were changed.

## Coverage and rules

Audited 36 native football presets, 10 Fieldhouse basketball presets shared by men and women, and 69 web presets including manual player/stat questions.

- Card-wide event counts retain their baseline proportion, rounded upward. Football's 3 of 5 becomes 6 of 10 or 13 of 21; 2 of 5 becomes 9 of 21. Basketball's 3 of 10 becomes 7 of 21; 6 of 10 becomes 13 of 21.
- Combined score totals scale per game: the high threshold is 56 × games + 1; the low threshold is 40 × games. At 21 games these are 1,177 and 840.
- Single-player and single-game targets stay fixed. A 200-yard performance stays 200 yards. Any/all questions apply to all games actually on the published card. This is structural scaling, not probability balancing.
- Labels, questions, answer options and grading agree. Reopening the slate and selecting a preset resolves its size again; web publication resolves the preset against the actual selected games.
- Published football questions are graded using their stated thresholds, not newly scaled thresholds. Historical five-game wording remains recognized. Fieldhouse accepts both old spelled-out and new numeric count wording (existing published Fieldhouse cards have ten games).
- The edge evaluator supports 1–30 finals and numeric count thresholds, plus legacy spelled-out basketball counts. Existing card-format validation remains in place; this does not expand the permitted published slate sizes for any sport.
- Two older web wording aliases (favorite sweeps and final ties) now resolve in the edge grader.
- Custom questions and player/box-score props retain manual grading. Arbitrary custom text is not rewritten. Home-underdog/rivalry-specific props still depend on the commissioner selecting an eligible slate; this change does not rebalance prop probabilities or select games.

## Validation

`node --import tsx scripts/verify-prop-slate-sizes.ts` generates Swift fixtures from the actual native bank, then exercises all 69 web presets across 1–30 games, all 1,380 native/edge combinations, web automatic questions against the edge evaluator, count boundaries, and historical count/total semantics. Requires Xcode's Swift compiler on macOS.

Full iOS Simulator build passed. Web TypeScript check passed with Deno edge-function files excluded; the repository-wide Next TypeScript configuration currently includes those Deno files and reports runtime/module typing errors. The exact edge evaluator is exercised by the regression script without starting its server or accessing credentials.

## Release order

Deploy and verify the backward-compatible autonomous-football-results evaluator before releasing the client changes or updated web publishers. Then ship the native work in Build 31. No migration or rewrite of existing card props is needed. GitHub publishing remains pending the prior explicit-approval block; these changes are committed locally.
