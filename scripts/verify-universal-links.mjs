import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[universal-links] ${message}`);
}

const entitlements = read("ios/App/App/App.entitlements");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const associationRoute = read("src/app/.well-known/apple-app-site-association/route.ts");
const nativeRuntime = read("src/components/NativeRuntime.tsx");

assert(entitlements.includes("com.apple.developer.associated-domains"), "Associated Domains entitlement missing");
assert(entitlements.includes("applinks:www.war-room-picks.com"), "canonical universal-link host missing");
assert(entitlements.includes("applinks:war-room-picks.com"), "apex universal-link host missing");
assert(xcodeProject.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)?.length === 2, "entitlements are not attached to both app build configurations");
assert(associationRoute.includes("process.env.APPLE_TEAM_ID"), "AASA route is not bound to the Apple Team ID");
assert(associationRoute.includes('const bundleId = "com.warroompicks.app"'), "AASA bundle ID drifted");
for (const path of ["/join", "/reset-password", "/login", "/account", "/picks", "/standings", "/locker-room"]) {
  assert(associationRoute.includes(`\"${path}\"`), `AASA route is missing ${path}`);
}
assert(nativeRuntime.includes('App.addListener("appUrlOpen"'), "installed app does not receive universal links");
assert(nativeRuntime.includes("App.getLaunchUrl()"), "cold-start universal links are not handled");

console.log("[universal-links] PASS — entitlement, AASA endpoint, and app routing agree");
