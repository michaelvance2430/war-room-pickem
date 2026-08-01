/**
 * Track distinct sport packs a player has joined/played.
 * Powers multi-sport cheevos:
 *  - bare_minimum_dual: joined 2 sports
 *  - dual_desk_legend: finished seasons in NFL AND CFB
 */

const KEY = "warroom-sports-played-v1";
/** Max weeks played per sport (career high-water mark). */
const WEEKS_KEY = "warroom-sports-weeks-v1";

/** Weeks to count as "finished a season" on a desk. */
export const SPORT_FINISH_WEEKS = 10;

type Store = Record<string, string[]>;
type WeeksStore = Record<string, Record<string, number>>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function read(): Store {
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

function write(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function readWeeks(): WeeksStore {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(WEEKS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as WeeksStore;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeWeeks(s: WeeksStore) {
  if (!canUse()) return;
  try {
    localStorage.setItem(WEEKS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function normalizeSportId(sportId: string | null | undefined): string {
  const s = (sportId || "cfb").trim().toLowerCase();
  return s || "cfb";
}

/** Record that this account has been in a league of this sport. */
export function recordSportPlayed(
  userId: string | null | undefined,
  sportId: string | null | undefined
): void {
  if (!userId) return;
  const sid = normalizeSportId(sportId);
  const all = read();
  const list = all[userId] || [];
  if (list.includes(sid)) return;
  all[userId] = [...list, sid];
  write(all);
}

/**
 * Keep career high-water weeks for a sport (CFB desk vs NFL desk).
 * Call with membership weeksPlayed when loading profile / badges.
 */
export function recordSportWeeks(
  userId: string | null | undefined,
  sportId: string | null | undefined,
  weeks: number
): void {
  if (!userId) return;
  const n = Math.max(0, Math.floor(Number(weeks) || 0));
  if (n <= 0) return;
  const sid = normalizeSportId(sportId);
  recordSportPlayed(userId, sid);
  const all = readWeeks();
  const row = all[userId] || {};
  const prev = row[sid] || 0;
  if (n <= prev) return;
  row[sid] = n;
  all[userId] = row;
  writeWeeks(all);
}

export function getSportWeeks(
  userId: string | null | undefined,
  sportId: string
): number {
  if (!userId) return 0;
  return readWeeks()[userId]?.[normalizeSportId(sportId)] || 0;
}

/** True if career weeks on that desk hit the finish bar. */
export function hasFinishedSport(
  userId: string | null | undefined,
  sportId: string,
  minWeeks = SPORT_FINISH_WEEKS
): boolean {
  return getSportWeeks(userId, sportId) >= minWeeks;
}

/**
 * Legendary dual-desk: finished CFB and NFL seasons (not just joined both).
 */
export function hasFinishedNflAndCfb(
  userId: string | null | undefined,
  minWeeks = SPORT_FINISH_WEEKS
): boolean {
  return (
    hasFinishedSport(userId, "cfb", minWeeks) &&
    hasFinishedSport(userId, "nfl", minWeeks)
  );
}

/** Progress toward dual finish: 0–2 desks completed. */
export function dualDeskFinishProgress(
  userId: string | null | undefined,
  minWeeks = SPORT_FINISH_WEEKS
): { current: number; target: number; cfbWeeks: number; nflWeeks: number } {
  const cfbWeeks = getSportWeeks(userId, "cfb");
  const nflWeeks = getSportWeeks(userId, "nfl");
  let current = 0;
  if (cfbWeeks >= minWeeks) current += 1;
  if (nflWeeks >= minWeeks) current += 1;
  return { current, target: 2, cfbWeeks, nflWeeks };
}

export function getSportsPlayed(userId: string | null | undefined): string[] {
  if (!userId) return [];
  return [...(read()[userId] || [])];
}

export function getSportsPlayedCount(userId: string | null | undefined): number {
  return getSportsPlayed(userId).length;
}

/**
 * Sync from cloud memberships (distinct sport_id). Safe to call often.
 */
export function mergeSportsFromMemberships(
  userId: string | null | undefined,
  memberships: {
    sportId?: string | null;
    weeksPlayed?: number | null;
  }[]
): number {
  if (!userId || !memberships?.length) return getSportsPlayedCount(userId);
  for (const m of memberships) {
    recordSportPlayed(userId, m.sportId);
    if (m.weeksPlayed != null && m.weeksPlayed > 0) {
      recordSportWeeks(userId, m.sportId, m.weeksPlayed);
    }
  }
  return getSportsPlayedCount(userId);
}
