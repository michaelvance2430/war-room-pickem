/**
 * Chaos Mode — pure random card, 2× week points, 2 uses/season.
 * Visible: flames on name while Chaos is locked for the live week.
 */

import type { Game, Prop, UserPick } from "./types";
import { getSession, getLeague } from "./league";
import { defaultSeasonYear } from "./trophies";

export const CHAOS_USES_PER_SEASON = 2;
export const CHAOS_BADGE_ID = "let_them_cook";

const USES_KEY = "warroom-chaos-uses-v1";
const WEEKS_KEY = "warroom-chaos-weeks-v1"; // leagueId → { userId: weekNumbers[] }
const ACTIVE_KEY = "warroom-chaos-active-v1"; // leagueId → { userId: weekNumber } live flames

export type ChaosUsesState = {
  seasonYear: number;
  used: number;
  /** Weeks this season that were Chaos locks */
  weekNumbers: number[];
};

type UsesStore = Record<string, ChaosUsesState>; // `${leagueId}:${userId}`

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function usesKey(leagueId: string, userId: string) {
  return `${leagueId}:${userId}`;
}

function readUsesStore(): UsesStore {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(USES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UsesStore;
  } catch {
    return {};
  }
}

function writeUsesStore(s: UsesStore) {
  if (!canUse()) return;
  try {
    localStorage.setItem(USES_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getChaosUsesRemaining(
  leagueId?: string | null,
  userId?: string | null,
  seasonYear = defaultSeasonYear()
): number {
  const lid = leagueId || getLeague()?.id;
  const uid = userId || getSession()?.playerId;
  if (!lid || !uid) return CHAOS_USES_PER_SEASON;
  const row = readUsesStore()[usesKey(lid, uid)];
  if (!row || row.seasonYear !== seasonYear) return CHAOS_USES_PER_SEASON;
  return Math.max(0, CHAOS_USES_PER_SEASON - (row.used || 0));
}

export function getChaosUsesState(
  leagueId?: string | null,
  userId?: string | null,
  seasonYear = defaultSeasonYear()
): ChaosUsesState {
  const lid = leagueId || getLeague()?.id;
  const uid = userId || getSession()?.playerId;
  if (!lid || !uid) {
    return { seasonYear, used: 0, weekNumbers: [] };
  }
  const row = readUsesStore()[usesKey(lid, uid)];
  if (!row || row.seasonYear !== seasonYear) {
    return { seasonYear, used: 0, weekNumbers: [] };
  }
  return row;
}

/** Spend one Chaos charge for this week (idempotent if week already Chaos). */
export function spendChaosUse(
  weekNumber: number,
  leagueId?: string | null,
  userId?: string | null,
  seasonYear = defaultSeasonYear()
): { ok: boolean; remaining: number; error?: string } {
  const lid = leagueId || getLeague()?.id;
  const uid = userId || getSession()?.playerId;
  if (!lid || !uid) return { ok: false, remaining: 0, error: "Not signed in" };

  const store = readUsesStore();
  const k = usesKey(lid, uid);
  let row = store[k];
  if (!row || row.seasonYear !== seasonYear) {
    row = { seasonYear, used: 0, weekNumbers: [] };
  }
  if (row.weekNumbers.includes(weekNumber)) {
    markChaosActive(lid, uid, weekNumber);
    return {
      ok: true,
      remaining: Math.max(0, CHAOS_USES_PER_SEASON - row.used),
    };
  }
  if (row.used >= CHAOS_USES_PER_SEASON) {
    return {
      ok: false,
      remaining: 0,
      error: "No Chaos charges left this season (2 max).",
    };
  }
  row = {
    seasonYear,
    used: row.used + 1,
    weekNumbers: [...row.weekNumbers, weekNumber],
  };
  store[k] = row;
  writeUsesStore(store);
  markChaosActive(lid, uid, weekNumber);
  rememberChaosWeek(lid, uid, weekNumber);
  return {
    ok: true,
    remaining: Math.max(0, CHAOS_USES_PER_SEASON - row.used),
  };
}

export function isWeekChaosForUser(
  weekNumber: number,
  leagueId?: string | null,
  userId?: string | null,
  seasonYear = defaultSeasonYear()
): boolean {
  const st = getChaosUsesState(leagueId, userId, seasonYear);
  return st.weekNumbers.includes(weekNumber);
}

/** Live flames registry for the room (best-effort; cloud is_chaos is source of truth when available). */
function readActive(): Record<string, Record<string, number>> {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Record<string, number>>;
  } catch {
    return {};
  }
}

function writeActive(m: Record<string, Record<string, number>>) {
  if (!canUse()) return;
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function markChaosActive(
  leagueId: string,
  userId: string,
  weekNumber: number
) {
  const m = readActive();
  if (!m[leagueId]) m[leagueId] = {};
  m[leagueId][userId] = weekNumber;
  writeActive(m);
  try {
    window.dispatchEvent(
      new CustomEvent("warroom-chaos-active", {
        detail: { leagueId, userId, weekNumber },
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearChaosActiveIfWeek(
  leagueId: string,
  userId: string,
  weekNumber: number
) {
  const m = readActive();
  if (m[leagueId]?.[userId] === weekNumber) {
    delete m[leagueId][userId];
    writeActive(m);
  }
}

export function isChaosFlamesActive(
  userId: string | null | undefined,
  liveWeek: number,
  leagueId?: string | null
): boolean {
  if (!userId) return false;
  const lid = leagueId || getLeague()?.id;
  if (!lid) return false;
  const m = readActive();
  return m[lid]?.[userId] === liveWeek;
}

/** Merge cloud slips into flames registry for current week. */
export function hydrateChaosFlamesFromSlips(
  leagueId: string,
  liveWeek: number,
  slips: { userId: string; isChaos?: boolean; lockedAt?: string | null }[]
) {
  const m = readActive();
  if (!m[leagueId]) m[leagueId] = {};
  for (const s of slips) {
    if (s.isChaos && s.lockedAt) {
      m[leagueId][s.userId] = liveWeek;
    }
  }
  writeActive(m);
}

function rememberChaosWeek(leagueId: string, userId: string, week: number) {
  if (!canUse()) return;
  try {
    const raw = localStorage.getItem(WEEKS_KEY);
    const all = raw
      ? (JSON.parse(raw) as Record<string, Record<string, number[]>>)
      : {};
    if (!all[leagueId]) all[leagueId] = {};
    const list = all[leagueId][userId] || [];
    if (!list.includes(week)) all[leagueId][userId] = [...list, week];
    localStorage.setItem(WEEKS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pure random legal card: random sides, conf 1–5 once each, random BB, random prop.
 * No favorites bias — coin flip only.
 */
export function generateChaosCard(opts: {
  games: Game[];
  prop: Prop;
}): {
  picks: Record<string, UserPick>;
  bestBetId: string;
  propChoice: string;
} {
  const games = opts.games;
  const confs = shuffle(
    [1, 2, 3, 4, 5].slice(0, Math.max(1, games.length))
  );
  const picks: Record<string, UserPick> = {};
  games.forEach((g, i) => {
    const side: "home" | "away" = Math.random() < 0.5 ? "home" : "away";
    picks[g.id] = {
      gameId: g.id,
      pick: side,
      confidence: confs[i] ?? i + 1,
      isBestBet: false,
      lockedSpread: g.spread,
      lockedFavorite: g.favorite,
    };
  });
  const ids = games.map((g) => g.id);
  const bestBetId = ids[Math.floor(Math.random() * ids.length)] || ids[0];
  if (bestBetId && picks[bestBetId]) {
    picks[bestBetId] = { ...picks[bestBetId], isBestBet: true };
  }
  const optsProp = opts.prop.options || ["A", "B"];
  const propChoice =
    optsProp[Math.floor(Math.random() * optsProp.length)] || optsProp[0];
  return { picks, bestBetId, propChoice };
}

/** Apply Chaos double after base week score. */
export function applyChaosWeekMultiplier(
  totalPoints: number,
  isChaos: boolean
): number {
  if (!isChaos) return totalPoints;
  return totalPoints * 2;
}

export function chaosExtremeLabel(weekPoints: number, isChaos: boolean): {
  kind: "nuke" | "meltdown" | null;
  text: string;
} {
  if (!isChaos) return { kind: null, text: "" };
  // Doubled totals: nuke if still huge, meltdown if tiny
  if (weekPoints >= 28) {
    return {
      kind: "nuke",
      text: "CHAOS NUKE — robots cooked",
    };
  }
  if (weekPoints <= 6) {
    return {
      kind: "meltdown",
      text: "CHAOS MELTDOWN — blue screen",
    };
  }
  return { kind: null, text: "" };
}
