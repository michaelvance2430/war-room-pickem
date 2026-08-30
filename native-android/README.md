# War Room Pick'em — Native Android

This is the Android-native Kotlin/Jetpack Compose client. It intentionally does not load the War Room website or use Capacitor.

## Product contract

- Package: `com.warroompicks.WarRoom`
- Sports in scope: CFB and NFL
- Shared production backend: the same Supabase project used by native iOS
- Stable navigation: Home, Picks, Standings, Locker, You
- Favorite teams are editable; Crystal Ball picks are required per league campaign
- Weekly picks start blank, confidence values are unique, Best Bet and prop are required, and locking is atomic

## Local build

Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to an SDK containing Android 36, then run:

```sh
gradle :app:assembleDebug
```

Version code 3 is reserved for the first native closed-testing replacement of the existing Play build 2.
