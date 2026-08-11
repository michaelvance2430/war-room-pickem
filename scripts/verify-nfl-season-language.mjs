import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cutLockWeek,
  listSeasonWeekNumbers,
  NFL_CUT_LOCK_WEEK,
  NFL_RS_MAX_WEEK,
} from "../src/lib/season-calendar.ts";

assert.equal(NFL_RS_MAX_WEEK, 18, "NFL regular season ends after Week 18");
assert.equal(NFL_CUT_LOCK_WEEK, 18, "NFL cut locks after Week 18");
assert.equal(cutLockWeek("nfl"), 18, "NFL commissioner cut week");
assert.equal(cutLockWeek("cfb"), 14, "CFB commissioner cut week");
assert.deepEqual(
  listSeasonWeekNumbers("nfl"),
  Array.from({ length: 22 }, (_, index) => index + 1),
  "NFL uses official Weeks 1–18 followed by playoff slots 19–22"
);

const commissioner = readFileSync(
  "src/app/commissioner/CommissionerClient.tsx",
  "utf8"
);
const championship = readFileSync("src/app/championship/page.tsx", "utf8");
const rules = readFileSync("src/lib/rules.ts", "utf8");

assert.doesNotMatch(
  commissioner,
  /cutHint:\s*w === 14/,
  "commissioner cut styling must never hard-code the CFB week for NFL"
);
assert.equal(
  commissioner.match(/cutHint:\s*w === cutLockWeek\(league\?\.sportId\)/g)
    ?.length,
  2,
  "both commissioner week pickers use the sport-native cut"
);
assert.match(
  championship,
  /After Week 18, seeds lock and the War Room playoffs begin/,
  "NFL bracket explains the real seed lock"
);
assert.match(
  rules,
  /Official NFL Weeks 1–18/,
  "NFL rules use official week numbering"
);

console.log(
  "NFL season language verified: Week 18 cut · official Weeks 1–22 · no CFB cut styling leak"
);
