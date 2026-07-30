import type { Player } from "./types";
import { weekCrownAndShame, type CrownShame } from "./fun-board";
import { weekTitle } from "./dates";
import { getSession } from "./league";
import { hasSeenRules } from "./rules";
import { createClient } from "@/lib/supabase/client";

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

/** Counts for tests / commissioner sanity checks. */
export const GAZETTE_COPY_COUNTS = {
  crownHeadlines: CROWN_HEADLINES.length,
  crownDecks: CROWN_DECKS.length,
  shameHeadlines: SHAME_HEADLINES.length,
  shameDecks: SHAME_DECKS.length,
  standingsTieHeadlines: STANDINGS_TIE_HEADLINES.length,
  standingsTieDecks: STANDINGS_TIE_DECKS.length,
} as const;

/**
 * Build a one-sheet edition from latest scored week, or null if nothing to show.
 *
 * Headlines:
 * 1) Killer (or rough) week — single name for high/low on the card
 * 2) Optional: overall standings #1 multi-way tie (season totalPoints)
 * Weekly multi-way same scores do NOT get special deadlock copy.
 */
export function buildGazetteEdition(players: Player[]): GazetteEdition | null {
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

  return {
    weekIndex,
    weekLabel,
    volumeLabel: `Vol. ${weekIndex} · ${weekLabel}`,
    masthead: "THE WAR ROOM GAZETTE",
    samePerson: data.samePerson,
    crown,
    shame,
    standingsDeadlock,
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
    const edition = buildGazetteEdition(players);
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

export type { CrownShame };
