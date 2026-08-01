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

/** Funny, not-robot CFB conference champion lines */
function cfbHeadline(name: string, conf: string, seed: string): {
  headline: string;
  deck: string;
} {
  const lines: { headline: string; deck: string }[] = [
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
  ];
  return lines[hashPick(`${seed}:${name}:${conf}`, lines.length)];
}

/** Funny NFL division clinch lines */
function nflHeadline(name: string, conf: string, seed: string): {
  headline: string;
  deck: string;
} {
  const lines: { headline: string; deck: string }[] = [
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
      deck: `No campus filler. No participation ribbons. Just ${name} on top of the ${conf} heap.`,
    },
    {
      headline: `${conf} belongs to ${name}. The rest of the division can practice their “we'll get 'em next year” face.`,
      deck: `Clinched. Engraved. Roasted. ${name} did the work; the paper does the yelling.`,
    },
    {
      headline: `STOP THE PRESSES: ${name} is ${conf} champions. Yes, we're yelling. It's the job.`,
      deck: `Division race over. ${name} wins. Update your fantasy of being better than them.`,
    },
  ];
  return lines[hashPick(`${seed}:${name}:${conf}:nfl`, lines.length)];
}

/** Gazette stories for conference/division clinch edition */
export function buildConferenceChampionStories(
  champs: DivisionChampion[],
  opts: { sportId?: string | null; weekIndex: number; seasonYear: number }
): GazetteStory[] {
  const sid = opts.sportId || "cfb";
  const nfl = sid === "nfl";
  const seed = `${opts.seasonYear}:w${opts.weekIndex}`;

  return champs.map((c) => {
    const name = c.winner.name || "Somebody";
    const conf = c.conferenceLabel;
    const copy = nfl
      ? nflHeadline(name, conf, seed)
      : cfbHeadline(name, conf, seed);
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
