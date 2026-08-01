/**
 * Track distinct sport packs a player has joined/played.
 * Powers multi-sport cheevos (start small: 2 sports).
 */

const KEY = "warroom-sports-played-v1";

type Store = Record<string, string[]>;

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
  memberships: { sportId?: string | null }[]
): number {
  if (!userId || !memberships?.length) return getSportsPlayedCount(userId);
  for (const m of memberships) {
    recordSportPlayed(userId, m.sportId);
  }
  return getSportsPlayedCount(userId);
}
