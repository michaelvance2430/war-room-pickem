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
- Bundle SHA-256: `0d9c2e470c848710506ddda60e5c0a37b568588021894d3a3f7092666fea4a62`

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

## Blocking items before upload

1. Google Play currently accepts upload certificate SHA-256
   `43:96:84:F2:48:9D:52:72:6E:56:68:CB:3E:03:15:1C:8E:EE:23:DE:7D:98:83:DD:F3:79:FA:08:3B:D2:71:6D`.
   Its private key is not present in the available workspaces.
2. The retained upload keystore and the newly signed bundle use SHA-256
   `9C:00:6A:16:3D:EE:05:27:49:41:CC:AC:74:38:AB:F0:E3:73:64:62:60:FA:E1:7B:36:BA:1D:E3:6E:97:F9:82`.
   The Play Console upload-key reset form is prepared but has not been submitted.
3. Firebase Android client identifiers and FCM service credentials are not configured.
   Android notification registration exists in the app, and the Supabase sender supports
   FCM HTTP v1, but real Android push delivery cannot work until those credentials are installed.
4. An authenticated end-to-end test against the production Supabase project still requires a
   test account/session. Automated fixture-based CFB/NFL coverage has passed.
5. The signed bundle has not been uploaded to the closed-testing track. No review, rollout, or
   publication action has been taken for this native rebuild.

## Release rule

Do not upload a bundle until the Play upload-key reset is approved and the bundle is rebuilt
with the accepted key. Do not claim Android push readiness until an actual device receives and
routes a test notification.
