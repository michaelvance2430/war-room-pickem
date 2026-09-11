# War Room Pick'Em — TestFlight Submission

## App identity

- App name: War Room Pick'Em
- Bundle ID: `com.warroompicks.WarRoom`
- Version: `3.5`
- Build: `29`
- Platform: iPhone
- Minimum iOS: 17.0
- Category: Sports
- Support URL: `https://app.war-room-picks.com/support`
- Privacy policy: `https://app.war-room-picks.com/privacy`
- Terms: `https://app.war-room-picks.com/terms`

## Beta description

War Room Pick'Em is a private-league football and college-basketball picks app built around flexible weekly cards, confidence points, best bets, live boards, standings, scorecards, postseason brackets, achievements, and league trash talk. Build 29 adds a sport-grouped My Leagues tracker beneath the Home scorecard, account-saved league visibility controls in Edit Profile, automatic removal of completed seasons, a guided practice card, clearer pick and Best Bet steps, named Members’ Top 12 ballots, and seasonal Home presentation.

## Build 29 focus

- On Home, compare all leagues grouped by CFB, NFL, NCAAM, and NCAAW. Check overall rank, current-week points/TBD, and scored-game counts.
- Collapse and reopen My Leagues. Hide a league with “Don’t show this league,” then restore it using the Edit Profile link → League Tracker. Preferences follow your account.
- Open a league from the tracker and use the Back arrow to return to Home.
- Completed seasons disappear after official closeout. Publishing a new card restores a returning league unless the player has hidden it.
- Try the guided practice card and the team → confidence → optional Best Bet flow.
- Review AP Top 25 and the Members’ Top 12 ballot receipts.

## What to test

1. Create an account or sign in.
2. Join the supplied review league.
3. Open the weekly card and save picks.
4. Confirm picks remain private before kickoff.
5. Review standings and scorecard explanations.
6. Open the Locker Room, post a safe message, react, report a message, and block a player.
7. Open Profile > Privacy & Safety and verify Privacy, Terms, Support, and Delete Account.
8. Exercise postseason and bracket screens using the supplied league state.
9. In You > Edit Profile, turn War Room alerts off and on; if iOS previously denied permission, confirm the control opens the app's notification settings.
10. Open The Dispatch, move through all four pages, and share the four-page image set.

## Review notes

- This app does not offer gambling, wagering, cash prizes, or real-money contests.
- Football results are scored from the authoritative live-score pipeline and remain explainable in player scorecards. Commissioners do not choose official winners.
- Locker Room content is user-generated. The app filters prohibited abuse, permits reporting, permits blocking, and provides direct support contact.
- Account deletion is available inside Profile > Privacy & Safety. Personal profile data is removed; completed league results remain anonymized so historical standings are not rewritten.
- A populated reviewer account and league must be entered in App Store Connect immediately before submission.

## App Privacy answers

Data linked to the user and used only for App Functionality:

- Name
- Email address
- User ID
- Photos or videos (optional profile photo)
- Other user content (Locker Room messages)
- Gameplay content (picks, scores, standings, achievements)
- Device ID (APNs token and per-install notification identifier)

Tracking: No.

Advertising: No.

Analytics SDK: None currently embedded.

## Export compliance

The app uses only encryption provided by Apple's operating system and HTTPS for network transport. `ITSAppUsesNonExemptEncryption` is set to `NO`.

## Age rating recommendation

Complete the App Store Connect questionnaire truthfully. User-generated Locker Room content and unrestricted web links to support/legal pages must be declared. The initial product should not be placed in the Kids category.

## Final gates before upload

- [ ] Production account deletion returns success for a disposable account.
- [ ] Reported Locker Room content reaches the moderation queue/support channel.
- [ ] Blocked-player messages disappear and remain hidden after relaunch.
- [ ] Privacy manifest is present at the root of the archived `.app`.
- [ ] `scripts/verify-native-ios-release-metadata.mjs` passes for the intended version and build number.
- [ ] Release archive passes Xcode validation.
- [ ] Reviewer account and populated review league are active.
- [ ] Contact name, phone, and email are entered in Beta App Review Information.
- [ ] Beta feedback email is entered.
- [ ] All agreements in App Store Connect are active.
- [ ] App Store Connect privacy answers disclose Device ID as linked to the user, used for App Functionality, and not used for tracking.
- [ ] Physical iPhone receives a real APNs alert, routes to the intended league/week, and stops receiving alerts after the profile toggle is disabled.
- [ ] Physical iPhone with Instagram/Facebook installed receives all four Dispatch images from the system share sheet.
- [ ] `public.app_release_channels` remains disabled until Apple confirms the build is publicly installable.
