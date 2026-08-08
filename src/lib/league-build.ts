/**
 * League Build — first-time commissioner constitution for a room.
 *
 * Fires right after create (any sport). Editable until opening week starts.
 * Day before open: one-time “locks tomorrow” reminder.
 * Foundry “new commissioner” eyes force this wizard first.
 */

import { firstSeasonWeek, weekWindowMs, weekDateRangeLabel } from "@/lib/season-calendar";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { getLeague, isActuallyCommissioner } from "@/lib/league";

const KEY = "warroom-league-build-v1";
const EYES_FORCE_KEY = "warroom-league-build-eyes-force-v1";
export const EVENT_LEAGUE_BUILD = "warroom-league-build";

export type LeagueBuildFlags = {
  /** Set true when this league must complete the wizard */
  needed?: boolean;
  /** Finished once */
  complete?: boolean;
  /** ET calendar day (YYYY-MM-DD) when lock-eve reminder was dismissed */
  lockReminderDismissedOn?: string;
};

type Store = Record<string, LeagueBuildFlags>;

export const LEAGUE_BUILD_RECOMMENDED = {
  crystalBallEnabled: true,
  cutPercent: 50,
  openRoom: false,
  fillBots: false,
} as const;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_LEAGUE_BUILD));
  } catch {
    /* ignore */
  }
}

export function getLeagueBuildFlags(leagueId: string): LeagueBuildFlags {
  if (!leagueId) return {};
  return readAll()[leagueId] || {};
}

export function patchLeagueBuild(
  leagueId: string,
  patch: Partial<LeagueBuildFlags>
) {
  if (!leagueId) return;
  const all = readAll();
  all[leagueId] = { ...(all[leagueId] || {}), ...patch };
  writeAll(all);
}

/** Call immediately after league create. */
export function markLeagueBuildNeeded(leagueId: string) {
  if (!leagueId) return;
  patchLeagueBuild(leagueId, { needed: true, complete: false });
}

export function markLeagueBuildComplete(leagueId: string) {
  if (!leagueId) return;
  patchLeagueBuild(leagueId, { needed: true, complete: true });
  clearEyesLeagueBuildForce();
}

/**
 * Needs the wizard? Only when explicitly marked needed and not complete.
 * Existing rooms without the flag are never forced (grandfathered).
 */
export function needsLeagueBuild(leagueId: string | null | undefined): boolean {
  if (!leagueId) return false;
  if (isEyesLeagueBuildForced()) return true;
  const f = getLeagueBuildFlags(leagueId);
  if (!f.needed) return false;
  return !f.complete;
}

export function isLeagueBuildComplete(leagueId: string | null | undefined): boolean {
  if (!leagueId) return true;
  if (isEyesLeagueBuildForced()) return false;
  const f = getLeagueBuildFlags(leagueId);
  if (!f.needed) return true;
  return !!f.complete;
}

/** Opening week date locks rules (CFB Week 0 / NFL Week 1). */
export function isLeagueBuildLocked(
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  return hasOpeningWeekStarted(sportId, nowMs);
}

export function openingWeekStartMs(sportId?: string | null): number | null {
  const sid = sportId ?? getLeague()?.sportId;
  const first = firstSeasonWeek(sid);
  const win = weekWindowMs(first, sid === "nfl" ? "nfl" : "cfb");
  return win?.startMs ?? null;
}

/** Human label for the lock moment. */
export function openingWeekLockLabel(sportId?: string | null): string {
  const sid = sportId ?? getLeague()?.sportId;
  if (sid === "cbb") return "Fieldhouse Window 1 · first tip";
  const first = firstSeasonWeek(sid);
  const range = weekDateRangeLabel(first, sid);
  const sport = sid === "nfl" ? "NFL Week 1" : "CFB Week 0";
  return range ? `${sport} · ${range}` : sport;
}

/**
 * Calendar day before opening week (ET): show “locks tomorrow” popup.
 * Window = [start − 24h, start).
 */
export function isLeagueBuildLockEve(
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  if (isLeagueBuildLocked(sportId, nowMs)) return false;
  const start = openingWeekStartMs(sportId);
  if (start == null) return false;
  const dayBefore = start - 24 * 60 * 60 * 1000;
  return nowMs >= dayBefore && nowMs < start;
}

function etYmd(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/** Show lock-eve modal once per league per ET day (if still unlocked). */
export function shouldShowLeagueBuildLockReminder(
  leagueId: string | null | undefined,
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  if (!leagueId || !isActuallyCommissioner()) return false;
  if (!isLeagueBuildLockEve(sportId, nowMs)) return false;
  // Only rooms that finished build (or grandfathered) care about lock
  if (needsLeagueBuild(leagueId)) return false;
  const f = getLeagueBuildFlags(leagueId);
  const today = etYmd(nowMs);
  return f.lockReminderDismissedOn !== today;
}

export function dismissLeagueBuildLockReminder(leagueId: string) {
  if (!leagueId) return;
  patchLeagueBuild(leagueId, {
    lockReminderDismissedOn: etYmd(Date.now()),
  });
}

/** True when real host should be redirected into the wizard. */
export function shouldRedirectToLeagueBuild(): boolean {
  if (!canUse()) return false;
  if (!isActuallyCommissioner()) return false;
  const league = getLeague();
  if (!league?.id) return false;
  if (isLeagueBuildLocked(league.sportId)) return false;
  return needsLeagueBuild(league.id);
}

// ── Foundry eyes ──────────────────────────────────────────────────────────

export function forceEyesLeagueBuild(): void {
  if (!canUse()) return;
  try {
    localStorage.setItem(EYES_FORCE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearEyesLeagueBuildForce(): void {
  if (!canUse()) return;
  try {
    localStorage.removeItem(EYES_FORCE_KEY);
  } catch {
    /* ignore */
  }
}

export function isEyesLeagueBuildForced(): boolean {
  if (!canUse()) return false;
  try {
    return localStorage.getItem(EYES_FORCE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Pride pick copy for sport. */
export function pridePickWizardCopy(sportId?: string | null): {
  title: string;
  /** Short line scannable in one glance */
  oneLiner: string;
  body: string;
  onLabel: string;
} {
  const nfl = sportId === "nfl";
  const hoops = sportId === "cbb";
  return {
    title: nfl ? "Super Bowl pride pick?" : hoops ? "National champion Crystal Ball?" : "Crystal Ball?",
    oneLiner: nfl
      ? "Players predict the Super Bowl champion before Week 1. Pride only—no standings points."
      : hoops
        ? "Players predict the national champion before Window 1. Pride only—no standings points."
      : "Pick the national champ. No points. Secret until freeze.",
    body: nfl
      ? "Defaults on for new NFL rooms. After freeze, everyone’s pick is a permanent board. This is not their favorite-team allegiance — that’s separate."
      : hoops
        ? "After the first tip, everyone’s pick becomes a permanent board. This is separate from the college basketball team they ride with."
      : "Optional free brag tab. After freeze, everyone’s pick is a permanent board.",
    onLabel: nfl ? "On — Super Bowl tab (recommended)" : hoops ? "On — National Champion tab (recommended)" : "On — Crystal Ball tab",
  };
}
