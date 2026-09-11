# Activity achievement repair — September 11, 2026

Knock Knock, Crystal Gazed, Locker Lurker and Profile Peeker were listed as 10-point achievements in iOS, but production had no award triggers for them. Face of the Franchise already had a working profile-photo trigger. The point values were correct; the missing receipts were the failure.

## Changes

- Saved join requests, Crystal Ball picks and Locker posts now award their corresponding achievement from private database triggers.
- Awards are serialized per player/code and only issued once across leagues. Active accounts qualify; bot memberships do not.
- Owners can read their own achievement receipts even before a private-room request is approved.
- iOS records an actual visit from the public player profile screen, separately from background achievement lookups. A new RLS-protected table stores only each viewer/target's first visit. Self-visits, forged viewers and players outside shared leagues are rejected. Clients cannot submit an award code or point value.
- Historical saved activity restored missed Knock Knock, Crystal Gazed and Locker Lurker receipts. No historical profile visits were invented.

## Verification

- Production migration `engagement_cheevos` applied successfully.
- Requeried all award counts and the reported account's receipts.
- Transactional database tests passed for each activity trigger, repeated activity, shared-room profile visits, multiple visited players, self-visits, forged viewer IDs, unrelated targets and pending applicants reading their own awards. Test writes were rolled back.
- All private award functions deny execute permission to both anonymous and authenticated API roles. Security advisors reported no findings for the added table or functions; unrelated existing findings remain.
- Build 30 source plus this patch built successfully and passed EngagementCheevoTests and MyLeaguesTests in iOS Simulator.

## Delivery

The saved-activity repair is live and works with the existing app. Profile Peeker requires the iOS client patch in a new tester build. This task did not archive or upload a new iOS build.

The release checkout is far ahead of `origin/main`. Only this targeted fix is ported to main, including the existing release-side rule that duplicate achievement codes count once. No bulk merge of the release branch is part of this repair.
