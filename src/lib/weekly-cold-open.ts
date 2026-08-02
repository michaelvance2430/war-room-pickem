/**
 * Preseason cold-open — Gazette Network “wanted” package on last year’s champ.
 *
 * Window: the calendar week before the season’s opening week starts
 *   (CFB Week 0 / NFL Week 1) through the moment opening week begins.
 * Frequency: once per player · league · champ year (not weekly).
 * Subject: defending championship trophy winner (prior-season seed if needed).
 */

import { getLeague, getSession } from "@/lib/league";
import {
  firstSeasonWeek,
  weekWindowMs,
} from "@/lib/season-calendar";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import {
  getPriorSeasonSeeds,
  PRIOR_SEASON_YEAR,
  resolvePriorSport,
} from "@/lib/prior-season-seed";
import type { LeagueTrophy } from "@/lib/trophies";
import { getDefendingChampion } from "@/lib/player-history";

/** Bump when once-per-season semantics change */
const SEEN_KEY = "warroom-cold-open-seen-v2";

/** Optional ambient video (poster-only is fine if missing) */
export const WEEKLY_COLD_OPEN_VIDEO_SRC = "/videos/kahmann-cold-open.mp4";

/** Shared brand with GazettePaper / buildGazetteEdition */
export const GAZETTE_STATION = {
  callSign: "WRG",
  masthead: "THE WAR ROOM GAZETTE",
  tagline: "All the news that's fit to roast",
  network: "Gazette Network",
  desk: "Investigative Desk",
  bugLabel: "GAZETTE · LIVE",
} as const;

/** Foundry / creator: open broadcast without leaving the page. */
export const EVENT_FORCE_WEEKLY_COLD_OPEN = "warroom-force-weekly-cold-open";

/** Seven days before opening week start → opening week start (exclusive). */
const PRESEASON_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type ColdOpenSubject = {
  year: number;
  name: string;
  userId: string | null;
  avatarUrl: string | null;
};

export type WeeklyColdOpenCopy = {
  stamp: string;
  wanted: string;
  headline: string;
  phonetic: string | null;
  body: string;
  kalshi: string;
  cta: string;
  ctaGazette: string;
  hardwareLabel: string;
};

/** Fire from Foundry — preview only (does not burn the once-per-season flag). */
export function requestWeeklyColdOpenPreview(): void {
  if (typeof window === "undefined") return;
  const fire = () => {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_FORCE_WEEKLY_COLD_OPEN, {
          detail: { preview: true },
        })
      );
    } catch {
      /* ignore */
    }
  };
  fire();
  window.setTimeout(fire, 50);
  window.setTimeout(fire, 200);
  window.setTimeout(fire, 500);
}

/**
 * Opening-week start ms for this sport (CFB Week 0 / NFL Week 1).
 */
export function coldOpenSeasonOpenMs(sportId?: string | null): number | null {
  const sid = sportId ?? getLeague()?.sportId;
  const first = firstSeasonWeek(sid);
  const cal = sid === "nfl" ? "nfl" : "cfb";
  const win = weekWindowMs(first, cal);
  return win?.startMs ?? null;
}

/**
 * Preseason cold-open window: week before season starts only.
 * Ends when opening week begins (ring ceremony takes the stage).
 */
export function isWeeklyColdOpenWindowOpen(
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  const sid = sportId ?? getLeague()?.sportId;
  // Once the season’s opening week has started, cold open is done.
  if (hasOpeningWeekStarted(sid, nowMs)) return false;
  const openMs = coldOpenSeasonOpenMs(sid);
  if (openMs == null) return false;
  const startMs = openMs - PRESEASON_LEAD_MS;
  return nowMs >= startMs && nowMs < openMs;
}

/**
 * Resolve last year’s championship trophy holder for the cold open.
 * Prefers live Trophy Room championships; falls back to prior-season seed.
 */
export function resolveColdOpenSubject(
  trophies: LeagueTrophy[],
  sportId?: string | null
): Omit<ColdOpenSubject, "avatarUrl"> | null {
  const sport = resolvePriorSport(sportId);
  const d = getDefendingChampion(trophies);
  if (d?.name) {
    return {
      year: d.year,
      name: d.name,
      userId: d.userId,
    };
  }
  const seed = getPriorSeasonSeeds(sport).find(
    (s) => s.trophyType === "championship"
  );
  if (!seed) return null;
  return {
    year: PRIOR_SEASON_YEAR,
    name: seed.winnerName,
    userId: null,
  };
}

function isKahmann(name: string): boolean {
  return /\bkahmann\b/i.test(name || "");
}

/** Article copy for the defending champ — static, no animation beats. */
export function getWeeklyColdOpenCopy(
  subject: { name: string; year?: number },
  sportId?: string | null
): WeeklyColdOpenCopy {
  const name = (subject.name || "Last year's champ").trim();
  const sport = resolvePriorSport(sportId);
  const year = subject.year ?? PRIOR_SEASON_YEAR;
  const hardware =
    sport === "nfl"
      ? "Super Bowl hardware"
      : "championship crystal";
  const phonetic = isKahmann(name)
    ? "Kahmann — pronounced COMMON"
    : null;
  const nameCall = isKahmann(name)
    ? `${name} (say it with us — COMMON)`
    : name;

  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    wanted: "Have you seen this man?",
    headline: `${name}: known time traveler — some even say a cheat`,
    phonetic,
    body:
      `Gazette Network has it on the record: ${nameCall} is a known time traveler. ` +
      `Room veterans have long whispered that the reigning champ (${year} ${hardware}) ` +
      `somehow always knows next week’s scores before the rest of us lock. ` +
      `Some even say a cheat. Investigative Desk has not recovered a DeLorean — ` +
      `but the pattern is hard to unsee. This is the week-before package: ` +
      `face on the carton, name in the paper, target on their back.`,
    kalshi: `Kalshi odds have ${name} definitely not winning this year. Markets price the time-travel edge as spent. The board is open — the tape says no.`,
    cta: "Cool — back to the room",
    ctaGazette: "Open the Gazette",
    hardwareLabel:
      sport === "nfl"
        ? `${year} Super Bowl champion`
        : `${year} War Room champion`,
  };
}

export function coldOpenSeenKey(
  leagueId: string,
  playerId: string,
  champYear: number
): string {
  return `${SEEN_KEY}:${leagueId}:${playerId}:${champYear}`;
}

export function hasSeenWeeklyColdOpen(
  playerId: string,
  leagueId: string,
  champYear: number
): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(coldOpenSeenKey(leagueId, playerId, champYear)) === "1";
  } catch {
    return true;
  }
}

export function markWeeklyColdOpenSeen(
  playerId: string,
  leagueId: string,
  champYear: number
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      coldOpenSeenKey(leagueId, playerId, champYear),
      "1"
    );
  } catch {
    /* ignore */
  }
}

/**
 * Sync gate only — modal still loads trophies + roster before showing.
 * True when calendar window is open and this player hasn't seen this champ year.
 */
export function shouldShowWeeklyColdOpen(
  nowMs = Date.now(),
  opts?: { champYear?: number }
): boolean {
  if (typeof window === "undefined") return false;
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) return false;
  if (!isWeeklyColdOpenWindowOpen(league.sportId, nowMs)) return false;
  if (opts?.champYear != null) {
    if (hasSeenWeeklyColdOpen(session.playerId, league.id, opts.champYear)) {
      return false;
    }
  }
  return true;
}
