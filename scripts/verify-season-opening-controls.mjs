import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/SeasonOpening.tsx", "utf8");

assert.match(source, /Skip intro →/i, "opening video needs a visible temporary skip");
assert.match(
  source,
  /aria-label="Skip the opening video this time"/,
  "temporary behavior must be clear to assistive technology"
);
assert.match(source, /onClick=\{dismiss\}/, "skip must dismiss only this playback");
assert.doesNotMatch(source, /Don(?:'|&apos;)t show again/i, "permanent disable must not be offered");
assert.doesNotMatch(source, /DISABLED_KEY|disableOpening|localStorage\.setItem/, "permanent-disable state must not exist");
assert.doesNotMatch(source, /SEEN_THIS_SESSION_KEY|sessionStorage/, "opening must not be suppressed for the session");

console.log("Season opening controls verified: always opens · temporary skip only");
