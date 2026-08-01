/**
 * Profile trophy case — career hardware from the league Trophy Room
 * plus legacy engravings (seeded for known winners by display name).
 *
 * Cases:
 *  - Hardware: Championship, Toilet Bowl, Village Nerd
 *  - Division: division titles (North/South/East/West)
 */

import type { LeagueTrophy, TrophyType } from "./trophies";
import { TROPHY_META } from "./trophies";

export type ProfileTrophyKind =
  | "championship"
  | "toilet_bowl"
  | "crystal_ball"
  | "division";

export type ProfileTrophy = {
  id: string;
  kind: ProfileTrophyKind;
  seasonYear: number;
  /** Display title on plaque */
  title: string;
  subtitle?: string | null;
  notes?: string | null;
  /** For division titles */
  division?: string | null;
  winnerName: string;
  source: "league" | "legacy";
};

function normName(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesMatch(a: string, b: string) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // "Bill Ball Ben" vs "Bill Ben" / partial
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  // last token match for "Kahmann" vs "Mike Kahmann"
  if (ta[ta.length - 1] === tb[tb.length - 1] && ta[ta.length - 1].length >= 4) {
    return true;
  }
  return false;
}

/**
 * Legacy / prior-season hardware for this friend group.
 * Matched by display name so it shows even before engraver links a user id.
 * Last CFB season relative to mid-2026 = 2025.
 */
/**
 * Confirmed prior-season hardware only.
 * Kahmann = 2025 champ. Bill ball Ben = Village Nerd.
 * Visconti/Andy is NOT a champ (mistaken swap — revoked).
 */
export const LEGACY_PROFILE_HARDWARE: Omit<ProfileTrophy, "source">[] = [
  {
    id: "legacy-kahmann-championship-2025",
    kind: "championship",
    seasonYear: 2025,
    title: "Championship",
    subtitle: "War Room Champion",
    notes: "Last season's big one. The board still remembers.",
    winnerName: "Kahmann",
  },
  {
    id: "legacy-justin-strayer-toilet-2025",
    kind: "toilet_bowl",
    seasonYear: 2025,
    title: "Toilet Bowl",
    subtitle: "Bottom-half crown",
    notes: "Still a crown. Wear it proudly.",
    winnerName: "Justin Strayer",
  },
  {
    id: "legacy-bill-ball-ben-nerd-2025",
    kind: "crystal_ball",
    seasonYear: 2025,
    title: "Village Nerd Award",
    subtitle: "Crystal Ball prophet",
    notes: "Called the national champ. Zero standings points. Infinite smug.",
    winnerName: "Big Ball Ben",
  },
];

/** Also match these name aliases → legacy id */
const LEGACY_NAME_ALIASES: { pattern: RegExp; legacyId: string }[] = [
  {
    pattern: /\bkahmann\b/i,
    legacyId: "legacy-kahmann-championship-2025",
  },
  {
    pattern: /\bjustin\s+strayer\b|\bstrayer\b/i,
    legacyId: "legacy-justin-strayer-toilet-2025",
  },
  {
    pattern: /\bbig\s*ball\s*ben\b|\bbill\s*ball\s*ben\b|\bbillballben\b/i,
    legacyId: "legacy-bill-ball-ben-nerd-2025",
  },
];

function leagueToProfile(t: LeagueTrophy): ProfileTrophy {
  const meta = TROPHY_META[t.trophyType];
  const isDiv =
    typeof t.trophyType === "string" && t.trophyType.startsWith("division_");
  return {
    id: t.id,
    kind: isDiv ? "division" : (t.trophyType as ProfileTrophyKind),
    seasonYear: t.seasonYear,
    title: isDiv
      ? t.subtitle || meta?.title || "Conference Champions"
      : meta?.title || t.trophyType,
    subtitle: t.subtitle,
    notes: t.notes,
    winnerName: t.winnerName,
    source: "league",
    division: isDiv ? t.subtitle : null,
  };
}

/**
 * Hardware for one player's profile: league Trophy Room rows they won
 * + legacy seeds matched by name.
 */
export function getProfileHardware(opts: {
  playerId: string;
  playerName: string;
  leagueTrophies: LeagueTrophy[];
}): ProfileTrophy[] {
  const { playerId, playerName, leagueTrophies } = opts;
  const out: ProfileTrophy[] = [];
  const seen = new Set<string>();

  // From engraved Trophy Room (this league)
  for (const t of leagueTrophies) {
    const byId = t.winnerUserId && t.winnerUserId === playerId;
    const byName = namesMatch(t.winnerName, playerName);
    if (!byId && !byName) continue;
    const row = leagueToProfile(t);
    // Dedupe kind+year (+ subtitle for multi division titles)
    const key = `${row.kind}:${row.seasonYear}:${row.subtitle || row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  // Legacy seeds by name / alias
  for (const legacy of LEGACY_PROFILE_HARDWARE) {
    const key = `${legacy.kind}:${legacy.seasonYear}`;
    if (seen.has(key)) continue;
    const direct = namesMatch(legacy.winnerName, playerName);
    const alias = LEGACY_NAME_ALIASES.some(
      (a) => a.legacyId === legacy.id && a.pattern.test(playerName)
    );
    if (!direct && !alias) continue;
    seen.add(key);
    out.push({ ...legacy, source: "legacy" });
  }

  return out.sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
    return a.kind.localeCompare(b.kind);
  });
}

export function splitHardwareCases(items: ProfileTrophy[]): {
  bigGame: ProfileTrophy[];
  division: ProfileTrophy[];
} {
  return {
    bigGame: items.filter((i) => i.kind !== "division"),
    division: items.filter((i) => i.kind === "division"),
  };
}

export const HARDWARE_KIND_META: Record<
  ProfileTrophyKind,
  { emoji: string; accent: string; border: string; emptyLabel: string }
> = {
  championship: {
    emoji: "🏆",
    accent: "text-amber-300",
    border: "border-amber-400/40",
    emptyLabel: "No championships yet",
  },
  toilet_bowl: {
    emoji: "🚽",
    accent: "text-toilet",
    border: "border-toilet/40",
    emptyLabel: "No Toilet Bowls… yet",
  },
  crystal_ball: {
    emoji: "🔮",
    accent: "text-sky-300",
    border: "border-sky-400/40",
    emptyLabel: "No Village Nerd awards",
  },
  division: {
    emoji: "🛡️",
    accent: "text-primary",
    border: "border-primary/40",
    emptyLabel: "No division titles yet",
  },
};

/** Kinds shown in the big-game case (ordered). */
export const BIG_GAME_KINDS: ProfileTrophyKind[] = [
  "championship",
  "toilet_bowl",
  "crystal_ball",
];

/** Tiny standings flair for players with career hardware. */
export function standingsHardwareFlair(playerName: string): {
  emoji: string;
  title: string;
}[] {
  const items = getProfileHardware({
    playerId: "",
    playerName,
    leagueTrophies: [],
  });
  const flair: { emoji: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const h of items) {
    if (seen.has(h.kind)) continue;
    seen.add(h.kind);
    const meta = HARDWARE_KIND_META[h.kind];
    flair.push({
      emoji: meta.emoji,
      title: `${h.seasonYear} ${h.title}`,
    });
  }
  return flair;
}
