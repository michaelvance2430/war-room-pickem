# War Room Pick'Em — Build 20 Ledger

This file is the authority for deferred iOS work targeted at Build 20. Chat history is not a release checklist. An item is complete only after implementation and simulator/device verification.

## High priority

### Direct league invitation link

- **Problem:** The current Share button shares the App Store URL. Existing users are sent to the store and must manually return to War Room and enter the invite code.
- **Required behavior:** Share one league-specific HTTPS Universal Link, for example `https://app.war-room-picks.com/join/H54KSJ`.
- **Installed app:** Open a league preview showing league name, sport, commissioner, and current member count. Require an explicit **Join League** confirmation, then select and open that league's home page.
- **Logged-out user:** Preserve the pending invitation through login or signup, then return to the same confirmation screen.
- **App not installed:** Open a lightweight invitation landing page with the league information, App Store download button, visible/copyable invite code, and instructions to tap the original invitation again after installation.
- **Share copy:** Include the Universal Link and invite code as a fallback. Do not use the App Store URL as the shared item.
- **Safety:** Validate the code/link server-side. Invalid, expired, revoked, full-league, already-a-member, and unauthorized cases must produce specific recoverable messages. Never auto-join from a link without confirmation.

#### Acceptance checks

- [ ] Installed and signed in -> link opens the correct league preview.
- [ ] Confirm -> membership is created once, the correct league is selected, and its Home opens.
- [ ] Cancel -> no membership or selected-league state changes.
- [ ] Installed but logged out -> invitation survives login/signup and returns to preview.
- [ ] Not installed -> landing page opens and preserves a visible/copyable fallback code.
- [ ] Already a member -> opens that league without creating a duplicate membership.
- [ ] Invalid or revoked code -> clear error with a path back to the lobby.
- [ ] Full league -> clear error directing the user to the commissioner.
- [ ] Repeated taps and retries -> no duplicate membership or duplicate request.
- [ ] CFB and NFL invitations route to the correct sport and league.
- [ ] Existing manual **Enter an Invite Code** flow continues to work.
- [ ] Physical-device test from Messages, Mail, and a social app.

## Deferred visual correction

### Crystal Ball trophy artwork

- Replace the incorrect shit icon on the Crystal Ball page with the Village Nerd trophy artwork.
- Verify both locked and unlocked Crystal Ball states in CFB and NFL.

