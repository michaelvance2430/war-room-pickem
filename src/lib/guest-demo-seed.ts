/**
 * Seed a lived-in Demo War Room through Week 9 for guest mode.
 * LocalStorage only — bots, scored weeks 0–8, open card on week 9.
 */

import type { Player } from "./types";
import type { League, Session } from "./league";
import { mockPlayers } from "./mock-data";
import { generateDemoSlate } from "./demo-slate";
import { propFromPreset, PROP_PRESETS } from "./prop-presets";
import { savePlayers } from "./store";

export const GUEST_LEAGUE_ID = "guest-demo-league";
export const GUEST_PLAYER_ID = "guest-you";
export const GUEST_ACTIVE_WEEK = 9;
/** Weeks already scored in the demo (0…8). Guest lands on week 9. */
export const GUEST_SCORED_WEEKS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";
const ACTIVE_WEEK_KEY = "warroom-active-week";
const SCORED_KEY = "warroom-guest-scored-weeks";

function mulberry(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildWeeklySeries(seed: number, weeks: number): number[] {
  const rand = mulberry(seed);
  const out: number[] = [];
  for (let i = 0; i < weeks; i++) {
    out.push(Math.floor(4 + rand() * 14)); // ~4–17 pts/week
  }
  return out;
}

function seedRoster(): Player[] {
  const weeksDone = GUEST_SCORED_WEEKS.length; // 9
  const guest: Player = {
    id: GUEST_PLAYER_ID,
    name: "You (Guest)",
    division: "North",
    totalPoints: 0,
    weeklyPoints: buildWeeklySeries(42, weeksDone),
    atsCorrect: 28,
    atsTotal: 45,
    currentStreak: 2,
    bestWeek: 16,
    worstWeek: 5,
    perfectWeeks: 0,
    bestBetHits: 3,
    bestBetTotal: 9,
    propHits: 5,
    propTotal: 9,
    weeksPlayed: weeksDone,
    memberSince: "2026-08-20T12:00:00.000Z",
    avatarUrl: null,
    isCreator: false,
    isMock: false,
  };
  guest.totalPoints = guest.weeklyPoints.reduce((a, b) => a + b, 0);

  // Use mock bots but stretch weekly series to 9 weeks + recompute totals
  const bots: Player[] = mockPlayers
    .filter((p) => p.id !== "1")
    .slice(0, 15)
    .map((p, i) => {
      const weeklyPoints = buildWeeklySeries(100 + i * 17, weeksDone);
      const totalPoints = weeklyPoints.reduce((a, b) => a + b, 0);
      return {
        ...p,
        id: `guest-bot-${p.id}`,
        weeklyPoints,
        totalPoints,
        weeksPlayed: weeksDone,
        atsTotal: weeksDone * 5,
        atsCorrect: Math.floor(weeksDone * 5 * (0.45 + (i % 5) * 0.05)),
        bestWeek: Math.max(...weeklyPoints),
        worstWeek: Math.min(...weeklyPoints),
        bestBetTotal: weeksDone,
        bestBetHits: Math.floor(weeksDone * 0.35),
        propTotal: weeksDone,
        propHits: Math.floor(weeksDone * 0.5),
        isMock: true,
        isCreator: false,
      };
    });

  // Sort-ish standings flavor: put a couple bots ahead of guest
  return [guest, ...bots];
}

function seedWeekCard(week: number) {
  const games = generateDemoSlate(week, 5);
  // Week 9: kickoffs in the future so guest can still "pick"
  if (week === GUEST_ACTIVE_WEEK) {
    const base = Date.now() + 3 * 24 * 60 * 60 * 1000;
    games.forEach((g, i) => {
      const t = new Date(base + i * 3 * 60 * 60 * 1000);
      g.commenceTime = t.toISOString();
      g.startTime = t.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: "America/New_York",
      });
    });
  }
  const prop = propFromPreset(PROP_PRESETS[week % PROP_PRESETS.length], week);
  const payload = {
    games,
    prop,
    weekNumber: week,
  };
  localStorage.setItem(`warroom-card-week-${week}`, JSON.stringify(payload));
}

export function seedGuestDemoWorld() {
  const league: League = {
    id: GUEST_LEAGUE_ID,
    name: "Demo War Room",
    code: "GUEST1",
    commissionerId: GUEST_PLAYER_ID,
    createdAt: "2026-08-15T12:00:00.000Z",
    settings: {
      cutPercent: 50,
      regularSeasonWeeks: 18,
      gamesPerWeek: 5,
      crystalBallEnabled: true,
      homeTaglineId: "good-teams",
      homeTaglineCustom: "",
      seasonThemeId: "default",
    },
  };

  const session: Session = {
    playerId: GUEST_PLAYER_ID,
    playerName: "You (Guest)",
    isCommissioner: false, // set when they pick Commish role
    leagueId: GUEST_LEAGUE_ID,
  };

  localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(ACTIVE_WEEK_KEY, String(GUEST_ACTIVE_WEEK));
  localStorage.setItem(SCORED_KEY, JSON.stringify(GUEST_SCORED_WEEKS));

  savePlayers(seedRoster());

  // Scored weeks 0–8: store cards (viewable); active week 9 open for picks
  for (const w of GUEST_SCORED_WEEKS) {
    seedWeekCard(w);
  }
  seedWeekCard(GUEST_ACTIVE_WEEK);
}

export function getGuestScoredWeeks(): number[] {
  try {
    const raw = localStorage.getItem(SCORED_KEY);
    if (!raw) return [...GUEST_SCORED_WEEKS];
    const p = JSON.parse(raw) as number[];
    return Array.isArray(p) ? p : [...GUEST_SCORED_WEEKS];
  } catch {
    return [...GUEST_SCORED_WEEKS];
  }
}
