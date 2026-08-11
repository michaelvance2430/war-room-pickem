import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  crewContinuityThreshold,
  defaultSportPoolMessage,
  doesCrewContinue,
} = await import("../src/lib/sport-pool.ts");

assert.equal(crewContinuityThreshold(20), 10);
assert.equal(doesCrewContinue(20, 10), true);
assert.equal(doesCrewContinue(20, 9), false);

assert.equal(crewContinuityThreshold(4), 3);
assert.equal(doesCrewContinue(4, 3), true);
assert.equal(doesCrewContinue(4, 2), false);

// The contract deliberately accepts no year, elapsed-time, or prior-sport input.
// A returning Crew is judged only by the chapter launching the query.
assert.equal(doesCrewContinue(18, 9), true);

assert.equal(
  defaultSportPoolMessage("NFL"),
  "NFL. Same crew, new ways to embarrass yourselves. You in?"
);

const commissionerUi = readFileSync(
  new URL("../src/components/SportPoolCommishPanel.tsx", import.meta.url),
  "utf8"
);
const playerUi = readFileSync(
  new URL("../src/components/SportPoolPollBanner.tsx", import.meta.url),
  "utf8"
);

assert.match(commissionerUi, /Ask this league who wants in/);
assert.match(commissionerUi, /Ask the league/);
assert.match(commissionerUi, /creates the new league/);
assert.match(playerUi, /I’m in/);
assert.match(playerUi, /seat is automatic/);
assert.doesNotMatch(commissionerUi, /Soft invite|new desk/);

console.log("Crew continuity contract: PASS");
