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
import {
  gazetteSecretLetterForWeek,
  pickRareGazetteLine,
} from "./easter-eggs";
import {
  pickFromFnBank,
  pickBankSlot,
  comboCrownHeadline,
  comboCrownDeck,
  comboShameHeadline,
  comboShameDeck,
  comboSoloHeadline,
  comboSoloDeck,
} from "./gazette-copy-engine";

const SEEN_PREFIX = "warroom-gazette-seen-v1";

/** Combo factories keyed by bank id (exhausted-season forever lines). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GAZETTE_COMBO: Record<string, ((salt: number) => any) | undefined> = {
  crown_headlines: comboCrownHeadline,
  crown_decks: comboCrownDeck,
  shame_headlines: comboShameHeadline,
  shame_decks: comboShameDeck,
  solo_headlines: comboSoloHeadline,
  solo_decks: comboSoloDeck,
  nfl_crown_headlines: comboCrownHeadline,
  nfl_crown_decks: comboCrownDeck,
  nfl_shame_headlines: comboShameHeadline,
  nfl_shame_decks: comboShameDeck,
};

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
  /** Closest live season race between two active, real players. */
  rivalryWatch?: GazetteStory | null;
  /**
   * Someone confirmed Chaos lock this week — one headline (multi-name if several).
   * Trigger is lock-in, not final score. All sports.
   */
  chaosDetonation: GazetteStory | null;
  /** Emergency front-page art direction for an authorized War Room weapon. */
  emergencyProtocol?: "tactical_nuke" | "hellfire" | "jdam";
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
  /**
   * Ritual brand for the drop — “Sunday Paper”, “Monday Morning Edition”, etc.
   * This is the weekly appointment product.
   */
  ritualName: string;
  /** Sport pack — drives World Cup Edition vs classic War Room paper */
  sportId?: string;
  /** Top stamp: EXTRA! / EXTRA · EXTRA */
  stampLine?: string;
  /** Subline under masthead (e.g. Brazil 2027) */
  eventLine?: string;
  /**
   * Easter egg — rare absurd desk line (~4% of editions). Zero points.
   * Discoverable; not announced in a secret menu.
   */
  rareEgg?: { headline: string; deck: string } | null;
  /**
   * Quiet acrostic letter for the week (spells NEVER GIVE UP over time).
   * Rendered as a subtle highlight — never explained in UI chrome.
   */
  secretLetter?: string | null;
  /**
   * Cut-lock week only: conference / division champions (SEC, AFC East, …).
   * Auto-engraved to Trophy Room the same night.
   */
  conferenceChampions?: GazetteStory[] | null;
};

/** Sidebar / “also in this paper” bit */
export type GazetteSideStory = {
  kicker: string;
  headline: string;
  body: string;
};

/**
 * Shared league-wide rivalry lead for the standings page of the paper.
 * This is deliberately dynamic: the closest live points race gets the ink,
 * and a stale pairing disappears as soon as the standings move away from it.
 */
export function buildGazetteRivalryWatch(
  players: Player[]
): GazetteStory | null {
  const active = players
    .filter(
      (p) =>
        !p.isMock &&
        p.weeksPlayed > 0 &&
        p.weeklyPoints.some((points) => Number.isFinite(points))
    )
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  if (active.length < 2) return null;

  let pair: [Player, Player] = [active[0], active[1]];
  let gap = Math.abs(active[0].totalPoints - active[1].totalPoints);
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const nextGap = Math.abs(active[i].totalPoints - active[j].totalPoints);
      if (nextGap < gap) {
        gap = nextGap;
        pair = [active[i], active[j]];
      }
    }
  }

  const [leader, chaser] = pair;
  return {
    names: [leader.name, chaser.name],
    pts: gap,
    kind: gap === 0 ? "tie" : "clear",
    headline:
      gap === 0
        ? `${leader.name.toUpperCase()} AND ${chaser.name.toUpperCase()} REFUSE TO BLINK`
        : `${leader.name.toUpperCase()} HAS ${chaser.name.toUpperCase()} IN THE REARVIEW`,
    deck:
      gap === 0
        ? `Dead even at ${leader.totalPoints} season points. This rivalry has no adult supervision.`
        : `Only ${gap} ${gap === 1 ? "point" : "points"} separate the room's closest live race. One good card changes the headline.`,
  };
}

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
  try {
    window.dispatchEvent(new CustomEvent("warroom-gazette-seen"));
  } catch {
    /* ignore */
  }
}

/** Foundry / re-score: allow the paper to pop again for this week. */
export function clearGazetteSeenForWeek(
  leagueId: string,
  weekIndex: number
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(leagueId, weekIndex));
  } catch {
    /* ignore */
  }
}

/**
 * Sunday / Monday ritual naming — what people look forward to.
 * Scored weekend → Sunday Paper; Monday → Monday Morning Edition; else special.
 */
export function ritualEditionName(when: Date = new Date()): string {
  const day = when.getDay(); // 0 = Sun
  if (day === 0) return "Sunday Paper";
  if (day === 1) return "Monday Morning Edition";
  if (day === 2) return "Tuesday Hangover Edition";
  if (day === 6) return "Saturday Night Extra";
  return "War Room Late Edition";
}

/** World Cup event paper ritual names */
export function ritualEditionNameWwc(when: Date = new Date()): string {
  const day = when.getDay();
  if (day === 0) return "Sunday World Cup Extra";
  if (day === 1) return "Monday Matchday Edition";
  if (day === 2) return "Group Stage Hangover";
  if (day === 6) return "Knockout Night Extra";
  return "World Cup Late Edition";
}

/** NFL primetime paper ritual names */
export function ritualEditionNameNfl(when: Date = new Date()): string {
  const day = when.getDay();
  if (day === 0) return "Sunday Night Extra";
  if (day === 1) return "Monday Morning Film";
  if (day === 2) return "Tuesday Tape Review";
  if (day === 4) return "Thursday Night Hangover";
  if (day === 6) return "Saturday Primetime Desk";
  return "War Room Late Edition";
}

function isWwcLeague(): boolean {
  try {
    return (getLeague()?.sportId || "cfb") === "soccer_wwc";
  } catch {
    return false;
  }
}

function isNflLeague(): boolean {
  try {
    return (getLeague()?.sportId || "cfb") === "nfl";
  } catch {
    return false;
  }
}

/** Short tease while waiting on Commish to score. */
export function gazetteAnticipationCopy(): {
  title: string;
  body: string;
  ritualHint: string;
} {
  const day = new Date().getDay();
  if (isWwcLeague()) {
    if (day === 0 || day === 1) {
      return {
        title: "WORLD CUP EDITION almost on the stands",
        body: "When the commish scores this matchday, the Extra drops — survivors, collapses, chaos in the group. ESPN energy. War Room sass.",
        ritualHint: ritualEditionNameWwc(),
      };
    }
    return {
      title: "Save room for the World Cup paper",
      body: "After scores post: EXTRA! Crowns, shame, and group-stage nonsense. The weekly appointment, Brazil 2027 edition.",
      ritualHint: "World Cup Extra",
    };
  }
  if (isNflLeague()) {
    if (day === 0 || day === 1) {
      return {
        title: "Primetime paper almost on the stands",
        body: "When the commish scores this week, the Sunday desk drops — late-window crowns, three-and-outs, Best Bet blood. No campus filler.",
        ritualHint: ritualEditionNameNfl(),
      };
    }
    return {
      title: "Save room for the Sunday paper",
      body: "After scores post: one tight Extra. Who owned the late window, who three-and-out'd, who moved. Film room energy. Not a magazine.",
      ritualHint: "Sunday Extra",
    };
  }
  if (day === 0 || day === 1) {
    return {
      title: "The paper is almost here",
      body: "When the commish scores this week, the Sunday / Monday Gazette drops — crowns, shame, fake news, the works.",
      ritualHint: ritualEditionName(),
    };
  }
  return {
    title: "Save room for the Gazette",
    body: "After scores post, the room gets a full paper. It’s the weekly appointment — don’t miss the splash.",
    ritualHint: "Weekly paper",
  };
}

export const EVENT_GAZETTE_SEEN = "warroom-gazette-seen";

/**
 * Home / nav: is there a filed edition this player hasn’t opened?
 */
const gazetteUnreadCache = new Map<
  string,
  {
    at: number;
    value: {
      unread: boolean;
      weekNumber: number | null;
      ritualName: string | null;
      weekLabel: string | null;
    };
  }
>();
const GAZETTE_UNREAD_TTL_MS = 45_000;

export async function getGazetteUnreadState(): Promise<{
  unread: boolean;
  weekNumber: number | null;
  ritualName: string | null;
  weekLabel: string | null;
}> {
  const empty = {
    unread: false,
    weekNumber: null as number | null,
    ritualName: null as string | null,
    weekLabel: null as string | null,
  };
  if (!GAZETTE_ENABLED) return empty;
  const session = getSession();
  if (!session?.leagueId) return empty;

  const cacheKey = `${session.leagueId}:${session.playerId || ""}`;
  const hit = gazetteUnreadCache.get(cacheKey);
  if (hit && Date.now() - hit.at < GAZETTE_UNREAD_TTL_MS) return hit.value;

  try {
    // Badge only needs the latest week number — not the full archive payloads
    // (loadGazetteArchive was downloading every edition on every Nav boot).
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gazette_editions")
      .select("week_number, week_label, created_at")
      .eq("league_id", session.leagueId)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      gazetteUnreadCache.set(cacheKey, { at: Date.now(), value: empty });
      return empty;
    }
    // Paper exists → season is alive (unlock deep home tiles / cheevo pops)
    try {
      const { markSeasonComeAlive } = await import("./first-week");
      markSeasonComeAlive(session.playerId);
    } catch {
      /* ignore */
    }
    const week = data.week_number as number;
    const createdAt = (data.created_at as string) || null;
    const unread = !hasSeenGazette(session.leagueId, week);
    const ritual = ritualEditionName(
      createdAt ? new Date(createdAt) : new Date()
    );
    const value = {
      unread,
      weekNumber: week,
      ritualName: ritual,
      weekLabel: (data.week_label as string) || null,
    };
    gazetteUnreadCache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch {
    return empty;
  }
}

/**
 * Pick copy for this week — unique per league-season when possible.
 * After the bank is exhausted, combinatorial generators (or spice-wrap)
 * keep lines fresh forever. Same week always rebuilds the same line.
 *
 * `bankKey` scopes uniqueness (crown vs shame don't share slots).
 * Prefer passing an explicit key; falls back to a hash of list identity.
 */
function byWeek<T>(
  list: T[],
  weekIndex: number,
  offset = 0,
  bankKey?: string
): T {
  const n = list.length;
  if (n === 0) throw new Error("empty copy bank");
  const key =
    bankKey ||
    `anon_${n}_${offset}_${typeof list[0] === "function" ? "fn" : "val"}`;

  if (typeof list[0] === "function") {
    return pickFromFnBank(
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      list as any,
      weekIndex,
      offset,
      GAZETTE_COMBO[key]
    ) as T;
  }

  const slot = pickBankSlot({
    bankKey: key,
    bankLen: n,
    weekIndex,
    offset,
  });
  if (slot.mode === "bank") return list[slot.index]!;
  const i = (slot.comboSalt + weekIndex + offset) % n;
  return list[i]!;
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
/**
 * Chaos lock-in headlines — fires because they *confirmed Chaos*, not the final score.
 * One story for the week; multi-name if several people went postal.
 * All sports.
 */
const CHAOS_LOCK_HEADLINES: ((label: string) => string)[] = [
  (label) => `${label.toUpperCase()} HAS GONE POSTAL`,
  (label) => `${label.toUpperCase()} HAS GONE NUCLEAR`,
  (label) => `${label.toUpperCase()} JUST HIT THE BIG RED BUTTON`,
  (label) => `BREAKING: ${label.toUpperCase()} WENT FULL CHAOS`,
  (label) => `${label.toUpperCase()} HAS LEFT THE BUILDING (CHAOS MODE)`,
  (label) => `${label.toUpperCase()} CHOSE VIOLENCE — CHAOS LOCKED`,
  (label) => `EXTRA! ${label.toUpperCase()} DETONATED THEIR OWN CARD`,
  (label) => `${label.toUpperCase()} WENT THERMONUCLEAR ON PURPOSE`,
];

const CHAOS_LOCK_MULTI_HEADLINES: ((label: string) => string)[] = [
  (label) => `MASS CHAOS: ${label.toUpperCase()} HAVE GONE POSTAL`,
  (label) => `MULTIPLE NUKES ARMED: ${label.toUpperCase()}`,
  (label) => `THE CHAOS DESK: ${label.toUpperCase()} ALL HIT THE BIG RED BUTTON`,
  (label) => `${label.toUpperCase()} WENT NUCLEAR. EVACUATE THE LOCKER ROOM.`,
];

/** Always explain Chaos once — half the room will ask “wtf is that?” */
const CHAOS_WHAT_IS =
  "Chaos Mode = one pure-random card, 2× the week points, limited uses. No take-backs. Flames on the name.";

const CHAOS_LOCK_DECKS: ((count: number, pts: number) => string)[] = [
  (count, pts) =>
    count > 1
      ? `${count} humans locked pure random this week. Peak ${pts}. ${CHAOS_WHAT_IS}`
      : `Confirmed Chaos lock. Finished at ${pts}. ${CHAOS_WHAT_IS}`,
  (count, pts) =>
    count > 1
      ? `Group detonation at lock (${pts} peak). ${CHAOS_WHAT_IS}`
      : `They pressed the big red button. ${pts} pts when the smoke cleared. ${CHAOS_WHAT_IS}`,
  (count) =>
    count > 1
      ? `Several big red buttons. One paper. Zero chill. ${CHAOS_WHAT_IS}`
      : `Gone postal at the lock screen. The room saw the flames. ${CHAOS_WHAT_IS}`,
];

/**
 * Who confirmed Chaos lock this week (is_chaos on the pick).
 * Cloud preferred; local chaos-week list is fallback.
 * Score is for the deck only — trigger is the lock, not a nuke threshold.
 */
async function buildChaosDetonationStory(
  weekIndex: number,
  players: Player[]
): Promise<GazetteStory | null> {
  const leagueId = getLeague()?.id;
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const ptsById = new Map(
    players.map((p) => {
      const w = p.weeklyPoints || [];
      const last = w.length ? w[w.length - 1] : null;
      const atWeek =
        w.length > weekIndex && weekIndex >= 0 ? w[weekIndex] : last;
      return [p.id, atWeek ?? last ?? 0] as const;
    })
  );

  type Hit = { name: string; pts: number };
  const hits: Hit[] = [];

  // Cloud: anyone who locked is_chaos for this week
  try {
    const session = getSession();
    if (session?.leagueId && typeof window !== "undefined") {
      const supabase = createClient();
      let rows: {
        user_id: string;
        total_points: number | null;
        is_chaos?: boolean;
        locked_at?: string | null;
      }[] = [];
      const res = await supabase
        .from("picks")
        .select("user_id, total_points, is_chaos, locked_at")
        .eq("league_id", session.leagueId)
        .eq("week_number", weekIndex);
      if (res.error && /is_chaos|column/i.test(res.error.message || "")) {
        rows = [];
      } else if (!res.error && res.data) {
        rows = res.data as typeof rows;
      }
      for (const r of rows) {
        if (!r.is_chaos) continue;
        // Prefer locked chaos cards
        if (r.locked_at === null || r.locked_at === undefined) {
          // still count if is_chaos set (some paths lock without timestamp edge cases)
        }
        const pts = Number(r.total_points ?? ptsById.get(r.user_id) ?? 0);
        const name = nameById.get(r.user_id) || "Someone";
        hits.push({ name, pts });
      }
    }
  } catch {
    /* fall through */
  }

  // Local fallback — marked chaos for this week at lock
  if (!hits.length) {
    try {
      const { isWeekChaosForUser } = await import("./chaos-mode");
      for (const p of players) {
        if (p.isMock) continue;
        if (!isWeekChaosForUser(weekIndex, leagueId, p.id)) continue;
        hits.push({ name: p.name, pts: ptsById.get(p.id) ?? 0 });
      }
    } catch {
      /* ignore */
    }
  }

  if (!hits.length) return null;

  hits.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const k = h.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const names = unique.map((h) => h.name);
  const topPts = unique[0].pts;
  const label = formatNameList(names);
  const multi = names.length > 1;
  const hn = multi
    ? byWeek(CHAOS_LOCK_MULTI_HEADLINES, weekIndex, 0, "chaos_lock_multi_headlines")(label)
    : byWeek(CHAOS_LOCK_HEADLINES, weekIndex, 0, "chaos_lock_headlines")(label);
  const deck = byWeek(CHAOS_LOCK_DECKS, weekIndex, 0, "chaos_lock_decks")(names.length, topPts);

  return {
    names,
    pts: topPts,
    kind: multi ? "tie" : "clear",
    headline: hn,
    deck,
  };
}

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
  /** Hand banks are finite; after exhaust, combinatorial lines run forever */
  uniquePerSeasonThenCombo: true,
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
function eggFields(weekIndex: number): {
  rareEgg: { headline: string; deck: string } | null;
  secretLetter: string;
} {
  const leagueId = getLeague()?.id || "local";
  return {
    rareEgg: pickRareGazetteLine(leagueId, weekIndex),
    secretLetter: gazetteSecretLetterForWeek(weekIndex),
  };
}

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
  const eggs = eggFields(weekIndex);

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
      ? byWeek(SOLO_HEADLINES, weekIndex, 0, "solo_headlines")(cn, cp)
      : byWeek(CROWN_HEADLINES, weekIndex, 0, "crown_headlines")(cn, cp),
    deck: data.samePerson
      ? byWeek(SOLO_DECKS, weekIndex, 0, "solo_decks")(cp)
      : byWeek(CROWN_DECKS, weekIndex, 0, "crown_decks")(cp),
  };

  let shame: GazetteStory | null = null;
  if (!data.samePerson) {
    shame = {
      names: [sn],
      pts: sp,
      kind: "clear",
      headline: byWeek(SHAME_HEADLINES, weekIndex, 0, "shame_headlines")(sn, sp),
      deck: byWeek(SHAME_DECKS, weekIndex, 0, "shame_decks")(sp),
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
      headline: byWeek(STANDINGS_TIE_HEADLINES, weekIndex, 0, "standings_tie_headlines")(
        label,
        overallTie.pts,
        overallTie.names.length
      ),
      deck: byWeek(STANDINGS_TIE_DECKS, weekIndex, 0, "standings_tie_decks")(
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
      headline: byWeek(NO_LOCK_HEADLINES, weekIndex, 3, "no_lock_headlines")(label),
      deck: byWeek(NO_LOCK_DECKS, weekIndex, 3, "no_lock_decks")(ghostNames.length),
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
          headline: byWeek(CRYSTAL_MISS_HEADLINES, weekIndex, 1, "crystal_miss_headlines")(label),
          deck: byWeek(CRYSTAL_MISS_DECKS, weekIndex, 1, "crystal_miss_decks")(missNames.length),
        };
      }
    } catch {
      crystalBallMiss = null;
    }
  }

  // Chaos went postal / nuclear — one headline, multi-name if several nuked
  let chaosDetonation: GazetteStory | null = null;
  try {
    chaosDetonation = await buildChaosDetonationStory(weekIndex, players);
  } catch {
    chaosDetonation = null;
  }

  // Cut-lock week: conference / division champs — Gazette splash + Trophy Room
  let conferenceChampions: GazetteStory[] | null = null;
  try {
    const {
      shouldSplashConferenceChamps,
      computeDivisionChampions,
      buildConferenceChampionStories,
      engraveDivisionChampions,
    } = await import("./division-champions");
    const sportNow = getLeague()?.sportId || "cfb";
    if (shouldSplashConferenceChamps(weekIndex, sportNow)) {
      const champs = computeDivisionChampions(players, sportNow);
      if (champs.length) {
        conferenceChampions = buildConferenceChampionStories(champs, {
          sportId: sportNow,
          weekIndex,
          seasonYear: defaultSeasonYear(),
        });
        // Auto-engrave (ops / host scoring path)
        await engraveDivisionChampions(players, {
          weekNumber: weekIndex,
        });
      }
    }
  } catch {
    conferenceChampions = null;
  }

  // Biggest climber / freefall for the paper's "Movers" box
  let swing: GazetteStory | null = null;
  try {
    const ranked = rankPlayersWithSwings(
      players,
      getLeague()?.sportId
    ).filter((p) => !p.isMock);
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
          ? byWeek(SWING_UP_HEADLINES, weekIndex, 0, "swing_up_headlines")(
              star.name,
              star.swing.delta,
              star.swing.text
            )
          : byWeek(SWING_DOWN_HEADLINES, weekIndex, 0, "swing_down_headlines")(
              star.name,
              Math.abs(star.swing.delta),
              star.swing.text
            ),
        deck: up
          ? byWeek(SWING_UP_DECKS, weekIndex, 0, "swing_up_decks")(
              star.swing.delta,
              star.rank,
              star.swing.text
            )
          : byWeek(SWING_DOWN_DECKS, weekIndex, 0, "swing_down_decks")(
              Math.abs(star.swing.delta),
              star.rank,
              star.swing.text
            ),
      };
    }
  } catch {
    swing = null;
  }

  const rivalryWatch = buildGazetteRivalryWatch(players);

  const leagueName = getLeague()?.name || "War Room";
  const year = defaultSeasonYear();
  const sportId = getLeague()?.sportId || "cfb";
  const wwc = sportId === "soccer_wwc";
  const nfl = sportId === "nfl";

  // Early weeks: one tight page (want next issue, not homework)
  // WWC: still keep a tight paper early; full desk from matchday 2
  let flavor: "slim" | "full" = "full";
  try {
    const { gazetteFlavorLevel, markSeasonComeAlive } = await import(
      "./first-week"
    );
    flavor = gazetteFlavorLevel(weekIndex);
    // Scored week exists → unlock personality layer for the room
    markSeasonComeAlive();
  } catch {
    flavor = weekIndex <= 1 ? "slim" : "full";
  }

  const classifiedCtx = {
    crown: cn,
    shame: sn,
    league: leagueName,
    pts: cp,
  };

  // --- NFL Sunday paper — own headlines & sass (not CFB recycled) ---
  if (nfl) {
    const {
      NFL_CROWN_HEADLINES,
      NFL_CROWN_DECKS,
      NFL_SHAME_HEADLINES,
      NFL_SHAME_DECKS,
      NFL_EDITION_TAGLINES,
      NFL_WEATHER_BOXES,
      NFL_CLASSIFIEDS,
      NFL_PULL_QUOTES,
      NFL_SIDE_STORIES,
      NFL_NO_LOCK_HEADLINES,
      NFL_NO_LOCK_DECKS,
      NFL_SWING_UP_HEADLINES,
      NFL_SWING_UP_DECKS,
      NFL_SWING_DOWN_HEADLINES,
      NFL_SWING_DOWN_DECKS,
    } = await import("./sports/nfl-voice");

    const tagline = byWeek(NFL_EDITION_TAGLINES, weekIndex, 0, "nfl_edition_taglines");
    const weather = byWeek(NFL_WEATHER_BOXES, weekIndex, 1, "nfl_weather_boxes");
    const classifieds =
      flavor === "slim"
        ? [byWeek(NFL_CLASSIFIEDS, weekIndex, 0, "nfl_classifieds")(classifiedCtx)]
        : [
            byWeek(NFL_CLASSIFIEDS, weekIndex, 0, "nfl_classifieds"),
            byWeek(NFL_CLASSIFIEDS, weekIndex, 1, "nfl_classifieds"),
            byWeek(NFL_CLASSIFIEDS, weekIndex, 2, "nfl_classifieds"),
          ].map((fn) => fn(classifiedCtx));
    const pullQuote = byWeek(NFL_PULL_QUOTES, weekIndex, 1, "nfl_pull_quotes")({
      crown: cn,
      shame: sn,
      pts: cp,
    });
    const sideCtx: SideStoryCtx = {
      crown: cn,
      shame: sn,
      league: leagueName,
      pts: cp,
      weekLabel,
    };
    const sideStories: GazetteSideStory[] =
      flavor === "slim"
        ? [byWeek(NFL_SIDE_STORIES, weekIndex, 0, "nfl_side_stories")(sideCtx)]
        : [
            byWeek(NFL_SIDE_STORIES, weekIndex, 0, "nfl_side_stories")(sideCtx),
            byWeek(NFL_SIDE_STORIES, weekIndex, 1, "nfl_side_stories")(sideCtx),
          ];

    const nflCrown: GazetteStory = {
      ...crown,
      headline: data.samePerson
        ? byWeek(NFL_CROWN_HEADLINES, weekIndex, 0, "nfl_crown_headlines")(cn, cp)
        : byWeek(NFL_CROWN_HEADLINES, weekIndex, 0, "nfl_crown_headlines")(cn, cp),
      deck: byWeek(NFL_CROWN_DECKS, weekIndex, 0, "nfl_crown_decks")(cp),
    };
    let nflShame: GazetteStory | null = shame;
    if (shame && !data.samePerson) {
      nflShame = {
        ...shame,
        headline: byWeek(NFL_SHAME_HEADLINES, weekIndex, 0, "nfl_shame_headlines")(sn, sp),
        deck: byWeek(NFL_SHAME_DECKS, weekIndex, 0, "nfl_shame_decks")(sp),
      };
    }

    // Ghosts / movers — re-voice so dual-sport rooms don't hear campus copy twice
    let nflNoLock: GazetteStory | null = noLock;
    if (noLock) {
      const label = formatNameList(noLock.names);
      nflNoLock = {
        ...noLock,
        headline: byWeek(NFL_NO_LOCK_HEADLINES, weekIndex, 3, "nfl_no_lock_headlines")(label),
        deck: byWeek(NFL_NO_LOCK_DECKS, weekIndex, 3, "nfl_no_lock_decks")(noLock.names.length),
      };
    }

    let nflSwing: GazetteStory | null = swing;
    if (swing) {
      try {
        const ranked = rankPlayersWithSwings(
      players,
      getLeague()?.sportId
    ).filter((p) => !p.isMock);
        const star = ranked.find(
          (p) => p.name.toLowerCase() === (swing!.names[0] || "").toLowerCase()
        );
        if (star) {
          const up = star.swing.delta > 0;
          const d = Math.abs(star.swing.delta);
          nflSwing = {
            ...swing,
            headline: up
              ? byWeek(NFL_SWING_UP_HEADLINES, weekIndex, 0, "nfl_swing_up_headlines")(
                  star.name,
                  d,
                  star.swing.text
                )
              : byWeek(NFL_SWING_DOWN_HEADLINES, weekIndex, 0, "nfl_swing_down_headlines")(
                  star.name,
                  d,
                  star.swing.text
                ),
            deck: up
              ? byWeek(NFL_SWING_UP_DECKS, weekIndex, 0, "nfl_swing_up_decks")(
                  d,
                  star.rank,
                  star.swing.text
                )
              : byWeek(NFL_SWING_DOWN_DECKS, weekIndex, 0, "nfl_swing_down_decks")(
                  d,
                  star.rank,
                  star.swing.text
                ),
          };
        }
      } catch {
        /* keep CFB-built swing as last resort */
      }
    }

    const ritualName = ritualEditionNameNfl();
    const printedLine = `${ritualName.toUpperCase()} · ${weekLabel.toUpperCase()} · ${year} · ${leagueName.toUpperCase()} · PRIMETIME DESK · NOT CAMPUS`;

    return {
      weekIndex,
      weekLabel,
      volumeLabel: `Sunday Edition · Vol. ${weekIndex + 1} · ${weekLabel} · ${year}`,
      masthead: "THE WAR ROOM · SUNDAY",
      ritualName,
      tagline,
      printedLine,
      weather,
      classifieds,
      pullQuote,
      sideStories,
      samePerson: data.samePerson,
      crown: nflCrown,
      shame: nflShame,
      standingsDeadlock,
      noLock: nflNoLock,
      crystalBallMiss: null, // no Crystal Ball in NFL packs by default
      swing: nflSwing,
      rivalryWatch,
      chaosDetonation,
      conferenceChampions,
      sportId: "nfl",
      stampLine: conferenceChampions?.length
        ? "DIVISION CLINCH · EXTRA"
        : "Extra · Extra",
      eventLine: conferenceChampions?.length
        ? "Division titles locked · engraved in the Trophy Room"
        : "Pro football · primetime desk · not college",
      rareEgg: eggs.rareEgg,
      secretLetter: eggs.secretLetter,
    };
  }

  // --- World Cup Edition voice (same engine, different newspaper) ---
  if (wwc) {
    const tagline = byWeek(WWC_EDITION_TAGLINES, weekIndex, 0, "wwc_edition_taglines");
    const weather = byWeek(WWC_WEATHER_BOXES, weekIndex, 1, "wwc_weather_boxes");
    const classifieds =
      flavor === "slim"
        ? [byWeek(WWC_CLASSIFIEDS, weekIndex, 0, "wwc_classifieds")(classifiedCtx)]
        : [
            byWeek(WWC_CLASSIFIEDS, weekIndex, 0, "wwc_classifieds"),
            byWeek(WWC_CLASSIFIEDS, weekIndex, 1, "wwc_classifieds"),
            byWeek(WWC_CLASSIFIEDS, weekIndex, 2, "wwc_classifieds"),
          ].map((fn) => fn(classifiedCtx));
    const pullQuote = byWeek(WWC_PULL_QUOTES, weekIndex, 2, "wwc_pull_quotes")({
      crown: cn,
      shame: sn,
      pts: cp,
    });
    const sideCtx: SideStoryCtx = {
      crown: cn,
      shame: sn,
      league: leagueName,
      pts: cp,
      weekLabel,
    };
    const sideStories: GazetteSideStory[] =
      flavor === "slim"
        ? [byWeek(WWC_SIDE_STORIES, weekIndex, 0, "wwc_side_stories")(sideCtx)]
        : [
            byWeek(WWC_SIDE_STORIES, weekIndex, 0, "wwc_side_stories")(sideCtx),
            byWeek(WWC_SIDE_STORIES, weekIndex, 1, "wwc_side_stories")(sideCtx),
          ];

    // Tournament-splash headlines on top of scored results
    const wwcCrown: GazetteStory = {
      ...crown,
      headline: byWeek(WWC_CROWN_HEADLINES, weekIndex, 0, "wwc_crown_headlines")(cn, cp),
      deck: byWeek(WWC_CROWN_DECKS, weekIndex, 0, "wwc_crown_decks")(cp),
    };
    let wwcShame: GazetteStory | null = shame;
    if (shame) {
      wwcShame = {
        ...shame,
        headline: byWeek(WWC_SHAME_HEADLINES, weekIndex, 0, "wwc_shame_headlines")(sn, sp),
        deck: byWeek(WWC_SHAME_DECKS, weekIndex, 0, "wwc_shame_decks")(sp),
      };
    }

    const ritualName = ritualEditionNameWwc();
    const printedLine = `EXTRA! · ${ritualName.toUpperCase()} · ${weekLabel.toUpperCase()} · FIFA WOMEN'S WORLD CUP BRAZIL 2027™ · ${leagueName.toUpperCase()} · NOT FIT FOR FRAMING`;

    return {
      weekIndex,
      weekLabel,
      volumeLabel: `WORLD CUP EDITION · Matchday ${weekIndex + 1} · ${weekLabel} · Brazil 2027`,
      masthead: "WORLD CUP EDITION",
      ritualName,
      tagline,
      printedLine,
      weather,
      classifieds,
      pullQuote,
      sideStories,
      samePerson: data.samePerson,
      crown: wwcCrown,
      shame: wwcShame,
      standingsDeadlock,
      noLock,
      crystalBallMiss,
      swing,
      rivalryWatch,
      chaosDetonation,
      conferenceChampions: null,
      sportId: "soccer_wwc",
      stampLine: "EXTRA!",
      eventLine: "FIFA Women's World Cup Brazil 2027™ · War Room desk",
      rareEgg: eggs.rareEgg,
      secretLetter: eggs.secretLetter,
    };
  }

  // --- Classic CFB War Room Gazette ---
  const tagline = byWeek(EDITION_TAGLINES, weekIndex, 0, "edition_taglines");
  const weather = byWeek(WEATHER_BOXES, weekIndex, 2, "weather_boxes");

  const classifieds =
    flavor === "slim"
      ? [byWeek(CLASSIFIEDS_A, weekIndex, 0, "classifieds_a")(classifiedCtx)]
      : [
          byWeek(CLASSIFIEDS_A, weekIndex, 0, "classifieds_a"),
          byWeek(CLASSIFIEDS_B, weekIndex, 1, "classifieds_b"),
          byWeek(CLASSIFIEDS_C, weekIndex, 2, "classifieds_c"),
        ].map((fn) => fn(classifiedCtx));
  const pullQuote = byWeek(PULL_QUOTES, weekIndex, 4, "pull_quotes")({
    crown: cn,
    shame: sn,
    pts: cp,
  });

  // The front page is community-first, so even a slim early edition needs one
  // contextual non-sports lead. Full editions add the absurd second column.
  const sideCtx: SideStoryCtx = {
    crown: cn,
    shame: sn,
    league: leagueName,
    pts: cp,
    weekLabel,
  };
  const sideStories: GazetteSideStory[] =
    flavor === "slim"
      ? [byWeek(SIDE_STORIES_NAMED, weekIndex, 0, "side_stories_named")(sideCtx)]
      : [
          byWeek(SIDE_STORIES_NAMED, weekIndex, 0, "side_stories_named")(sideCtx),
          byWeek(SIDE_STORIES_ABSURD, weekIndex, 1, "side_stories_absurd")(sideCtx),
        ];

  const ritualName = ritualEditionName();
  const printedLine = `${ritualName.toUpperCase()} · ${weekLabel.toUpperCase()} · ${year} SEASON · ${leagueName.toUpperCase()} · NOT FIT FOR FRAMING (BUT YOU WILL)`;

  return {
    weekIndex,
    weekLabel,
    volumeLabel: conferenceChampions?.length
      ? `CONFERENCE CHAMPS EXTRA · Vol. ${weekIndex + 1} · ${weekLabel} · ${year}`
      : `${ritualName} · Vol. ${weekIndex + 1} · ${weekLabel} · ${year}`,
    masthead: "THE WAR ROOM GAZETTE",
    ritualName,
    tagline: conferenceChampions?.length
      ? "CONFERENCE TITLE NIGHT · the paper that yells in all caps (affectionately)"
      : tagline,
    printedLine: conferenceChampions?.length
      ? `CONFERENCE CHAMPS · ${weekLabel.toUpperCase()} · ${year} · ${leagueName.toUpperCase()} · ENGRAVED IN THE TROPHY ROOM`
      : printedLine,
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
    rivalryWatch,
    chaosDetonation,
    conferenceChampions,
    sportId: "cfb",
    stampLine: conferenceChampions?.length
      ? "CONFERENCE CHAMPS · EXTRA"
      : "Extra · Extra",
    eventLine: conferenceChampions?.length
      ? "Titles locked · auto-engraved in the Trophy Room"
      : undefined,
    rareEgg: eggs.rareEgg,
    secretLetter: eggs.secretLetter,
  };
}

/** One-tap share / paste into the group chat. */
export function formatGazetteShareText(edition: GazetteEdition): string {
  const confLines =
    edition.conferenceChampions?.flatMap((c) => [
      `🛡️ ${c.headline}`,
      c.deck,
      "",
    ]) || [];
  const lines = [
    `📰 ${edition.masthead}`,
    edition.ritualName
      ? `${edition.ritualName} · ${edition.volumeLabel}`
      : edition.volumeLabel,
    edition.tagline,
    "",
    ...confLines,
    `★ ${edition.crown.headline}`,
    edition.crown.deck,
    "",
  ];
  // Chaos lock-in sits high — Monday-morning “first thing” energy in the chat paste too
  if (edition.chaosDetonation) {
    lines.push(
      `💥 ${edition.chaosDetonation.headline}`,
      edition.chaosDetonation.deck,
      ""
    );
  }
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
  lines.push(
    "",
    "War Room Pick'Em · friend leagues · confidence · Best Bet · Toilet Bowl",
    "Don't ghost next week."
  );
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

// NFL Sunday paper banks live in ./sports/nfl-voice (not duplicated here).

// ——— FIFA WWC Brazil 2027™ paper banks (ESPN-event energy) ———

const WWC_EDITION_TAGLINES: string[] = [
  "WORLD CUP EDITION · all the news that fits the pitch",
  "EXTRA! · Brazil 2027 · feelings will be hurt in 90+ stoppage",
  "From the group stage to your group chat",
  "Printed in emerald, gold, and pure chaos",
  "Not FIFA official. Extremely unofficially savage.",
  "If you locked, you survived the whistle. Maybe.",
  "Special event desk · War Room press box · Brasil",
  "Penalties optional. Dignity optional. Locks mandatory.",
  "Breaking: someone actually read the card",
  "Subscription: one matchday, infinite opinions",
  "We report the board. You rewrite history.",
  "Weather in Rio of emotions: always stormy",
];

const WWC_WEATHER_BOXES: { kicker: string; body: string }[] = [
  {
    kicker: "Brasil forecast",
    body: "High: emerald heat. Low: royal-blue despair. Chance of gold for the crown. Pack sun and excuses.",
  },
  {
    kicker: "Matchday conditions",
    body: "Humid opinions. Sudden collapses. Late drama. 100% chance someone says “group of death.”",
  },
  {
    kicker: "Pitch report",
    body: "Surface: slick. Offside: your confidence. VAR: the standings. Crowd: the Locker Room.",
  },
];

const WWC_CROWN_HEADLINES: ((n: string, p: number) => string)[] = [
  (n, p) => `${n.toUpperCase()} ROLLS — ${p} PTS`,
  (n, p) => `${n.toUpperCase()} SURVIVES THE CHAOS (${p})`,
  (n, p) => `GOLD FOR ${n.toUpperCase()} · ${p} ON THE CARD`,
  (n, p) => `${n.toUpperCase()} RUNS THE TABLE FEEL (${p} PTS)`,
  (n, p) => `EXTRA! ${n.toUpperCase()} TOPS THE MATCHDAY — ${p}`,
  (n, p) => `${n.toUpperCase()} LOOKS UNTOUCHABLE (${p})`,
];

const WWC_CROWN_DECKS: ((p: number) => string)[] = [
  (p) => `Matchday masterclass. ${p} points. The room is not okay.`,
  (p) => `That’s a statement card. ${p} on the board. Cue the highlight package.`,
  (p) => `Clinic. ${p} pts. Someone print a Brazil jersey with their name.`,
];

const WWC_SHAME_HEADLINES: ((n: string, p: number) => string)[] = [
  (n, p) => `CHAOS FINDS ${n.toUpperCase()} — ONLY ${p}`,
  (n, p) => `${n.toUpperCase()} ELIMINATED FROM DIGNITY (${p})`,
  (n, p) => `GROUP OF DEATH CLAIMS ${n.toUpperCase()} · ${p} PTS`,
  (n, p) => `${n.toUpperCase()} BOTTLES IT — ${p} ON THE CARD`,
  (n, p) => `PENALTY ENERGY FOR ${n.toUpperCase()} (${p})`,
];

const WWC_SHAME_DECKS: ((p: number) => string)[] = [
  (p) => `${p} points. That’s a red card from the math department.`,
  (p) => `Rough night in Brasil. ${p} pts. The paper still loves you (meanly).`,
  (p) => `Not sent off — just sent to the standings basement. ${p}.`,
];

const WWC_PULL_QUOTES: ((ctx: {
  crown: string;
  shame: string;
  pts: number;
}) => { text: string; by: string })[] = [
  (c) => ({
    text: `"Trust the process."`,
    by: `${c.crown}, currently the process`,
  }),
  (c) => ({
    text: `"It's coming home."`,
    by: `Someone who locked ${c.pts} and forgot the rest`,
  }),
  (c) => ({
    text: `"We go again."`,
    by: c.shame || "The bottom of the table",
  }),
];

const WWC_CLASSIFIEDS: ((ctx: {
  crown: string;
  shame: string;
  league: string;
  pts: number;
}) => string)[] = [
  (c) =>
    `WANTED: one clean sheet of picks. Last seen near ${c.crown}'s card. Reward: respect.`,
  (c) =>
    `LOST: group-stage dignity. If found, return to ${c.shame || "the cut line"}. No questions.`,
  (c) =>
    `FOR SALE: hot takes, barely used. ${c.league} desk. Pay in Locker Room reactions.`,
  (c) =>
    `NOTICE: VAR reviewed ${c.crown}'s week. Decision stands. (${c.pts} pts, deal with it.)`,
];

const WWC_SIDE_STORIES: ((ctx: SideStoryCtx) => GazetteSideStory)[] = [
  (ctx) => ({
    kicker: "Group C desk",
    headline: "CHAOS IN GROUP C",
    body: `Sources confirm the only group harder than Group C is ${ctx.league}'s group chat after ${ctx.crown} posted ${ctx.pts}. ${ctx.shame ? `${ctx.shame} declined comment.` : "No one declined comment — everyone yelled."}`,
  }),
  (ctx) => ({
    kicker: "Breaking · pitch-side",
    headline: "USA SURVIVES PENALTIES (METAPHORICALLY)",
    body: `Nobody took actual pens. ${ctx.crown} just survived the card while half the room needed a wall. Matchday energy. Zero chill.`,
  }),
  (ctx) => ({
    kicker: "Host nation watch",
    headline: "BRAZIL ROLLS — IN SPIRIT",
    body: `The host nation is a vibe. ${ctx.crown} borrowed it for ${ctx.pts} points. Emerald. Gold. Unfair.`,
  }),
  (ctx) => ({
    kicker: "Also true",
    headline: "LOCKOUTS MORE DRAMATIC THAN EXTRA TIME",
    body: `First whistle freezes the slate. Miss it and you’re a milk carton, not a knockout hero. ${ctx.weekLabel} will not be taking questions.`,
  }),
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
