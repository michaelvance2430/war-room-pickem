# War Room Pick'Em — TestFlight Submission

## App identity

- App name: War Room Pick'Em
- Bundle ID: `com.warroompicks.WarRoom`
- Version: `1.0`
- Build: `1`
- Platform: iPhone
- Minimum iOS: 17.0
- Category: Sports
- Support URL: `https://app.war-room-picks.com/support`
- Privacy policy: `https://app.war-room-picks.com/privacy`
- Terms: `https://app.war-room-picks.com/terms`

## Beta description

War Room Pick'Em is a private-league college football pick'em built around weekly cards, confidence points, best bets, standings, scorecards, postseason brackets, achievements, and league trash talk.

## What to test

1. Create an account or sign in.
2. Join the supplied review league.
3. Open the weekly card and save picks.
4. Confirm picks remain private before kickoff.
5. Review standings and scorecard explanations.
6. Open the Locker Room, post a safe message, react, report a message, and block a player.
7. Open Profile > Privacy & Safety and verify Privacy, Terms, Support, and Delete Account.
8. Exercise postseason and bracket screens using the supplied league state.

## Review notes

- This app does not offer gambling, wagering, cash prizes, or real-money contests.
- League results are entered by commissioners and are explainable in weekly scorecards.
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
- [ ] Release archive passes Xcode validation.
- [ ] Reviewer account and populated review league are active.
- [ ] Contact name, phone, and email are entered in Beta App Review Information.
- [ ] Beta feedback email is entered.
- [ ] All agreements in App Store Connect are active.
