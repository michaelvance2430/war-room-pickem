import assert from "node:assert/strict";
import {
  CBB_MARCH_CARD_RULES,
  CBB_NATIONAL_TOURNAMENT_ROUNDS,
  CBB_NATIONAL_TOURNAMENT_TOTAL_GAMES,
  CBB_PHASE_ORDER,
  CBB_PROFILE_CONTRACT,
  splitCbbTournamentField,
} from "../src/lib/sports/cbb-contract.ts";
import {
  advanceCbbSim,
  buildCbbSimulationPlan,
  createCbbSimState,
  validateCbbSimConfig,
} from "../src/lib/sports/cbb-foundry-sim.ts";

assert.equal(
  CBB_NATIONAL_TOURNAMENT_ROUNDS.reduce((sum, round) => sum + round.games, 0),
  CBB_NATIONAL_TOURNAMENT_TOTAL_GAMES,
  "The Field of 68 must contain all 67 games"
);
assert.equal(CBB_MARCH_CARD_RULES.everyGameRequired, true);
assert.equal(CBB_MARCH_CARD_RULES.eliminatedPlayersKeepPicking, true);
assert.equal(CBB_MARCH_CARD_RULES.eliminationBegins, "sweet_16");
assert.equal(CBB_PROFILE_CONTRACT.publicProfilesShowLockedCheevos, false);
assert.equal(CBB_PHASE_ORDER[0], "regular_season");
assert.equal(CBB_PHASE_ORDER.at(-1), "season_complete");

for (let total = 8; total <= 32; total += 1) {
  const split = splitCbbTournamentField(total);
  assert.equal(split.championshipPlayers + split.toiletBowlPlayers, total);
  assert.ok(Math.abs(split.championshipPlayers - split.toiletBowlPlayers) <= 1);
  assert.ok(split.championshipBracketSize >= split.championshipPlayers);
  assert.ok(split.toiletBowlBracketSize >= split.toiletBowlPlayers);
  assert.equal(split.championshipByes, split.championshipBracketSize - split.championshipPlayers);
  assert.equal(split.toiletBowlByes, split.toiletBowlBracketSize - split.toiletBowlPlayers);
}

const thirtyOne = splitCbbTournamentField(31);
assert.equal(thirtyOne.championshipPlayers, 16);
assert.equal(thirtyOne.toiletBowlPlayers, 15);
assert.equal(thirtyOne.toiletBowlByes, 1);

const config = { playerCount: 31, regularWeeks: 14, conferenceChampionPicks: 6, takeoverIds: ["maui"] };
assert.deepEqual(validateCbbSimConfig(config), []);
const plan = buildCbbSimulationPlan(config);
assert.equal(plan.filter((step) => step.phase === "tournament_takeover").length, 1);
assert.equal(plan.find((step) => step.id === "round-64")?.games, 32);
assert.equal(plan.find((step) => step.id === "sweet-16")?.elimination, true);
let simulation = createCbbSimState(config);
for (let index = 1; index < simulation.steps.length; index += 1) simulation = advanceCbbSim(simulation);
assert.equal(simulation.steps[simulation.cursor]?.phase, "season_complete");
assert.ok(validateCbbSimConfig({ ...config, takeoverIds: ["maui", "atlantis"] }).length > 0);

console.log("CBB contract verified: 67 games · phases · profiles · fields 8–32 · isolated simulation");
