/**
 * Crew = permanent friend group. League/season = temporary chapter.
 *
 * Product law:
 * - Silent on create (no day-one lecture)
 * - Meat & potatoes after first season finale
 * - Chapters are sports seasons (sport 2 same year counts)
 * - Crew cheevos stay hidden until first unlock (later)
 */

import { getLeague, getSession } from "@/lib/league";
import { defaultSeasonYear } from "@/lib/trophies";
import type { LeagueTrophy } from "@/lib/trophies";

const STORE_KEY = "warroom-crews-v1";
export const EVENT_CREW = "warroom-crew";
export const EVENT_CREW_REVEAL = "warroom-crew-reveal";

export type CrewChapterStatus = "active" | "complete";

export type CrewChapter = {
  id: string;
  crewId: string;
  leagueId: string;
  sportId: string;
  year: number;
  status: CrewChapterStatus;
  leagueName: string;
  completedAt?: string;
  championshipName?: string | null;
  toiletName?: string | null;
  crystalBallName?: string | null;
};

export type Crew = {
  id: string;
  name: string;
  foundedAt: string;
  createdBy?: string;
  /** Set when first finale completes — story is real */
  revealedAt?: string | null;
  /** First crew cheevo ever (system intro) — later */
  firstCheevoAt?: string | null;
};

export type CrewStore = {
  crews: Record<string, Crew>;
  chapters: CrewChapter[];
  /** leagueId → crewId */
  leagueToCrew: Record<string, string>;
  /** `${playerId}:${crewId}` → true after they saw the reveal modal */
  revealSeenByPlayer: Record<string, boolean>;
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emptyStore(): CrewStore {
  return {
    crews: {},
    chapters: [],
    leagueToCrew: {},
    revealSeenByPlayer: {},
  };
}

function readStore(): CrewStore {
  if (!canUse()) return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw) as Partial<CrewStore>;
    return {
      crews: p.crews && typeof p.crews === "object" ? p.crews : {},
      chapters: Array.isArray(p.chapters) ? p.chapters : [],
      leagueToCrew:
        p.leagueToCrew && typeof p.leagueToCrew === "object"
          ? p.leagueToCrew
          : {},
      revealSeenByPlayer:
        p.revealSeenByPlayer && typeof p.revealSeenByPlayer === "object"
          ? p.revealSeenByPlayer
          : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(s: CrewStore) {
  if (!canUse()) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_CREW, { detail: s }));
  } catch {
    /* ignore */
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function revealSeenKey(playerId: string, crewId: string) {
  return `${playerId}:${crewId}`;
}

/** Chapters count as completed finales (any sport). */
export function completedChapterCount(crewId: string): number {
  return readStore().chapters.filter(
    (c) => c.crewId === crewId && c.status === "complete"
  ).length;
}

export function getCrewById(crewId: string | null | undefined): Crew | null {
  if (!crewId) return null;
  return readStore().crews[crewId] || null;
}

export function getCrewIdForLeague(
  leagueId: string | null | undefined
): string | null {
  if (!leagueId) return null;
  return readStore().leagueToCrew[leagueId] || null;
}

export function getCrewForLeague(
  leagueId: string | null | undefined
): Crew | null {
  const id = getCrewIdForLeague(leagueId);
  return getCrewById(id);
}

export function getChaptersForCrew(crewId: string): CrewChapter[] {
  return readStore()
    .chapters.filter((c) => c.crewId === crewId)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return (b.completedAt || "").localeCompare(a.completedAt || "");
    });
}

export function getChapterForLeague(
  leagueId: string | null | undefined
): CrewChapter | null {
  if (!leagueId) return null;
  return (
    readStore().chapters.find((c) => c.leagueId === leagueId) || null
  );
}

/** Story UI unlocked for this player (finale reveal seen or crew revealed + they opened). */
export function isCrewStoryRevealed(
  leagueId?: string | null,
  playerId?: string | null
): boolean {
  const lid = leagueId ?? getLeague()?.id;
  const pid = playerId ?? getSession()?.playerId;
  const crew = getCrewForLeague(lid);
  if (!crew?.revealedAt) return false;
  if (!pid) return !!crew.revealedAt;
  const key = revealSeenKey(pid, crew.id);
  // Once crew is revealed, story is available; personal "first time modal" is separate
  return !!crew.revealedAt || !!readStore().revealSeenByPlayer[key];
}

/** True if this player still needs the one-time "oh shit" reveal modal. */
export function needsCrewRevealModal(
  leagueId?: string | null,
  playerId?: string | null
): boolean {
  const lid = leagueId ?? getLeague()?.id;
  const pid = playerId ?? getSession()?.playerId;
  if (!lid || !pid) return false;
  const crew = getCrewForLeague(lid);
  if (!crew?.revealedAt) return false;
  const key = revealSeenKey(pid, crew.id);
  return !readStore().revealSeenByPlayer[key];
}

export function markCrewRevealSeen(
  crewId: string,
  playerId?: string | null
) {
  const pid = playerId ?? getSession()?.playerId;
  if (!pid || !crewId) return;
  const s = readStore();
  s.revealSeenByPlayer[revealSeenKey(pid, crewId)] = true;
  writeStore(s);
}

/**
 * Silent: create Crew + active chapter for a new (or existing) league.
 * Safe to call on create, join, and boot — idempotent.
 */
export function ensureCrewForLeague(opts: {
  leagueId: string;
  leagueName: string;
  sportId?: string | null;
  createdBy?: string | null;
  foundedAt?: string | null;
}): { crew: Crew; chapter: CrewChapter; created: boolean } {
  const s = readStore();
  const existingCrewId = s.leagueToCrew[opts.leagueId];
  if (existingCrewId && s.crews[existingCrewId]) {
    let chapter =
      s.chapters.find((c) => c.leagueId === opts.leagueId) || null;
    if (!chapter) {
      chapter = {
        id: uid("ch"),
        crewId: existingCrewId,
        leagueId: opts.leagueId,
        sportId: (opts.sportId || "cfb").trim() || "cfb",
        year: defaultSeasonYear(),
        status: "active",
        leagueName: opts.leagueName || s.crews[existingCrewId].name,
      };
      s.chapters.push(chapter);
      writeStore(s);
    }
    return { crew: s.crews[existingCrewId], chapter, created: false };
  }

  const crewId = uid("crew");
  const crew: Crew = {
    id: crewId,
    name: (opts.leagueName || "War Room").trim() || "War Room",
    foundedAt: opts.foundedAt || new Date().toISOString(),
    createdBy: opts.createdBy || undefined,
    revealedAt: null,
    firstCheevoAt: null,
  };
  const chapter: CrewChapter = {
    id: uid("ch"),
    crewId,
    leagueId: opts.leagueId,
    sportId: (opts.sportId || "cfb").trim() || "cfb",
    year: defaultSeasonYear(),
    status: "active",
    leagueName: crew.name,
  };
  s.crews[crewId] = crew;
  s.chapters.push(chapter);
  s.leagueToCrew[opts.leagueId] = crewId;
  writeStore(s);
  return { crew, chapter, created: true };
}

/**
 * Stamp chapter complete from engraved trophies (finale hardware).
 * First completion sets crew.revealedAt → story becomes real.
 */
export function completeCrewChapterFromFinale(opts: {
  leagueId: string;
  year: number;
  trophies: LeagueTrophy[];
  leagueName?: string;
  sportId?: string | null;
}): {
  crew: Crew | null;
  chapter: CrewChapter | null;
  firstReveal: boolean;
} {
  const league = getLeague();
  const sportId =
    opts.sportId || league?.sportId || "cfb";
  // Ensure crew exists even if create path was missed
  ensureCrewForLeague({
    leagueId: opts.leagueId,
    leagueName: opts.leagueName || league?.name || "War Room",
    sportId,
    createdBy: getSession()?.playerId,
    foundedAt: league?.createdAt,
  });

  const s = readStore();
  const crewId = s.leagueToCrew[opts.leagueId];
  if (!crewId || !s.crews[crewId]) {
    return { crew: null, chapter: null, firstReveal: false };
  }

  const champ = opts.trophies.find((t) => t.trophyType === "championship");
  const toilet = opts.trophies.find((t) => t.trophyType === "toilet_bowl");
  const crystal = opts.trophies.find((t) => t.trophyType === "crystal_ball");

  let chapter = s.chapters.find((c) => c.leagueId === opts.leagueId) || null;
  const now = new Date().toISOString();
  if (!chapter) {
    chapter = {
      id: uid("ch"),
      crewId,
      leagueId: opts.leagueId,
      sportId: sportId || "cfb",
      year: opts.year,
      status: "complete",
      leagueName: opts.leagueName || s.crews[crewId].name,
      completedAt: now,
      championshipName: champ?.winnerName || null,
      toiletName: toilet?.winnerName || null,
      crystalBallName: crystal?.winnerName || null,
    };
    s.chapters.push(chapter);
  } else {
    chapter = {
      ...chapter,
      status: "complete",
      year: opts.year || chapter.year,
      completedAt: chapter.completedAt || now,
      championshipName: champ?.winnerName || chapter.championshipName || null,
      toiletName: toilet?.winnerName || chapter.toiletName || null,
      crystalBallName:
        crystal?.winnerName || chapter.crystalBallName || null,
      leagueName: opts.leagueName || chapter.leagueName,
    };
    s.chapters = s.chapters.map((c) =>
      c.id === chapter!.id ? chapter! : c
    );
  }

  const crew = s.crews[crewId];
  const firstReveal = !crew.revealedAt;
  if (firstReveal) {
    s.crews[crewId] = { ...crew, revealedAt: now };
  }

  writeStore(s);

  if (firstReveal) {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_CREW_REVEAL, {
          detail: { crewId, leagueId: opts.leagueId },
        })
      );
    } catch {
      /* ignore */
    }
  }

  return {
    crew: s.crews[crewId],
    chapter,
    firstReveal,
  };
}

/** Sports label for UI */
export function sportChapterLabel(sportId: string): string {
  switch ((sportId || "").toLowerCase()) {
    case "nfl":
      return "NFL";
    case "cfb":
      return "CFB";
    case "nba":
      return "NBA";
    case "nhl":
      return "NHL";
    case "soccer_wwc":
      return "WWC";
    default:
      return sportId?.toUpperCase() || "SPORT";
  }
}

export function crewFoundedLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
