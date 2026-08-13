/**
 * Profile trophy case — permanent career hardware across the entire product.
 *
 * Binding law:
 * - Profile Trophy Room is global history (CFB + NFL + future sports together).
 * - Active league sport must not filter permanent career hardware.
 * - Each plaque keeps its own sport identity (colors, iconography, labels).
 * - Identity-bearing seeds (AFC/NFC Championship) bind by stable user_id only.
 * - Older Excel-era fill-ins still use name/alias matching until UUID-mapped.
 * - Multi-league: three CFB titles in three rooms → three championship plaques.
 *
 * Optional activeSportOnly is for league standings flair only — not the
 * default Profile Trophy Room.
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
  /** Room that awarded this hardware — multi-league showcase */
  leagueName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
  trophyDesignId?: string | null;
};

/** Trophy input may carry room meta from multi-league career load */
export type LeagueTrophyInput = LeagueTrophy & {
  leagueName?: string | null;
  sportId?: string | null;
  leagueCode?: string | null;
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
  /**
   * When set, career hardware attaches ONLY to this auth.users / profiles id.
   * Display name, nickname, and aliases are never used for matching.
   * Required for identity-bearing conference hardware (AFC/NFC Championship).
   */
  winnerUserId?: string | null;
};

/**
 * Confirmed prior-season hardware only.
 * CFB 2025–26 Excel: Kahmann / Strayer / Big Balls Ben.
 * NFL 2025: Maria Super Bowl (or Vonnagio gold family form).
 * NFL 2026 conference hardware: Mike NFC Championship · Maria AFC Championship.
 * Profile Trophy Room is global — seeds keep sport identity but are not
 * filtered by the active league desk.
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
    winnerName: "Jstray",
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
    /** Permanent identity pin — survives nickname and league changes. */
    winnerName: "Big Balls Ben",
    winnerUserId: "fdddf273-2430-42db-9127-b8fa7efc1572",
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
  {
    id: "legacy-mike-nfc-championship-2026",
    kind: "division",
    seasonYear: 2026,
    title: "NFC Championship",
    subtitle: "NFC Champion · 2026",
    notes:
      "2026 NFC Championship. Conference hardware — not Super Bowl. Permanent career history.",
    /** Display only — matching is winnerUserId only */
    winnerName: "Mike Vance",
    winnerUserId: "09544d2b-6eca-4131-a321-c000586c9029",
    division: "NFC Championship",
    sport: "nfl",
    sportId: "nfl",
  },
  {
    id: "legacy-maria-afc-championship-2026",
    kind: "division",
    seasonYear: 2026,
    title: "AFC Championship",
    subtitle: "AFC Champion · 2026",
    notes:
      "2026 AFC Championship. Conference hardware en route to the Super Bowl. Permanent career history.",
    /** Display only — matching is winnerUserId only */
    winnerName: "Maria",
    winnerUserId: "131b404e-db8e-4adf-86f4-f78aacf2a5bc",
    division: "AFC Championship",
    sport: "nfl",
    sportId: "nfl",
  },
];

/**
 * Name aliases for *legacy Excel-era* CFB/NFL seeds that predate ID mapping.
 * Conference AFC/NFC Championship seeds above MUST NOT be listed here.
 */
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
    pattern: /\bbig\s*balls?\s*ben\b|\bbill\s*balls?\s*ben\b|\bbillballs?ben\b/i,
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

function leagueToProfile(
  t: LeagueTrophyInput,
  fallbackSport?: string | null
): ProfileTrophy {
  const meta = TROPHY_META[t.trophyType];
  const isDiv =
    typeof t.trophyType === "string" && t.trophyType.startsWith("division_");
  const rowSport =
    t.sportId === "nfl" || t.sportId === "cfb"
      ? t.sportId
      : fallbackSport === "nfl" || fallbackSport === "cfb"
        ? fallbackSport
        : null;
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
    sportId: rowSport,
    leagueName: t.leagueName || null,
    leagueId: t.leagueId || null,
    leagueCode: t.leagueCode || null,
    trophyDesignId: t.trophyDesignId || null,
  };
}

/**
 * Hardware for one player's profile: multi-league Trophy Room wins
 * + legacy seeds matched by name (sport-gated).
 *
 * Dedupe: one plaque per kind · year · league (three CFB titles → three plaques).
 * Same league + same kind + year still collapses Excel seed vs cloud double.
 */
export function getProfileHardware(opts: {
  playerId: string;
  playerName: string;
  leagueTrophies: LeagueTrophyInput[];
  /**
   * Active league sport — styles room-local presentation (e.g. Vonnagio gold
   * form) and optional standings flair. Does NOT filter the default Profile
   * Trophy Room unless activeSportOnly is true.
   */
  sportId?: string | null;
  /** Active room name for room-local presentation only */
  activeLeagueName?: string | null;
  activeLeagueId?: string | null;
  /**
   * When true, only include hardware whose sport matches the active league.
   * Default false — Profile Trophy Room shows full career history.
   * Standings flair may pass true so league boards stay sport-local.
   */
  activeSportOnly?: boolean;
}): ProfileTrophy[] {
  const { playerId, playerName, leagueTrophies } = opts;
  const out: ProfileTrophy[] = [];
  const seen = new Set<string>();
  const activeSportOnly = !!opts.activeSportOnly;

  let activeSport: "cfb" | "nfl" = "cfb";
  let activeVonnagio = false;
  let activeLeagueName = opts.activeLeagueName || null;
  let activeLeagueId = opts.activeLeagueId || null;
  let activeLeagueCode: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVonnaggioLeague } =
      require("./league-trophy-override") as typeof import("./league-trophy-override");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    const lg = getLeague();
    const sid = opts.sportId ?? lg?.sportId;
    activeSport = sid === "nfl" ? "nfl" : "cfb";
    activeLeagueName = activeLeagueName || lg?.name || null;
    activeLeagueId = activeLeagueId || lg?.id || null;
    activeLeagueCode = lg?.code || null;
    activeVonnagio =
      activeSport === "nfl" &&
      isVonnaggioLeague(lg?.name, lg?.id, lg?.code);
  } catch {
    activeSport = opts.sportId === "nfl" ? "nfl" : "cfb";
  }

  function hardwareDedupeKey(row: {
    id?: string;
    kind: ProfileTrophyKind;
    seasonYear: number;
    subtitle?: string | null;
    division?: string | null;
    leagueId?: string | null;
    leagueName?: string | null;
    sportId?: string | null;
  }): string {
    const y =
      typeof row.seasonYear === "number"
        ? row.seasonYear
        : Number.parseInt(String(row.seasonYear ?? ""), 10) || 0;
    // Prefer stable plaque id so career seeds never duplicate when the
    // viewer switches active league / sport context.
    if (row.id && String(row.id).startsWith("legacy-")) {
      return `legacy:${row.id}`;
    }
    const room =
      (row.leagueId || "").trim() ||
      (row.leagueName || "").toLowerCase().replace(/\s+/g, "-") ||
      "room";
    if (row.kind === "division") {
      return `division:${y}:${room}:${row.division || row.subtitle || ""}:${row.sportId || ""}`;
    }
    return `${row.kind}:${y}:${room}:${row.sportId || ""}`;
  }

  // From engraved Trophy Room(s) — multi-league career stack (all sports)
  for (const t of leagueTrophies) {
    const byId = t.winnerUserId && t.winnerUserId === playerId;
    const byName = namesMatch(t.winnerName, playerName);
    if (!byId && !byName) continue;
    const rowSport =
      t.sportId === "nfl" || t.sportId === "cfb" ? t.sportId : activeSport;
    if (activeSportOnly && rowSport !== activeSport) continue;
    let row = leagueToProfile(t, rowSport);
    // Vonnagio gold copy when this plaque is from that room (or active desk)
    let rowVonnagio = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isVonnaggioLeague } =
        require("./league-trophy-override") as typeof import("./league-trophy-override");
      rowVonnagio = isVonnaggioLeague(
        t.leagueName || activeLeagueName,
        t.leagueId || activeLeagueId,
        t.leagueCode || activeLeagueCode
      );
    } catch {
      rowVonnagio = activeVonnagio;
    }
    if (
      rowVonnagio &&
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
    if (!row.leagueName && activeLeagueName) {
      row = { ...row, leagueName: activeLeagueName };
    }
    if (!row.leagueId && (t.leagueId || activeLeagueId)) {
      row = { ...row, leagueId: t.leagueId || activeLeagueId };
    }
    const key = hardwareDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  // Legacy career seeds — default: all sports (Profile Trophy Room is global)
  for (const legacy of LEGACY_PROFILE_HARDWARE) {
    if (activeSportOnly && legacy.sport !== activeSport) continue;
    // Room-local gold form of Maria's championship (not a sport desk filter)
    if (legacy.id === "legacy-maria-super-bowl-2025" && activeVonnagio)
      continue;
    if (legacy.id === "legacy-maria-vonnagio-2025" && !activeVonnagio)
      continue;

    const alreadyFromAnyRoom = out.some(
      (p) =>
        p.kind === legacy.kind &&
        p.seasonYear === legacy.seasonYear &&
        (p.sportId || legacy.sport) === legacy.sport
    );
    // Skip legacy fill-in only when a real/league plaque already covers
    // this kind·year·sport (multi-room career still stacks by league id)
    if (alreadyFromAnyRoom) continue;

    // Identity-bearing seeds: stable user_id only (never display name / nickname)
    const idOnly = !!(
      legacy.winnerUserId &&
      String(legacy.winnerUserId).trim().length > 0
    );
    if (idOnly) {
      const want = String(legacy.winnerUserId).trim().toLowerCase();
      const have = String(playerId || "").trim().toLowerCase();
      if (!have || have !== want) continue;
    } else {
      const direct = namesMatch(legacy.winnerName, playerName);
      const alias = LEGACY_NAME_ALIASES.some(
        (a) => a.legacyId === legacy.id && a.pattern.test(playerName)
      );
      if (!direct && !alias) continue;
    }
    const { sport: _s, winnerUserId: _uid, ...rest } = legacy;
    // Stable career placement — do not re-key by active league (avoids dupes
    // and wrong room labels when the profile is opened from another sport).
    const leg: ProfileTrophy = {
      ...rest,
      source: "legacy",
      sportId: legacy.sport,
      leagueName:
        legacy.sport === "nfl" ? "NFL career" : "CFB career",
      leagueId: `legacy-${legacy.id}`,
      leagueCode: null,
    };
    const key = hardwareDedupeKey(leg);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(leg);
  }

  return out.sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
    const kn = a.kind.localeCompare(b.kind);
    if (kn !== 0) return kn;
    return (a.leagueName || "").localeCompare(b.leagueName || "");
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

/** Tiny standings flair — sport-local to the active league board only. */
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
    activeSportOnly: true,
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
