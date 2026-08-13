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
const nativeFeedback = read("src/lib/native-feedback.ts");
const commishOnboarding = read("src/lib/commish-onboarding.ts");

assert(manifest.name === "War Room Pick'Em", "manifest app name drifted");
assert(manifest.id === "/" && manifest.scope === "/", "manifest identity/scope missing");
assert(manifest.display === "standalone", "manifest must remain standalone");
assert(manifest.icons?.some((icon) => icon.sizes === "512x512"), "512px app icon missing");
assert(nativeContract.includes('bundleId: "com.warroompicks.app"'), "bundle ID contract missing");
assert(nativeContract.includes('canonicalOrigin: "https://www.war-room-picks.com"'), "canonical origin drifted");
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

console.log("[native-readiness] PASS — identity, links, safe areas, and free-1.0 Plus guard verified");
