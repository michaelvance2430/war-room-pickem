# Build 31: shared confidence controls

Held for the next iOS release. This change does not upload an archive or change live services.

- Shared football picks screen (CFB/NFL and any sport routed through it) and Fieldhouse picks (men's/women's basketball, including conference championships) use ConfidencePicker and ConfidenceUsageStrip.
- At most ten buttons. Green 1–10, yellow 11–20, red 21–30; cap values at the actual card size. Used values on other games are skipped. Tapping past the last available tier clears, and Clear is always available for a selection.
- Tracker remains above the scrolling slate. Tapping an assigned number scrolls to its game; unassigned numbers do not navigate.
- Existing scoring integers, save contracts, deadlines, and sport card sizes are unchanged. This does not authorize 30-game cards in formats with fixed card sizes. Brackets and ranked bowl selections do not use this confidence control.

Validation: compile/run native-ios/Checks/ConfidenceCycleChecks.swift with native-ios/WarRoom/ConfidenceCycle.swift. Covers sizes 1–30, complete unique allocation, used-value skipping, and clear behavior. Full simulator app build also required before release.

Validation completed September 13, 2026: full iOS Simulator build passed; men's and women's Fieldhouse two-row confidence UI checks passed. The UI checks use short drags within the slate to avoid flinging past the first game beneath the fixed tracker. GitHub backup push was blocked by automatic approval review; source remains committed locally pending explicit push authorization.
