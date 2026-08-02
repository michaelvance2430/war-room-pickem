/**
 * Seed last season hardware into THIS league's Trophy Room.
 *
 * CFB (Excel 2025–26, season_year 2025):
 *  - Championship → Kahmann
 *  - Toilet Bowl → Justin Strayer
 *  - Village Nerd (Crystal Ball) → Big Ball Ben
 *
 * NFL (2025 season Super Bowl → season_year 2025):
 *  - Championship → Maria (defending Super Bowl champ; ring at Week 1 open)
 *
 * Safe to re-run (upsert by league+year+type). Links winner_user_id when
 * a roster display name matches.
 */

import {
  awardTrophy,
  loadLeagueTrophies,
  type LeagueTrophy,
  type TrophyType,
} from "@/lib/trophies";
import { loadLeagueRoster } from "@/lib/cloud";
import { getLeague, getSession } from "@/lib/league";

/** Campaign year stored on plaques (CFB 2025–26 / NFL 2025 SB). */
export const PRIOR_SEASON_YEAR = 2025;
export const PRIOR_SEASON_LABEL = "2025–26";
export const NFL_PRIOR_SEASON_LABEL = "2025";

type SeedRow = {
  trophyType: TrophyType;
  winnerName: string;
  namePatterns: RegExp[];
  subtitle: string;
  notes: string;
  /** ISO when the hardware was earned (display / sort) */
  awardedAt?: string;
};

/** Confirmed CFB Excel-era hardware for this friend group. */
export const PRIOR_SEASON_2025_SEEDS: SeedRow[] = [
  {
    trophyType: "championship",
    winnerName: "Kahmann",
    namePatterns: [/\bkahmann\b/i],
    subtitle: `War Room Champion · ${PRIOR_SEASON_LABEL}`,
    notes: `Reigning champ — full ${PRIOR_SEASON_LABEL} season (Excel era). The board still remembers.`,
    awardedAt: "2026-01-20T12:00:00.000Z",
  },
  {
    trophyType: "toilet_bowl",
    winnerName: "Justin Strayer",
    namePatterns: [
      /\bjustin\s+strayer\b/i,
      /\bstrayer\b/i,
      /\bjstray\b/i,
      /^j\s*stray$/i,
    ],
    subtitle: `Toilet Bowl · ${PRIOR_SEASON_LABEL}`,
    notes: `Bottom-half crown · ${PRIOR_SEASON_LABEL}. Still hardware. Wear it proudly.`,
    awardedAt: "2026-01-20T12:00:00.000Z",
  },
  {
    trophyType: "crystal_ball",
    winnerName: "Big Ball Ben",
    namePatterns: [
      /\bbig\s*ball\s*ben\b/i,
      /\bbill\s*ball\s*ben\b/i,
      /\bbillballben\b/i,
    ],
    subtitle: `Village Nerd · Crystal Ball · ${PRIOR_SEASON_LABEL}`,
    notes: `Called the national champ · ${PRIOR_SEASON_LABEL}. Zero standings points. Infinite smug.`,
    awardedAt: "2026-01-20T12:00:00.000Z",
  },
];

/** NFL prior Super Bowl hardware — Maria walks first at Week 1 open. */
export const NFL_PRIOR_SEASON_SEEDS: SeedRow[] = [
  {
    trophyType: "championship",
    winnerName: "Maria",
    namePatterns: [/\bmaria\b/i],
    subtitle: `Super Bowl Champion · ${NFL_PRIOR_SEASON_LABEL}`,
    notes: `Defending Super Bowl champ of this room · ${NFL_PRIOR_SEASON_LABEL} season. Ring ceremony drops at the start of Week 1.`,
    awardedAt: "2026-02-09T12:00:00.000Z",
  },
];

/**
 * Vonnaggio Family Vacation — same Maria 2025 plaque, gold family hardware lore.
 * (Art is league-overridden separately; copy lives here.)
 */
export function decorateNflPriorForLeague(
  trophies: LeagueTrophy[],
  leagueName?: string | null,
  leagueId?: string | null,
  leagueCode?: string | null
): LeagueTrophy[] {
  let vonnaggio = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVonnaggioLeague } =
      require("./league-trophy-override") as typeof import("./league-trophy-override");
    vonnaggio = isVonnaggioLeague(leagueName, leagueId, leagueCode);
  } catch {
    vonnaggio = false;
  }
  if (!vonnaggio) return trophies;
  return trophies.map((t) => {
    if (
      trophySeasonYear(t) !== PRIOR_SEASON_YEAR ||
      t.trophyType !== "championship"
    ) {
      return t;
    }
    return {
      ...t,
      subtitle: `Vonnaggio Champion · ${NFL_PRIOR_SEASON_LABEL}`,
      notes:
        `Family Vacation gold hardware · ${NFL_PRIOR_SEASON_LABEL}. ` +
        `Same trophy from last year's fantasy board — Maria holds it until someone rips it off her. ` +
        `Current season shelf stays empty (grey) until this year's champ is engraved.`,
    };
  });
}

/** @deprecated use getPriorSeasonSeeds — CFB Excel list (back-compat for share resolve) */
export const ALL_PRIOR_SEASON_SEEDS = PRIOR_SEASON_2025_SEEDS;

export function resolvePriorSport(
  sportId?: string | null
): "cfb" | "nfl" {
  if (sportId === "nfl" || sportId === "cfb") return sportId;
  return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
}

export function getPriorSeasonSeeds(sportId?: string | null): SeedRow[] {
  return resolvePriorSport(sportId) === "nfl"
    ? NFL_PRIOR_SEASON_SEEDS
    : PRIOR_SEASON_2025_SEEDS;
}

export function getPriorSeasonLabel(sportId?: string | null): string {
  return resolvePriorSport(sportId) === "nfl"
    ? NFL_PRIOR_SEASON_LABEL
    : PRIOR_SEASON_LABEL;
}

function matchUserId(
  roster: { userId: string; name: string; isBot?: boolean }[],
  patterns: RegExp[]
): string | null {
  for (const m of roster) {
    if (m.isBot) continue;
    const n = m.name || "";
    if (patterns.some((p) => p.test(n))) return m.userId;
  }
  return null;
}

function matchPlayerId(
  players: { id: string; name: string }[] | undefined,
  patterns: RegExp[]
): string | null {
  if (!players?.length) return null;
  for (const p of players) {
    if (patterns.some((re) => re.test(p.name || ""))) return p.id;
  }
  return null;
}

/** Coerce year so "2025" from JSON/DB still matches PRIOR_SEASON_YEAR. */
export function trophySeasonYear(t: { seasonYear?: unknown }): number {
  const y = t?.seasonYear;
  if (typeof y === "number" && Number.isFinite(y)) return y;
  const n = Number.parseInt(String(y ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** True when this sport's prior-season big hardware is already engraved. */
export function hasPriorSeasonBigHardware(
  trophies: LeagueTrophy[],
  sportId?: string | null
): boolean {
  const seeds = getPriorSeasonSeeds(sportId);
  const y = trophies.filter(
    (t) => trophySeasonYear(t) === PRIOR_SEASON_YEAR
  );
  return seeds.every((s) => y.some((t) => t.trophyType === s.trophyType));
}

/**
 * Last season plaques that MUST always be on the wall (display layer).
 * CFB Excel 2025–26: Kahmann / Strayer / Big Ball Ben.
 * NFL 2025: Maria Super Bowl.
 */
export function listLastSeasonDisplayPlaques(opts?: {
  players?: { id: string; name: string }[];
  sportId?: string | null;
}): LeagueTrophy[] {
  const sport = resolvePriorSport(opts?.sportId);
  const seeds = getPriorSeasonSeeds(sport);
  return seeds.map((row) => ({
    id: `prior-seed-${sport}-${row.trophyType}`,
    leagueId: "prior-excel",
    seasonYear: PRIOR_SEASON_YEAR,
    trophyType: row.trophyType,
    winnerName: row.winnerName,
    winnerUserId: matchPlayerId(opts?.players, row.namePatterns),
    subtitle: row.subtitle,
    notes: row.notes,
    awardedAt: row.awardedAt || "2026-01-20T12:00:00.000Z",
  }));
}

/**
 * Fill prior plaques for Museum / history display.
 * FORCE last-year seed winners onto the wall for this sport so they always show
 * (Kahmann / Strayer / Ben on CFB · Maria on NFL). Cloud rows for other years stay.
 */
export function mergePriorSeasonTrophies(
  trophies: LeagueTrophy[],
  opts?: { players?: { id: string; name: string }[]; sportId?: string | null }
): LeagueTrophy[] {
  const sport = resolvePriorSport(opts?.sportId);
  const seeds = getPriorSeasonSeeds(sport);
  const seedTypes = new Set(seeds.map((s) => s.trophyType));

  // Keep everything except prior-year seed slots (we re-inject those)
  const out = trophies.filter(
    (t) =>
      !(
        trophySeasonYear(t) === PRIOR_SEASON_YEAR &&
        seedTypes.has(t.trophyType)
      )
  );

  // Always inject last season hardware first (on display) — even with zero cloud rows
  for (const row of seeds) {
    const uid = matchPlayerId(opts?.players, row.namePatterns);
    // Prefer cloud user id if engraved under the right name
    const cloud = trophies.find(
      (t) =>
        trophySeasonYear(t) === PRIOR_SEASON_YEAR &&
        t.trophyType === row.trophyType &&
        row.namePatterns.some((p) => p.test(t.winnerName || ""))
    );
    out.push({
      id: cloud?.id || `prior-seed-${sport}-${row.trophyType}`,
      leagueId: cloud?.leagueId || "prior-excel",
      seasonYear: PRIOR_SEASON_YEAR,
      trophyType: row.trophyType,
      winnerName: row.winnerName,
      winnerUserId: cloud?.winnerUserId || uid,
      subtitle: row.subtitle,
      notes: row.notes,
      awardedAt: row.awardedAt || cloud?.awardedAt || "2026-01-20T12:00:00.000Z",
    });
  }

  // Vonnagio: Maria's plaque uses family-vacay gold hardware copy
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    const lg = getLeague();
    return decorateNflPriorForLeague(out, lg?.name, lg?.id, lg?.code);
  } catch {
    return out;
  }
}

/**
 * Patterns that match a live display name to an engraved prior winner.
 * Searches both CFB + NFL seed banks (share resolve / late rebrand).
 */
export function excelHolderPatternsForName(engravedName: string): RegExp[] {
  const banks = [...PRIOR_SEASON_2025_SEEDS, ...NFL_PRIOR_SEASON_SEEDS];
  const row = banks.find(
    (s) => s.winnerName.toLowerCase() === (engravedName || "").toLowerCase()
  );
  if (row) return row.namePatterns;
  for (const s of banks) {
    if (
      namesLooseMatch(s.winnerName, engravedName) ||
      s.namePatterns.some((p) => p.test(engravedName || ""))
    ) {
      return s.namePatterns;
    }
  }
  return [];
}

function namesLooseMatch(a: string, b: string) {
  const na = (a || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nb = (b || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Re-upsert prior trophies so winner_user_id links when someone joins later.
 */
export async function relinkPriorSeasonWinners(): Promise<{
  ok: boolean;
  message: string;
  linked: string[];
}> {
  return seedPriorSeason2025Trophies().then((r) => ({
    ok: r.ok,
    message: r.message,
    linked: r.awarded,
  }));
}

/**
 * Engrave prior-season plaques into the active league (sport-aware).
 * Commissioner/ops only.
 */
export async function seedPriorSeason2025Trophies(): Promise<{
  ok: boolean;
  message: string;
  awarded: string[];
  errors: string[];
}> {
  const session = getSession();
  const { isOps } = await import("./league");
  if (!session?.leagueId || !(session.isCommissioner || isOps())) {
    return {
      ok: false,
      message: "Commissioner or ops only — open the league as commish first.",
      awarded: [],
      errors: ["Not commissioner"],
    };
  }

  const sport = resolvePriorSport(getLeague()?.sportId);
  const seeds = getPriorSeasonSeeds(sport);
  const label = getPriorSeasonLabel(sport);

  let roster: { userId: string; name: string; isBot?: boolean }[] = [];
  try {
    roster = await loadLeagueRoster();
  } catch {
    roster = [];
  }

  let existing: LeagueTrophy[] = [];
  try {
    existing = await loadLeagueTrophies();
  } catch {
    existing = [];
  }

  const awarded: string[] = [];
  const errors: string[] = [];

  for (const row of seeds) {
    // NFL: never overwrite a non-Maria 2025 championship (e.g. CFB Excel Kahmann)
    if (sport === "nfl" && row.trophyType === "championship") {
      const cur = existing.find(
        (t) =>
          trophySeasonYear(t) === PRIOR_SEASON_YEAR &&
          t.trophyType === "championship"
      );
      if (
        cur?.winnerName &&
        !/\bmaria\b/i.test(cur.winnerName) &&
        !row.namePatterns.some((p) => p.test(cur.winnerName))
      ) {
        awarded.push(
          `championship: kept ${cur.winnerName} (not overwritten by Maria)`
        );
        continue;
      }
    }

    const uid = matchUserId(roster, row.namePatterns);
    const res = await awardTrophy({
      seasonYear: PRIOR_SEASON_YEAR,
      trophyType: row.trophyType,
      winnerName: row.winnerName,
      winnerUserId: uid,
      subtitle: row.subtitle,
      notes: row.notes,
      allowOps: true,
    });
    if (res.ok) {
      awarded.push(
        `${row.trophyType}: ${row.winnerName}${uid ? " (linked)" : " (name only)"}`
      );
    } else {
      errors.push(`${row.trophyType}: ${res.error || "failed"}`);
    }
  }

  try {
    const list = await loadLeagueTrophies();
    const y25 = list.filter((t) => trophySeasonYear(t) === PRIOR_SEASON_YEAR);
    if (y25.length < 1 && errors.length) {
      return {
        ok: false,
        message: errors.join(" · "),
        awarded,
        errors,
      };
    }
  } catch {
    /* ignore */
  }

  if (awarded.length === 0) {
    return {
      ok: false,
      message: errors[0] || "Nothing engraved",
      awarded,
      errors,
    };
  }

  const crown =
    sport === "nfl"
      ? "Opening Week 1 ring ceremony can crown Maria."
      : "Opening-week ring ceremony can crown Kahmann.";

  return {
    ok: true,
    message: `${sport === "nfl" ? "NFL" : "CFB"} ${label} hardware locked in: ${awarded.join(" · ")}. ${crown} Refresh Trophy Room.`,
    awarded,
    errors,
  };
}
