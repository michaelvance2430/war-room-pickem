import assert from "node:assert/strict";
import { buildDispatchFactPacket, buildDeterministicDispatchDraft, dispatchDraftSideStories } from "../src/lib/dispatch-newsroom.ts";
import { validateDispatchAiDraft } from "../src/lib/dispatch-ai-contract.ts";
import { readFileSync } from "node:fs";

const edition = {
  weekIndex: 0, weekLabel: "Week 0", volumeLabel: "Vol. 0", coverageLine: "Coverage: Aug 24–29", sportId: "cfb",
  crown: { names: ["Brick"], pts: 21, headline: "", deck: "", kind: "clear" },
  shame: { names: ["Bagz"], pts: 3, headline: "", deck: "", kind: "clear" },
  swing: null, noLock: null, rivalryWatch: null, chaosDetonation: null, emergencyProtocol: undefined,
};
const packet = buildDispatchFactPacket({ leagueId: "league-1", edition, players: [] });
assert.equal(packet.weekNumber, 0, "Week 0 must be publishable");
assert.ok(packet.facts.every((fact) => fact.id && fact.summary), "every fact is cited and printable");
const draft = buildDeterministicDispatchDraft(packet);
assert.deepEqual(validateDispatchAiDraft(packet, draft), { ok: true });
assert.ok(dispatchDraftSideStories(packet, draft).length, "fallback newsroom must produce briefs without AI");
const bad = structuredClone(draft);
bad.lead.sourceFactIds = ["invented-fact"];
assert.equal(validateDispatchAiDraft(packet, bad).ok, false, "uncited inventions must be rejected");
const lockerPacket = buildDispatchFactPacket({
  leagueId: "league-1", edition, players: [],
  lockerThemes: [{ summary: "Dave delivered a fully redacted outburst. Somebody get that player a Snickers.", messageIds: ["message-1"] }],
});
assert.match(
  dispatchDraftSideStories(lockerPacket, buildDeterministicDispatchDraft(lockerPacket))[0].body,
  /Snickers/,
  "redacted Locker meltdowns must survive the deterministic fallback"
);
const route = readFileSync("src/app/api/dispatch/newsroom/route.ts", "utf8");
const gazette = readFileSync("src/lib/gazette.ts", "utf8");
assert.match(route, /store:\s*false/, "Dispatch API must not store model requests");
assert.match(route, /no private message text was supplied/i, "Locker themes must disclose metadata-only input");
assert.match(route, /function vulgarityScore/, "Locker meltdowns must be detected before the model call");
assert.match(route, /fully redacted outburst/, "vulgar Locker meltdowns must become redacted Dispatch copy");
assert.doesNotMatch(route, /content:\s*JSON\.stringify\(messages\)/, "raw Locker messages must never enter the model request");
assert.ok(gazette.indexOf("await archiveGazetteEdition(edition)") < gazette.indexOf("requestDispatchNewsroom(packet)"), "factual Dispatch must file before AI runs");
console.log("Dispatch newsroom verified: cited facts · Week 0 · truth-first fallback · metadata-only Locker themes · hallucination rejection");
