/**
 * Seed last Excel / friend-group season into THIS league's Trophy Room.
 *
 * Full 2025–26 season (fall 2025 → winter 2026; stored as season_year 2025):
 *  - Championship → Kahmann
 *  - Toilet Bowl → Justin Strayer
 *  - Village Nerd (Crystal Ball) → Big Ball Ben / Bill ball Ben
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
import { getSession } from "@/lib/league";

/** CFB campaign year (2025–26 season → 2025 in Trophy Room / Museum). */
export const PRIOR_SEASON_YEAR = 2025;
export const PRIOR_SEASON_LABEL = "2025–26";

type SeedRow = {
  trophyType: TrophyType;
  winnerName: string;
  namePatterns: RegExp[];
  subtitle: string;
  notes: string;
};

/** Confirmed 2025–26 Excel season hardware for this friend group. */
export const PRIOR_SEASON_2025_SEEDS: SeedRow[] = [
  {
    trophyType: "championship",
    winnerName: "Kahmann",
    namePatterns: [/\bkahmann\b/i],
    subtitle: `War Room Champion · ${PRIOR_SEASON_LABEL}`,
    notes: `Reigning champ — full ${PRIOR_SEASON_LABEL} season (Excel era). The board still remembers.`,
  },
  {
    trophyType: "toilet_bowl",
    winnerName: "Justin Strayer",
    // Joined as "Jstray" — keep full name engraved, match live profile aliases
    namePatterns: [
      /\bjustin\s+strayer\b/i,
      /\bstrayer\b/i,
      /\bjstray\b/i,
      /^j\s*stray$/i,
    ],
    subtitle: `Toilet Bowl · ${PRIOR_SEASON_LABEL}`,
    notes: `Bottom-half crown · ${PRIOR_SEASON_LABEL}. Still hardware. Wear it proudly.`,
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
  },
];

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

/** True when champ + toilet + nerd are already engraved for the Excel year. */
export function hasPriorSeasonBigHardware(trophies: LeagueTrophy[]): boolean {
  const y = trophies.filter((t) => t.seasonYear === PRIOR_SEASON_YEAR);
  return (
    y.some((t) => t.trophyType === "championship") &&
    y.some((t) => t.trophyType === "toilet_bowl") &&
    y.some((t) => t.trophyType === "crystal_ball")
  );
}

/**
 * Fill any missing Excel-era plaques for Museum / history display.
 * Does not write to the DB — use seedPriorSeason2025Trophies for that.
 * Links winnerUserId when roster/player names match (incl. late joiners like Jstray).
 */
export function mergePriorSeasonTrophies(
  trophies: LeagueTrophy[],
  opts?: { players?: { id: string; name: string }[] }
): LeagueTrophy[] {
  const out = trophies.map((t) => ({ ...t }));
  for (const row of PRIOR_SEASON_2025_SEEDS) {
    const idx = out.findIndex(
      (t) =>
        t.seasonYear === PRIOR_SEASON_YEAR && t.trophyType === row.trophyType
    );
    if (idx >= 0) {
      // Late join: link profile id when missing (Jstray → toilet, etc.)
      if (!out[idx].winnerUserId) {
        const uid = matchPlayerId(opts?.players, row.namePatterns);
        if (uid) out[idx] = { ...out[idx], winnerUserId: uid };
      }
      continue;
    }
    out.push({
      id: `prior-seed-${row.trophyType}`,
      leagueId: "prior-excel",
      seasonYear: PRIOR_SEASON_YEAR,
      trophyType: row.trophyType,
      winnerName: row.winnerName,
      winnerUserId: matchPlayerId(opts?.players, row.namePatterns),
      subtitle: row.subtitle,
      notes: row.notes,
      // After Excel season closed (winter 2026)
      awardedAt: "2026-01-20T12:00:00.000Z",
    });
  }
  return out;
}

/**
 * Patterns that match a live display name to an engraved Excel winner.
 * Used when holders rebrand (Justin Strayer → Jstray).
 */
export function excelHolderPatternsForName(engravedName: string): RegExp[] {
  const row = PRIOR_SEASON_2025_SEEDS.find(
    (s) => s.winnerName.toLowerCase() === (engravedName || "").toLowerCase()
  );
  if (row) return row.namePatterns;
  // Also try loose contains
  for (const s of PRIOR_SEASON_2025_SEEDS) {
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
 * Re-upsert Excel trophies so winner_user_id links when someone joins later
 * (e.g. Jstray = Justin Strayer Toilet Bowl). Commissioner/ops.
 * Safe to re-run — keeps engraving, refreshes profile link.
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
 * Engrave 2025 plaques into the active league. Commissioner/ops only.
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
      message: "Commissioner or ops only — open the league as host first.",
      awarded: [],
      errors: ["Not commissioner"],
    };
  }

  let roster: { userId: string; name: string; isBot?: boolean }[] = [];
  try {
    roster = await loadLeagueRoster();
  } catch {
    roster = [];
  }

  const awarded: string[] = [];
  const errors: string[] = [];

  for (const row of PRIOR_SEASON_2025_SEEDS) {
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

  // Confirm load
  try {
    const list = await loadLeagueTrophies();
    const y25 = list.filter((t) => t.seasonYear === PRIOR_SEASON_YEAR);
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

  return {
    ok: true,
    message: `${PRIOR_SEASON_LABEL} hardware locked in: ${awarded.join(" · ")}. Opening-week ring ceremony can crown Kahmann. Refresh Trophy Room.`,
    awarded,
    errors,
  };
}
