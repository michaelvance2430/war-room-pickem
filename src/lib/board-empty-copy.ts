/**
 * Empty Board — zero scored weeks.
 * War Room never invents history. Mash for more takes.
 */

export type BoardEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

/** Rotate freely — order is the show. */
export const BOARD_EMPTY_TAKES: BoardEmptyTake[] = [
  {
    emoji: "🏈",
    title: "Nothing to reveal... yet.",
    body: "Nobody has won a week because nobody has played one. Check back after the first week is scored. Now quit trying to skip ahead.",
  },
  {
    emoji: "👀",
    title: "Looking for spoilers?",
    body: "Nice try. The Board doesn't wake up until the first week is in the books. Go make your picks.",
  },
  {
    emoji: "📋",
    title: "The Board is still empty.",
    body: "Football hasn't written any stories yet. Come back after Week 1 and we'll start exposing everyone's terrible picks.",
  },
  {
    emoji: "😂",
    title: "Slow down there, detective.",
    body: "There aren't any old picks to snoop through yet. You're going to have to earn your gossip.",
  },
  {
    emoji: "🔒",
    title: "No receipts. No drama.",
    body: "The Board only shows what the season actually produced. Right now that's a blank wall and your imagination.",
  },
  {
    emoji: "🕵️",
    title: "Case file: empty.",
    body: "Zero weeks scored means zero dirt. Come back when someone's already regretting a Best Bet.",
  },
  {
    emoji: "📺",
    title: "This channel isn't on the air.",
    body: "We don't fill dead air with reruns that never happened. First scored week flips the lights on.",
  },
  {
    emoji: "🤫",
    title: "Nothing happened. We're not lying about it.",
    body: "Other apps invent a leaderboard so you feel busy. We invent nothing. Go lock a card.",
  },
  {
    emoji: "⏳",
    title: "Patience is a skill. Try it.",
    body: "The Board reveals history. History requires... history. One scored week and this place gets loud.",
  },
  {
    emoji: "🎯",
    title: "Wrong room, champ.",
    body: "Picks is where you cook. The Board is where we roast the results. Nobody's done cooking yet.",
  },
  {
    emoji: "🧹",
    title: "We wiped the fake stuff on purpose.",
    body: "If you saw old weeks here with no season played, that was a trust crime. Empty is honest.",
  },
  {
    emoji: "📣",
    title: "The wall is blank. Own it.",
    body: "Your league's first story starts the second someone scores a week. Until then: trash talk in the Locker.",
  },
];

export function boardEmptyTakeAt(index: number): BoardEmptyTake {
  const n = BOARD_EMPTY_TAKES.length;
  if (n === 0) {
    return {
      emoji: "📋",
      title: "The Board is still empty.",
      body: "Come back after the first week is scored.",
    };
  }
  const i = ((index % n) + n) % n;
  return BOARD_EMPTY_TAKES[i]!;
}
