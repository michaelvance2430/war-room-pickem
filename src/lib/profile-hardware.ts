/**
 * Profile trophy case — career hardware from the league Trophy Room
 * plus legacy engravings (seeded for known winners by display name).
 *
 * Legacy seeds are sport-gated so Maria Super Bowl doesn’t show in CFB
 * rooms and Kahmann Excel hardware doesn’t show as NFL Super Bowl art.
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
  /** For division / conference titles (compass slot) */
  division?: string | null;
  winnerName: string;
  source: "league" | "legacy";
  /** Sport this plaque belongs to (for art / gating) */
  sportId?: "cfb" | "nfl" | null;
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
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  if (ta[ta.length - 1] === tb[tb.length - 1] && ta[ta.length - 1].length >= 4) {
    return true;
  }
  return false;
}

type LegacySeed = Omit<ProfileTrophy, "source"> & {
  /** Which sport desk this seed belongs on */
  sport: "cfb" | "nfl";
};

/**
 * Confirmed prior-season hardware only.
 * CFB 2025–26 Excel: Kahmann / Strayer / Big Ball Ben.
 * NFL 2025: Maria Super Bowl (or Vonnagio gold family form).
 */
export const LEGACY_PROFILE_HARDWARE: LegacySeed[] = [
  {
    id: "legacy-kahmann-championship-2025",
    kind: "championship",
    seasonYear: 2025,
    title: "Championship",
    subtitle: "War Room Champion · 2025–26",
    notes: "Full 2025–26 season. The board still remembers.",
    winnerName: "Kahmann",
    sport: "cfb",
    sportId: "cfb",
  },
  {
    id: "legacy-justin-strayer-toilet-2025",
    kind: "toilet_bowl",
    seasonYear: 2025,
    title: "Toilet Bowl",
    subtitle: "Bottom-half crown · 2025–26",
    notes: "2025–26 Toilet Bowl. Still a crown. Wear it proudly.",
    winnerName: "Justin Strayer",
    sport: "cfb",
    sportId: "cfb",
  },
  {
    id: "legacy-bill-ball-ben-nerd-2025",
    kind: "crystal_ball",
    seasonYear: 2025,
    title: "Village Nerd Award",
    subtitle: "Crystal Ball prophet · 2025–26",
    notes: "2025–26 Crystal Ball. Zero standings points. Infinite smug.",
    winnerName: "Big Ball Ben",
    sport: "cfb",
    sportId: "cfb",
  },
  {
    id: "legacy-maria-super-bowl-2025",
    kind: "championship",
    seasonYear: 2025,
    title: "Super Bowl",
    subtitle: "Super Bowl Champion · 2025",
    notes: "Defending Super Bowl champ. Announced at the start of Week 1.",
    winnerName: "Maria",
    sport: "nfl",
    sportId: "nfl",
  },
  {
    id: "legacy-maria-vonnagio-2025",
    kind: "championship",
    seasonYear: 2025,
    title: "Championship",
    subtitle: "Vonnagio Champion · 2025",
    notes:
      "Family Vacay gold hardware · 2025. Same trophy from last year's fantasy pool. Maria holds it until someone takes it.",
    winnerName: "Maria",
    sport: "nfl",
    sportId: "nfl",
  },
];

/** Also match these name aliases → legacy id */
const LEGACY_NAME_ALIASES: { pattern: RegExp; legacyId: string }[] = [
  {
    pattern: /\bkahmann\b/i,
    legacyId: "legacy-kahmann-championship-2025",
  },
  {
    pattern: /\bjustin\s+strayer\b|\bstrayer\b|\bjstray\b|^j\s*stray$/i,
    legacyId: "legacy-justin-strayer-toilet-2025",
  },
  {
    pattern: /\bbig\s*ball\s*ben\b|\bbill\s*ball\s*ben\b|\bbillballben\b/i,
    legacyId: "legacy-bill-ball-ben-nerd-2025",
  },
  {
    pattern: /\bmaria\b/i,
    legacyId: "legacy-maria-super-bowl-2025",
  },
  {
    pattern: /\bmaria\b/i,
    legacyId: "legacy-maria-vonnagio-2025",
  },
];

function leagueToProfile(t: LeagueTrophy, sportId?: string | null): ProfileTrophy {
  const meta = TROPHY_META[t.trophyType];
  const isDiv =
    typeof t.trophyType === "string" && t.trophyType.startsWith("division_");
  return {
    id: t.id,
    kind: isDiv ? "division" : (t.trophyType as ProfileTrophyKind),
    seasonYear: t.seasonYear,
    title: isDiv
      ? t.subtitle || meta?.title || "Division / Conference Champions"
      : meta?.title || t.trophyType,
    subtitle: t.subtitle,
    notes: t.notes,
    winnerName: t.winnerName,
    source: "league",
    division: isDiv ? t.subtitle : null,
    sportId: sportId === "nfl" || sportId === "cfb" ? sportId : null,
  };
}

/**
 * Hardware for one player's profile: league Trophy Room rows they won
 * + legacy seeds matched by name (sport-gated to the active desk).
 */
export function getProfileHardware(opts: {
  playerId: string;
  playerName: string;
  leagueTrophies: LeagueTrophy[];
  /** Active league sport — gates Excel vs Super Bowl legacy seeds */
  sportId?: string | null;
}): ProfileTrophy[] {
  const { playerId, playerName, leagueTrophies } = opts;
  const out: ProfileTrophy[] = [];
  const seen = new Set<string>();

  let sport: "cfb" | "nfl" = "cfb";
  let vonnagio = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVonnaggioLeague } =
      require("./league-trophy-override") as typeof import("./league-trophy-override");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    const lg = getLeague();
    const sid = opts.sportId ?? lg?.sportId;
    sport = sid === "nfl" ? "nfl" : "cfb";
    vonnagio =
      sport === "nfl" &&
      isVonnaggioLeague(lg?.name, lg?.id, lg?.code);
  } catch {
    sport = opts.sportId === "nfl" ? "nfl" : "cfb";
    vonnagio = false;
  }

  // From engraved Trophy Room (this league)
  for (const t of leagueTrophies) {
    const byId = t.winnerUserId && t.winnerUserId === playerId;
    const byName = namesMatch(t.winnerName, playerName);
    if (!byId && !byName) continue;
    let row = leagueToProfile(t, sport);
    if (
      vonnagio &&
      row.kind === "championship" &&
      (namesMatch(row.winnerName, "Maria") || /\bmaria\b/i.test(playerName))
    ) {
      row = {
        ...row,
        title: "Championship",
        subtitle: row.subtitle?.includes("Vonnagio")
          ? row.subtitle
          : `Vonnagio Champion · ${row.seasonYear}`,
        notes:
          row.notes?.includes("Family Vacay") || row.notes?.includes("gold")
            ? row.notes
            : "Family Vacay gold hardware — last year's fantasy pool trophy. Not the silver football.",
        sportId: "nfl",
      };
    }
    const key = `${row.kind}:${row.seasonYear}:${row.subtitle || row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  // Legacy seeds — only for the active sport desk
  for (const legacy of LEGACY_PROFILE_HARDWARE) {
    if (legacy.sport !== sport) continue;
    if (legacy.id === "legacy-maria-super-bowl-2025" && vonnagio) continue;
    if (legacy.id === "legacy-maria-vonnagio-2025" && !vonnagio) continue;

    const key = `${legacy.kind}:${legacy.seasonYear}`;
    if (seen.has(key)) continue;
    const direct = namesMatch(legacy.winnerName, playerName);
    const alias = LEGACY_NAME_ALIASES.some(
      (a) => a.legacyId === legacy.id && a.pattern.test(playerName)
    );
    if (!direct && !alias) continue;
    seen.add(key);
    const { sport: _s, ...rest } = legacy;
    out.push({ ...rest, source: "legacy", sportId: legacy.sport });
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

export const DIVISION_CONFERENCE_SECTION = {
  labelA: "Division",
  labelB: "Conference",
  combined: "Division / Conference",
  emptyA: "No division titles yet",
  emptyB: "No conference titles yet",
  blurb:
    "NFL division crowns and CFB conference titles share this shelf — stack every year you win.",
} as const;

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
    emptyLabel: "No division / conference titles yet",
  },
};

export const BIG_GAME_KINDS: ProfileTrophyKind[] = [
  "championship",
  "toilet_bowl",
  "crystal_ball",
];

/** Tiny standings flair — sport-gated via active league. */
export function standingsHardwareFlair(playerName: string): {
  emoji: string;
  title: string;
}[] {
  let sportId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    sportId = getLeague()?.sportId || null;
  } catch {
    sportId = null;
  }
  const items = getProfileHardware({
    playerId: "",
    playerName,
    leagueTrophies: [],
    sportId,
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
