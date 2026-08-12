/**
 * The Dispatch AI boundary.
 *
 * Competitive truth is assembled by War Room code. A model may write jokes
 * only from these cited facts; it never queries the database or awards points.
 */

export type DispatchFactKind =
  | "weekly_score"
  | "game_result"
  | "upset"
  | "standings_move"
  | "best_bet"
  | "no_lock"
  | "weapon_use"
  | "locker_theme";

export type DispatchFact = {
  id: string;
  kind: DispatchFactKind;
  summary: string;
  /** Display names already authorized for this league edition. */
  people: string[];
  /** Locker content is summarized before AI; raw messages never enter drafts. */
  lockerMessageIds: string[];
};

export type DispatchFactPacket = {
  schemaVersion: 1;
  leagueId: string;
  sportId: string;
  weekNumber: number;
  weekLabel: string;
  coverageLine: string;
  facts: DispatchFact[];
};

export type DispatchAiStory = {
  kicker: string;
  headline: string;
  body: string;
  sourceFactIds: string[];
};

export type DispatchAiDraft = {
  schemaVersion: 1;
  lead: DispatchAiStory;
  briefs: DispatchAiStory[];
  lockerRoasts: DispatchAiStory[];
};

export type DispatchDraftValidation =
  | { ok: true }
  | { ok: false; error: string };

/** Reject uncited prose before it can be merged into a filed edition. */
export function validateDispatchAiDraft(
  packet: DispatchFactPacket,
  draft: DispatchAiDraft
): DispatchDraftValidation {
  const allowed = new Set(packet.facts.map((fact) => fact.id));
  const stories = [draft.lead, ...draft.briefs, ...draft.lockerRoasts];
  for (const story of stories) {
    if (!story.headline.trim() || !story.body.trim()) {
      return { ok: false, error: "Dispatch AI returned an empty story." };
    }
    if (!story.sourceFactIds.length) {
      return { ok: false, error: "Every Dispatch AI story requires a source fact." };
    }
    const unknown = story.sourceFactIds.find((id) => !allowed.has(id));
    if (unknown) {
      return { ok: false, error: `Dispatch AI cited unknown fact ${unknown}.` };
    }
  }
  return { ok: true };
}

