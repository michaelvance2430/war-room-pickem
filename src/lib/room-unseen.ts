/**
 * Unseen activity for Home / nav: announcements (cloud reads) +
 * locker posts (per-device last-seen watermark).
 *
 * Locker: walking into /locker-room clears the badge automatically —
 * no extra tap. Watermark = max(now, newest message on screen).
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { getLockerWeekBounds } from "@/lib/locker-room";

const LOCKER_SEEN_KEY = "warroom-locker-seen-v1";

/** Fired after markLockerSeen so Nav / Home can drop badges without a full reload. */
export const EVENT_LOCKER_SEEN = "warroom-locker-seen";

type LockerSeenStore = Record<string, string>; // `${leagueId}:${userId}` → ISO timestamp

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function lockerKey(leagueId: string, userId: string) {
  return `${leagueId}:${userId}`;
}

function readLockerSeen(): LockerSeenStore {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(LOCKER_SEEN_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as LockerSeenStore;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeLockerSeen(store: LockerSeenStore) {
  if (!canUse()) return;
  try {
    localStorage.setItem(LOCKER_SEEN_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function emitLockerSeen() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_LOCKER_SEEN));
  } catch {
    /* ignore */
  }
}

export function getLockerLastSeenIso(
  leagueId: string,
  userId: string
): string | null {
  if (!leagueId || !userId) return null;
  return readLockerSeen()[lockerKey(leagueId, userId)] || null;
}

/**
 * Call when the user opens Locker Room (or after they post).
 * Uses the later of `atIso` and now so clock skew / sort mistakes can't leave
 * a sticky "1 unread".
 */
export function markLockerSeen(opts?: {
  leagueId?: string;
  userId?: string;
  /** Newest message createdAt if known */
  atIso?: string;
  /** Skip browser event (batch) */
  silent?: boolean;
}) {
  const session = getSession();
  const league = getLeague();
  const leagueId = opts?.leagueId || league?.id || session?.leagueId || "";
  const userId = opts?.userId || session?.playerId || "";
  if (!leagueId || !userId) return;

  const nowMs = Date.now();
  let atMs = nowMs;
  if (opts?.atIso) {
    const t = new Date(opts.atIso).getTime();
    if (!Number.isNaN(t)) atMs = Math.max(atMs, t);
  }
  // Small pad so equality / ms rounding never leaves the newest post "after" watermark
  const at = new Date(atMs + 500).toISOString();

  const all = readLockerSeen();
  const key = lockerKey(leagueId, userId);
  const prev = all[key];
  // Never move watermark backward
  if (prev && new Date(prev).getTime() >= new Date(at).getTime()) {
    if (!opts?.silent) emitLockerSeen();
    return;
  }
  all[key] = at;
  writeLockerSeen(all);
  if (!opts?.silent) emitLockerSeen();
}

/**
 * Mark fully caught up from a loaded thread (oldest→newest or any order).
 * Prefer this over passing list[0].
 */
export function markLockerCaughtUp(
  messages: { createdAt?: string | null }[]
) {
  let newest: string | undefined;
  let newestMs = 0;
  for (const m of messages) {
    if (!m.createdAt) continue;
    const t = new Date(m.createdAt).getTime();
    if (!Number.isNaN(t) && t >= newestMs) {
      newestMs = t;
      newest = m.createdAt;
    }
  }
  markLockerSeen({ atIso: newest });
}

export async function countUnreadAnnouncements(): Promise<number> {
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) return 0;
  try {
    const supabase = createClient();
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id")
      .eq("league_id", league.id);

    if (!announcements?.length) return 0;

    const ids = announcements.map((a) => a.id as string);
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", session.playerId)
      .in("announcement_id", ids);

    const readIds = new Set(
      (reads || []).map((r) => r.announcement_id as string)
    );
    return ids.filter((id) => !readIds.has(id)).length;
  } catch {
    return 0;
  }
}

/**
 * Locker posts this football week that are newer than last visit,
 * not written by you.
 */
export async function countUnseenLockerPosts(): Promise<number> {
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) return 0;
  try {
    const { startIso } = getLockerWeekBounds();
    const lastSeen = getLockerLastSeenIso(league.id, session.playerId);
    const supabase = createClient();

    let q = supabase
      .from("locker_messages")
      .select("id, user_id, created_at", { count: "exact", head: false })
      .eq("league_id", league.id)
      .gte("created_at", startIso)
      .neq("user_id", session.playerId);

    if (lastSeen) {
      q = q.gt("created_at", lastSeen);
    }

    const { data, error } = await q.limit(100);
    if (error) return 0;
    return (data || []).length;
  } catch {
    return 0;
  }
}

export type RoomUnseen = {
  announcements: number;
  locker: number;
  total: number;
};

export async function loadRoomUnseen(): Promise<RoomUnseen> {
  const [announcements, locker] = await Promise.all([
    countUnreadAnnouncements(),
    countUnseenLockerPosts(),
  ]);
  return {
    announcements,
    locker,
    total: announcements + locker,
  };
}
