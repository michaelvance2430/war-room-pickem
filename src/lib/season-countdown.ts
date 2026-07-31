/**
 * Global “league starts” countdown — everyone sees it until doors open.
 *
 * CFB: Sun Aug 23, 2026, 00:01 ET (hype before Week 0 Sat Aug 29)
 * NFL: Wed Sep 9, 2026 Kickoff Game (first regular-season game — NOT preseason)
 */

/** CFB doors — keep existing gold standard */
export const CFB_SEASON_OPEN_AT_MS = Date.parse("2026-08-23T04:01:00.000Z");
export const CFB_SEASON_OPEN_LABEL = "Sun Aug 23 · 12:01 AM ET";

/**
 * NFL Kickoff Game 2026 — Wed Sep 9 evening ET.
 * Doors open at kickoff so the countdown mirrors the first real game.
 * (8:20 PM EDT ≈ 00:20 UTC Sep 10)
 */
export const NFL_SEASON_OPEN_AT_MS = Date.parse("2026-09-10T00:20:00.000Z");
export const NFL_SEASON_OPEN_LABEL = "Wed Sep 9 · Kickoff · ~8:20 PM ET";

/** @deprecated use getSeasonOpenAtMs — kept for any stray imports */
export const SEASON_OPEN_AT_MS = CFB_SEASON_OPEN_AT_MS;
/** @deprecated use getSeasonOpenLabel */
export const SEASON_OPEN_LABEL = CFB_SEASON_OPEN_LABEL;

/** Display season tag on the one-time welcome splash */
export const SEASON_DISPLAY_YEAR = "2026-27";

/** localStorage key prefix — one splash per browser per league per season */
export const SEASON_OPEN_WELCOME_KEY = "warroom-season-open-welcome-2026-27";

function resolveSportId(explicit?: string | null): "cfb" | "nfl" {
  if (explicit === "nfl" || explicit === "cfb") return explicit;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  } catch {
    return "cfb";
  }
}

export function getSeasonOpenAtMs(sportId?: string | null): number {
  return resolveSportId(sportId) === "nfl"
    ? NFL_SEASON_OPEN_AT_MS
    : CFB_SEASON_OPEN_AT_MS;
}

export function getSeasonOpenLabel(sportId?: string | null): string {
  return resolveSportId(sportId) === "nfl"
    ? NFL_SEASON_OPEN_LABEL
    : CFB_SEASON_OPEN_LABEL;
}

export function seasonOpenWelcomeStorageKey(leagueId: string) {
  return `${SEASON_OPEN_WELCOME_KEY}:${leagueId || "default"}`;
}

export function hasSeenSeasonOpenWelcome(leagueId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seasonOpenWelcomeStorageKey(leagueId)) === "1";
  } catch {
    return true;
  }
}

export function markSeasonOpenWelcomeSeen(leagueId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seasonOpenWelcomeStorageKey(leagueId), "1");
  } catch {
    /* ignore */
  }
}

export function isSeasonOpen(
  nowMs = Date.now(),
  sportId?: string | null
): boolean {
  return nowMs >= getSeasonOpenAtMs(sportId);
}

export type CountdownParts = {
  totalMs: number;
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getCountdownParts(
  nowMs = Date.now(),
  sportId?: string | null
): CountdownParts {
  const totalMs = getSeasonOpenAtMs(sportId) - nowMs;
  if (totalMs <= 0) {
    return { totalMs: 0, done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const sec = Math.floor(totalMs / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return { totalMs, done: false, days, hours, minutes, seconds };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Compact: 23d 14:07:42 */
export function formatCountdownCompact(p: CountdownParts): string {
  if (p.done) return "LIVE";
  if (p.days > 0) {
    return `${p.days}d ${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`;
  }
  return `${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`;
}
