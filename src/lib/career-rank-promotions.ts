import { CAREER_RANKS, type CareerRank } from "./career-ranks";

const KEY = "warroom-career-rank-promotions-v1";
type Store = Record<string, { rankId: string; weekIndex: number }>;

function read(): Store {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Store; } catch { return {}; }
}

export function getRecordedCareerRankId(playerId: string): string | null {
  return playerId ? read()[playerId]?.rankId || null : null;
}

/** Career rank is a ratchet: once displayed as earned, it can only move forward. */
export function recordCareerRankFloor(playerId: string, rankId: string, weekIndex = 0): void {
  if (!playerId || !rankId || typeof localStorage === "undefined") return;
  const store = read();
  const previous = store[playerId];
  const previousIndex = CAREER_RANKS.findIndex((rank) => rank.id === previous?.rankId);
  const nextIndex = CAREER_RANKS.findIndex((rank) => rank.id === rankId);
  if (nextIndex < 0 || previousIndex >= nextIndex) return;
  store[playerId] = { rankId, weekIndex };
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** Records only forward movement. First observation establishes the baseline. */
export function observeCareerPromotion(input: { playerId: string; playerName: string; rank: CareerRank; weekIndex: number }): { name: string; from: CareerRank; to: CareerRank } | null {
  if (!input.playerId || typeof localStorage === "undefined") return null;
  const store = read();
  const previous = store[input.playerId];
  const toIndex = CAREER_RANKS.findIndex((rank) => rank.id === input.rank.id);
  if (!previous) {
    store[input.playerId] = { rankId: input.rank.id, weekIndex: input.weekIndex };
    localStorage.setItem(KEY, JSON.stringify(store));
    return null;
  }
  const fromIndex = CAREER_RANKS.findIndex((rank) => rank.id === previous.rankId);
  if (toIndex <= fromIndex) return null;
  store[input.playerId] = { rankId: input.rank.id, weekIndex: input.weekIndex };
  localStorage.setItem(KEY, JSON.stringify(store));
  return { name: input.playerName, from: CAREER_RANKS[Math.max(0, fromIndex)], to: input.rank };
}

const RANK_ROASTS: Record<string, (name: string) => string> = {
  PV2: (name) => `${name} is now authorized to know just enough to be dangerous. Leadership has hidden the keys.` ,
  PFC: (name) => `${name} found the formation, brought the correct picks, and has been promoted before anyone could investigate further.`,
  SPC: (name) => `${name} has entered the E-4 Mafia and already identified three league requirements that could have been emails.`,
  CPL: (name) => `${name} received all the responsibilities of a sergeant and approximately none of the respect. A proud tradition continues.`,
  SGT: (name) => `${name} is now officially accountable for several grown adults and every pick they forgot to lock.`,
  SSG: (name) => `${name} has acquired a clipboard, a suspiciously specific standard, and the ability to say “too easy” before assigning work.`,
  SFC: (name) => `${name} now runs the room through coffee, institutional memory, and one look that ends side conversations.`,
  MSG: (name) => `${name} has reached the rank where every answer begins with “Back when this league had standards…”`,
  "1SG": (name) => `${name} can now detect hands in pockets, missing picks, and unauthorized happiness from two counties away.`,
  SGM: (name) => `${name} has become the senior enlisted subject-matter expert on parking, fonts, and why your bracket lacks discipline.`,
  CSM: (name) => `${name} made Command Sergeant Major. The grass has been placed on notice and the group chat will stand at parade rest.`,
  "2LT": (name) => `${name} has been commissioned. Salute now; provide adult supervision and a map immediately afterward.`,
  "1LT": (name) => `${name} survived the butter-bar years and may now be trusted with a laminated playoff bracket under direct supervision.`,
  CPT: (name) => `${name} has command authority, a color-coded training calendar, and exactly one weekend before the inbox wins.`,
  MAJ: (name) => `${name} converted one correct pick into a 46-slide decision brief. Promotion was the only way to stop the presentation.`,
  LTC: (name) => `${name} now commands meetings about the meetings that determine which picks require another meeting.`,
  COL: (name) => `${name} pinned the bird and immediately asked why the War Room could not simply “be more agile.” Staff remains missing.`,
  BG: (name) => `${name} earned a star. Every obvious observation will now be repeated by six people and called strategic guidance.`,
  MG: (name) => `${name} has two stars and a bracket so classified even the computer is pretending not to have seen it.`,
  LTG: (name) => `${name} has three stars, four aides, and no remaining ability to enter the group chat unnoticed.`,
  GEN: (name) => `${name} has four stars. The picks are now called theater strategy and losing weeks are officially learning opportunities.`,
  "★★★★★": (name) => `${name} is now Five-Star Field General. Congress has requested testimony. The group chat has requested they calm down.`,
};

export function promotionGazetteDeck(name: string, from: CareerRank, to: CareerRank): string {
  const roast = RANK_ROASTS[to.abbreviation]?.(name) || `${name} advanced from ${from.name} to ${to.name}. The paperwork survived.`;
  return `${roast} Promotion points cleared. Time in service acknowledged. Orders effective immediately.`;
}
