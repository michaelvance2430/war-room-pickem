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

/** Fired after News/announcements are marked read so Nav can drop the badge. */
export const EVENT_ANNOUNCEMENTS_SEEN = "warroom-announcements-seen";

const UNSEEN_TTL_MS = 30_000;
const annCache = new Map<string, { at: number; n: number }>();
const lockerCache = new Map<string, { at: number; n: number }>();

/** Call after posting / opening locker so badge can refresh immediately. */
export function invalidateRoomUnseenCaches() {
  annCache.clear();
  lockerCache.clear();
}

/**
 * Call when the user opens News (/announcements) and reads are stamped.
 * Clears the 30s unread cache and notifies Nav / Home tiles.
 */
export function markAnnouncementsSeen(opts?: { silent?: boolean }) {
  annCache.clear();
  if (opts?.silent) return;
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_ANNOUNCEMENTS_SEEN));
  } catch {
    /* ignore */
  }
}

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
  try {
    // Force next badge count to re-hit network after a visit
    lockerCache.delete(key);
  } catch {
    /* ok */
  }
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
  const key = `${league.id}:${session.playerId}`;
  const hit = annCache.get(key);
  if (hit && Date.now() - hit.at < UNSEEN_TTL_MS) return hit.n;

  try {
    const supabase = createClient();
    // One query for ids is enough — avoid loading full rows then a second round-trip
    // when leagues are small; still two-step for read marks but short-circuit empty.
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id")
      .eq("league_id", league.id)
      .limit(40);

    if (!announcements?.length) {
      annCache.set(key, { at: Date.now(), n: 0 });
      return 0;
    }

    const ids = announcements.map((a) => a.id as string);
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", session.playerId)
      .in("announcement_id", ids);

    const readIds = new Set(
      (reads || []).map((r) => r.announcement_id as string)
    );
    const n = ids.filter((id) => !readIds.has(id)).length;
    annCache.set(key, { at: Date.now(), n });
    return n;
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
  const key = `${league.id}:${session.playerId}`;
  const hit = lockerCache.get(key);
  if (hit && Date.now() - hit.at < UNSEEN_TTL_MS) return hit.n;

  try {
    const { startIso } = getLockerWeekBounds();
    const lastSeen = getLockerLastSeenIso(league.id, session.playerId);
    const supabase = createClient();

    // Head count only — don't download up to 100 message rows for a badge
    let q = supabase
      .from("locker_messages")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .gte("created_at", startIso)
      .neq("user_id", session.playerId);

    if (lastSeen) {
      q = q.gt("created_at", lastSeen);
    }

    const { count, error } = await q;
    if (error) return 0;
    const n = count ?? 0;
    lockerCache.set(key, { at: Date.now(), n });
    return n;
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
