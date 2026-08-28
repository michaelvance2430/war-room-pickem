# Google Play release

This native Android project was created from `origin/main` commit `63613cb`.

## Release identity

- Application ID: `com.warroompicks.app`
- Version code: `2`
- Version name: `1.0.1`
- Compile SDK: `36`
- Target SDK: `36`
- Minimum SDK: `24`

Increment `versionCode` for every bundle uploaded to Google Play.

## Signing

Keep the upload keystore and passwords outside Git. Export these variables before building:

```sh
export WAR_ROOM_ANDROID_KEYSTORE=/absolute/path/to/upload-key.jks
export WAR_ROOM_ANDROID_KEYSTORE_PASSWORD=...
export WAR_ROOM_ANDROID_KEY_ALIAS=...
export WAR_ROOM_ANDROID_KEY_PASSWORD=...
```

Then build the release bundle from the repository root:

```sh
npm run android:sync
npm run android:bundle
```

The signed bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`.

## Verified app links

The manifest claims `https://app.war-room-picks.com`. Before release, publish an Android Digital Asset Links file at:

`https://app.war-room-picks.com/.well-known/assetlinks.json`

It must contain the SHA-256 fingerprint of the Google Play App Signing certificate for `com.warroompicks.app`.

## Play Console items not stored in this repository

- Create the Play Console app using `com.warroompicks.app`.
- Enroll in Play App Signing and securely retain the upload keystore.
- Complete the Data safety, privacy policy, content rating, ads, target audience, and app access declarations.
- Upload phone/tablet screenshots, the 512 px store icon, and the 1024 x 500 feature graphic.
- Complete the required testing track before requesting production access, if the developer account is subject to that policy.
