/**
 * Global “league starts” countdown — everyone sees it until doors open.
 *
 * Target: Sun Aug 23, 2026, 00:01 America/New_York (EDT)
 * (Hype / doors open before Week 0 kickoff Sat Aug 29.)
 */

/** Fixed target as UTC ms for Aug 23, 2026 00:01:00 EDT (UTC-4). */
export const SEASON_OPEN_AT_MS = Date.parse("2026-08-23T04:01:00.000Z");

export const SEASON_OPEN_LABEL = "Sun Aug 23 · 12:01 AM ET";

export type CountdownParts = {
  totalMs: number;
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getCountdownParts(nowMs = Date.now()): CountdownParts {
  const totalMs = SEASON_OPEN_AT_MS - nowMs;
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
