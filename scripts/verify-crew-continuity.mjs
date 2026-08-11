import assert from "node:assert/strict";

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

console.log("Crew continuity contract: PASS");
