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

/** Stable pick from list using week + name seed. */
function pick<T>(list: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

const CROWN_HEADLINES = [
  (n: string, pts: number) => `${n.toUpperCase()} DROPS ${pts} — LEAGUE IN SHAMBLES`,
  (n: string, pts: number) => `STOP THE PRESSES: ${n.toUpperCase()} COOKS FOR ${pts}`,
  (n: string, pts: number) => `${n.toUpperCase()} GOES NUCLEAR (${pts} PTS)`,
  (n: string, pts: number) => `WAR ROOM CROWN: ${n.toUpperCase()} AT ${pts}`,
  (n: string, pts: number) => `${n.toUpperCase()} MAKES CONFIDENCE LOOK EASY — ${pts}`,
  (n: string, pts: number) => `TIP THE CAP: ${n.toUpperCase()} POSTS ${pts}`,
];

const CROWN_DECKS = [
  (pts: number) =>
    `${pts} on the card. Tip the cap or start a conspiracy group chat.`,
  (pts: number) =>
    `A ${pts}-point clinic. Everyone else is writing apology essays.`,
  (pts: number) =>
    `${pts} points. The standings graph just grew a mountain.`,
  (pts: number) =>
    `Somebody check the smoke alarms. ${pts} will do that.`,
];

const SHAME_HEADLINES = [
  (n: string, pts: number) => `${n.toUpperCase()} SCRAPES ${pts} — PAPER BAG SEASON`,
  (n: string, pts: number) => `WALL OF SHAME HIRES ${n.toUpperCase()} (${pts} PTS)`,
  (n: string, pts: number) => `${n.toUpperCase()} FLATLINES AT ${pts}`,
  (n: string, pts: number) => `BREAKING: ${n.toUpperCase()} ALLERGIC TO COVERS (${pts})`,
  (n: string, pts: number) => `${n.toUpperCase()} POSTS A ${pts} — SEND SNACKS`,
  (n: string, pts: number) => `TOILET BOWL SCOUTS ${n.toUpperCase()} AFTER ${pts}`,
];

const SHAME_DECKS = [
  (pts: number) =>
    `${pts} points. That is not a strategy. That is a cry for help.`,
  (pts: number) =>
    `A ${pts}-spot on the ledger. Brown paper bag still in stock.`,
  (pts: number) =>
    `${pts}. The Best Bet is on a fraud watch. Possibly the whole card.`,
  (pts: number) =>
    `Lowlight reel locked at ${pts}. Locker Room is open for comments.`,
];

const SOLO_HEADLINES = [
  (n: string, pts: number) =>
    `${n.toUpperCase()} IS BOTH THE STORY AND THE SUBPLOT (${pts})`,
  (n: string, pts: number) =>
    `ONE-PERSON NEWS CYCLE: ${n.toUpperCase()} AT ${pts}`,
];

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
  const seed = `${weekIndex}:${data.crown.player.name}:${data.shame.player.name}`;

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
        headline: pick(SOLO_HEADLINES, seed)(n, pts),
        deck: "Lonely at the top (and the bottom). Range is a skill.",
      },
      shame: null,
    };
  }

  const cn = data.crown.player.name;
  const cp = data.crown.pts;
  const sn = data.shame.player.name;
  const sp = data.shame.pts;

  return {
    weekIndex,
    weekLabel,
    volumeLabel: `Vol. ${weekIndex} · ${weekLabel}`,
    masthead: "THE WAR ROOM GAZETTE",
    samePerson: false,
    crown: {
      name: cn,
      pts: cp,
      headline: pick(CROWN_HEADLINES, seed + ":c")(cn, cp),
      deck: pick(CROWN_DECKS, seed + ":cd")(cp),
    },
    shame: {
      name: sn,
      pts: sp,
      headline: pick(SHAME_HEADLINES, seed + ":s")(sn, sp),
      deck: pick(SHAME_DECKS, seed + ":sd")(sp),
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
