/**
 * Fake 5-game slates for full-season dry runs (no Odds API required).
 */

import type { Game } from "./types";
import type { GameResult } from "./scoring";
import { listFbsTeams } from "./fbs-teams";
import { weekDateWindow } from "./season-calendar";

function mulberry(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic 5-game demo card for a pick'em week.
 * Teams/spreads/kickoffs change by weekNumber so each week looks different.
 */
export function generateDemoSlate(weekNumber: number, count = 5): Game[] {
  const names = listFbsTeams().map((t) => t.name);
  const rand = mulberry(10007 + weekNumber * 9973);
  const used = new Set<string>();
  const win = weekDateWindow(weekNumber);
  const baseDay = win?.startDate || "2026-09-01";

  const games: Game[] = [];
  for (let i = 0; i < count; i++) {
    let away = "";
    let home = "";
    let guard = 0;
    while (guard++ < 200) {
      away = names[Math.floor(rand() * names.length)];
      home = names[Math.floor(rand() * names.length)];
      if (away !== home && !used.has(away) && !used.has(home)) break;
    }
    used.add(away);
    used.add(home);

    // Home spread points (negative = home favored) — matches Odds API mapping
    const mag = Math.round((1 + rand() * 13) * 2) / 2; // 1–14 by half
    const homeFavored = rand() < 0.55;
    const spread = homeFavored ? -mag : mag;
    const favorite: "home" | "away" = spread < 0 ? "home" : "away";

    // Kickoffs across the window (or consecutive days from base)
    const dayOffset = i % 5;
    const kick = demoKickoffIso(baseDay, dayOffset, 12 + (i % 8)); // noon–evening ET-ish

    const start = new Date(kick);
    const startTime = start.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "America/New_York",
    });

    games.push({
      id: `demo-w${weekNumber}-g${i}`,
      oddsEventId: `demo-w${weekNumber}-g${i}`,
      awayTeam: away,
      homeTeam: home,
      spread,
      favorite,
      startTime,
      commenceTime: kick,
      bookmaker: "demo-sim",
    });
  }
  return games;
}

function demoKickoffIso(
  startYmd: string,
  dayOffset: number,
  hourEt: number
): string {
  const [y, m, d] = startYmd.split("-").map(Number);
  // Build as noon UTC then label as ET display; use fixed -04:00 for demo consistency
  const day = d + dayOffset;
  const hh = String(Math.min(23, Math.max(11, hourEt))).padStart(2, "0");
  const mm = dayOffset % 2 === 0 ? "00" : "30";
  // Pad month/day carefully via Date
  const dt = new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
  const ymd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  return `${ymd}T${hh}:${mm}:00-04:00`;
}

/** Random ATS covers + prop option for dry-run scoring. */
export function randomizeDemoResults(
  games: Game[],
  propOptions: [string, string] | string[]
): { results: Record<string, GameResult>; propResult: string } {
  const rand = mulberry(Date.now() % 1_000_000);
  const results: Record<string, GameResult> = {};
  for (const g of games) {
    const r = rand();
    const winner: "home" | "away" | "push" =
      r < 0.08 ? "push" : r < 0.54 ? "home" : "away";
    results[g.id] = { gameId: g.id, winner };
  }
  const opts = propOptions?.length >= 2 ? propOptions : ["Yes", "No"];
  const propResult = opts[rand() < 0.5 ? 0 : 1];
  return { results, propResult };
}
