# Android release readiness

Last audited: 2026-08-30

## Release identity

- Native Kotlin / Jetpack Compose application (no web wrapper)
- Package: `com.warroompicks.WarRoom`
- Version code: `3`
- Version name: `3.1`
- Minimum SDK: `26`
- Target / compile SDK: `36`
- Release bundle: `app/build/outputs/bundle/release/app-release.aab`
- Bundle SHA-256: `0358dc121f6cb4c908c588350ed2faaa4526cce714045060957929ade3fe4c14`

## Verification completed

- `testDebugUnitTest` passed.
- `connectedDebugAndroidTest` passed all three Compose UI tests on the Android 16 / API 36 emulator:
  - CFB regular-season picks
  - NFL Final Thirteen postseason flow
  - CFB Bowl Mania postseason flow
- Release lint-vital passed.
- R8 minification and resource shrinking passed.
- `validateSigningRelease`, `signReleaseBundle`, and `bundleRelease` passed.
- JAR signature verification succeeded; the signer certificate expires in 2054.
- Package identity matches the existing Google Play application.
- The Play tester audience is configured through
  `war-room-pickem-android-testers@googlegroups.com`.
- Firebase project `war-room-pickem-android` is configured for
  `com.warroompicks.WarRoom`.
- The Firebase Admin credential was verified through an OAuth token exchange without
  printing or storing an access token in the repository.
- Supabase Edge Function `push-notifications` version 9 is active with FCM HTTP v1
  support and its required Firebase secrets.
- A fresh emulator installation generated and queued an FCM registration token before
  login. A controlled FCM HTTP v1 message was accepted, received, and posted by Android.
- The final Firebase-enabled release gate passed all unit tests, all three emulator UI
  tests, lint-vital, R8, signing, and bundle generation.

## Blocking items before upload

1. Google Play currently accepts upload certificate SHA-256
   `43:96:84:F2:48:9D:52:72:6E:56:68:CB:3E:03:15:1C:8E:EE:23:DE:7D:98:83:DD:F3:79:FA:08:3B:D2:71:6D`.
   Its private key is not present in the available workspaces.
2. The retained upload keystore and the newly signed bundle use SHA-256
   `9C:00:6A:16:3D:EE:05:27:49:41:CC:AC:74:38:AB:F0:E3:73:64:62:60:FA:E1:7B:36:BA:1D:E3:6E:97:F9:82`.
   The Play Console upload-key reset request has been submitted and remains pending.
3. An authenticated end-to-end test against the production Supabase project still requires a
   test account/session. Automated fixture-based CFB/NFL coverage has passed.
4. The signed bundle has not been uploaded to the closed-testing track. No review, rollout, or
   publication action has been taken for this native rebuild.

## Release rule

Do not upload a bundle until the Play upload-key reset is approved and the bundle is rebuilt
with the accepted key. After approval, rerun the full release gate before the closed-testing upload.
