# War Room Pick'Em — Build 20 Release Ledger and Handoff

**Purpose:** This file is the authority for deferred native iOS work targeted at Build 20. Chat history is context, not a release checklist. Anyone resuming this work should be able to understand the product decision, current implementation, known traps, required order of operations, and proof required before upload without reconstructing the conversation.

**Last updated:** September 1, 2026

**Native iOS baseline inspected:** version 3.2, Build 19, bundle ID `com.warroompicks.WarRoom`, Apple team `XWW458P3J7`

**Working branch at capture:** `release/build-18-fixed`
**Short-ledger commit:** `ab26024`

## Release policy and boundaries

- Build 19 is the current submitted/native baseline. Build 20 is the next planned iOS upload.
- Unless a defect threatens scoring, access, data integrity, authentication, or the live season, collect improvements here and ship one deliberate iOS build per week.
- Backend-only production repairs may ship without an Apple build. Record them under **Completed outside Build 20** so they are not mistaken for app work.
- Do not include unfinished Fieldhouse gameplay in Build 20. Fieldhouse may remain a Coming Soon surface only unless Mike explicitly changes this boundary.
- Android is not part of this Build 20 ledger. Do not delay native iOS for Android parity.
- CFB and NFL share navigation and account rules. Test every shared-flow change against both sports.
- Freeze scope, run the entire regression checklist, test on a physical phone, then upload. A compile is not release proof.
- Code written, local commit, archive, upload, TestFlight processing, App Store submission, approval, and release are separate milestones.

## P0 — Direct league invitation link

### Product problem

The current Home and Commissioner Command Share buttons use `LeagueInvitation.appStoreURL` as the shared item. The message includes a six-character code and tells the recipient to download/open the app and manually navigate to the invite-code screen. Existing players are therefore sent to the App Store even when War Room is installed, then must reopen War Room, find the Lobby, find **Enter an Invite Code**, return to the message, copy the code, and submit it.

This is unnecessary friction in the primary growth loop. Commissioners recruit friends into private leagues. The invitation must deliver the recipient to the intended room, not merely advertise the app.

### Binding product decision

Share one league-specific HTTPS Universal Link. The same URL must:

1. Open native War Room to the correct invitation when installed.
2. Open a lightweight invitation landing page when not installed.
3. Preserve the target invitation through login or signup.
4. Require explicit **Join League** confirmation before membership creation.
5. Select and open the invited league after success.
6. Keep the six-character invite code visible as a human-readable fallback.

Do **not** share the App Store URL as the primary item. Do **not** silently join someone merely because they tapped a link.

### Recommended URL and credential design

Use an opaque, unguessable token:

`https://app.war-room-picks.com/invite/<opaque-token>`

Example shape only:

`https://app.war-room-picks.com/invite/2fba9c01d86f4be58af8b06b2c6e57c1`

The six-character league code remains in share copy and the landing page as fallback, but should not be the durable anonymous web credential. Human-friendly six-character codes are too small to treat as non-enumerable bearer tokens.

#### Recommended server record

| Field | Purpose |
|---|---|
| `id` UUID | Internal identity |
| `token_hash` text, unique | Hash of opaque token; avoid storing bearer token in plaintext |
| `league_id` UUID | Target league |
| `created_by` UUID | Authorized member who generated it |
| `created_at` timestamptz | Audit timestamp |
| `expires_at` timestamptz nullable | Optional expiration |
| `revoked_at` timestamptz nullable | Stops future joins |
| `last_used_at` timestamptz nullable | Operational visibility |
| `use_count` integer | Atomic aggregate use count if retained |

Recommended v1: one active reusable invite per league. Create it server-side on first request, reuse it for later shares, and allow commissioner rotation/revocation later. Do not generate a new row every time the Share sheet opens.

If time forces a smaller first version, `/join/<six-character-code>` is acceptable only as a temporary bridge. The client must still use existing atomic server authority, reveal no broad league data, and retain a migration path to opaque tokens.

### Exact user flows

#### A — Installed, signed in, not a member

1. Recipient taps the HTTPS invitation in Messages, Mail, Facebook, or another app.
2. iOS opens War Room through Associated Domains.
3. Root routing suppresses the weekly opening film, as notification routing does.
4. App validates token and loads minimum preview data.
5. Present a native preview with league name, sport, commissioner game handle, current/max members, seat availability, **Join League**, and cancel.
6. No membership or selected-league state changes before confirmation.
7. Confirm calls one atomic server join operation; never insert membership client-side.
8. Success calls `auth.selectLeague(returnedLeagueId)` exactly once.
9. Dismiss preview, reset Home to that league, and preserve standard bottom navigation.
10. If onboarding is incomplete, complete missing global favorite team and/or required league Crystal Ball, preserving the invited league as the return destination.
11. Do not replay the opening film because selected league changed.

#### B — Installed, signed in, already a member

1. Validate invitation and membership.
2. Show `You're already in this room` or route directly with a brief confirmation.
3. Select invited league and open Home.
4. Do not create a duplicate membership or join request.

#### C — Installed, signed out

1. Validate URL shape locally; do not request protected league data yet.
2. Persist pending invitation before showing Login.
3. Complete login, signup, email confirmation, or password recovery normally.
4. When `AuthStore.user` is available, restore pending invitation and open preview.
5. Retain across termination during authentication.
6. Clear only after successful join/open, explicit cancellation, confirmed expiration/revocation, or malformed token.
7. Do not clear for temporary network error, recoverable token refresh, or server outage.

Recommended local model:

```swift
struct PendingLeagueInvite: Codable, Equatable {
    let token: String
    let receivedAt: Date
}
```

Persist one pending invite in `UserDefaults` or a dedicated store. A newer deliberate tap may replace an older invite. Expire abandoned local state after about seven days; server expiration remains authoritative.

#### D — App not installed

1. Browser opens `app.war-room-picks.com/invite/<token>`.
2. Landing page validates server-side and renders only minimal data.
3. Show branding, `You've been invited`, league name/sport, commissioner handle, available/full state, **Download War Room**, fallback code with **Copy Code**, and `After installing, return to this message and tap the invitation again.`
4. Never expose emails, roster, picks, standings, chat, or private league content.
5. This is an invitation bridge, not permission to rebuild/expose web gameplay.

Standard Universal Links do not reliably carry arbitrary pending state through App Store installation. Do not promise automatic post-install continuation without separately implementing and proving deferred deep linking.

#### E — App already foregrounded/backgrounded

1. Handle the link without restart.
2. Root-level routing presents above current league/tab.
3. Cancel returns to exact prior league/tab without changing selection.
4. Success switches to invited league Home.
5. Repeated delivery while preview is visible cannot stack sheets or duplicate requests.

### Required states and copy

| State | Required behavior/copy |
|---|---|
| Loading | `Opening your invitation...`; no blank screen |
| Valid, seat available | Preview and **Join League** |
| Already member | `You're already in this room` then **Open League** |
| Full | `This room is full. Ask the commissioner to open a seat.` No mutation |
| Invalid | `This invitation is not valid.` Offer Lobby/Home |
| Expired | `This invitation has expired. Ask for a new link.` |
| Revoked | Same safe public copy as expired |
| Deleted/closed league | `This room is no longer available.` |
| Offline/server unavailable | `We couldn't verify this invitation. Try again.` Preserve pending state |
| Final-seat race lost | Authoritative full-room message; no partial membership |
| Already member after retry | Treat as success and open league |
| Missing favorite team | Required confirmation, then return to invited league |
| Missing Crystal Ball | Required league confirmation, then return to invited league |

### Current-state source audit — important

1. `native-ios/WarRoom/ContentView.swift`
   - `LeagueInvitation.appStoreURL` points to `https://apps.apple.com/app/id6802751064`.
   - Home and Commissioner Command ShareLinks both use it as the shared item.
   - `LeagueInvitation.message(...)` instructs manual Lobby/code entry.
   - Root notification routing already suppresses the opening film and selects a target league. Reuse that architecture.
2. `native-ios/WarRoom/LobbyView.swift`
   - `SupabaseAPI.joinLeagueByCode` already calls atomic `join_league_by_code` and returns league UUID.
   - Manual JoinByCode selects the returned league. Preserve this fallback and converge on the same server authority.
3. `native-ios/WarRoom/AuthStore.swift`
   - Selected league persists under `warroom-selected-league`.
   - No pending-invitation state exists.
4. `native-ios/WarRoom/WarRoom.entitlements`
   - Native target currently contains only `aps-environment`.
   - It lacks `com.apple.developer.associated-domains` and `applinks:app.war-room-picks.com`.
5. `src/app/.well-known/apple-app-site-association/route.ts`
   - Current AASA names old bundle ID `com.warroompicks.app`.
   - Native Build 19 uses `com.warroompicks.WarRoom`.
   - Current AASA therefore does not authorize the native app bundle.
6. `ios/App/App/App.entitlements` and `scripts/verify-universal-links.mjs`
   - Existing verification targets the old Capacitor app, not native SwiftUI.
   - Passing it is not proof that native links work.

### Required implementation areas

#### Native SwiftUI

- `ContentView.swift`: replace both ShareLink items, update share copy, and route invitations at root.
- New preferred `LeagueInviteRouter.swift`: validate host/path/token, deduplicate warm/cold deliveries, and own pending-state clear rules.
- New preferred `LeagueInvitePreviewView.swift`: loading, confirmation, already-member, full, invalid, expired, and retry states.
- `LobbyView.swift` / `SupabaseAPI`: add minimal preview call and add/reuse a single atomic join call. No direct membership writes.
- `AuthStore.swift` or dedicated store: persist pending invite independently of selected league and auth refresh.
- `WarRoom.entitlements`: add `com.apple.developer.associated-domains` with `applinks:app.war-room-picks.com`; preserve APNs.

#### Server/landing page

- Update AASA:
  - Add `XWW458P3J7.com.warroompicks.WarRoom` for `/invite/*` and retained `/join/*` compatibility.
  - Temporarily keep old app ID if an installed legacy build depends on it.
  - Do not associate the marketing apex/storefront without approval.
- Add `src/app/invite/[token]/page.tsx` or equivalent bridge: App Store button, copyable code, safe errors; no web gameplay.
- Add narrow schema/RPC or Edge Function to create/retrieve, preview, join, and later revoke/rotate invitation tokens.
- Never expose service-role credentials or private league records to browser/native clients.

#### Verification

- Add native Universal Link verifier checking native bundle/team, native entitlement, AASA native ID and `/invite/*`, cold/warm routing, ShareLink no longer using App Store item, and manual code fallback.
- Unit-test URL parsing and pending-state clearing.
- Test server join idempotency and capacity race.
- Add Build 20 invitation cases to `docs/WAR-ROOM-REGRESSION-CHECKLIST.md`.

### Deployment order — binding

1. Implement server invitation records and preview/join authority in reviewable migration/function.
2. Verify authorization, capacity race, already-member idempotency, expiration, and revocation with disposable data.
3. Deploy landing page and updated AASA to `app.war-room-picks.com`.
4. Verify live AASA contains `XWW458P3J7.com.warroompicks.WarRoom` and `/invite/*`.
5. Add Associated Domains and native routing.
6. Simulator-test routing/state logic.
7. Physical-iPhone test links outside Safari.
8. Run full Build 20 regression checklist across CFB and NFL.
9. Archive/upload Build 20.
10. Install processed TestFlight build and repeat external-link smoke test before production review.

Do not reverse server/domain readiness and native release. Apple's association caching can make an otherwise-correct TestFlight build appear randomly broken if the domain is late.

### Acceptance matrix

#### Infrastructure

- [ ] Live AASA contains `XWW458P3J7.com.warroompicks.WarRoom`.
- [ ] Native entitlement contains `applinks:app.war-room-picks.com` and preserves APNs.
- [ ] Marketing/storefront domains do not unintentionally open War Room.
- [ ] Valid invite resolves in browser without app.
- [ ] Invalid/expired/revoked links reveal no private data.

#### Installed/signed in

- [ ] Messages, Mail, and one social app each reach correct preview or documented safe landing fallback.
- [ ] Preview identity/capacity data is correct.
- [ ] Confirm creates one membership and opens invited Home.
- [ ] Cancel creates none and preserves prior league/tab.
- [ ] Repeated tap/confirm cannot duplicate membership.
- [ ] Already-member opens correct league.
- [ ] CFB invite from NFL and NFL invite from CFB route correctly only after confirmation.
- [ ] Invitation launch never plays weekly opening film.

#### Authentication handoff

- [ ] Signed-out cold launch stores invite and shows Login.
- [ ] Login/signup returns to correct preview.
- [ ] Email-confirmation-required signup and password recovery preserve invite.
- [ ] Force-quit/relaunch during auth preserves invite.
- [ ] Explicit cancel clears it; temporary network failure does not.

#### Join/onboarding rules

- [ ] Server authority only; no direct native membership insert.
- [ ] Full room and final-seat race create no partial membership.
- [ ] Existing member is idempotent success.
- [ ] Missing global favorite team is confirmed once, then returns to invited league.
- [ ] Existing global favorite is not requested again.
- [ ] Missing league Crystal Ball is confirmed, then returns to invited league.
- [ ] Commissioner cannot disable required Crystal Ball through this flow.
- [ ] Manual code entry still works in CFB and NFL.

#### Accessibility/presentation

- [ ] VoiceOver reads identity, capacity, actions, and errors.
- [ ] Dynamic Type does not truncate code/action.
- [ ] Copy Code provides visible/haptic confirmation.
- [ ] Loading/retry cannot trap user.
- [ ] Top-left close/back follows app-wide rule.

### Success criteria

- Installed/signed-in player reaches correct preview in one app transition and joins with one explicit confirmation.
- Median physical-device completion under 15 seconds.
- No installed recipient is sent to App Store by primary Share item.
- Zero duplicate memberships from retries.
- Zero wrong-league landings in CFB/NFL cross-sport tests.
- Do not block on a full analytics SDK; structured server invitation/join outcomes are enough initially.

### P1 follow-ups — do not delay v1

- Commissioner rotate/revoke controls.
- QR code for in-person recruitment.
- Expiration presets.
- Invitation use count.
- Social preview artwork.
- Android App Links later.
- True deferred deep linking only after choosing and validating a maintained provider/owned mechanism.

### Explicit non-goals

- No automatic join without confirmation.
- No Contacts permission/import.
- No bulk email/SMS sending.
- No public discovery changes.
- No web gameplay.
- No App Clip.
- No Android implementation in this build.
- No broad Lobby/auth/navigation redesign.

### Nonblocking open questions and recommendations

- Token lifetime: reusable until revoked for v1.
- Who can share: preserve current all-member sharing unless Mike restricts it.
- Already member: immediate route plus brief confirmation.
- Landing skin: War Room identity plus sport color; keep it operational and small.

## P1 — Crystal Ball trophy artwork correction

### Problem and required behavior

The live/native Crystal Ball page still shows the shit/dumb icon where the Village Nerd trophy should appear. `VillageNerdArtifact` exists, but a correct shared mapping is not proof every actual Crystal Ball page uses it.

- Crystal Ball selection, confirmation, locked receipt, and profile/receipt references must consistently use Village Nerd where the season-long bad championship prediction is represented.
- Remove incorrect shit/dumb icon from the top of selection/locked page.
- Preserve legitimate Toilet Bowl/Crown of Shame imagery elsewhere; do not globally replace toilet assets.
- CFB and NFL retain sport copy/styling while sharing trophy identity.

### Source areas

- Trace actual selection and locked page paths in `ContentView.swift`, including direct `VillageNerdArtifact` use and trophy mappings.
- Verify `Assets.xcassets/VillageNerdArtifact.imageset/village-nerd-artifact.png` belongs to built target.
- Search both asset names and SF Symbols; wrong header may bypass shared mapping.

### Acceptance checks

- [ ] Fresh CFB and NFL selection show Village Nerd.
- [ ] Team selection collapses list and presents explicit confirmation.
- [ ] Cancel/back before confirmation saves nothing.
- [ ] Confirmed/locked receipt shows Village Nerd, not shit/dumb icon.
- [ ] Existing Build 19 locked predictions upgrade/render correctly.
- [ ] Profile display remains correct.
- [ ] No legitimate Toilet Bowl/Crown of Shame art replaced.
- [ ] Simulator screenshots captured for CFB/NFL unlocked and locked states.

## Completed outside Build 20 — do not reimplement

### Autonomous football scorer eligibility

- Production `autonomous-football-results` updated to version 8 on September 1, 2026.
- Old scorer filtered `published_at >= now - 10 days`, excluding valid future cards built early.
- Live scorer now stays within existing 100-card ceiling and filters by five scheduled game times: last game no older than 10 days; first game no farther than 45 days ahead.
- Live verification showed `All Jokes Aside`, `Department of Football-DOF`, and `Test NFL League` Week 1 eligible.
- `All Jokes Aside` was rebuilt with supported prop: `Will the sum of all five combined final scores be 281 or more?`
- Version-8 scheduled execution returned HTTP 200.
- Local repair commit: `37bfdb9`.
- No Apple review required; do not call this a Build 20 binary change.

## Build 20 release gate

- [ ] Freeze ledger; later noncritical discoveries move to Build 21.
- [ ] Every item has commit and verification evidence.
- [ ] Full `docs/WAR-ROOM-REGRESSION-CHECKLIST.md` run line by line.
- [ ] CFB and NFL tested separately.
- [ ] Fresh and existing accounts tested.
- [ ] Build 19 upgrade preserves session, selected league, picks, favorite team, Crystal Ball, achievements, and notifications.
- [ ] Physical invitation test from Messages, Mail, and one social app.
- [ ] APNs remains after adding Associated Domains.
- [ ] Archive version/build and distribution signing verified.
- [ ] Upload, TestFlight, external testers, production submission, and release reported separately.
