/**
 * Unseen activity for Home / nav: announcements (cloud reads) +
 * locker posts (per-device last-seen watermark).
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { getLockerWeekBounds } from "@/lib/locker-room";

const LOCKER_SEEN_KEY = "warroom-locker-seen-v1";

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

export function getLockerLastSeenIso(
  leagueId: string,
  userId: string
): string | null {
  if (!leagueId || !userId) return null;
  return readLockerSeen()[lockerKey(leagueId, userId)] || null;
}

/** Call when the user opens Locker Room (or after they post). */
export function markLockerSeen(opts?: {
  leagueId?: string;
  userId?: string;
  /** Default: now. Pass latest message createdAt to avoid race with poll. */
  atIso?: string;
}) {
  const session = getSession();
  const league = getLeague();
  const leagueId = opts?.leagueId || league?.id || session?.leagueId || "";
  const userId = opts?.userId || session?.playerId || "";
  if (!leagueId || !userId) return;
  const at = opts?.atIso || new Date().toISOString();
  const all = readLockerSeen();
  const key = lockerKey(leagueId, userId);
  const prev = all[key];
  // Never move watermark backward
  if (prev && new Date(prev).getTime() >= new Date(at).getTime()) return;
  all[key] = at;
  writeLockerSeen(all);
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
