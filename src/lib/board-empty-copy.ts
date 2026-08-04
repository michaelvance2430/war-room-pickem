/**
 * Empty Board — nothing public yet.
 * One job: reveal locked cards after kickoff. No tour, no CTAs.
 * Voice: War Room — fun, dry, a little mean. Not corporate.
 *
 * One take per week index so the empty state rotates with the season
 * (Week 0 ≠ Week 1 ≠ Week 7). Loops if the season outruns the list.
 */

export type BoardEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

/** Rotating empty-state takes — pick by week number. */
export const BOARD_EMPTY_TAKES: BoardEmptyTake[] = [
  {
    emoji: "🔒",
    title: "Still classified.",
    body: "Picks stay secret until the first whistle. Come back after kickoff when the whole room gets exposed.",
  },
  {
    emoji: "🤐",
    title: "Nobody's naked yet.",
    body: "The vault is shut. First kickoff is when the blinds open and the excuses start writing themselves.",
  },
  {
    emoji: "🕵️",
    title: "Recon only. No intel.",
    body: "Everyone's cards are still under the table. Whistle blows — then we see who actually believed their own take.",
  },
  {
    emoji: "🕶️",
    title: "Dark room. No receipts.",
    body: "Picks don't exist in public until kickoff. Until then it's pure vibes and pure denial.",
  },
  {
    emoji: "📦",
    title: "Sealed for shipping.",
    body: "The Board doesn't open early. First kickoff is the box cutter — and somebody's getting unboxed.",
  },
  {
    emoji: "🤫",
    title: "Silence is the product.",
    body: "No peeks. No leaks. No “just curious.” Wait for kickoff like everybody else.",
  },
  {
    emoji: "🎭",
    title: "Masks stay on.",
    body: "Half this room is bluffing. You'll find out which half after the first ball is snapped.",
  },
  {
    emoji: "⏳",
    title: "Drama is on a timer.",
    body: "Nothing to roast until kickoff. Patience is hard. Being wrong in public is harder.",
  },
  {
    emoji: "🗂️",
    title: "File not found: courage.",
    body: "Locked cards reveal after first kickoff. Until then, every take is still theoretical.",
  },
  {
    emoji: "🧊",
    title: "On ice.",
    body: "The room stays quiet until the first game starts. Then the board thaws and the alibis melt.",
  },
  {
    emoji: "🚪",
    title: "Door's locked. Good.",
    body: "If you could see cards early, half the fun dies. Wait for the whistle. Earn the humiliation.",
  },
  {
    emoji: "📡",
    title: "Signal blackout.",
    body: "Zero public slips. First kickoff restores transmission — and the group chat loses its mind.",
  },
  {
    emoji: "🦴",
    title: "No bones yet.",
    body: "The Board is the skeleton of the week. Kickoff puts meat on it. Until then, empty plate.",
  },
  {
    emoji: "🧪",
    title: "Lab is closed.",
    body: "You don't get to stress-test your rivals before kickoff. Science can wait. Football cannot.",
  },
  {
    emoji: "🎬",
    title: "Curtain's still down.",
    body: "Opening night is first kickoff. Until then it's intermission and everybody's still in costume.",
  },
  {
    emoji: "🧹",
    title: "Nothing to clean up…yet.",
    body: "The mess starts when picks go public. Come back after kickoff for the crime scene.",
  },
  {
    emoji: "🎰",
    title: "Table's closed.",
    body: "Cards stay face-down until the first kickoff. Then we flip 'em and pretend we always liked our side.",
  },
  {
    emoji: "🧾",
    title: "No paper trail.",
    body: "The Board is where the receipts live. Kickoff stamps the timestamp. Patience, villain.",
  },
];

/**
 * Week-keyed empty take. Week 0 → index 0, Week 1 → index 1, …
 * Negative / non-finite week falls back to 0. List loops for long seasons.
 */
export function boardEmptyTakeAt(week?: number): BoardEmptyTake {
  const n = BOARD_EMPTY_TAKES.length;
  if (n === 0) {
    return {
      emoji: "🔒",
      title: "Still classified.",
      body: "Picks stay secret until the first whistle.",
    };
  }
  const w = Number(week);
  const index = Number.isFinite(w) ? Math.trunc(w) : 0;
  return BOARD_EMPTY_TAKES[((index % n) + n) % n]!;
}
