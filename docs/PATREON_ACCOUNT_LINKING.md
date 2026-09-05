# Patreon account linking

Status: implemented locally for Build 21; not deployed.

## Product rule

Patreon linking recognizes a user's relationship with War Room Pick'Em. It does not change picks, scoring, standings, league access, odds, weapons, trophies, or any other competitive feature. Do not add paid digital entitlements without a separate StoreKit/App Review decision.

### Founding Ten

- Only the first ten historical paid supporters receive **FOUNDING TEN · #01** through **#10**.
- Order comes from creator-reviewed Patreon history, never OAuth connection order.
- Numbers are permanent and never recycled. Current status remains a separate **ACTIVE SUPPORTER**, **PAYMENT ISSUE**, or **FORMER SUPPORTER** label.
- The private registry reserves **#01 for Big Balls Ben** and **#02 for Tbone Soulstache**. Both intentionally have no Patreon user ID until each exact identity connects and Mike verifies the match.
- Never match a founder by display name alone. Bind the verified Patreon user ID in the private registry after review.

## Flow

1. A signed-in user opens **You → Connect Patreon**.
2. The iOS app asks the `patreon-oauth` Edge Function to start OAuth.
3. The server creates a random, ten-minute, single-use state token tied to the authenticated War Room user.
4. Patreon authenticates the user. The War Room app never receives the user's Patreon password or Patreon client secret.
5. Patreon returns its single-use code to the registered HTTPS Edge Function callback.
6. The server consumes the state, exchanges the code, reads Patreon API v2 identity/membership data, encrypts both OAuth tokens with AES-256-GCM, and stores the private connection.
7. The callback returns to `warroom://patreon-connected`; the app reloads the verified status.
8. Status checks refresh stale Patreon credentials on the server. Disconnecting removes only the War Room link and does not cancel Patreon membership.

## Required Patreon client

Create an API v2 OAuth client in Patreon's **Clients & API Keys** portal. Register this exact HTTPS callback as a redirect URI:

`https://dorhjepugsjpmnuzdzck.supabase.co/functions/v1/patreon-oauth?action=callback`

Request only the `identity` scope. The integration does not request a user's email address or their memberships to unrelated creators.

## Required Edge Function secrets

- `PATREON_CLIENT_ID`
- `PATREON_CLIENT_SECRET`
- `PATREON_REDIRECT_URI` — exact callback above
- `PATREON_CAMPAIGN_ID` — War Room Pick'Em campaign ID
- `PATREON_TOKEN_ENCRYPTION_KEY` — base64 encoding of 32 random bytes

Never put these values in Swift, source control, screenshots, chat, or a public environment variable.

## Deployment gate

1. Review and apply `supabase/patreon-account-linking-REVIEW-ONLY.sql`.
2. Set all five secrets.
3. Deploy `patreon-oauth` with gateway JWT verification disabled because Patreon's HTTPS callback has no Supabase JWT. The function performs its own authentication: War Room JWTs for app actions and single-use state for callbacks.
4. Test link, status refresh, duplicate-Patreon-account rejection, cancellation, expired state, token refresh, and disconnect with a non-production test account.
5. Verify the private schema is not exposed through the Data API.
6. Review Patreon membership history, fill positions #03 through #10, and bind each exact Patreon user ID. Do not guess an identity match from a nickname.
7. Add an App Review note explaining that linking only recognizes supporter status and unlocks no digital content or gameplay functionality.
8. Flip `PatreonConnectionFeature.isEnabled` to `true` only after the live round trip passes.
9. Update the privacy policy and App Store privacy answers for the Patreon user ID, display name, avatar, membership status, Founding Ten number, and encrypted OAuth credentials before release.

Do not enable the client UI in a production build until the database, secrets, function, and end-to-end OAuth test are complete.
