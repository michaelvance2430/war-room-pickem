# Account Deletion — Real Auth and Storage Proof

**Date:** 2026-08-10  
**Environment:** Disposable Supabase branch only  
**Branch:** `account-deletion-foundry-20260810` (`ivahanchngmcnxclzfat`)  
**Production mutation:** None

## Fixture

A real password-authenticated Supabase user was created on the empty branch and
given the smallest durable competition history:

- one non-commissioner membership;
- one locked Week 0 pick worth 13 points;
- one Week 0 result;
- one avatar object;
- one private locker-media object.

The deletion workflow ran through a temporary JWT-protected Edge Function locked
to the exact fixture user. Supabase injected the branch service credential at
runtime; no service-role key entered source control, command output, or a client.

## Result

The server sequence completed once with operation
`3ce4ec04-62ca-4b04-bce1-1f0df89c26cf`:

1. began the idempotent deletion operation;
2. revoked global sessions;
3. removed avatar and locker-media objects through Storage;
4. redacted database identity;
5. deleted the Auth user through the Admin API;
6. completed the durable operation receipt.

Post-run evidence:

| Invariant | Result |
|---|---:|
| Auth users for fixture | 0 |
| Auth sessions for fixture | 0 |
| Storage objects owned by fixture | 0 |
| Tombstone profile | `[REDACTED]`, `deleted` |
| Membership retained | 1 |
| Membership points retained | 13 |
| Membership alias retained | No — cleared |
| Locked pick retained | 1 |
| Pick points retained | 13 |
| Week result retained | 1 |
| League retained | 1 |
| Operation status | `complete`, attempt 1, no error |

The old access token returned `403` from Auth because its subject no longer
exists. Replaying that same cryptographically valid token against the picks API
returned zero rows, proving the restrictive active-account RLS overlay fails
closed before token expiry.

## Baseline defect found during replay

The repository's reconstructed legacy branch schema used a self-referencing
`memberships` SELECT policy and initially returned an infinite-recursion error.
Read-only production inspection confirmed production does not use that policy;
it uses non-recursive league-membership helpers. The disposable fixture policy
was corrected to match that behavior, after which old-token replay returned a
clean empty result.

This is a migration-reproducibility defect, not an account-deletion defect. The
production schema still needs to be converted into a complete ordered migration
history before launch.

## Cleanup

The temporary privileged Edge Function was immediately replaced by version 2,
which contains no service client or deletion capability and only returns HTTP
`410 Gone`. The disposable branch remains isolated for the gated UI/device test.

## Remaining gate

Account deletion must stay dark until the Foundry-facing transfer flow, exact
confirmation UI, retry/repair surface, and physical-device tests pass. This proof
authorizes that next UI checkpoint; it does not authorize a production migration
or opening the public feature flag.

## Pass the Keys proof — 2026-08-10

A second rollback-only branch test created a commissioner, successor, room, and
memberships. It proved the complete transfer gate:

- deletion was blocked with exactly one owned room;
- the blocked commissioner's profile remained `active`;
- room and membership leadership transferred to the successor;
- a new deletion operation then began successfully; and
- the former commissioner immediately entered `deletion_in_progress` so access
  failed closed.

All fixtures and lifecycle changes from this proof were rolled back. Production
was inspected only to distinguish its non-recursive membership helpers from the
disposable legacy-baseline policy; production was not mutated.
