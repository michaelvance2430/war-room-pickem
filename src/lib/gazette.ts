import type { Player } from "./types";
import { weekCrownAndShame, type CrownShame } from "./fun-board";
import { weekTitle } from "./dates";
import { getSession } from "./league";
import { hasSeenRules } from "./rules";

const SEEN_PREFIX = "warroom-gazette-seen-v1";

/** Feature flag — set false or delete modal to kill the trial. */
export const GAZETTE_ENABLED = true;

export type GazetteStory = {
  /** Display names (1 = clear winner/loser; 2+ = tie) */
  names: string[];
  pts: number;
  headline: string;
  deck: string;
  /** clear | tie — for UI label */
  kind: "clear" | "tie";
};

export type GazetteEdition = {
  weekIndex: number;
  weekLabel: string;
  volumeLabel: string;
  crown: GazetteStory;
  shame: GazetteStory | null;
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

/** Format "A & B" or "A, B & C" or "A, B, C +2 more" */
export function formatNameList(names: string[], maxShow = 3): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "THE FIELD";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  if (clean.length <= maxShow) {
    const head = clean.slice(0, -1).join(", ");
    return `${head} & ${clean[clean.length - 1]}`;
  }
  const shown = clean.slice(0, maxShow);
  const rest = clean.length - maxShow;
  return `${shown.join(", ")} +${rest} more`;
}

function lastWeekPts(p: Player): number | null {
  if (!p.weeklyPoints?.length) return null;
  return p.weeklyPoints[p.weeklyPoints.length - 1] ?? null;
}

/** Everyone tied for high score this week (2+). */
function tiedForCrown(players: Player[]): { names: string[]; pts: number } | null {
  const rows = players
    .map((p) => ({ name: p.name, pts: lastWeekPts(p) }))
    .filter((x): x is { name: string; pts: number } => x.pts != null);
  if (rows.length < 2) return null;
  const max = Math.max(...rows.map((r) => r.pts));
  const tied = rows
    .filter((r) => r.pts === max)
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b));
  if (tied.length < 2) return null;
  return { names: tied, pts: max };
}

/** Everyone tied for low score this week (2+), and not the whole league on one number. */
function tiedForShame(
  players: Player[],
  crownPts: number
): { names: string[]; pts: number } | null {
  const rows = players
    .map((p) => ({ name: p.name, pts: lastWeekPts(p) }))
    .filter((x): x is { name: string; pts: number } => x.pts != null);
  if (rows.length < 2) return null;
  const min = Math.min(...rows.map((r) => r.pts));
  // If min === max, entire field is flat — handled as solo/all-tie
  if (min === crownPts) return null;
  const tied = rows
    .filter((r) => r.pts === min)
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b));
  if (tied.length < 2) return null;
  return { names: tied, pts: min };
}

type TieHN = (label: string, pts: number, count: number) => string;
type TieDK = (pts: number, count: number) => string;

/** Deadlock at the top — WHO WILL PULL AHEAD energy (18, week-keyed). */
export const TIE_CROWN_HEADLINES: TieHN[] = [
  (label, pts) => `DEADLOCK AT ${pts}: ${label.toUpperCase()} — WHO WILL PULL AHEAD?`,
  (label, pts) => `TOP OF THE TABLE TIED AT ${pts} — ${label.toUpperCase()} SHARE THE CROWN`,
  (label, pts) => `PHOTO FINISH: ${label.toUpperCase()} KNOTTED AT ${pts}`,
  (label, pts) => `NO SOLO KING: ${label.toUpperCase()} ALL AT ${pts}`,
  (label, pts) => `WHO BLINKS FIRST? ${label.toUpperCase()} LOCKED AT ${pts}`,
  (label, pts) => `SHARED THRONE: ${label.toUpperCase()} CAN'T SEPARATE (${pts})`,
  (label, pts) => `${pts}-POINT LOGJAM — ${label.toUpperCase()} STILL UNDECIDED`,
  (label, pts) => `TIEBREAKER WANTED: ${label.toUpperCase()} ALL POSTED ${pts}`,
  (label, pts) => `THE RACE IS ON: ${label.toUpperCase()} DEAD EVEN AT ${pts}`,
  (label, pts) => `CROWNS FOR EVERYONE (FOR NOW): ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `STANDOFF AT THE SUMMIT — ${label.toUpperCase()} (${pts} PTS)`,
  (label, pts) => `PULL AHEAD OR FALL: ${label.toUpperCase()} TIED AT ${pts}`,
  (label, pts) => `LEVEL AT THE TOP: ${label.toUpperCase()} BOTH/ALL AT ${pts}`,
  (label, pts) => `NEXT WEEK DECIDES — ${label.toUpperCase()} CAN'T BREAK ${pts}`,
  (label, pts) => `CO-MVPS THIS CARD: ${label.toUpperCase()} WITH ${pts}`,
  (label, pts) => `GRIDLOCK: ${label.toUpperCase()} MIRROR EACH OTHER AT ${pts}`,
  (label, pts) => `WHO PULLS AHEAD? ${label.toUpperCase()} WON'T SEPARATE (${pts})`,
  (label, pts) => `TIE GAME IN THE STANDINGS RACE: ${label.toUpperCase()} AT ${pts}`,
];

export const TIE_CROWN_DECKS: TieDK[] = [
  (pts, count) =>
    `${count} players at ${pts}. Same card, same score — next week is the breakup album.`,
  (pts, count) =>
    `Deadlocked at ${pts}. Someone has to flinch. The cut line is watching.`,
  (pts) =>
    `${pts} points each. Co-champions of the week until the next slate splits them.`,
  (pts, count) =>
    `${count}-way tie at the top (${pts}). Group chat just became a thriller.`,
  (pts) =>
    `Nobody owns the crown alone at ${pts}. Fade one of them. Or don't. Chaos either way.`,
  (pts, count) =>
    `${count} names, one number: ${pts}. Who pulls ahead is the only plot left.`,
  (pts) =>
    `Photograph finishes don't hand out rings. ${pts} even — see you next kickoff.`,
  (pts, count) =>
    `Shared glory at ${pts}. ${count} egos. One standings page. Delicious.`,
  (pts) =>
    `They can't separate at ${pts}. Confidence pools are about to get personal.`,
  (pts, count) =>
    `Top shelf is crowded (${count} at ${pts}). Next week's dogs will pick a villain.`,
  (pts) =>
    `Even at ${pts}. The War Room does not do participation trophies for long.`,
  (pts, count) =>
    `${count}-player logjam. ${pts} on the nose. Someone's Best Bet is about to snitch.`,
  (pts) =>
    `Tied for first at ${pts}. Rematch card loading. Bring popcorn.`,
  (pts, count) =>
    `No sole survivor at the top — ${count} at ${pts}. Pull ahead or get pulled under.`,
  (pts) =>
    `${pts} apiece. The ticker can't decide who to crown. Neither can we.`,
  (pts, count) =>
    `A ${count}-horse photo at ${pts}. Place your lean. League lore starts here.`,
  (pts) =>
    `Dead heat at ${pts}. Next slate is the tiebreaker nobody voted for.`,
  (pts, count) =>
    `${count} players, zero separation, ${pts} points. Who will pull ahead?`,
];

/** Multi-way basement — optional shame ties. */
export const TIE_SHAME_HEADLINES: TieHN[] = [
  (label, pts) => `BASEMENT TRAFFIC JAM: ${label.toUpperCase()} ALL AT ${pts}`,
  (label, pts) => `SHARED PAPER BAG: ${label.toUpperCase()} TIED AT ${pts}`,
  (label, pts) => `NOBODY WANTS THIS TROPHY — ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `MULTI-WAY MELTDOWN: ${label.toUpperCase()} (${pts} PTS)`,
  (label, pts) => `WALL OF SHAME IS A GROUP PROJECT — ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `TIED FOR LAST AT ${pts}: ${label.toUpperCase()}`,
  (label, pts) => `TOILET SCOUTS OPEN A GROUP CHAT: ${label.toUpperCase()} (${pts})`,
  (label, pts) => `EQUAL OPPORTUNITY DISASTER — ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `${label.toUpperCase()} CAN'T EVEN LOSE ALONE (${pts})`,
  (label, pts) => `BOTTOM RUNG HOLDS ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `TIE FOR THE BAG: ${label.toUpperCase()} WITH ${pts}`,
  (label, pts) => `COLLECTIVE SIGH: ${label.toUpperCase()} FLAT AT ${pts}`,
  (label, pts) => `LAST PLACE IS CROWDED — ${label.toUpperCase()} (${pts})`,
  (label, pts) => `SHARED L FOR ${label.toUpperCase()} AT ${pts}`,
  (label, pts) => `WHO ESCAPES FIRST? ${label.toUpperCase()} STUCK AT ${pts}`,
  (label, pts) => `BASEMENT DEADLOCK: ${label.toUpperCase()} ALL SCORED ${pts}`,
  (label, pts) => `GROUP RATE ON SHAME: ${label.toUpperCase()} (${pts} PTS)`,
  (label, pts) => `NO SOLO GOAT — ${label.toUpperCase()} TIED AT ${pts} FOR LAST`,
];

export const TIE_SHAME_DECKS: TieDK[] = [
  (pts, count) =>
    `${count} players at ${pts}. Misery loves company. The cut line loves data.`,
  (pts) =>
    `Tied for the floor at ${pts}. Someone has to climb. Preferably soon.`,
  (pts, count) =>
    `${count}-way last place at ${pts}. Brown paper bags sold in bulk this week.`,
  (pts) =>
    `${pts} points each. The Toilet Bowl is taking applications as a group.`,
  (pts, count) =>
    `${count} names, one sad number (${pts}). Escape velocity required.`,
  (pts) =>
    `Nobody lost alone at ${pts}. Character development is mandatory next card.`,
  (pts, count) =>
    `Shared basement at ${pts}. ${count} egos. One way out: better dogs.`,
  (pts) =>
    `${pts} on the card, times a few. The lowlight reel needs a director's cut.`,
  (pts, count) =>
    `${count} players discovered ${pts} together. Bonding! Horrible bonding.`,
  (pts) =>
    `Deadlocked at the bottom (${pts}). Next week is the jailbreak episode.`,
  (pts, count) =>
    `Group rate shame at ${pts}. All ${count} should re-read the rules. Or the lines.`,
  (pts) =>
    `${pts} apiece for last. Fade the field or hug the field — both valid.`,
  (pts, count) =>
    `${count}-person pile-up at ${pts}. Traffic in the basement is not a metaphor.`,
  (pts) =>
    `Tied for worst at ${pts}. Standings don't do soft landings.`,
  (pts, count) =>
    `${count} at ${pts}. The only race left is who stops the bleeding first.`,
  (pts) =>
    `Equal opportunity L at ${pts}. Rematch card can't come soon enough.`,
  (pts, count) =>
    `Basement photo finish: ${count} at ${pts}. Dignity optional.`,
  (pts) =>
    `${pts} points, shared last place. The Gazette refuses to pick just one victim.`,
];

/** Counts for tests / commissioner sanity checks. */
export const GAZETTE_COPY_COUNTS = {
  crownHeadlines: CROWN_HEADLINES.length,
  crownDecks: CROWN_DECKS.length,
  shameHeadlines: SHAME_HEADLINES.length,
  shameDecks: SHAME_DECKS.length,
  tieCrownHeadlines: TIE_CROWN_HEADLINES.length,
  tieCrownDecks: TIE_CROWN_DECKS.length,
  tieShameHeadlines: TIE_SHAME_HEADLINES.length,
  tieShameDecks: TIE_SHAME_DECKS.length,
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

  const topTie = tiedForCrown(players);
  const allSameScore =
    topTie &&
    topTie.names.length === withPts.length;

  // Everyone put up the same number — one weird edition
  if (allSameScore && topTie) {
    const label = formatNameList(topTie.names);
    return {
      weekIndex,
      weekLabel,
      volumeLabel: `Vol. ${weekIndex} · Final Edition`,
      masthead: "THE WAR ROOM GAZETTE",
      samePerson: true,
      crown: {
        names: topTie.names,
        pts: topTie.pts,
        kind: "tie",
        headline: byWeek(TIE_CROWN_HEADLINES, weekIndex)(
          label,
          topTie.pts,
          topTie.names.length
        ),
        deck: `The whole league at ${topTie.pts}. Not a crown. Not a bag. A mirror. Who will pull ahead next week?`,
      },
      shame: null,
    };
  }

  if (data.samePerson && !topTie) {
    const n = data.crown.player.name;
    const pts = data.crown.pts;
    return {
      weekIndex,
      weekLabel,
      volumeLabel: `Vol. ${weekIndex} · Final Edition`,
      masthead: "THE WAR ROOM GAZETTE",
      samePerson: true,
      crown: {
        names: [n],
        pts,
        kind: "clear",
        headline: byWeek(SOLO_HEADLINES, weekIndex)(n, pts),
        deck: byWeek(SOLO_DECKS, weekIndex)(pts),
      },
      shame: null,
    };
  }

  // --- Crown story (clear winner or top tie) ---
  let crown: GazetteStory;
  if (topTie) {
    const label = formatNameList(topTie.names);
    crown = {
      names: topTie.names,
      pts: topTie.pts,
      kind: "tie",
      headline: byWeek(TIE_CROWN_HEADLINES, weekIndex)(
        label,
        topTie.pts,
        topTie.names.length
      ),
      deck: byWeek(TIE_CROWN_DECKS, weekIndex)(topTie.pts, topTie.names.length),
    };
  } else {
    const cn = data.crown.player.name;
    const cp = data.crown.pts;
    crown = {
      names: [cn],
      pts: cp,
      kind: "clear",
      headline: byWeek(CROWN_HEADLINES, weekIndex, 0)(cn, cp),
      deck: byWeek(CROWN_DECKS, weekIndex, 0)(cp),
    };
  }

  // --- Shame story ---
  const bottomTie = tiedForShame(players, crown.pts);
  let shame: GazetteStory | null = null;

  if (bottomTie) {
    const label = formatNameList(bottomTie.names);
    shame = {
      names: bottomTie.names,
      pts: bottomTie.pts,
      kind: "tie",
      headline: byWeek(TIE_SHAME_HEADLINES, weekIndex)(
        label,
        bottomTie.pts,
        bottomTie.names.length
      ),
      deck: byWeek(TIE_SHAME_DECKS, weekIndex)(
        bottomTie.pts,
        bottomTie.names.length
      ),
    };
  } else if (!data.samePerson) {
    const sn = data.shame.player.name;
    const sp = data.shame.pts;
    // Don't dunk the same person as sole crown if weird edge
    if (!(crown.kind === "clear" && crown.names[0] === sn && crown.pts === sp)) {
      shame = {
        names: [sn],
        pts: sp,
        kind: "clear",
        headline: byWeek(SHAME_HEADLINES, weekIndex, 0)(sn, sp),
        deck: byWeek(SHAME_DECKS, weekIndex, 0)(sp),
      };
    }
  }

  return {
    weekIndex,
    weekLabel,
    volumeLabel: `Vol. ${weekIndex} · ${weekLabel}`,
    masthead: "THE WAR ROOM GAZETTE",
    samePerson: false,
    crown,
    shame,
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
