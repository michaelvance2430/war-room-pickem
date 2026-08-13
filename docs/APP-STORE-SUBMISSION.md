# War Room Pick'Em — App Store Submission Packet

**Prepared:** August 13, 2026  
**Bundle ID:** `com.warroompicks.app`  
**Version:** 1.0  
**Release model:** Free 1.0; no purchases, ads, cash prizes, or wagering

## Store URLs

- Support: `https://www.war-room-picks.com/support`
- Privacy Policy: `https://www.war-room-picks.com/privacy`
- Privacy Choices: `https://www.war-room-picks.com/account`
- Terms: `https://www.war-room-picks.com/terms`
- Community Standards: `https://www.war-room-picks.com/community`

## Suggested listing

**Name:** War Room Pick'Em  
**Subtitle:** Pick games. Run the room.  
**Primary category:** Sports  
**Secondary category:** Games  

**Promotional text:** Build a private CFB or NFL pick'em room, lock confidence picks, survive the postseason, and keep the receipts.

**Description:**

War Room Pick'Em turns a friend-group football pool into a full season command center. Create or join a private room, make weekly confidence picks, designate Best Bets, follow live standings, talk responsibly in the Locker Room, and chase permanent league hardware.

CFB and NFL rooms keep separate schedules, rules, picks, postseason formats, and history. Commissioners publish cards and manage the room while every player keeps one account across leagues.

Free 1.0 includes the competitive game, standings, Locker Room, achievements, trophies, postseason play, reporting, blocking, and moderation. War Room does not offer real-money gambling, entry-fee collection, or cash prizes.

## App Privacy answers

Answer **Yes, data is collected**. The following is linked to the user's identity and used for App Functionality unless noted.

| Apple data type | War Room examples | Purpose |
|---|---|---|
| Contact Info · Email Address | Login, password recovery, support verification | App Functionality, Account Management |
| User Content · Photos or Videos | Avatar and Locker image uploads | App Functionality |
| User Content · Other User Content | Locker posts, reactions, reports, league settings | App Functionality, Safety |
| Identifiers · User ID | Supabase Auth/profile identifiers | App Functionality, Security |
| Usage Data · Product Interaction | League membership, picks, scores, achievements, feature state | App Functionality |
| Other Data | Favorite teams and optional birthday month/day | Personalization, App Functionality |

- Tracking: **No**
- Third-party advertising: **No**
- Developer advertising/marketing: **No** for free 1.0
- Data sold: **No**
- Precise/coarse location: **No**
- Contacts, health, financial, payment, browsing, search history: **No**
- Diagnostics: disclose only if a diagnostics/crash SDK is added before submission.

Supabase is an infrastructure service provider for authentication, database, and storage; its handling must be included in the app-level answers.

## Age rating questionnaire

Use the questionnaire's current wording; do not force a lower result.

- User-generated content: **Yes**
- Messaging and chat: **Yes**
- Social media: **No** (private league Locker, no broad public feed/discovery)
- Parental controls / age assurance: **No**
- Unrestricted web access: **No**
- Advertising: **No**
- Contests: **Frequent**
- Gambling with real money or redeemable currency: **No**
- Simulated gambling: **Infrequent** (conservative answer for fictional Bowl Mania bankroll points)
- Profanity or crude humor: **Frequent**
- Guns or other weapons references: **Frequent** (War Room/JDAM/arsenal theme)
- Realistic or graphic violence: **None**
- Sexual content, drugs, alcohol, medical content: **None**, unless product content changes
- Recommended floor: **13+**; accept Apple's generated regional ratings.

## App Review notes

War Room Pick'Em is a free, private friend-league sports prediction game. It does not accept entry fees, facilitate bets, award cash or redeemable currency, or link to sportsbooks.

Review path:

1. Launch the app and allow or skip the native opening movie.
2. Sign in with the review account.
3. Open the populated review league.
4. Visit Picks, Standings, Locker, another player's profile, and You/Account.
5. On another player's profile, expand Safety to test report/block controls.
6. The commissioner review account can open Moderation to review reports, mute members, and remove posts.

The app loads War Room's canonical HTTPS product inside a Capacitor iOS container while native opening, lifecycle, link routing, haptics, and status-bar behavior are supplied by the iOS project.

## Owner actions before upload

- Create a fictional, populated App Review league and two non-personal review accounts.
- Put the credentials in App Store Connect Review Information, never in source control.
- Confirm the support inbox is monitored.
- Confirm account deletion is publicly enabled only after the cascade-safe migration and device proof pass.
- Capture current iPhone screenshots after the signed device build is final.
- Recheck every privacy answer if analytics, crash reporting, notifications, payments, or advertising are added.

## TestFlight acceptance run

- Fresh install → opening movie → skip and natural completion.
- Login, persisted session, force-close, relaunch.
- Join by invite; password recovery returns to the app.
- CFB Week 0 and NFL Week 1 remain independent.
- Make, edit, submit, lock, background, resume, and verify picks.
- Commissioner publishes and scores; standings match the web product.
- Share invite; receive haptic confirmation on a physical iPhone.
- Locker text/image/reaction; block hides the player's posts.
- Report enters the private staff queue; staff resolve/dismiss/reopen.
- Network interruption produces a recoverable state and no duplicated write.
- Privacy, Terms, Community Standards, and Support open inside the app.
- Account deletion passes only after its release gate opens.
