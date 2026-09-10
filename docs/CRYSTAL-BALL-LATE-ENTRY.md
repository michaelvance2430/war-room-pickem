# Crystal Ball late entry

First Crystal Ball selection remains available after opening kickoff. Existing selections cannot be revised after kickoff. Earlier selections can still be changed before kickoff. A late entry receives its actual server save time.

The native CFB/NFL Picks screen checks the current league's saved Crystal Ball before regular and weapon-assisted submissions. Missing selections open an alert: “You must choose your Crystal Ball before you can save any picks.” “Choose Crystal Ball” opens that league's selection screen in a sheet. “Back to Picks” returns to the retained draft; the player explicitly saves again. A failed lookup displays an error rather than treating a missing response as permission to save.

## Rollout

- `supabase/crystal-ball-late-entry.sql`: applied to production September 10, 2026. Insert permission changed; kickoff update permission and reveal timing retained.
- Native iOS changes: require a new app build and distribution. The active release checkout also has the focused native patch, preserving its other work.
- `supabase/crystal-ball-required-before-picks-RELEASE.sql`: staged, not applied. Apply only after supported clients provide late selection and the Picks redirect. Existing installed clients still have their original UI gate.
- Web and native Android need corresponding client updates before enforcing the staged save requirement across clients.

## Verification

A rolled-back authenticated transaction in a league whose opening kickoff had passed verified a first insertion succeeds, a direct update changes zero rows under RLS, and an upsert revision is rejected. The transaction restored all data. Production read-back confirmed first-insert policy, existing update policy, enabled lock trigger, and Carter's unchanged Miami/Texas selections.
