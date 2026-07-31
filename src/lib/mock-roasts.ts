import { Player } from "./types";

/**
 * Ten War Room shit-talk lines for demo/NPC profiles.
 * One is shown per mock player (stable pick from their id).
 */
export const MOCK_NPC_ROASTS: string[] = [
  "This ain't a person. It's a spreadsheet with a gambling problem and a fake name.",
  "NPC energy. Built in a lab to pad divisions and steal your Best Bet aura.",
  "Not real. Never locked a card. Still somehow mid in your division.",
  "If you trash-talk this profile, you're arguing with the furniture. Respectfully: it's furniture.",
  "Demo account. All the swagger of a pregame show, none of the consequences.",
  "No heartbeat, no bad beats, no group chat. Just vibes and made-up ATS%.",
  "This one came free with the War Room. Like the plastic trophy. Louder than it is useful.",
  "Not a human — a cautionary tale in username form. Do not challenge to a prop.",
  "Synthetic spread-slinger. If it hits a parlay, check the matrix, not the scoreboard.",
  "Practice dummy. Here so the standings don't look lonely. Roast freely; it can't feel pain.",
];

function stableIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return mod > 0 ? h % mod : 0;
}

/** True for demo/NPC roster fillers (not a real signed-up human). */
export function isMockPlayer(player: Player | null | undefined): boolean {
  if (!player) return false;
  if (player.isCreator) return false;
  return player.isMock === true;
}

/** One of 10 snark lines for a mock profile, or null if real. */
export function mockRoastFor(player: Player): string | null {
  if (!isMockPlayer(player)) return null;
  const idx = stableIndex(player.id + ":" + player.name, MOCK_NPC_ROASTS.length);
  return MOCK_NPC_ROASTS[idx] ?? MOCK_NPC_ROASTS[0];
}

/** e.g. "3 / 10" which roast variant they got */
export function mockRoastLabel(player: Player): string | null {
  if (!isMockPlayer(player)) return null;
  const idx = stableIndex(player.id + ":" + player.name, MOCK_NPC_ROASTS.length);
  return `${idx + 1} / ${MOCK_NPC_ROASTS.length}`;
}
