# War Room Account Lifecycle

**Status:** Binding product contract; production foundation verified and public entry enabled
**Decision:** MIA is reversible. Dossier destruction is permanent. Competitive receipts survive anonymously.

## Player-facing exits

| Exit | Meaning | Identity | Competitive history | Return |
|---|---|---|---|---|
| **GO MIA** | Pause the account | Name and profile remain with an `MIA` marker | Preserved and still attributed | Sign in and return with everything intact |
| **BURN THE DOSSIER** | Permanently delete the account | Private identity is deleted; historical name becomes `[REDACTED]` | Picks, standings, brackets, trophies, awards, and Gazette structure remain | A new account starts clean and cannot reclaim the old identity automatically |

MIA copy: **“Step away from the table. Your chair—and your terrible record—will remain.”**

Permanent-deletion copy: **“Delete the account. Keep the receipts.”**

The permanent confirmation must also state plainly:

> This permanently deletes your login and private data. Your picks, standings,
> trophies, and league history stay behind as [REDACTED]. This cannot be undone.

## MIA behavior

- Authentication and the profile row remain active.
- Optional notifications stop. Required security or account messages may still be sent.
- The roster and profile display `MIA`; the player keeps the league seat until the commissioner removes it under normal league rules.
- MIA never submits automatic picks, changes a lock, or grants scoring relief.
- Returning removes the MIA marker and restores notification preferences explicitly; it does not silently opt the player back into marketing.
- A commissioner may go MIA temporarily, but permanent deletion requires passing the keys or safely resolving every room they own.

## Permanent deletion behavior

The protected server workflow must:

1. Reauthenticate and collect a separate destructive confirmation.
2. Block while the player owns an unresolved community league; offer **Pass the Keys** first.
3. Revoke every session and connected provider token before deleting Auth.
4. Delete email, credentials, private profile fields, birthday, favorite teams, notification tokens/preferences, avatars/uploads, private messages, blocks/reports authored as private identity data, and other non-required personal data.
5. Preserve only the minimum non-identifying competitive facts needed for league history.
6. Render the former player as `[REDACTED]` with `Former player · dossier destroyed`.
7. Delete the Supabase Auth user through a protected server path. A service-role or secret key may never reach the client.
8. Make the deletion irreversible and prevent a later account from automatically reclaiming the old record.

Public historical examples:

- `2026 Toilet Bowl Champion — [REDACTED]`
- `[REDACTED] finished 3rd with 184 points.`
- `Former player · dossier destroyed`

## Historical schema blocker — resolved August 18, 2026

The original model tied `public.profiles.id` directly to `auth.users.id` with
`ON DELETE CASCADE`. Leagues, memberships, picks, Locker messages, Crystal Ball
picks, and other records also reference profiles with cascading deletes. Deleting
the Auth user today can therefore erase the receipts and may erase an entire
commissioner-owned league.

No client account-deletion mutation may ship against that model. Production now detaches the Auth foreign key, preserves a durable redacted profile tombstone, blocks non-active JWTs through restrictive RLS policies, and restricts deletion RPCs to the service role.

## Required target model

Historical competition needs a durable, non-auth participant identity or frozen
participant snapshot. Auth/profile identity can then be detached and destroyed
without deleting league facts. The final schema design must inventory every
foreign key and classify its data as one of:

- **Delete:** private or identifying data not legally required;
- **Anonymize:** retained operational rows with identity removed;
- **Preserve:** non-identifying competitive facts and community history.

The database transition must be review-only first, tested on a disposable
Foundry league with a commissioner and multiple players, and prove that deletion
cannot cascade into leagues, picks, standings, trophies, brackets, or Gazette
history.

## Release gates

- Foundry demonstrates MIA → return and permanent deletion independently.
- Commissioner transfer and solo disposable-room behavior are deterministic.
- All sessions are revoked; deleted users cannot continue through an old token.
- Storage objects and private rows are removed and verified.
- Historical UI consistently renders `[REDACTED]` without leaking old aliases,
  avatars, Gazette text, share cards, logs, or cached client state.
- Account deletion succeeds on a physical iPhone and meets App Review behavior.
- `ACCOUNT_LIFECYCLE_PUBLIC` may remain `true` only while the production post-verification and App Review regression gates pass.

## August 13, 2026 production audit

The read-only live inventory reconfirmed that `profiles.id` still cascades from
`auth.users.id`. Competitive tables including memberships, picks, achievements,
Crystal Ball picks, and weapon history still cascade from profiles. Leagues also
cascade from the commissioner profile. The public deletion switch therefore
remains closed.

The review-only redaction plan now includes player safety data: blocks involving
the departing account are removed; reports authored by that account are removed;
reports about the account may remain as staff safety records against the durable
`[REDACTED]` participant; and staff resolution identity is detached.
