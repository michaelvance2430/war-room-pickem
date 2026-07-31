import type { Player } from "./types";
import {
  rankPlayersWithSwings,
  weekCrownAndShame,
} from "./fun-board";
import { weekTitle } from "./dates";
import { getSession, getLeague } from "./league";
import { hasSeenRules } from "./rules";
import { createClient } from "@/lib/supabase/client";
import { defaultSeasonYear } from "./trophies";

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
  /** Best week card (single name — weekly multi-ties pick one, no “deadlock” copy). */
  crown: GazetteStory;
  /** Worst week card (single name). */
  shame: GazetteStory | null;
  /**
   * Only when 2+ players are tied for #1 overall standings (season totalPoints).
   * Not used for same weekly score.
   */
  standingsDeadlock: GazetteStory | null;
  /**
   * Players who never locked a full card (0 by ghosting).
   * Milk-carton missing-person energy.
   */
  noLock: GazetteStory | null;
  /**
   * Week 0 (or first freeze): humans who never locked Crystal Ball.
   * Mild shit-talk — forgot the national champ pick.
   */
  crystalBallMiss: GazetteStory | null;
  /** Biggest standings mover this week (climb or freefall). */
  swing: GazetteStory | null;
  samePerson: boolean;
  masthead: string;
  /** Under the masthead — one-line sizzle */
  tagline: string;
  /** “Printed” date line for newspaper feel */
  printedLine: string;
  /** Fake weather / league forecast box */
  weather: { kicker: string; body: string };
  /** Classified ads — short roasts */
  classifieds: string[];
  /** Pull quote for layout drama */
  pullQuote: { text: string; by: string };
  /**
   * Funny sub-stories — sarcastic “fake news” (often non-football).
   * One may name-drop the crown/shame; others are pure absurdity.
   */
  sideStories: GazetteSideStory[];
};

/** Sidebar / “also in this paper” bit */
export type GazetteSideStory = {
  kicker: string;
  headline: string;
  body: string;
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

/**
 * Players tied for #1 in overall season standings (totalPoints).
 * Weekly same-score ties intentionally ignored — those happen constantly.
 */
export function tiedForOverallFirst(
  players: Player[]
): { names: string[]; pts: number } | null {
  if (players.length < 2) return null;
  const max = Math.max(...players.map((p) => p.totalPoints || 0));
  // Need some season scoring on the board
  if (max <= 0) return null;
  const tied = players
    .filter((p) => (p.totalPoints || 0) === max)
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));
  if (tied.length < 2) return null;
  return { names: tied, pts: max };
}

type TieHN = (label: string, pts: number, count: number) => string;
type TieDK = (pts: number, count: number) => string;

/**
 * Season standings #1 deadlock — WHO WILL PULL AHEAD (18, week-keyed).
 * Copy talks overall points / table, not this week’s card alone.
 */
export const STANDINGS_TIE_HEADLINES: TieHN[] = [
  (label, pts) =>
    `STANDINGS DEADLOCK AT ${pts}: ${label.toUpperCase()} — WHO WILL PULL AHEAD?`,
  (label, pts) =>
    `NO SOLO #1: ${label.toUpperCase()} TIED ATOP THE TABLE (${pts})`,
  (label, pts) =>
    `PHOTO FINISH FOR FIRST: ${label.toUpperCase()} AT ${pts} OVERALL`,
  (label, pts) =>
    `SHARED THRONE: ${label.toUpperCase()} CAN'T SEPARATE (${pts} SEASON PTS)`,
  (label, pts) =>
    `WHO BLINKS FIRST? ${label.toUpperCase()} LOCKED AT ${pts} IN THE STANDINGS`,
  (label, pts) =>
    `TOP OF THE BOARD TIED AT ${pts} — ${label.toUpperCase()}`,
  (label, pts) =>
    `${pts}-POINT LOGJAM FOR #1 — ${label.toUpperCase()} STILL EVEN`,
  (label, pts) =>
    `TIEBREAKER WANTED: ${label.toUpperCase()} BOTH/ALL SIT AT ${pts}`,
  (label, pts) =>
    `THE RACE FOR FIRST IS ON: ${label.toUpperCase()} DEAD EVEN (${pts})`,
  (label, pts) =>
    `CO-LEADERS OF THE WAR ROOM: ${label.toUpperCase()} AT ${pts}`,
  (label, pts) =>
    `STANDOFF AT #1 — ${label.toUpperCase()} (${pts} OVERALL)`,
  (label, pts) =>
    `PULL AHEAD OR FALL: ${label.toUpperCase()} TIED FOR FIRST AT ${pts}`,
  (label, pts) =>
    `LEVEL AT THE SUMMIT: ${label.toUpperCase()} ALL AT ${pts}`,
  (label, pts) =>
    `NEXT WEEK DECIDES #1 — ${label.toUpperCase()} CAN'T BREAK ${pts}`,
  (label, pts) =>
    `GRIDLOCK ATOP THE STANDINGS: ${label.toUpperCase()} (${pts})`,
  (label, pts) =>
    `WHO PULLS AHEAD? ${label.toUpperCase()} WON'T SEPARATE (${pts} PTS)`,
  (label, pts) =>
    `TIE GAME FOR THE #1 SPOT: ${label.toUpperCase()} AT ${pts}`,
  (label, pts) =>
    `SEASON RACE FROZEN AT ${pts} — ${label.toUpperCase()} SHARE FIRST`,
];

export const STANDINGS_TIE_DECKS: TieDK[] = [
  (pts, count) =>
    `${count} players tied for first overall at ${pts} season points. Someone has to flinch.`,
  (pts, count) =>
    `Deadlocked atop the standings at ${pts}. The cut line is watching. So is the group chat.`,
  (pts) =>
    `${pts} overall, apiece. No solo king of the table — next card is the breakup episode.`,
  (pts, count) =>
    `${count}-way tie for #1 (${pts} pts). Group chat just became a thriller.`,
  (pts) =>
    `Nobody owns first alone at ${pts} season points. Fade one. Or don't. Chaos either way.`,
  (pts, count) =>
    `${count} names, one number on the board: ${pts}. Who pulls ahead is the only plot left.`,
  (pts) =>
    `Photo finishes don't hand out rings. ${pts} even in the standings — see you next kickoff.`,
  (pts, count) =>
    `Shared #1 at ${pts}. ${count} egos. One standings page. Delicious.`,
  (pts) =>
    `They can't separate at ${pts} overall. Confidence pools are about to get personal.`,
  (pts, count) =>
    `Top of the table is crowded (${count} at ${pts}). Next week's dogs will pick a villain.`,
  (pts) =>
    `Even at ${pts} season points. The War Room does not do co-champions forever.`,
  (pts, count) =>
    `${count}-player logjam for first. ${pts} on the nose. Someone's Best Bet is about to snitch.`,
  (pts) =>
    `Tied for first overall at ${pts}. Rematch card loading. Bring popcorn.`,
  (pts, count) =>
    `No sole #1 — ${count} at ${pts} season points. Pull ahead or get pulled under.`,
  (pts) =>
    `${pts} apiece atop the board. The ticker can't decide who to crown.`,
  (pts, count) =>
    `A ${count}-horse race for first at ${pts} overall. Place your lean.`,
  (pts) =>
    `Dead heat for the #1 spot at ${pts}. Next slate is the tiebreaker nobody voted for.`,
  (pts, count) =>
    `${count} players, zero separation, ${pts} season points. Who will pull ahead?`,
];

/** Forgot to lock — milk carton / missing-person energy (rotates by week). */
export const NO_LOCK_HEADLINES: ((names: string) => string)[] = [
  (n) => `MISSING: HAVE YOU SEEN ${n.toUpperCase()}? CHECK THE MILK CARTON`,
  (n) => `ALERT: ${n.toUpperCase()} NEVER LOCKED — SIDE OF A GALLON ENERGY`,
  (n) => `WAR ROOM AMBER ALERT: ${n.toUpperCase()} GHOSTED THE CARD`,
  (n) => `SOMEONE CHECK THE DAIRY AISLE FOR ${n.toUpperCase()}`,
  (n) => `${n.toUpperCase()} WENT 0 THE COWARDLY WAY — NO LOCK, NO DIGNITY`,
  (n) => `BREAKING: ${n.toUpperCase()} LEFT THE PICKS ON READ`,
  (n) => `HAVE YOU SEEN THIS PLAYER? ${n.toUpperCase()} LAST SPOTTED PRE-KICKOFF`,
  (n) => `MILK CARTON MONDAY: ${n.toUpperCase()} DID NOT SAVE`,
  (n) => `${n.toUpperCase()} — IF FOUND, PLEASE RETURN TO MY PICKS`,
  (n) => `KICKOFF CAME. ${n.toUpperCase()} DID NOT. ZERO POINTS. ZERO EXCUSES.`,
  (n) => `THE CARD WAS OPEN. ${n.toUpperCase()} WAS… ELSEWHERE`,
  (n) => `MISSING PERSON REPORT: ${n.toUpperCase()} (SUSPECTED: NETFLIX)`,
  (n) => `${n.toUpperCase()} TREATED “LOCK BEFORE KICKOFF” LIKE A SUGGESTION`,
  (n) => `LOST & FOUND: ONE (1) BRAIN CELL, LAST HELD BY ${n.toUpperCase()}`,
  (n) => `HEY — SOMEONE CHECK THE MILK CARTON FOR ${n.toUpperCase()}!`,
  (n) => `${n.toUpperCase()} DISCOVERED A NEW STRATEGY: NOT PLAYING`,
  (n) => `NO LOCK, NO POINTS, NO MERCY: ${n.toUpperCase()} ON THE CARTON`,
  (n) => `THE SPREAD DIDN'T BEAT ${n.toUpperCase()}. THE CLOCK DID.`,
];

export const NO_LOCK_DECKS: ((count: number) => string)[] = [
  (c) =>
    c === 1
      ? "Forgot to lock. Scored a crisp 0. The milk is cold and so is the reception."
      : `${c} players ghosted the card. Group milk carton. No makeups. Fair is fair.`,
  (c) =>
    c === 1
      ? "Kickoff hit. Card still draft. Zero points. Dignity also zero."
      : `${c} no-shows on lock. The War Room does not do participation trophies.`,
  () =>
    "If you don't lock before kickoff, you score nothing. This is not a drill. This is a roast.",
  (c) =>
    c === 1
      ? "Last seen: scrolling. Not seen: Save Picks. Case closed at 0."
      : `${c} names on the carton. Check My Picks next week like it matters — because it does.`,
  () =>
    "No lock, no points. The rules are mean. The group chat will be meaner.",
  (c) =>
    c === 1
      ? "They'll say the dog ate the homework. The dog locked before them."
      : `A ${c}-person missing-persons lineup. Side of 2%. Extra sarcasm.`,
  () =>
    "Pro tip for next week: the big green button that says Save. Revolutionary.",
  (c) =>
    c === 1
      ? "Amber Alert for a locked card. Spoiler: it never arrived."
      : `${c} players chose chaos by choosing nothing. The ledger recorded it as 0.`,
];

/** Forgot Crystal Ball before Week 0 freeze — soft roast, not cruelty. */
export const CRYSTAL_MISS_HEADLINES: ((names: string) => string)[] = [
  (n) => `CRYSTAL BALL GHOSTS: ${n.toUpperCase()} NEVER PICKED A CHAMP`,
  (n) => `ORACLE NO-SHOW: ${n.toUpperCase()} LEFT THE BALL ON THE SHELF`,
  (n) => `WEEK 0 CLOSED — ${n.toUpperCase()} STILL HAD AN EMPTY CRYSTAL BALL`,
  (n) => `PROPHECY MISSED: ${n.toUpperCase()} FORGOT THE NATIONAL CHAMP PICK`,
  (n) => `${n.toUpperCase()} TREATED CRYSTAL BALL LIKE OPTIONAL HOMEWORK`,
  (n) => `BREAKING: ${n.toUpperCase()} ARRIVED TO WEEK 1 WITH ZERO CHAMPION`,
];

export const CRYSTAL_MISS_DECKS: ((count: number) => string)[] = [
  (c) =>
    c === 1
      ? "Zero points on the line. Infinite future \"I told you so\" — if you'd locked one. You didn't. Adulting: incomplete."
      : `${c} players never locked Crystal Ball. The orb stays blank. Smugness season is cancelled for them.`,
  (c) =>
    c === 1
      ? "They'll swear they meant to. Week 0 locked. The pick did not. Take your meds and lock next season's ball on time."
      : `${c} blank crystal balls. Not window-licker energy — just chronically offline until it was too late.`,
  () =>
    "Crystal Ball locks with Week 0. No pick = no Witch/Wizard shot. Dignity is also optional, apparently.",
  (c) =>
    c === 1
      ? "Forgot the free preseason flex. The rest of the room will never let it go. Quietly. Then loudly."
      : `A ${c}-person reminder that \"do it early\" was not a suggestion.`,
];

/** Score fallback: 0 on the week while someone else scored > 0. */
export function inferNoLockNamesFromScores(
  players: Player[],
  weekIndex: number
): string[] {
  const rows = players
    .filter((p) => !p.isMock)
    .map((p) => ({
      name: p.name,
      pts: p.weeklyPoints?.[weekIndex],
    }))
    .filter((r): r is { name: string; pts: number } => typeof r.pts === "number");

  if (rows.length < 2) return [];
  const max = Math.max(...rows.map((r) => r.pts));
  if (max <= 0) return [];
  return rows
    .filter((r) => r.pts === 0)
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Counts for tests / commissioner sanity checks. */
export const GAZETTE_COPY_COUNTS = {
  crownHeadlines: CROWN_HEADLINES.length,
  crownDecks: CROWN_DECKS.length,
  shameHeadlines: SHAME_HEADLINES.length,
  shameDecks: SHAME_DECKS.length,
  standingsTieHeadlines: STANDINGS_TIE_HEADLINES.length,
  standingsTieDecks: STANDINGS_TIE_DECKS.length,
  noLockHeadlines: NO_LOCK_HEADLINES.length,
  noLockDecks: NO_LOCK_DECKS.length,
} as const;

/**
 * Build a one-sheet edition from latest scored week, or null if nothing to show.
 *
 * Headlines:
 * 1) Killer (or rough) week — single name for high/low on the card
 * 2) Optional: overall standings #1 multi-way tie (season totalPoints)
 * 3) Optional: forgot-to-lock milk carton story
 * Weekly multi-way same scores do NOT get special deadlock copy.
 */
export async function buildGazetteEdition(
  players: Player[]
): Promise<GazetteEdition | null> {
  const data = weekCrownAndShame(players);
  if (!data) return null;

  const withPts = players.filter(
    (p) => p.weeklyPoints && p.weeklyPoints.length > 0
  );
  if (withPts.length < 2) return null;

  const weekIndex = data.weekIndex;
  const weekLabel = weekTitle(weekIndex);

  const cn = data.crown.player.name;
  const cp = data.crown.pts;
  const sn = data.shame.player.name;
  const sp = data.shame.pts;

  // Weekly crown — always one name (if multi-way weekly high, weekCrownAndShame already picked one)
  const crown: GazetteStory = {
    names: [cn],
    pts: cp,
    kind: "clear",
    headline: data.samePerson
      ? byWeek(SOLO_HEADLINES, weekIndex)(cn, cp)
      : byWeek(CROWN_HEADLINES, weekIndex, 0)(cn, cp),
    deck: data.samePerson
      ? byWeek(SOLO_DECKS, weekIndex)(cp)
      : byWeek(CROWN_DECKS, weekIndex, 0)(cp),
  };

  let shame: GazetteStory | null = null;
  if (!data.samePerson) {
    shame = {
      names: [sn],
      pts: sp,
      kind: "clear",
      headline: byWeek(SHAME_HEADLINES, weekIndex, 0)(sn, sp),
      deck: byWeek(SHAME_DECKS, weekIndex, 0)(sp),
    };
  }

  // Season table only — not this week's multi-way high score
  const overallTie = tiedForOverallFirst(players);
  let standingsDeadlock: GazetteStory | null = null;
  if (overallTie) {
    const label = formatNameList(overallTie.names);
    standingsDeadlock = {
      names: overallTie.names,
      pts: overallTie.pts,
      kind: "tie",
      headline: byWeek(STANDINGS_TIE_HEADLINES, weekIndex)(
        label,
        overallTie.pts,
        overallTie.names.length
      ),
      deck: byWeek(STANDINGS_TIE_DECKS, weekIndex)(
        overallTie.pts,
        overallTie.names.length
      ),
    };
  }

  // Forgot to lock → milk carton story
  let noLock: GazetteStory | null = null;
  let ghostNames: string[] = [];
  try {
    const { loadWeekNoLockNames } = await import("./cloud");
    ghostNames = await loadWeekNoLockNames(weekIndex);
  } catch {
    ghostNames = [];
  }
  if (!ghostNames.length) {
    ghostNames = inferNoLockNamesFromScores(players, weekIndex);
  }
  if (ghostNames.length) {
    const label = formatNameList(ghostNames);
    noLock = {
      names: ghostNames,
      pts: 0,
      kind: ghostNames.length > 1 ? "tie" : "clear",
      headline: byWeek(NO_LOCK_HEADLINES, weekIndex, 3)(label),
      deck: byWeek(NO_LOCK_DECKS, weekIndex, 3)(ghostNames.length),
    };
    // If the "shame" player is only on the carton for ghosting, prefer milk carton copy
    // and still keep shame for legit low scores who did lock.
    if (
      shame &&
      ghostNames.some(
        (g) => g.toLowerCase() === (shame!.names[0] || "").toLowerCase()
      ) &&
      shame.pts === 0
    ) {
      shame = null;
    }
  }

  // Week 0 scored / frozen → roast who never locked Crystal Ball
  let crystalBallMiss: GazetteStory | null = null;
  if (weekIndex === 0) {
    try {
      const { loadCrystalBallNoPickNames } = await import("./crystal-ball");
      const missNames = await loadCrystalBallNoPickNames();
      if (missNames.length) {
        const label = formatNameList(missNames);
        crystalBallMiss = {
          names: missNames,
          pts: 0,
          kind: missNames.length > 1 ? "tie" : "clear",
          headline: byWeek(CRYSTAL_MISS_HEADLINES, weekIndex, 1)(label),
          deck: byWeek(CRYSTAL_MISS_DECKS, weekIndex, 1)(missNames.length),
        };
      }
    } catch {
      crystalBallMiss = null;
    }
  }

  // Biggest climber / freefall for the paper's "Movers" box
  let swing: GazetteStory | null = null;
  try {
    const ranked = rankPlayersWithSwings(players).filter((p) => !p.isMock);
    const movers = ranked.filter(
      (p) =>
        p.swing.tone === "hero" ||
        p.swing.tone === "up" ||
        p.swing.tone === "shame" ||
        p.swing.tone === "down"
    );
    if (movers.length) {
      movers.sort(
        (a, b) => Math.abs(b.swing.delta) - Math.abs(a.swing.delta)
      );
      const star = movers[0];
      const up = star.swing.delta > 0;
      swing = {
        names: [star.name],
        pts: star.lastWeekPts ?? star.totalPoints,
        kind: "clear",
        headline: up
          ? byWeek(SWING_UP_HEADLINES, weekIndex)(
              star.name,
              star.swing.delta,
              star.swing.text
            )
          : byWeek(SWING_DOWN_HEADLINES, weekIndex)(
              star.name,
              Math.abs(star.swing.delta),
              star.swing.text
            ),
        deck: up
          ? byWeek(SWING_UP_DECKS, weekIndex)(
              star.swing.delta,
              star.rank,
              star.swing.text
            )
          : byWeek(SWING_DOWN_DECKS, weekIndex)(
              Math.abs(star.swing.delta),
              star.rank,
              star.swing.text
            ),
      };
    }
  } catch {
    swing = null;
  }

  const leagueName = getLeague()?.name || "War Room";
  const year = defaultSeasonYear();
  const tagline = byWeek(EDITION_TAGLINES, weekIndex);
  const weather = byWeek(WEATHER_BOXES, weekIndex, 2);
  const classifieds = [
    byWeek(CLASSIFIEDS_A, weekIndex, 0),
    byWeek(CLASSIFIEDS_B, weekIndex, 1),
    byWeek(CLASSIFIEDS_C, weekIndex, 2),
  ].map((fn) =>
    fn({
      crown: cn,
      shame: sn,
      league: leagueName,
      pts: cp,
    })
  );
  const pullQuote = byWeek(PULL_QUOTES, weekIndex, 4)({
    crown: cn,
    shame: sn,
    pts: cp,
  });

  // Sub-stories: one name-tied roast + one pure non-football absurdity
  const sideCtx: SideStoryCtx = {
    crown: cn,
    shame: sn,
    league: leagueName,
    pts: cp,
    weekLabel,
  };
  const sideStories: GazetteSideStory[] = [
    byWeek(SIDE_STORIES_NAMED, weekIndex, 0)(sideCtx),
    byWeek(SIDE_STORIES_ABSURD, weekIndex, 1)(sideCtx),
  ];

  const printedLine = `${weekLabel.toUpperCase()} EDITION · ${year} SEASON · ${leagueName.toUpperCase()} · NOT FIT FOR FRAMING (BUT YOU WILL)`;

  return {
    weekIndex,
    weekLabel,
    volumeLabel: `Vol. ${weekIndex + 1} · ${weekLabel} · ${year}`,
    masthead: "THE WAR ROOM GAZETTE",
    tagline,
    printedLine,
    weather,
    classifieds,
    pullQuote,
    sideStories,
    samePerson: data.samePerson,
    crown,
    shame,
    standingsDeadlock,
    noLock,
    crystalBallMiss,
    swing,
  };
}

/** One-tap share / paste into the group chat. */
export function formatGazetteShareText(edition: GazetteEdition): string {
  const lines = [
    `📰 ${edition.masthead}`,
    edition.volumeLabel,
    edition.tagline,
    "",
    `★ ${edition.crown.headline}`,
    edition.crown.deck,
    "",
  ];
  if (edition.shame) {
    lines.push(`🚽 ${edition.shame.headline}`, edition.shame.deck, "");
  }
  if (edition.swing) {
    lines.push(`📈 ${edition.swing.headline}`, edition.swing.deck, "");
  }
  if (edition.noLock) {
    lines.push(`🥛 ${edition.noLock.headline}`, edition.noLock.deck, "");
  }
  if (edition.standingsDeadlock) {
    lines.push(
      `⚖️ ${edition.standingsDeadlock.headline}`,
      edition.standingsDeadlock.deck,
      ""
    );
  }
  if (edition.sideStories?.length) {
    lines.push("— ALSO IN THIS PAPER —", "");
    for (const s of edition.sideStories) {
      lines.push(`${s.kicker}: ${s.headline}`, s.body, "");
    }
  }
  lines.push(`— ${edition.pullQuote.text}`, `   — ${edition.pullQuote.by}`);
  lines.push("", "War Room Pick'Em · don't ghost next week");
  return lines.filter((l) => l != null).join("\n");
}

// ——— Extra flavor banks (week-keyed) ———

const EDITION_TAGLINES: string[] = [
  "All the news that's fit to roast",
  "Printed in ink, sealed in shame",
  "If you're reading this, you locked. Probably.",
  "Special late edition: feelings were hurt",
  "Confidence died so this paper could live",
  "Not responsible for group-chat violence",
  "Free with every scored week · tips optional",
  "Est. whenever you started caring too much",
  "The only paper that covers the spread",
  "Breaking: somebody was right. Most of you weren't.",
  "Hold for applause · then hold for the Toilet Bowl",
  "Weather inside: 100% chance of trash talk",
  "Your name may appear. Lawyer up or lean in.",
  "Brought to you by Best Bets and bad ideas",
  "Extra! Extra! Read all about… yourself",
  "Subscription: one lock per week, forever",
  "We report. You cope.",
  "Official publication of the cut line",
];

const WEATHER_BOXES: { kicker: string; body: string }[] = [
  {
    kicker: "War Room weather",
    body: "High: confidence. Low: dignity. Wind: from the Toilet Bowl. Pack a paper bag.",
  },
  {
    kicker: "Forecast",
    body: "Scattered Best Bets, late shame, 80% chance someone says “I almost had it.”",
  },
  {
    kicker: "Conditions",
    body: "Fog of spreads. Brief sun if you hit the prop. Overnight: group chat storms.",
  },
  {
    kicker: "Advisory",
    body: "Heat advisory for the crown. Freeze warning for anyone who didn't lock.",
  },
  {
    kicker: "Local radar",
    body: "Storm cells forming over the cut line. Seek shelter in better dogs.",
  },
  {
    kicker: "Extended outlook",
    body: "Next week: more football, more opinions, same people who “know ball.”",
  },
];

type ClassCtx = { crown: string; shame: string; league: string; pts: number };

const CLASSIFIEDS_A: ((c: ClassCtx) => string)[] = [
  (c) =>
    `FOR SALE: One (1) strategy. Barely used by ${c.shame}. Make offer in Locker.`,
  (c) =>
    `WANTED: Dignity. Last seen near ${c.shame}'s card. Reward: nothing, but respect.`,
  (c) =>
    `LOST: A lock button. If found, return to ${c.shame} before next kickoff.`,
  (c) =>
    `HELP WANTED: Underdog. Must cover. Apply to everyone who faded ${c.crown}.`,
];

const CLASSIFIEDS_B: ((c: ClassCtx) => string)[] = [
  (c) =>
    `PERSONALS: ${c.crown} seeks worthy rival. Must survive ${c.pts}-pt weeks.`,
  (c) =>
    `SERVICES: Confidence assigned randomly. Results may vary (${c.shame} can confirm).`,
  (c) =>
    `NOTICE: ${c.league} reminds all members that “almost” is not a score.`,
  (c) =>
    `YARD SALE: Old excuses. Free to ${c.shame}. Bring your own alibi.`,
];

const CLASSIFIEDS_C: ((c: ClassCtx) => string)[] = [
  (c) =>
    `LEGAL: Spreads are not financial advice. Neither is listening to ${c.shame}.`,
  (c) =>
    `EVENTS: Mandatory coping session after ${c.crown}'s ${c.pts}. BYO snacks.`,
  (c) =>
    `REAL ESTATE: One open seat in the Toilet Bowl. Tour with ${c.shame}.`,
  (c) =>
    `PETS: Found — one lucky dog. Owner: ${c.crown}. Collar says “I told you so.”`,
];

const PULL_QUOTES: ((c: {
  crown: string;
  shame: string;
  pts: number;
}) => { text: string; by: string })[] = [
  (c) => ({
    text: `"I knew it the whole time."`,
    by: `${c.crown}, probably lying a little`,
  }),
  (c) => ({
    text: `"The process is fine."`,
    by: `${c.shame}, after ${c.pts > 0 ? "a long week" : "zero"}`,
  }),
  (c) => ({
    text: `"It's a marathon."`,
    by: `Someone who just lost a sprint to ${c.crown}`,
  }),
  (c) => ({
    text: `"Trust the card."`,
    by: `Ancient War Room proverb (contested)`,
  }),
  (c) => ({
    text: `"We're still early."`,
    by: `The cut line, sharpening its knife`,
  }),
  (c) => ({
    text: `"No notes."`,
    by: `${c.crown}, with ${c.pts} notes`,
  }),
];

type SwingHN = (name: string, spots: number, label: string) => string;
type SwingDK = (spots: number, rank: number, label: string) => string;

const SWING_UP_HEADLINES: SwingHN[] = [
  (n, s, lab) =>
    `${n.toUpperCase()} ${lab} — UP ${s} SPOT${s === 1 ? "" : "S"} IN THE TABLE`,
  (n, s) =>
    `MOVERS: ${n.toUpperCase()} CLIMBS ${s} — STANDINGS JUST GOT LOUDER`,
  (n, s, lab) =>
    `${n.toUpperCase()} GOES ${lab} (+${s}) — CHASE PACK NERVOUS`,
];

const SWING_UP_DECKS: SwingDK[] = [
  (s, rank, lab) =>
    `${lab}. Climbed ${s} spot${s === 1 ? "" : "s"} to #${rank}. Elevators exist; this was a rocket.`,
  (s, rank) =>
    `+${s} in the rankings, now sitting ${rank === 1 ? "alone at the top" : `at #${rank}`}. Momentum is a drug.`,
  (s, rank) =>
    `Jumped ${s}. Current rank: #${rank}. The people below are “happy for them.”`,
];

const SWING_DOWN_HEADLINES: SwingHN[] = [
  (n, s, lab) =>
    `${n.toUpperCase()} ${lab} — DOWN ${s} IN THE STANDINGS`,
  (n, s) =>
    `TRAPDOOR OPENS: ${n.toUpperCase()} FALLS ${s} SPOT${s === 1 ? "" : "S"}`,
  (n, s, lab) =>
    `MOVERS (THE BAD KIND): ${n.toUpperCase()} ${lab} (−${s})`,
];

const SWING_DOWN_DECKS: SwingDK[] = [
  (s, rank, lab) =>
    `${lab}. Dropped ${s} to #${rank}. Gravity remains undefeated.`,
  (s, rank) =>
    `−${s} on the board. Now #${rank}. Bring a helmet next week.`,
  (s, rank) =>
    `Fell ${s} spots (now #${rank}). The cut line sent a “thinking of you” card.`,
];

// ——— Non-football (and barely-football) side stories ———

type SideStoryCtx = {
  crown: string;
  shame: string;
  league: string;
  pts: number;
  weekLabel: string;
};

type SideFn = (c: SideStoryCtx) => GazetteSideStory;

/** Uses the week’s hero/villain names — still silly, not real sports recaps. */
const SIDE_STORIES_NAMED: SideFn[] = [
  (c) => ({
    kicker: "Lifestyle",
    headline: `${c.crown.toUpperCase()} DECLARED “FINANCIALLY RESPONSIBLE” AFTER ${c.pts}-POINT WEEK`,
    body: `Local sources confirm ${c.crown} immediately spent the aura on imaginary swagger. ${c.shame} was seen Googling “how to reverse a Best Bet.” Experts say the market for humility is still closed.`,
  }),
  (c) => ({
    kicker: "Science",
    headline: `STUDY: ${c.crown.toUpperCase()}'S BRAIN NOW 12% MORE ANNOYING`,
    body: `Peer-reviewed in the group chat. Symptoms include unsolicited “I told you so,” selective memory, and claiming the prop was “always the play.” ${c.shame} declined a control-group invitation.`,
  }),
  (c) => ({
    kicker: "Metro",
    headline: `CITY RENAMES A SPEED BUMP AFTER ${c.shame.toUpperCase()}`,
    body: `“It slows everyone down for no good reason,” said a council member who requested anonymity and better dogs. ${c.crown} declined the ribbon-cutting, citing “main character conflicts.”`,
  }),
  (c) => ({
    kicker: "Business",
    headline: `${c.crown.toUpperCase()} LAUNCHES CONSULTING FIRM: “JUST HIT YOUR FIVES”`,
    body: `Rates start at one brag per hour. ${c.league} members can pay in shame. ${c.shame} is reportedly a founding client and also the product.`,
  }),
  (c) => ({
    kicker: "Obituaries",
    headline: `${c.shame.toUpperCase()}'S EXCUSES, 2024–${new Date().getFullYear()}`,
    body: `Survived by “the refs,” “the line moved,” and “I was busy.” In lieu of flowers, please lock next week. ${c.crown} sent a fruit basket labeled ${c.pts} PTS.`,
  }),
  (c) => ({
    kicker: "Travel",
    headline: `${c.crown.toUpperCase()} BOOKS ONE-WAY FLIGHT TO THE MORAL HIGH GROUND`,
    body: `TSA confiscated false modesty. ${c.shame} is still at the gate arguing with the boarding pass that says 0. ${c.weekLabel} travel advisory: pack dignity or don't pack at all.`,
  }),
  (c) => ({
    kicker: "Food",
    headline: `RECIPE OF THE WEEK: WHATEVER ${c.crown.toUpperCase()} COOKED (${c.pts} SERVINGS)`,
    body: `Ingredients: five spreads, one Best Bet, zero mercy. ${c.shame} attempted the same dish and invented a new way to undercook confidence.`,
  }),
  (c) => ({
    kicker: "Tech",
    headline: `APP UPDATE: MUTE BUTTON ADDED FOR ${c.crown.toUpperCase()} SPECIFICALLY`,
    body: `Beta testers report ${c.shame} held the button so long the phone overheated. Developers say “it’s a feature, not a bug, and also a cry for help.”`,
  }),
  (c) => ({
    kicker: "Politics",
    headline: `${c.crown.toUpperCase()} WINS LANDSLIDE IN POLL OF ONE (THEMSELF)`,
    body: `Opposition candidate ${c.shame} conceded after discovering ballots required locking before kickoff. International observers called the process “fair, mean, and hilarious.”`,
  }),
  (c) => ({
    kicker: "Real estate",
    headline: `${c.shame.toUpperCase()} LISTS PRIDE AT A LOSS`,
    body: `Open house Saturday. Bring snacks. ${c.crown} is the nosy neighbor measuring the property line with a ruler labeled STANDINGS. HOA fines start at one public roast.`,
  }),
  (c) => ({
    kicker: "Crime blotter",
    headline: `${c.crown.toUpperCase()} CAUGHT STEALING A WHOLE WEEK (${c.pts} PTS)`,
    body: `Witnesses say the crime was “too clean.” ${c.shame} filed a report under “emotional damages.” Bail set at one better card next week.`,
  }),
  (c) => ({
    kicker: "Horoscope",
    headline: `${c.crown.toUpperCase()}: SUN IN BEST BET. ${c.shame.toUpperCase()}: MOON IN “WHY”`,
    body: `Mercury is in retrograde only for people who didn’t lock. Lucky numbers: 1 through 5, used once, unlike your excuses.`,
  }),
];

/** Pure absurd non-football filler — Onion energy, no real sports. */
const SIDE_STORIES_ABSURD: SideFn[] = [
  () => ({
    kicker: "World",
    headline: `NATION AGREES TO “JUST ONE MORE GROUP CHAT” THEN SLEEP`,
    body: `Treaty collapses at 1:14 a.m. when someone posts a meme. Historians note this is the 400th consecutive failed summit. Coffee futures surge.`,
  }),
  () => ({
    kicker: "Science",
    headline: `RESEARCHERS CONFIRM “I’LL DO IT LATER” IS A COMPLETE PERSONALITY`,
    body: `Subjects shown a green Save button chose scrolling instead. Control group locked picks and felt superior in a sustainable, annoying way.`,
  }),
  () => ({
    kicker: "Business",
    headline: `LOCAL MAN PIVOTS TO “ vibes-based economics ”`,
    body: `Shareholders asked for a spreadsheet. He replied with a shrug emoji. Markets briefly rallied on pure spite, then remembered math.`,
  }),
  () => ({
    kicker: "Metro",
    headline: `CITY INSTALLS “THOUGHTS AND PRAYERS” AS OFFICIAL PUBLIC TRANSIT`,
    body: `Riders report frequent delays and no actual movement. Mayor insists the system is “working as designed for people who never lock.”`,
  }),
  () => ({
    kicker: "Lifestyle",
    headline: `EXPERTS WARN AGAINST “MAIN CHARACTER ENERGY” WITHOUT A PLOT`,
    body: `Side characters in the group chat demand better writing. One anonymous source whispered, “At least give us a Best Bet.”`,
  }),
  () => ({
    kicker: "Tech",
    headline: `NEW AI WRITES APOLOGIES SO YOU DON’T HAVE TO MEAN THEM`,
    body: `Early reviews: “Sounds like me after a 4-point week.” Subscription includes optional sincerity upgrade (sold separately, rarely used).`,
  }),
  () => ({
    kicker: "Weather",
    headline: `NATIONAL WEATHER SERVICE ISSUES “MID” ADVISORY`,
    body: `Conditions: meh with scattered opinions. Residents advised to stay indoors unless they have a take. Wind chill measured in lost confidence points.`,
  }),
  () => ({
    kicker: "Culture",
    headline: `DOCUMENTARY “WAITING FOR THE PROP” WINS NOTHING, DESERVES LESS`,
    body: `Runtime: three hours of a loading spinner. Critics call it “a meditation on hope” and “please just score the week already.”`,
  }),
  () => ({
    kicker: "Health",
    headline: `DOCTORS LINK GROUP-CHAT REFRESHING TO “COMPETITIVE STRESS DISORDER”`,
    body: `Treatment: touch grass, lock earlier, stop checking standings at red lights. Side effects of recovery include accidentally being fun at parties.`,
  }),
  () => ({
    kicker: "Opinion",
    headline: `IN DEFENSE OF PEOPLE WHO ARE WRONG LOUDLY`,
    body: `Without them, the paper would be two paragraphs and a weather box. Wrongness is content. Content is love. Love is a 0 on the card.`,
  }),
  () => ({
    kicker: "Odd news",
    headline: `MAN CLAIMS DOG ATE HOMEWORK, DOG RELEASES STATEMENT`,
    body: `“I only eat quality content,” the dog said. “That card was not it.” The man has been reassigned to the milk carton beat.`,
  }),
  () => ({
    kicker: "Obituaries",
    headline: `“I’LL START NEXT WEEK,” 1998–THIS WEEK`,
    body: `Survived by a long list of next weeks. Services will be held every Saturday until someone actually locks. In lieu of flowers: hit Save.`,
  }),
];

/**
 * Should we show the gazette now?
 * Guardrails: feature on, rules already seen, league session, not seen this week.
 */
export async function shouldOfferGazette(
  players: Player[]
): Promise<
  { show: true; edition: GazetteEdition; leagueId: string } | { show: false }
> {
  if (!GAZETTE_ENABLED) return { show: false };
  if (typeof window === "undefined") return { show: false };
  if (!hasSeenRules()) return { show: false }; // rules first, always

  const session = getSession();
  if (!session?.leagueId || !session.playerId) return { show: false };

  const edition = await buildGazetteEdition(players);
  if (!edition) return { show: false };

  if (hasSeenGazette(session.leagueId, edition.weekIndex)) {
    return { show: false };
  }

  return { show: true, edition, leagueId: session.leagueId };
}

export type ArchivedGazette = {
  id: string;
  weekNumber: number;
  weekLabel: string;
  volumeLabel: string;
  edition: GazetteEdition;
  createdAt: string;
};

/**
 * Snapshot this week's paper into the archive (commissioner, after score).
 * Upserts by league + week so re-scores refresh the edition.
 */
export async function archiveGazetteEdition(
  edition: GazetteEdition
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  // Deputies scoring a week should also archive the paper
  if (
    !session?.leagueId ||
    !(session.isCommissioner || session.isDeputy)
  ) {
    return { ok: false, error: "Commissioner or deputy only" };
  }
  const supabase = createClient();
  const { error } = await supabase.from("gazette_editions").upsert(
    {
      league_id: session.leagueId,
      week_number: edition.weekIndex,
      week_label: edition.weekLabel,
      volume_label: edition.volumeLabel,
      payload: edition as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
    },
    { onConflict: "league_id,week_number" }
  );
  if (error) {
    if (
      /does not exist|schema cache|gazette_editions/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Gazette archive table missing — run supabase/gazette-archive.sql once.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Load all archived editions for the active league (newest week first). */
export async function loadGazetteArchive(): Promise<{
  ok: boolean;
  editions?: ArchivedGazette[];
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league selected" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gazette_editions")
    .select("id, week_number, week_label, volume_label, payload, created_at")
    .eq("league_id", session.leagueId)
    .order("week_number", { ascending: false });

  if (error) {
    if (
      /does not exist|schema cache|gazette_editions/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Gazette archive not set up. Commissioner: run supabase/gazette-archive.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  const editions: ArchivedGazette[] = (data || []).map((row) => {
    const r = row as Record<string, unknown>;
    const payload = (r.payload || {}) as GazetteEdition;
    const weekNumber = r.week_number as number;
    return {
      id: r.id as string,
      weekNumber,
      weekLabel: (r.week_label as string) || weekTitle(weekNumber),
      volumeLabel: (r.volume_label as string) || `Vol. ${weekNumber}`,
      edition: {
        ...payload,
        weekIndex: payload.weekIndex ?? weekNumber,
        weekLabel: payload.weekLabel || (r.week_label as string) || weekTitle(weekNumber),
        volumeLabel:
          payload.volumeLabel ||
          (r.volume_label as string) ||
          `Vol. ${weekNumber}`,
        masthead: payload.masthead || "THE WAR ROOM GAZETTE",
      },
      createdAt: (r.created_at as string) || new Date().toISOString(),
    };
  });

  return { ok: true, editions };
}

/**
 * After a week is scored: rebuild edition from fresh standings and archive it.
 * Safe no-op if nothing to publish or table missing.
 */
export async function snapshotGazetteAfterScore(
  players: Player[],
  weekNumber?: number
): Promise<void> {
  try {
    const edition = await buildGazetteEdition(players);
    if (!edition) return;
    // Prefer explicit week when re-scoring a specific card
    if (weekNumber != null && Number.isFinite(weekNumber)) {
      edition.weekIndex = weekNumber;
      edition.weekLabel = weekTitle(weekNumber);
      edition.volumeLabel = `Vol. ${weekNumber} · ${edition.weekLabel}`;
    }
    await archiveGazetteEdition(edition);
  } catch {
    /* archive is best-effort — never block scoring */
  }
}

export type { CrownShame } from "./fun-board";
