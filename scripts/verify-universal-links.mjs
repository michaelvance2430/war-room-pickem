import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[universal-links] ${message}`);
}

const entitlements = read("ios/App/App/App.entitlements");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const nativeEntitlements = read("native-ios/WarRoom/WarRoom.entitlements");
const nativeXcodeProject = read("native-ios/WarRoom.xcodeproj/project.pbxproj");
const associationRoute = read("src/app/.well-known/apple-app-site-association/route.ts");
const nativeRuntime = read("src/components/NativeRuntime.tsx");

assert(entitlements.includes("com.apple.developer.associated-domains"), "Associated Domains entitlement missing");
assert(entitlements.includes("applinks:app.war-room-picks.com"), "dedicated app universal-link host missing");
assert(!entitlements.includes("applinks:www.war-room-picks.com"), "storefront must not open the app");
assert(!entitlements.includes("applinks:war-room-picks.com"), "apex storefront must not open the app");
assert(xcodeProject.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)?.length === 2, "entitlements are not attached to both app build configurations");
assert(associationRoute.includes('const teamId = "XWW458P3J7"'), "AASA route is not bound to the enrolled Apple Team ID");
assert(associationRoute.includes('`${teamId}.com.warroompicks.WarRoom`'), "AASA route is missing the native app ID");
assert(associationRoute.includes('`${teamId}.com.warroompicks.app`'), "AASA route dropped the retained legacy app ID");
assert(associationRoute.includes('{ "/": "/invite/*"'), "AASA route is missing native invitation links");
assert(xcodeProject.match(/DEVELOPMENT_TEAM = XWW458P3J7;/g)?.length === 2, "paid Apple team is not attached to both app build configurations");
assert(nativeEntitlements.includes("com.apple.developer.associated-domains"), "native Associated Domains entitlement missing");
assert(nativeEntitlements.includes("applinks:app.war-room-picks.com"), "native app universal-link host missing");
assert(nativeEntitlements.includes("aps-environment"), "native APNs entitlement was dropped");
assert(nativeXcodeProject.match(/CODE_SIGN_ENTITLEMENTS = WarRoom\/WarRoom\.entitlements;/g)?.length === 2, "native entitlements are not attached to both app build configurations");
assert(nativeXcodeProject.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.warroompicks\.WarRoom;/g)?.length === 2, "native bundle ID drifted");
for (const path of ["/join", "/reset-password", "/login", "/account", "/picks", "/standings", "/locker-room"]) {
  assert(associationRoute.includes(`\"${path}\"`), `AASA route is missing ${path}`);
}
assert(nativeRuntime.includes('App.addListener("appUrlOpen"'), "installed app does not receive universal links");
assert(nativeRuntime.includes("App.getLaunchUrl()"), "cold-start universal links are not handled");

console.log("[universal-links] PASS — entitlement, AASA endpoint, and app routing agree");
