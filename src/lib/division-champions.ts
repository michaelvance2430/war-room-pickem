/**
 * Conference / division champions (CFB: SEC, Big Ten… · NFL: AFC East…).
 * After cut-lock week is scored: funny Gazette splash + auto-engrave Trophy Room.
 */

import type { Player } from "./types";
import {
  DIVISIONS,
  type DivisionName,
  divisionDisplayLabel,
  isDivisionName,
} from "./divisions";
import { cutLockWeek } from "./season-calendar";
import { getLeague } from "./league";
import { defaultSeasonYear, type TrophyType } from "./trophies";
import type { GazetteStory } from "./gazette";

export type DivisionChampion = {
  division: DivisionName;
  /** Sport-facing label: SEC, AFC East, … */
  conferenceLabel: string;
  winner: Player;
  trophyType: TrophyType;
};

const DIVISION_TROPHY_TYPES: Record<DivisionName, TrophyType> = {
  North: "division_north",
  South: "division_south",
  East: "division_east",
  West: "division_west",
};

export function isDivisionTrophyType(t: string): boolean {
  return t.startsWith("division_");
}

export function divisionFromTrophyType(
  t: string
): DivisionName | null {
  if (t === "division_north") return "North";
  if (t === "division_south") return "South";
  if (t === "division_east") return "East";
  if (t === "division_west") return "West";
  return null;
}

/** Top player in each division (season points). Skip empty fields. */
export function computeDivisionChampions(
  players: Player[],
  sportId?: string | null
): DivisionChampion[] {
  const sid = sportId || getLeague()?.sportId || "cfb";
  const out: DivisionChampion[] = [];

  for (const div of DIVISIONS) {
    const field = players.filter((p) => {
      if (p.isMock) return false;
      const d = isDivisionName(p.division) ? p.division : "North";
      return d === div;
    });
    if (field.length < 1) continue;

    // Prefer humans who actually played; bots only if no human with points
    const ranked = [...field].sort((a, b) => {
      const pa = a.totalPoints || 0;
      const pb = b.totalPoints || 0;
      if (pb !== pa) return pb - pa;
      const wa = a.weeksPlayed || 0;
      const wb = b.weeksPlayed || 0;
      if (wb !== wa) return wb - wa;
      return (a.name || "").localeCompare(b.name || "");
    });

    const winner = ranked[0];
    if ((winner.totalPoints || 0) <= 0 && (winner.weeksPlayed || 0) <= 0) {
      continue; // nobody real yet
    }

    out.push({
      division: div,
      conferenceLabel: divisionDisplayLabel(div, sid),
      winner,
      trophyType: DIVISION_TROPHY_TYPES[div],
    });
  }
  return out;
}

function hashPick(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return n ? h % n : 0;
}

type ChampCopy = { headline: string; deck: string };

/**
 * One paper, one voice per story — never reuse the same template slot
 * on a single conference-champs edition (looks lazy when ACC = Big 12).
 */
function pickUniqueCopy(
  lines: ChampCopy[],
  seed: string,
  used: Set<number>
): ChampCopy {
  if (!lines.length) {
    return { headline: "Champions crowned.", deck: "The standings did the talking." };
  }
  let idx = hashPick(seed, lines.length);
  for (let step = 0; step < lines.length; step++) {
    const tryIdx = (idx + step) % lines.length;
    if (!used.has(tryIdx)) {
      used.add(tryIdx);
      return lines[tryIdx];
    }
  }
  // More champs than templates (shouldn't happen) — still vary with seed salt
  const fallback = lines[idx % lines.length];
  return {
    headline: fallback.headline,
    deck: `${fallback.deck} (Yes, we know — the desk is out of fresh verbs.)`,
  };
}

/** Funny, not-robot CFB conference champion lines */
function cfbCopyPool(name: string, conf: string): ChampCopy[] {
  return [
    {
      headline: `${name} is your ${conf} champion. Update the group chat. Then update it again.`,
      deck: `The rest of the ${conf} can print “participant” on their résumés. Banner energy only for ${name}.`,
    },
    {
      headline: `BREAKING: ${name} just became ${conf} champions. Dignity optional. Flex mandatory.`,
      deck: `They ran the table in the ${conf} like rent was due. Everyone else is on double-secret probation.`,
    },
    {
      headline: `${name} owns the ${conf}. Tell your cousins. Tell your cousins' group chat.`,
      deck: `Conference title locked. ${name} gets the cool headline. The others get participation vibes and unsolicited advice.`,
    },
    {
      headline: `${conf} CHAMPS: ${name}. The desk is not taking questions. Mostly because we're laughing.`,
      deck: `If your name isn't ${name}, your conference arc is “supporting cast.” Take a lap. Then take another.`,
    },
    {
      headline: `${name} runs the ${conf} now. Campus paper energy. Zero robot energy.`,
      deck: `Season points don't lie. ${name} sat atop the ${conf} and refused to share the oxygen.`,
    },
    {
      headline: `Somebody tell the band: ${name} is ${conf} champions. Somebody tell ${name} to act surprised.`,
      deck: `They knew. We knew. The standings knew. Still feels good to print it huge.`,
    },
    {
      headline: `${conf} race over: ${name} at the top. Everyone else is writing a strongly worded email.`,
      deck: `${name} stacked the ${conf} like it was a side quest. Spoiler: it was the main quest.`,
    },
    {
      headline: `Engrave it: ${name}, ${conf} champion. The paper already did.`,
      deck: `Four conferences. Four bosses. This one is ${name}. The ${conf} can start the offseason early.`,
    },
  ];
}

/** Funny NFL division clinch lines */
function nflCopyPool(name: string, conf: string): ChampCopy[] {
  return [
    {
      headline: `${name} clinches the ${conf}. Late-window gods approve. Softly. Forever.`,
      deck: `Division title secured. ${name} gets the banner. Everyone else is on IR for pride.`,
    },
    {
      headline: `OFFICIAL: ${name} is your ${conf} champ. Flex that one. Don't over-flex. Over-flex is illegal.`,
      deck: `The ${conf} has a boss now. It's ${name}. The standings board just became a shrine.`,
    },
    {
      headline: `${name} takes the ${conf}. Primetime desk is not subtle about this.`,
      deck: `Just ${name} on top of the ${conf} heap. No filler. No soft landings.`,
    },
    {
      headline: `${conf} belongs to ${name}. The rest of the division can practice their “we'll get 'em next year” face.`,
      deck: `Clinched. Engraved. Roasted. ${name} did the work; the paper does the yelling.`,
    },
    {
      headline: `STOP THE PRESSES: ${name} is ${conf} champions. Yes, we're yelling. It's the job.`,
      deck: `Division race over. ${name} wins. Update your fantasy of being better than them.`,
    },
    {
      headline: `${name} locks the ${conf}. Script complete. Credits rolling. Boos optional.`,
      deck: `The ${conf} standings finally stopped twitching. ${name} is the last name standing.`,
    },
    {
      headline: `Division done: ${name} owns the ${conf}. Tape the banner. Unplug the drama.`,
      deck: `${name} closed the ${conf} like a late window. Everyone else is still buffering.`,
    },
    {
      headline: `${conf} champ is ${name}. The desk checked twice. Still true. Still loud.`,
      deck: `No shared template energy. This headline is for ${name} only — ${conf} edition.`,
    },
  ];
}

/** Gazette stories for conference/division clinch edition */
export function buildConferenceChampionStories(
  champs: DivisionChampion[],
  opts: { sportId?: string | null; weekIndex: number; seasonYear: number }
): GazetteStory[] {
  const sid = opts.sportId || "cfb";
  const nfl = sid === "nfl";
  const seedBase = `${opts.seasonYear}:w${opts.weekIndex}`;
  /** Template indices already used on THIS paper */
  const used = new Set<number>();

  return champs.map((c, i) => {
    const name = c.winner.name || "Somebody";
    const conf = c.conferenceLabel;
    const pool = nfl ? nflCopyPool(name, conf) : cfbCopyPool(name, conf);
    const copy = pickUniqueCopy(
      pool,
      `${seedBase}:${name}:${conf}:${c.division}:${i}`,
      used
    );
    return {
      names: [name],
      pts: c.winner.totalPoints || 0,
      kind: "clear" as const,
      headline: copy.headline,
      deck: copy.deck,
    };
  });
}

/**
 * Auto-engrave division/conference titles into Trophy Room.
 * Safe to call after cut-lock week (and re-score). Upserts per division.
 */
export async function engraveDivisionChampions(
  players: Player[],
  opts?: { weekNumber?: number; force?: boolean }
): Promise<{
  ok: boolean;
  engraved: number;
  champs: DivisionChampion[];
  error?: string;
}> {
  const league = getLeague();
  const sportId = league?.sportId || "cfb";
  const cut = cutLockWeek(sportId);
  const week = opts?.weekNumber;

  // Only lock/engrave once cut week is scored (or later re-score)
  if (!opts?.force && week != null && week < cut) {
    return { ok: true, engraved: 0, champs: [] };
  }

  const champs = computeDivisionChampions(players, sportId);
  if (!champs.length) {
    return { ok: true, engraved: 0, champs: [] };
  }

  const year = defaultSeasonYear();
  let engraved = 0;

  try {
    const { awardTrophy } = await import("./trophies");
    for (const c of champs) {
      const conf = c.conferenceLabel;
      const res = await awardTrophy({
        seasonYear: year,
        trophyType: c.trophyType,
        winnerName: c.winner.name,
        winnerUserId: c.winner.id,
        subtitle: `${conf} Champions`,
        notes: `Auto-engraved after cut lock (week ${cut}). ${c.winner.totalPoints || 0} season pts.`,
        allowOps: true,
      });
      if (res.ok) engraved += 1;
    }
  } catch (e) {
    return {
      ok: false,
      engraved,
      champs,
      error: e instanceof Error ? e.message : "Engrave failed",
    };
  }

  return { ok: true, engraved, champs };
}

/** True when this scored week should splash conference champs in the paper */
export function shouldSplashConferenceChamps(
  weekNumber: number,
  sportId?: string | null
): boolean {
  const cut = cutLockWeek(sportId);
  return weekNumber === cut;
}
