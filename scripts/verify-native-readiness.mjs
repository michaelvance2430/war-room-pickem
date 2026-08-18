import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[native-readiness] ${message}`);
}

const manifest = JSON.parse(read("public/manifest.webmanifest"));
const nativeContract = read("src/lib/native-contract.ts");
const plusContract = read("src/lib/plus-contract.ts");
const login = read("src/app/login/page.tsx");
const layout = read("src/app/layout.tsx");
const browserSupabase = read("src/lib/supabase/client.ts");
const nativeRuntime = read("src/components/NativeRuntime.tsx");
const seasonOpening = read("src/components/SeasonOpening.tsx");
const capacitorConfig = read("capacitor.config.ts");
const sceneDelegate = read("ios/App/App/SceneDelegate.swift");
const infoPlist = read("ios/App/App/Info.plist");
const privacyManifest = read("ios/App/App/PrivacyInfo.xcprivacy");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const appStoreExport = read("ios/ExportOptions-AppStore.plist");
const submissionPacket = read("docs/APP-STORE-SUBMISSION.md");
const nativeFeedback = read("src/lib/native-feedback.ts");
const commishOnboarding = read("src/lib/commish-onboarding.ts");

assert(manifest.name === "War Room Pick'Em", "manifest app name drifted");
assert(manifest.id === "/" && manifest.scope === "/", "manifest identity/scope missing");
assert(manifest.display === "standalone", "manifest must remain standalone");
assert(manifest.icons?.some((icon) => icon.sizes === "512x512"), "512px app icon missing");
assert(nativeContract.includes('bundleId: "com.warroompicks.app"'), "bundle ID contract missing");
assert(nativeContract.includes('canonicalOrigin: "https://app.war-room-picks.com"'), "dedicated app origin drifted");
assert(capacitorConfig.includes('url: "https://app.war-room-picks.com"'), "native shell is not pinned to the dedicated app host");
assert(!capacitorConfig.includes('allowNavigation: ["www.war-room-picks.com"'), "native shell can navigate into the storefront");
assert(login.includes('warRoomAuthReturnUrl("/reset-password")'), "password reset bypasses native-safe return contract");
assert(!login.includes("warroom-remember"), "login contains a cosmetic remember-me flag");
assert(!login.includes("Remember me"), "login promises a session option it cannot honor");
assert(browserSupabase.includes('storageKey: "warroom-auth"'), "browser/native auth storage key drifted");
assert(browserSupabase.includes("persistSession: true"), "browser/native session persistence disabled");
assert(!fs.existsSync(new URL("../src/lib/supabase/server.ts", import.meta.url)), "dead cookie auth client can reintroduce storage mismatch");
assert(layout.includes('viewportFit: "cover"'), "iOS safe-area viewport coverage missing");
assert(plusContract.includes("export const WAR_ROOM_PLUS_PUBLIC = false"), "Plus must remain inactive for free 1.0");
assert(plusContract.includes('"competitive_fairness"'), "free competitive fairness boundary missing");
assert(plusContract.includes('"extra_points"'), "never-paid competitive guard missing");
assert(nativeRuntime.includes('App.addListener("appUrlOpen"'), "native deep-link listener missing");
assert(nativeRuntime.includes('App.addListener("appStateChange"'), "native resume listener missing");
assert(nativeRuntime.includes("App.getLaunchUrl()"), "cold-start deep-link handling missing");
assert(nativeRuntime.includes('router.refresh()'), "native foreground does not refresh server state");
assert(nativeRuntime.includes("safeWarRoomPath"), "native deep links bypass safe path guard");
assert(nativeFeedback.includes('import("@capacitor/haptics")'), "native haptic adapter missing");
assert(commishOnboarding.includes("nativeSuccessFeedback"), "invite sharing lacks native success feedback");
assert(seasonOpening.includes("isWarRoomNative()"), "web opening can stack over native opening");
assert(capacitorConfig.includes('appId: "com.warroompicks.app"'), "Capacitor bundle ID drifted");
assert(capacitorConfig.includes('overlaysWebView: false'), "iPhone status bar can cover War Room chrome");
assert(sceneDelegate.includes("SeasonOpeningViewController"), "native opening controller missing");
assert(sceneDelegate.includes('subdirectory: "public/media"'), "native opening asset path missing");
assert(sceneDelegate.includes("configureSoundButton()"), "native opening sound control missing");
assert(sceneDelegate.includes("player?.isMuted = !soundEnabled"), "native opening sound control is not wired to playback");
assert(infoPlist.includes("ITSAppUsesNonExemptEncryption"), "export compliance declaration missing");
assert(privacyManifest.includes("<key>NSPrivacyTracking</key>\n\t<false/>"), "native privacy manifest must declare no tracking");
assert(privacyManifest.includes("NSPrivacyCollectedDataTypeEmailAddress"), "native privacy manifest omits email collection");
assert(privacyManifest.includes("NSPrivacyCollectedDataTypeGameplayContent"), "native privacy manifest omits gameplay data");
assert(privacyManifest.includes("NSPrivacyAccessedAPICategoryUserDefaults"), "required-reason UserDefaults declaration missing");
assert(privacyManifest.includes("CA92.1"), "UserDefaults required reason missing");
assert(xcodeProject.includes("PrivacyInfo.xcprivacy in Resources"), "privacy manifest is not in the iOS target");
assert(appStoreExport.includes("app-store-connect"), "App Store Connect export method missing");
assert(appStoreExport.includes("XWW458P3J7"), "App Store export team drifted");
assert(appStoreExport.includes("<key>signingStyle</key>\n\t<string>automatic</string>"), "App Store export must use managed signing");
assert(!infoPlist.includes("UIInterfaceOrientationLandscapeLeft") || infoPlist.indexOf("UIInterfaceOrientationLandscapeLeft") > infoPlist.indexOf("UISupportedInterfaceOrientations~ipad"), "iPhone must remain portrait-first");
assert(submissionPacket.includes("Tracking: **No**"), "App Privacy tracking answer missing");
assert(submissionPacket.includes("Gambling with real money or redeemable currency: **No**"), "real-money boundary missing");
assert(submissionPacket.includes("Create a fictional, populated App Review league"), "review account owner action missing");
assert(submissionPacket.includes("https://app.war-room-picks.com/support"), "App Store support URL is not on the dedicated app host");
assert(submissionPacket.includes("https://app.war-room-picks.com/privacy"), "App Store privacy URL is not on the dedicated app host");
assert(!submissionPacket.includes("https://www.war-room-picks.com"), "App Store packet points back to the storefront");

console.log("[native-readiness] PASS — identity, links, safe areas, and free-1.0 Plus guard verified");
