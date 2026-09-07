import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[app-review-community-safety] ${message}`);
}

const content = read("native-ios/WarRoom/ContentView.swift");
const compliance = read("native-ios/WarRoom/AppCompliance.swift");
const tests = read("native-ios/WarRoomTests/WarRoomTests.swift");
const terms = read("src/app/terms/page.tsx");

assert(content.includes("acceptedCommunityTerms"), "pre-auth terms acceptance state is missing");
assert(content.includes("loginSubmissionIsAllowed("), "login/create-account gate is missing");
assert(content.includes("I agree to the Terms of Use and Privacy Policy."), "pre-auth agreement copy is missing");
assert(content.includes("Report Message"), "visible message-report action is missing");
assert(content.includes("Block Player"), "visible player-block action is missing");
assert(content.includes("SupabaseAPI.reportLockerMessage"), "report action is not connected to moderation storage");
assert(content.includes("safety.block(message.userId)"), "block action is not connected to the safety store");
assert(compliance.includes("zero tolerance for objectionable content or abusive users"), "in-app safety policy is missing");
assert(terms.includes("zero tolerance for objectionable content or abusive users"), "public Terms safety policy is missing");
assert(tests.includes("loginRequiresCommunityTermsForExistingAndNewAccounts"), "terms gate regression test is missing");

console.log("Build 22 App Review community-safety gate PASS — pre-auth agreement, zero-tolerance policy, report, block, and regression coverage are present");
