import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const details = readFileSync("src/components/ProfileHeavyDetails.tsx", "utf8");

assert.match(
  details,
  /const visibleBadges = isSelf \? badges : badges\.filter\(\(badge\) => badge\.earned\)/,
  "another player's profile must expose earned badges only",
);
assert.match(
  details,
  /const visibleWwcBadges = isSelf[\s\S]*wwcBadges\.filter\(\(badge\) => badge\.earned\)/,
  "WWC profiles must follow the same earned-only privacy rule",
);
assert.match(
  details,
  /<BadgeShelf badges=\{visibleBadges\}/,
  "the achievement shelf must render the filtered badge list",
);
assert.match(
  details,
  /filterCrewCheevos\(visibleBadges\)/,
  "crew marks must not leak locked badges",
);
assert.match(
  details,
  /isSelf \? "No badges loaded\." : "No achievements earned yet\."/,
  "an empty public profile must not imply a loading failure",
);

console.log("Profile badges verified: self sees catalog, other players show earned only");
