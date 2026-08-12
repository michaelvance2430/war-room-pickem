import assert from "node:assert/strict";
import { buildDispatchFactPacket, buildDeterministicDispatchDraft, dispatchDraftSideStories } from "../src/lib/dispatch-newsroom.ts";
import { validateDispatchAiDraft } from "../src/lib/dispatch-ai-contract.ts";

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
console.log("Dispatch newsroom verified: cited facts · Week 0 · deterministic fallback · hallucination rejection");
