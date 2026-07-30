import type { Player } from "./types";
import { weekCrownAndShame, type CrownShame } from "./fun-board";
import { weekTitle } from "./dates";
import { getSession } from "./league";
import { hasSeenRules } from "./rules";

const SEEN_PREFIX = "warroom-gazette-seen-v1";

/** Feature flag — set false or delete modal to kill the trial. */
export const GAZETTE_ENABLED = true;

export type GazetteEdition = {
  weekIndex: number;
  weekLabel: string;
  volumeLabel: string;
  crown: { name: string; pts: number; headline: string; deck: string };
  shame: { name: string; pts: number; headline: string; deck: string } | null;
  samePerson: boolean;
  masthead: string;
};

function storageKey(leagueId: string, weekIndex: number): string {
  return `${SEEN_PREFIX}:${leagueId}:w${weekIndex}`;
}

export function hasSeenGazette(leagueId: string, weekIndex: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(storageKey(leagueId, weekIndex)) === "1";
  } catch {
    return true;
  }
}

export function markGazetteSeen(leagueId: string, weekIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(leagueId, weekIndex), "1");
  } catch {
    /* ignore */
  }
}

/**
 * Pick by week index so each scored week gets a distinct line.
 * 18 templates → weeks 0–17 unique; week 18+ wraps once.
 * `offset` keeps crown vs shame from sharing the same “slot vibe.”
 */
function byWeek<T>(list: T[], weekIndex: number, offset = 0): T {
  const n = list.length;
  if (n === 0) throw new Error("empty copy bank");
  const i = (((weekIndex + offset) % n) + n) % n;
  return list[i];
}

type HN = (n: string, pts: number) => string;
type DK = (pts: number) => string;

/** 18 “awesome week” headlines — one per season slot. */
export const CROWN_HEADLINES: HN[] = [
  (n, pts) => `${n.toUpperCase()} DROPS ${pts} — LEAGUE IN SHAMBLES`,
  (n, pts) => `STOP THE PRESSES: ${n.toUpperCase()} COOKS FOR ${pts}`,
  (n, pts) => `${n.toUpperCase()} GOES NUCLEAR (${pts} PTS)`,
  (n, pts) => `WAR ROOM CROWN: ${n.toUpperCase()} AT ${pts}`,
  (n, pts) => `${n.toUpperCase()} MAKES CONFIDENCE LOOK EASY — ${pts}`,
  (n, pts) => `TIP THE CAP: ${n.toUpperCase()} POSTS ${pts}`,
  (n, pts) => `${n.toUpperCase()} BUILDS A MONUMENT OUT OF ${pts} POINTS`,
  (n, pts) => `SURGEON GENERAL: ${n.toUpperCase()}'S ${pts} IS CONTAGIOUS`,
  (n, pts) => `${n.toUpperCase()} TURNED SPREADS INTO ${pts} POINTS OF PAIN`,
  (n, pts) => `CLINIC IN SESSION: ${n.toUpperCase()} GRADUATES WITH ${pts}`,
  (n, pts) => `${n.toUpperCase()} IS UNDEFEATED AT BEING LOUD — ${pts} PTS`,
  (n, pts) => `VEGAS CALLED. IT WANTS ${n.toUpperCase()}'S ${pts} BACK`,
  (n, pts) => `${n.toUpperCase()} MAIN CHARACTER ENERGY: ${pts} ON THE CARD`,
  (n, pts) => `CONFIDENCE WAS A SUGGESTION. ${n.toUpperCase()} SCORED ${pts}`,
  (n, pts) => `${n.toUpperCase()} LEFT THE FIELD WITH ${pts} AND ZERO APOLOGIES`,
  (n, pts) => `PRINT IT: ${n.toUpperCase()} OWNERSHIP WEEK (${pts} PTS)`,
  (n, pts) => `${n.toUpperCase()} JUST MADE BEST BET LOOK LIKE A LAYUP — ${pts}`,
  (n, pts) => `ABSOLUTE UNIT: ${n.toUpperCase()} STACKS ${pts} WHILE YOU WATCH`,
];

/** 18 crown one-liners (deck under the headline). */
export const CROWN_DECKS: DK[] = [
  (pts) => `${pts} on the card. Tip the cap or start a conspiracy group chat.`,
  (pts) => `A ${pts}-point clinic. Everyone else is writing apology essays.`,
  (pts) => `${pts} points. The standings graph just grew a mountain.`,
  (pts) => `Somebody check the smoke alarms. ${pts} will do that.`,
  (pts) => `${pts}. That is not luck. That is a problem for the rest of you.`,
  (pts) => `League group chat is typing… then deleting. ${pts} hits different.`,
  (pts) => `${pts} points and a smile. Villain origin story for everyone else.`,
  (pts) => `They locked the card like they had the answer key. ${pts} says maybe.`,
  (pts) => `${pts} is a public service announcement: fade this person at your peril.`,
  (pts) => `Hot take ticker cannot keep up. ${pts} broke the teleprompter.`,
  (pts) => `Season-long résumé just got a bold new bullet: ${pts} this week.`,
  (pts) => `${pts}. The cut line felt that from three divisions away.`,
  (pts) => `Championship bracket just circled a name in gold. ${pts} is why.`,
  (pts) => `If confidence had a VIP section, they had the wristband. ${pts}.`,
  (pts) => `${pts} points. Prop hit optional. Aura mandatory.`,
  (pts) => `Rest of the league is “trusting the process.” This is the process: ${pts}.`,
  (pts) => `Screenshot this. ${pts} does not happen every Sunday — until it does.`,
  (pts) => `${pts} and the sound of everyone else double-checking their card.`,
];

/** 18 “go play in traffic” shame headlines. */
export const SHAME_HEADLINES: HN[] = [
  (n, pts) => `${n.toUpperCase()} SCRAPES ${pts} — PAPER BAG SEASON`,
  (n, pts) => `WALL OF SHAME HIRES ${n.toUpperCase()} (${pts} PTS)`,
  (n, pts) => `${n.toUpperCase()} FLATLINES AT ${pts}`,
  (n, pts) => `BREAKING: ${n.toUpperCase()} ALLERGIC TO COVERS (${pts})`,
  (n, pts) => `${n.toUpperCase()} POSTS A ${pts} — SEND SNACKS`,
  (n, pts) => `TOILET BOWL SCOUTS ${n.toUpperCase()} AFTER ${pts}`,
  (n, pts) => `${n.toUpperCase()} GO PLAY IN TRAFFIC ENERGY (${pts} PTS)`,
  (n, pts) => `CONFIDENCE FILED A RESTRAINING ORDER ON ${n.toUpperCase()} — ${pts}`,
  (n, pts) => `${n.toUpperCase()} TURNED FIVE GAMES INTO ${pts} POINTS OF FOG`,
  (n, pts) => `EMERGENCY BROADCAST: ${n.toUpperCase()} AT ${pts}`,
  (n, pts) => `${n.toUpperCase()}'S CARD WAS A CRIME SCENE — ${pts} PTS`,
  (n, pts) => `BEST BET? ${n.toUpperCase()} BET ON CHAOS AND LOST (${pts})`,
  (n, pts) => `${n.toUpperCase()} LEFT IT ALL ON THE FIELD. ALL ${pts} OF IT`,
  (n, pts) => `SPREADSHEET SAYS ${n.toUpperCase()} OWES THE LEAGUE AN APOLOGY (${pts})`,
  (n, pts) => `${n.toUpperCase()} DISCOVERED NEW WAYS TO MISS — TOTAL: ${pts}`,
  (n, pts) => `LOWLIGHT REEL STAR: ${n.toUpperCase()} WITH A CRISP ${pts}`,
  (n, pts) => `${n.toUpperCase()} DID NOT BEAT THE ALLEGATIONS (${pts} PTS)`,
  (n, pts) => `GPS TO THE CUT LINE: FOLLOW ${n.toUpperCase()} (${pts})`,
];

/** 18 shame one-liners. */
export const SHAME_DECKS: DK[] = [
  (pts) => `${pts} points. That is not a strategy. That is a cry for help.`,
  (pts) => `A ${pts}-spot on the ledger. Brown paper bag still in stock.`,
  (pts) => `${pts}. The Best Bet is on a fraud watch. Possibly the whole card.`,
  (pts) => `Lowlight reel locked at ${pts}. Locker Room is open for comments.`,
  (pts) => `${pts} points. Go touch grass. Then touch a better dog.`,
  (pts) => `Scientists baffled how ${pts} fits on a five-game card. We are not.`,
  (pts) => `${pts}. Someone check if they saved the card. Someone check if they care.`,
  (pts) => `That ${pts} is doing numbers — the wrong kind of numbers.`,
  (pts) => `${pts} points. Toilet Bowl just sent a friend request.`,
  (pts) => `Confidence 5 on a trap game. Manifested ${pts}. Beautiful.`,
  (pts) => `${pts}. The only cover was the blanket of shame.`,
  (pts) => `League rules do not require dignity. Good, because ${pts} used it all up.`,
  (pts) => `${pts} points and a dream. Mostly the dream is over.`,
  (pts) => `If this card were a road trip, you ran out of gas at ${pts}.`,
  (pts) => `${pts}. Please do not @ the prop. The prop already left the chat.`,
  (pts) => `Historic lowlight. ${pts} will be taught in future War Room orientations.`,
  (pts) => `${pts} points. Fade them next week — or hug them. Both valid.`,
  (pts) => `The standings did not stutter. ${pts} is exactly what it looks like.`,
];

const SOLO_HEADLINES: HN[] = [
  (n, pts) => `${n.toUpperCase()} IS BOTH THE STORY AND THE SUBPLOT (${pts})`,
  (n, pts) => `ONE-PERSON NEWS CYCLE: ${n.toUpperCase()} AT ${pts}`,
  (n, pts) => `${n.toUpperCase()} SWEPT THE AWARDS AND THE APOLOGIES (${pts})`,
  (n, pts) => `RANGE IS A SKILL: ${n.toUpperCase()} OWNS THE WHOLE PAPER (${pts})`,
];

const SOLO_DECKS: DK[] = [
  () => `Lonely at the top (and the bottom). Range is a skill.`,
  (pts) => `${pts} is the whole edition. Everyone else is classified ads.`,
  () => `When the league is small, you are the crown and the bag. Congrats?`,
  (pts) => `Single-name news day. ${pts} did double duty.`,
];

/** Counts for tests / commissioner sanity checks. */
export const GAZETTE_COPY_COUNTS = {
  crownHeadlines: CROWN_HEADLINES.length,
  crownDecks: CROWN_DECKS.length,
  shameHeadlines: SHAME_HEADLINES.length,
  shameDecks: SHAME_DECKS.length,
} as const;

/**
 * Build a one-sheet edition from latest scored week, or null if nothing to show.
 */
export function buildGazetteEdition(players: Player[]): GazetteEdition | null {
  const data = weekCrownAndShame(players);
  if (!data) return null;

  // Need at least 2 scores for a real "paper"
  const withPts = players.filter(
    (p) => p.weeklyPoints && p.weeklyPoints.length > 0
  );
  if (withPts.length < 2) return null;

  const weekIndex = data.weekIndex;
  const weekLabel = weekTitle(weekIndex);

  if (data.samePerson) {
    const n = data.crown.player.name;
    const pts = data.crown.pts;
    return {
      weekIndex,
      weekLabel,
      volumeLabel: `Vol. ${weekIndex} · Final Edition`,
      masthead: "THE WAR ROOM GAZETTE",
      samePerson: true,
      crown: {
        name: n,
        pts,
        headline: byWeek(SOLO_HEADLINES, weekIndex)(n, pts),
        deck: byWeek(SOLO_DECKS, weekIndex)(pts),
      },
      shame: null,
    };
  }

  const cn = data.crown.player.name;
  const cp = data.crown.pts;
  const sn = data.shame.player.name;
  const sp = data.shame.pts;

  // Crown = weekIndex slot; shame offset by 9 so same week never feels like a mirrored template
  return {
    weekIndex,
    weekLabel,
    volumeLabel: `Vol. ${weekIndex} · ${weekLabel}`,
    masthead: "THE WAR ROOM GAZETTE",
    samePerson: false,
    crown: {
      name: cn,
      pts: cp,
      headline: byWeek(CROWN_HEADLINES, weekIndex, 0)(cn, cp),
      deck: byWeek(CROWN_DECKS, weekIndex, 0)(cp),
    },
    shame: {
      name: sn,
      pts: sp,
      headline: byWeek(SHAME_HEADLINES, weekIndex, 0)(sn, sp),
      deck: byWeek(SHAME_DECKS, weekIndex, 0)(sp),
    },
  };
}

/**
 * Should we show the gazette now?
 * Guardrails: feature on, rules already seen, league session, not seen this week.
 */
export function shouldOfferGazette(
  players: Player[]
): { show: true; edition: GazetteEdition; leagueId: string } | { show: false } {
  if (!GAZETTE_ENABLED) return { show: false };
  if (typeof window === "undefined") return { show: false };
  if (!hasSeenRules()) return { show: false }; // rules first, always

  const session = getSession();
  if (!session?.leagueId || !session.playerId) return { show: false };

  const edition = buildGazetteEdition(players);
  if (!edition) return { show: false };

  if (hasSeenGazette(session.leagueId, edition.weekIndex)) {
    return { show: false };
  }

  return { show: true, edition, leagueId: session.leagueId };
}

export type { CrownShame };
