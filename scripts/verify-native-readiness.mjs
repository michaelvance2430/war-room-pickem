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

assert(manifest.name === "War Room Pick'Em", "manifest app name drifted");
assert(manifest.id === "/" && manifest.scope === "/", "manifest identity/scope missing");
assert(manifest.display === "standalone", "manifest must remain standalone");
assert(manifest.icons?.some((icon) => icon.sizes === "512x512"), "512px app icon missing");
assert(nativeContract.includes('bundleId: "com.warroompicks.app"'), "bundle ID contract missing");
assert(nativeContract.includes('canonicalOrigin: "https://www.war-room-picks.com"'), "canonical origin drifted");
assert(login.includes('warRoomAuthReturnUrl("/reset-password")'), "password reset bypasses native-safe return contract");
assert(layout.includes('viewportFit: "cover"'), "iOS safe-area viewport coverage missing");
assert(plusContract.includes("export const WAR_ROOM_PLUS_PUBLIC = false"), "Plus must remain inactive for free 1.0");
assert(plusContract.includes('"competitive_fairness"'), "free competitive fairness boundary missing");
assert(plusContract.includes('"extra_points"'), "never-paid competitive guard missing");

console.log("[native-readiness] PASS — identity, links, safe areas, and free-1.0 Plus guard verified");
