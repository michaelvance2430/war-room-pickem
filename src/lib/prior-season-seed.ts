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

import { awardTrophy, loadLeagueTrophies, type TrophyType } from "@/lib/trophies";
import { loadLeagueRoster } from "@/lib/cloud";
import { getSession } from "@/lib/league";

/** CFB campaign year (2025–26 season → 2025 in Trophy Room). */
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
    namePatterns: [/\bjustin\s+strayer\b/i, /\bstrayer\b/i],
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
  if (!session?.leagueId || !session.isCommissioner) {
    return {
      ok: false,
      message: "Commissioner only — open the league as host first.",
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
