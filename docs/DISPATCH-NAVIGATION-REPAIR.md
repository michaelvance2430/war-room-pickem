# Dispatch page navigation repair

The production Dispatch reader could remain on its front page after tapping SPORTS. An iPhone 17 Pro / iOS 26.5 UI test reproduced the failure: the SPORTS button reported hittable, but `CLASSIFIED // PAGE 2 OF 4` never appeared.

The large `scaledToFill` decorative photo was visually clipped to 190 points without opting out of hit testing. Its invisible image region could overlap the page controls. The repair disables hit testing on the photo and defines each page button's entire 44-point label as a rectangular tap target. Decorative border overlays also ignore touches.

The DEBUG-only `--dispatch-navigation-preview` launch argument supplies synthetic editions to the production GazetteView. It uses the actual archive picker, page bindings, paper and bundled artwork. It performs no account restore or backend writes. Add `--dispatch-nfl` for NFL.

Regression coverage taps pages 2, 3, 4 and 1 across strike, ordinary and postseason-transition editions, then verifies Back. Both CFB and NFL passed on the corrected release source. The original CFB test failed on the first attempt to open page 2.

No database changes or new App Store/TestFlight upload are part of this fix. The active iOS release checkout receives the tested patch; only the targeted change is ported to main.

Apple documents the hit-testing controls used here: [allowsHitTesting](https://developer.apple.com/documentation/swiftui/view/allowshittesting(_:)) and [contentShape](https://developer.apple.com/documentation/swiftui/view/contentshape(_:eofill:)).
