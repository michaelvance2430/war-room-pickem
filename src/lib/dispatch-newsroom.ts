import type { Player } from "@/lib/types";
import type { GazetteEdition, GazetteSideStory } from "@/lib/gazette";
import type {
  DispatchAiDraft,
  DispatchFact,
  DispatchFactPacket,
} from "@/lib/dispatch-ai-contract";
import { validateDispatchAiDraft } from "@/lib/dispatch-ai-contract";

export type SanitizedLockerTheme = {
  summary: string;
  messageIds: string[];
  people?: string[];
};

/** Competitive code creates the facts. A model never receives database access. */
export function buildDispatchFactPacket(opts: {
  leagueId: string;
  edition: GazetteEdition;
  players: Player[];
  lockerThemes?: SanitizedLockerTheme[];
}): DispatchFactPacket {
  const { edition } = opts;
  const facts: DispatchFact[] = [];
  const add = (fact: Omit<DispatchFact, "id">) =>
    facts.push({ ...fact, id: `w${edition.weekIndex}-${fact.kind}-${facts.length + 1}` });

  add({
    kind: "weekly_score",
    summary: `${edition.crown.names.join(" and ")} won ${edition.weekLabel} with ${edition.crown.pts} points.`,
    people: edition.crown.names,
    lockerMessageIds: [],
  });
  if (edition.shame) add({
    kind: "weekly_score",
    summary: `${edition.shame.names.join(" and ")} finished last for ${edition.weekLabel} with ${edition.shame.pts} points.`,
    people: edition.shame.names,
    lockerMessageIds: [],
  });
  if (edition.swing) add({
    kind: "standings_move",
    summary: `${edition.swing.names.join(" and ")} produced the week's biggest standings movement: ${edition.swing.deck}`,
    people: edition.swing.names,
    lockerMessageIds: [],
  });
  if (edition.noLock) add({
    kind: "no_lock",
    summary: `${edition.noLock.names.join(", ")} did not lock a complete card for ${edition.weekLabel}.`,
    people: edition.noLock.names,
    lockerMessageIds: [],
  });
  if (edition.rivalryWatch) add({
    kind: "standings_move",
    summary: edition.rivalryWatch.deck,
    people: edition.rivalryWatch.names,
    lockerMessageIds: [],
  });
  if (edition.chaosDetonation || edition.emergencyProtocol) add({
    kind: "weapon_use",
    summary: edition.chaosDetonation?.deck || `${edition.emergencyProtocol} was authorized during ${edition.weekLabel}.`,
    people: edition.chaosDetonation?.names || [],
    lockerMessageIds: [],
  });
  for (const theme of (opts.lockerThemes || []).slice(0, 3)) {
    const summary = theme.summary.replace(/\s+/g, " ").trim().slice(0, 240);
    if (!summary || !theme.messageIds.length) continue;
    add({ kind: "locker_theme", summary, people: theme.people || [], lockerMessageIds: theme.messageIds });
  }

  return {
    schemaVersion: 1,
    leagueId: opts.leagueId,
    sportId: edition.sportId || "cfb",
    weekNumber: edition.weekIndex,
    weekLabel: edition.weekLabel,
    coverageLine: edition.coverageLine || edition.weekLabel,
    facts,
  };
}

/** Always-available newsroom. AI may improve this draft, never replace its truth. */
export function buildDeterministicDispatchDraft(packet: DispatchFactPacket): DispatchAiDraft {
  const leadFact = packet.facts.find((fact) => fact.kind === "weekly_score") || packet.facts[0];
  const leadName = leadFact?.people[0] || "SOMEBODY";
  const briefs = packet.facts.slice(1, 5).map((fact) => ({
    kicker: fact.kind === "no_lock" ? "Missing persons" : fact.kind === "weapon_use" ? "Arsenal desk" : fact.kind === "locker_theme" ? "Locker wire" : "Around the room",
    headline: fact.kind === "no_lock" ? "CARD NEVER ARRIVES; SEARCH PARTY CLOCKS OUT" : fact.kind === "weapon_use" ? "AUTHORITIES CONFIRM THE BUTTON WAS, IN FACT, PRESSED" : fact.kind === "locker_theme" ? "LOCKER ROOM PRODUCES ANOTHER COMPLETELY NORMAL DISCUSSION" : "STANDINGS MOVE; GROUP CHAT DEMANDS INVESTIGATION",
    body: fact.summary,
    sourceFactIds: [fact.id],
  }));
  return {
    schemaVersion: 1,
    lead: {
      kicker: "Lead story",
      headline: `${leadName.toUpperCase()} OWNS ${packet.weekLabel.toUpperCase()}`,
      body: leadFact?.summary || `${packet.weekLabel} has been scored.`,
      sourceFactIds: leadFact ? [leadFact.id] : [],
    },
    briefs,
    lockerRoasts: [],
  };
}

export function dispatchDraftSideStories(packet: DispatchFactPacket, draft: DispatchAiDraft): GazetteSideStory[] {
  if (!validateDispatchAiDraft(packet, draft).ok) return [];
  return draft.briefs.map(({ kicker, headline, body }) => ({ kicker, headline, body }));
}
