import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const project = read("native-ios/WarRoom.xcodeproj/project.pbxproj");
const entitlements = read("native-ios/WarRoom/WarRoom.entitlements");
const privacy = read("native-ios/WarRoom/PrivacyInfo.xcprivacy");

const buildNumbers = [...project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
const marketingVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);

assert.equal(buildNumbers.length, 6, "Expected Build number on app, unit-test, and UI-test Debug/Release configurations");
assert.deepEqual(new Set(buildNumbers), new Set(["21"]), "Every native target configuration must be stamped Build 21");
assert.equal(marketingVersions.length, 6, "Expected marketing version on app, unit-test, and UI-test Debug/Release configurations");
assert.deepEqual(new Set(marketingVersions), new Set(["3.3"]), "Every native target configuration must be stamped Version 3.3");

assert.ok((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.warroompicks\.WarRoom;/g) ?? []).length === 2);
assert.ok((project.match(/CODE_SIGN_ENTITLEMENTS = WarRoom\/WarRoom\.entitlements;/g) ?? []).length === 2);
assert.ok((project.match(/INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;/g) ?? []).length === 2);
assert.ok((project.match(/DEVELOPMENT_TEAM = XWW458P3J7;/g) ?? []).length === 6);

assert.match(entitlements, /<key>aps-environment<\/key>/);
assert.match(entitlements, /applinks:app\.war-room-picks\.com/);
assert.match(privacy, /NSPrivacyTracking/);
assert.match(privacy, /<false\/>/);
assert.match(privacy, /NSPrivacyAccessedAPICategoryUserDefaults/);
assert.ok(existsSync(new URL("../native-ios/WarRoom/Assets.xcassets/AppIcon.appiconset", import.meta.url)));

console.log("Native iOS release metadata PASS - Version 3.3, Build 21, bundle identity, signing team, push/deep-link entitlements, privacy manifest, encryption declaration, and app icon are present");
