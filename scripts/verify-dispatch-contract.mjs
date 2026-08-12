import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateDispatchAiDraft,
} from "../src/lib/dispatch-ai-contract.ts";
import { weekDateRangeLabel } from "../src/lib/season-calendar.ts";

assert.equal(weekDateRangeLabel(1, "cfb"), "Sep 3–7, 2026");
assert.equal(weekDateRangeLabel(1, "nfl"), "Sep 10–14, 2026");

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
assert.match(gazette, /weekIndex < 1/);
assert.match(gazette, /THE WAR ROOM DISPATCH/);
assert.match(paper, /edition\.coverageLine/);
assert.match(nav, /label: "The Dispatch"/);

console.log("Dispatch contract verified: Week 2 debut · real coverage ranges · cited AI stories only");

