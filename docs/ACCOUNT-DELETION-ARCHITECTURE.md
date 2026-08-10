# War Room Account Deletion Architecture

**Status:** Review-only design. No production mutation is authorized.

## Decision

War Room will preserve competitive receipts without preserving a login identity.
The existing `public.profiles.id` UUID becomes the durable participant key after
its cascading foreign key to `auth.users.id` is removed. Permanent deletion turns
that row into a non-authenticated tombstone:

- `display_name` becomes `[REDACTED]`;
- avatar, birthday, favorite teams, notification data, and other private profile
  fields are removed;
- Auth identities, credentials, provider tokens, and sessions are revoked/deleted;
- private messages and user-owned uploads are deleted;
- picks, standings, awards, trophies, brackets, Museum events, and structural
  Gazette history retain the same participant UUID;
- a later account can never reclaim the deleted UUID or its history.

This is the smallest safe model change. It avoids rewriting every competition
table and already matches the Museum snapshot design, which retains display-name
snapshots while allowing account links to be removed.

## Fail-closed workflow

The public button remains disabled until every stage below passes in Foundry.

1. Reauthenticate the user and require the exact destructive confirmation.
2. Refuse deletion while the user commissions any unresolved room. Show **Pass
   the Keys** and list every blocking room.
3. Create a server-only deletion operation keyed by an idempotency UUID. The
   service-role key must never enter a browser or native bundle.
4. Revoke all refresh sessions/provider tokens before identity deletion.
5. Mark the profile `deletion_in_progress` so privileged app paths fail closed.
6. Delete private messages, reactions where identity is not required, reports or
   blocks classified as private, favorite teams, notification tokens/preferences,
   and every user-owned object in `avatars` and `locker-media`.
7. In one database transaction, redact the durable profile and any denormalized
   aliases/snapshots that could reveal the former identity.
8. Delete the Supabase Auth user through the server-only Admin API.
9. Mark the operation complete, clear local app state, and return to Log in.
10. Verify with the old access token that protected reads and writes fail.

## Required schema boundary

The migration must:

- replace `profiles.id -> auth.users.id ON DELETE CASCADE` with no Auth foreign
  key; the UUID remains the primary participant key;
- add a lifecycle state (`active`, `deletion_in_progress`, `deleted`) and
  `deleted_at` timestamp to profiles;
- add a private, append-only deletion-operation ledger with no `anon` or
  `authenticated` grants;
- provide a stable `is_active_account()` authorization helper;
- update sensitive RLS policies and privileged RPCs so a valid-but-revoked JWT
  cannot act after deletion begins;
- keep every history-bearing foreign key attached to the tombstone profile;
- classify every identity-shaped column from the production preflight as
  **DELETE**, **REDACT**, or **PRESERVE** before the migration is approved.

## Data classification

| Class | Initial contents | Required action |
|---|---|---|
| Delete | Auth identities/sessions, avatar objects, locker uploads, birthday, favorites, notification tokens, private reports/blocks | Remove permanently |
| Redact | Profile name/photo, league aliases, author snapshots, Gazette prose containing the name | Replace identity with `[REDACTED]` or regenerate |
| Preserve | Picks, scores, standings totals, brackets, trophies, achievements required for history, Museum event structure | Retain against tombstone UUID |

Locker posts require a product-safe split during inventory: their message bodies
are private user content and should be deleted, while league history must not rely
on them. Reactions can be deleted without changing competitive results.

## Production inventory snapshot — 2026-08-10

The read-only catalog inventory confirmed the production risk and the viability of
the tombstone model:

- `profiles_id_fkey` is `profiles.id -> auth.users.id ON DELETE CASCADE`;
- 20 public foreign keys point at profiles, including picks, memberships,
  achievements, Crystal Ball picks, weapon-service history, announcements, and
  locker content;
- `leagues.commissioner_id -> profiles.id ON DELETE CASCADE`, so an Auth deletion
  can currently erase an owned room through the profile cascade;
- production has seven rooms owned by two commissioner profiles; one profile owns
  six, making Pass the Keys a real multi-room gate rather than an edge case;
- storage contains 11 avatar objects and two private locker-media objects;
- profile PII is limited and explicitly enumerable: `display_name`, `avatar_url`,
  `birthday_mmdd`, `birthday_locked_at`, and `last_seen_at`;
- denormalized player identity also exists in `memberships.display_name_override`,
  `league_trophies.winner_name`, `egg_milestone_flexes.finder_name`, Museum
  display-name snapshots, and `leagues.open_room_nudge_left_name`.

The migration package must redact each denormalized identity location. Team names,
league names, and weapon-event league names are competition context, not player PII.

## Access-token hazard

Deleting a Supabase Auth user does not itself invalidate an already-issued access
token. Global sign-out revokes refresh ability, but a short-lived access token may
remain cryptographically valid until expiry. Therefore deletion cannot ship until:

- profile state changes to `deletion_in_progress` before private-data removal;
- sensitive policies/RPCs require an active profile in addition to `auth.uid()`;
- the deletion test replays the pre-deletion token and proves that protected
  operations fail;
- JWT expiry is reviewed and kept appropriately short.

## Foundry proof matrix

1. Ordinary player with history: identity disappears; receipts survive.
2. Commissioner with another human: deletion blocked until Pass the Keys.
3. Solo commissioner: deletion blocked pending an explicit archive-room decision.
4. Player in multiple sports: all private identity is removed across CFB, NFL,
   and Fieldhouse while every competitive result remains.
5. Storage owner: avatar and locker media are gone from both object storage and
   metadata.
6. Multi-device user: old refresh tokens fail and replayed access tokens cannot
   read/write protected account data.
7. Retry after a partial server failure: the idempotent operation finishes once,
   without deleting history twice or exposing identity.

## Release gate

`ACCOUNT_LIFECYCLE_PUBLIC` stays `false` until the production preflight is saved,
the review-only migration is approved, all seven Foundry scenarios pass, security
and performance advisors are clean for the new objects, and a physical-iPhone
test completes after the native shell exists.

## Disposable proof — 2026-08-10

Supabase branch `account-deletion-foundry-20260810` (`ivahanchngmcnxclzfat`)
was created without production data. The branch exposed that the project has no
reproducible production migration history, so the repository core schema plus an
explicit production-drift fixture were installed before lifecycle testing.

The rollback-only harness passed after proving:

- commissioner deletion is blocked until ownership transfers;
- the `authenticated` database role cannot change lifecycle fields;
- `deletion_in_progress` immediately makes `is_active_account()` false;
- restrictive RLS prevents an old, still-cryptographically-valid JWT from
  changing a pick;
- profile identity is replaced with `[REDACTED]` and private profile fields clear;
- picks, pick details, standings totals, the room, and successor ownership survive.

Supabase advisors reported no error introduced by the lifecycle objects. Remaining
branch errors belong to the deliberately old core baseline (`announcements` RLS and
the legacy public `handle_new_user` grant), not the deletion overlay; they reinforce
the separate requirement to convert production's loose SQL history into migrations.
