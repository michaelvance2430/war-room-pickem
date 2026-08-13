# War Room iOS Native Readiness

**Status:** Simulator development build active; no public App Store launch authorized
**Owner:** Mike Vance
**Architecture:** Existing Next.js/Supabase product inside a Capacitor iOS container

## Governing launch doctrine

War Room 1.0 may launch completely free. War Room Plus can arrive in a later
reviewed update only after the business, legal, product-value, entitlement,
purchase, restore, and support gates pass. Public launch itself requires an
independent thumbs-up from both Mike and the critical launch review.

The native transition must not rewrite the competitive engine or fork web and
iOS accounts. Supabase remains the source of truth.

## Current readiness snapshot

| Area | Status | Evidence / required action |
|---|---|---|
| Responsive phone UI | Strong base | Viewport cover, safe-area CSS, phone shell, 44px+ controls are present |
| Web install identity | Ready base | Manifest, icons, Apple web-app metadata are present |
| Native iOS project | Development build ready | Capacitor/Xcode project builds and runs in the iPhone simulator |
| Native opening | Ready | Bundled vertical opening plays natively with Skip Intro, then reveals the live app |
| Runtime boundary | Active | `src/lib/native-contract.ts` plus native URL routing; web opening is suppressed in the container |
| Universal/deep links | Partial | `warroom://` and in-app URL routing are wired; Associated Domains, AASA, and Supabase redirects remain |
| Password recovery | Web only | Current reset uses `window.location.origin`; route through universal-link contract |
| Account deletion | **App Review blocker** | Product contract and cascade safety gate added; schema/server implementation remains gated |
| User reporting/blocking | **App Review blocker** | Staff moderation exists; player report/block controls were not found |
| Privacy / Terms / Support | Published base | In-app public pages and support contact are reachable globally; final legal review remains |
| Plus entitlements | Inactive contract | `src/lib/plus-contract.ts`; no UI, checkout, or client grants |
| Payments | Intentionally absent | Free 1.0 remains viable; do not add until business and Apple gates pass |

## Work that can be completed before the Mac arrives

1. Freeze bundle identity, URL scheme, canonical origin, and deep-link routes.
2. Inventory every `window.location` auth/navigation path and route native-sensitive
   cases through the platform boundary.
3. Design secure account deletion:
   - reauthenticate the user;
   - resolve commissioner ownership before deletion;
   - revoke sessions and provider tokens;
   - remove/anonymize user data according to the final retention policy;
   - delete the Supabase Auth user through a protected server function;
   - never expose a service-role key to the client.
4. Add player-facing Locker report and block flows backed by auditable server rows.
5. Complete the privacy data map for Auth, profiles, picks, messages, uploads,
   notifications, diagnostics, and future purchase records.
6. Draft final Privacy Policy, Terms, Community Standards, and Support content
   after the LLC/seller identity decision.
7. Create App Review demo credentials and a fictional, fully populated review league.
8. Build a native regression matrix for login, invites, picks, lock, scoring,
   Locker, uploads, Moments, background/resume, offline/error states, and logout.

The binding MIA/deletion behavior and current cascade blocker are defined in
[`ACCOUNT-LIFECYCLE.md`](./ACCOUNT-LIFECYCLE.md).

## Mac / Xcode progress

1. Xcode, Capacitor packages, and the iOS platform are installed and operational.
2. The first iPhone simulator build loads the production War Room account and home experience.
3. The native opening movie, native skip control, branded icon/splash, safe status bar, and URL listener are installed.
4. Confirm Apple Developer membership and the exact legal seller identity.
5. Create the App ID using `com.warroompicks.app` only after confirming it in
   Apple Developer; do not casually change the bundle ID afterward.
6. Configure signing, Associated Domains, push capability, and app groups only
   when required.
7. Run the current build on Mike's physical iPhone.
8. Add native value before App Store submission: push, universal invite links,
   native share, haptics, badge count, and polished resume behavior.
9. Archive and upload an internal TestFlight build. TestFlight is the proving
   ground; it is not authorization for public launch.

The current development container intentionally loads the canonical HTTPS app so
the simulator stays aligned with production while native work proceeds. Replace
that development server boundary with the reviewed release strategy before an
App Store archive.

## Plus sequencing

### Free 1.0

Picks, scoring, standings, postseason, Locker Room, core Gazette/Moments,
achievements, trophies, and competitive fairness remain free.

### Later Plus update

Plus may sell expression, convenience, intelligence, and legacy. It may never
sell competitive advantage. Before activation:

- LLC/EIN/bank/seller identity resolved;
- Apple Paid Apps Agreement, tax, and banking approved;
- price and subscription term finalized;
- App Store product IDs created;
- server receipt/transaction verification implemented;
- restore purchases, expiration, refunds, revocation, and grace periods tested;
- web and Apple purchases resolve to one server entitlement;
- support/refund procedures ready;
- Plus provides obvious ongoing value;
- both launch approvals are affirmative.

## TestFlight acceptance gates

- No crash, freeze, stuck overlay, or lost navigation during a 20-minute phone session.
- Login and persisted session survive force-close and relaunch.
- Invite and password-reset links reach the correct in-app destination.
- Keyboard never covers the active field or primary action.
- Picks cannot be changed after lock, including background/resume edge cases.
- Push permission is requested in context, not at first launch.
- Locker report/block and account deletion work on-device.
- Network loss produces recoverable UI and never duplicates a write.
- App Review demo account can exercise all submitted functionality.
- No Plus purchase or promotion appears in free 1.0.

## Primary Apple requirements

- App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Account deletion: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
- Apple Developer enrollment: <https://developer.apple.com/help/account/membership/program-enrollment/>
- Capacitor installation: <https://capacitorjs.com/docs/getting-started>
