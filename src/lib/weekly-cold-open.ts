/**
 * Weekly cold-open broadcast — first login each calendar week, starting Aug 16 2026.
 * Same “station” as The War Room Gazette (TV desk for the paper).
 * One show per player per week (localStorage).
 */

import { getLeague, getSession } from "@/lib/league";

/** America/New_York midnight Aug 16 2026 */
export const WEEKLY_COLD_OPEN_START_MS = Date.parse(
  "2026-08-16T00:00:00-04:00"
);

const SEEN_KEY = "warroom-weekly-cold-open-seen-v1";

export const WEEKLY_COLD_OPEN_VIDEO_SRC =
  "/videos/kahmann-cold-open.mp4";

/** Shared brand with GazettePaper / buildGazetteEdition */
export const GAZETTE_STATION = {
  /** On-air bug / channel ID */
  callSign: "WRG",
  /** Matches Gazette masthead */
  masthead: "THE WAR ROOM GAZETTE",
  /** Matches Gazette tagline */
  tagline: "All the news that's fit to roast",
  network: "Gazette Network",
  desk: "Investigative Desk",
  /** Short for chyrons */
  bugLabel: "GAZETTE · LIVE",
} as const;

/** Foundry / creator: open broadcast without leaving the page. */
export const EVENT_FORCE_WEEKLY_COLD_OPEN = "warroom-force-weekly-cold-open";

/** Fire from Foundry — preview only (does not burn the once-per-week flag). */
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

export type WeeklyColdOpenCopy = {
  stamp: string;
  headline: string;
  phonetic: string;
  body: string;
  kalshi: string;
  cta: string;
  ctaGazette: string;
};

/** Kahmann = “COMMON” */
export function getWeeklyColdOpenCopy(): WeeklyColdOpenCopy {
  return {
    stamp: `${GAZETTE_STATION.callSign} · ${GAZETTE_STATION.desk}`,
    headline: "Is Kahmann a time traveler… or just a no-good cheat?",
    phonetic: "Kahmann — pronounced COMMON",
    body:
      "Gazette investigative reporters are still looking into whether reigning champ Kahmann (say it with us: COMMON) is truly a time traveler… or just a no-good cheat!?!!?",
    kalshi:
      "Either way, Kalshi odds have Andy and Definitely — NOT winning it again.",
    cta: "Cool — back to the room",
    ctaGazette: "Open the Gazette",
  };
}

/** Monday 00:00 local as week id (YYYY-MM-DD of that Monday). */
export function coldOpenWeekId(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(d.getDate() + diff);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, "0");
  const dd = String(mon.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function storageKey(playerId: string, leagueId: string, weekId: string) {
  return `${SEEN_KEY}:${leagueId}:${playerId}:${weekId}`;
}

export function hasSeenWeeklyColdOpen(
  playerId?: string | null,
  leagueId?: string | null,
  nowMs = Date.now()
): boolean {
  if (typeof window === "undefined") return true;
  const pid = playerId || getSession()?.playerId;
  const lid = leagueId || getLeague()?.id || "local";
  if (!pid) return true;
  try {
    return (
      localStorage.getItem(storageKey(pid, lid, coldOpenWeekId(nowMs))) === "1"
    );
  } catch {
    return true;
  }
}

export function markWeeklyColdOpenSeen(
  playerId?: string | null,
  leagueId?: string | null,
  nowMs = Date.now()
): void {
  if (typeof window === "undefined") return;
  const pid = playerId || getSession()?.playerId;
  const lid = leagueId || getLeague()?.id || "local";
  if (!pid) return;
  try {
    localStorage.setItem(storageKey(pid, lid, coldOpenWeekId(nowMs)), "1");
  } catch {
    /* ignore */
  }
}

export function isWeeklyColdOpenWindowOpen(nowMs = Date.now()): boolean {
  return nowMs >= WEEKLY_COLD_OPEN_START_MS;
}

export function shouldShowWeeklyColdOpen(nowMs = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  if (!isWeeklyColdOpenWindowOpen(nowMs)) return false;
  const session = getSession();
  if (!session?.playerId) return false;
  if (hasSeenWeeklyColdOpen(session.playerId, session.leagueId, nowMs)) {
    return false;
  }
  return true;
}
