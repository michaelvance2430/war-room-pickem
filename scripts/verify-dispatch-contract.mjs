import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateDispatchAiDraft,
} from "../src/lib/dispatch-ai-contract.ts";
import { weekDateRangeLabel } from "../src/lib/season-calendar.ts";
import {
  createFoundryWalkthrough,
  simulateNextFoundryWeek,
  simulateFoundrySeason,
} from "../src/lib/foundry-walkthrough.ts";

assert.equal(weekDateRangeLabel(1, "cfb"), "Sep 3–7, 2026");
assert.equal(weekDateRangeLabel(1, "nfl"), "Sep 10–14, 2026");

const cfbOpening = createFoundryWalkthrough("cfb");
assert.equal(cfbOpening.week, 0, "CFB Sandbox starts in Week 0");
const cfbWeekOne = simulateNextFoundryWeek(cfbOpening);
assert.equal(cfbWeekOne.week, 1, "Week 0 advances to Week 1");
assert.deepEqual(cfbWeekOne.gazetteWeeks, [0], "scored Week 0 immediately creates a Dispatch");
assert.equal(cfbWeekOne.weekHistory.length, 1, "one tap atomically archives one completed week");
assert.ok(cfbWeekOne.weekHistory[0].players.every((player) => player.locked), "every bot card is locked in the weekly record");
assert.ok(cfbWeekOne.weekHistory[0].games.every((game) => game.status === "final" && game.result), "every score is final in the weekly record");
const cfbWeekTwo = simulateNextFoundryWeek(cfbWeekOne);
assert.equal(cfbWeekTwo.week, 2, "Week 1 advances to Week 2");
assert.deepEqual(cfbWeekTwo.gazetteWeeks, [0, 1], "each scored week immediately creates a Dispatch");
assert.equal(cfbWeekTwo.weekHistory.length, 2, "weekly snapshots survive when the next card opens");
const cfbFullSeason = simulateFoundrySeason(cfbOpening);
assert.equal(cfbFullSeason.week, 16, "one tap reaches the CFB season boundary");
assert.deepEqual(cfbFullSeason.gazetteWeeks, Array.from({ length: 17 }, (_, index) => index), "one tap scores every CFB week including Week 0");
assert.equal(cfbFullSeason.weekHistory.length, 17, "every week has one atomic saved record");
assert.ok(cfbFullSeason.weekHistory.every((snapshot) => snapshot.games.every((game) => game.status === "final" && game.result)), "full-season simulation leaves no game requiring manual scoring");

const packet = {
  schemaVersion: 1,
  leagueId: "lab",
  sportId: "cfb",
  weekNumber: 1,
  weekLabel: "Week 1",
  coverageLine: "Coverage: Sep 3–7, 2026",
  facts: [{ id: "score:mike", kind: "weekly_score", summary: "Mike scored 31", people: ["Mike"], lockerMessageIds: [] }],
};
const story = { kicker: "A1", headline: "MIKE DISCOVERS POINTS", body: "The room has requested an investigation.", sourceFactIds: ["score:mike"] };
assert.deepEqual(validateDispatchAiDraft(packet, { schemaVersion: 1, lead: story, briefs: [], lockerRoasts: [] }), { ok: true });
assert.equal(validateDispatchAiDraft(packet, { schemaVersion: 1, lead: { ...story, sourceFactIds: ["invented"] }, briefs: [], lockerRoasts: [] }).ok, false);

const gazette = readFileSync("src/lib/gazette.ts", "utf8");
const paper = readFileSync("src/components/GazettePaper.tsx", "utf8");
const nav = readFileSync("src/components/Nav.tsx", "utf8");
assert.doesNotMatch(gazette, /edition\.weekIndex < 1|weekIndex < 1/);
assert.match(gazette, /THE WAR ROOM DISPATCH/);
assert.match(paper, /edition\.coverageLine/);
assert.match(paper, /CFB_DISPATCH_ART/);
assert.match(paper, /NFL_DISPATCH_ART/);
assert.match(paper, /edition\.weekIndex.*desk\.length/);
assert.match(nav, /label: "The Dispatch"/);

console.log("Dispatch contract verified: immediate first-score release · real coverage ranges · cited AI stories only");
