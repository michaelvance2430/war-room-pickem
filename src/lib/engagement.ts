/**
 * Lightweight client engagement flags for badges that aren't on memberships
 * (opened standings, rules, locker, announcements, other profiles).
 */

const KEY = "warroom-engagement-v1";

type Store = Record<string, Record<string, boolean>>;

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

export type EngagementKey =
  | "opened_standings"
  | "opened_rules"
  | "opened_locker"
  | "opened_announcements"
  | "opened_other_profile"
  | "posted_locker"
  | "locked_after_22"
  | "crystal_ball_picked"
  | "push_recorded";

export function markEngagement(
  userId: string,
  key: EngagementKey
): void {
  if (!userId) return;
  const all = read();
  const row = all[userId] || {};
  if (row[key]) return;
  row[key] = true;
  all[userId] = row;
  write(all);
}

export function hasEngagement(userId: string, key: EngagementKey): boolean {
  if (!userId) return false;
  return !!read()[userId]?.[key];
}
