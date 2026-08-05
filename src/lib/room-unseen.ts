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
/** Multi-league announcement unread (Stage 3 hub) — keyed by userId */
const annByLeagueCache = new Map<
  string,
  { at: number; byLeague: Record<string, number> }
>();
const annByLeagueInflight = new Map<
  string,
  Promise<Record<string, number>>
>();

/** Call after posting / opening locker so badge can refresh immediately. */
export function invalidateRoomUnseenCaches() {
  annCache.clear();
  lockerCache.clear();
  annByLeagueCache.clear();
  annByLeagueInflight.clear();
}

/**
 * Call when the user opens News (/announcements) and reads are stamped.
 * Clears the 30s unread cache and notifies Nav / Home tiles.
 */
export function markAnnouncementsSeen(opts?: { silent?: boolean }) {
  annCache.clear();
  // Stage 3 multi-league hub cache must drop so switcher re-fetches truthfully
  annByLeagueCache.clear();
  annByLeagueInflight.clear();
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
    // Prefer multi-league batch cache when warm (same durable source of truth)
    const multi = annByLeagueCache.get(session.playerId);
    if (multi && Date.now() - multi.at < UNSEEN_TTL_MS) {
      const n = multi.byLeague[league.id] ?? 0;
      annCache.set(key, { at: Date.now(), n });
      return n;
    }

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
 * Stage 3 — batched unread commissioner announcements per league.
 *
 * Source of truth: public.announcements − public.announcement_reads
 * for the authenticated user (profiles.id / auth.uid() as user_id).
 *
 * Query shape (not N+1):
 *   1) announcements id+league_id WHERE league_id IN (memberships)
 *   2) announcement_reads for those ids + this user_id (chunked if large)
 *
 * Authorization: only pass league IDs from fetchMyMemberships(); RLS further
 * restricts to leagues the JWT may see. Never localStorage.
 *
 * Failures throw so callers can preserve prior counts (fail closed for
 * announcements without erasing weekly-task badges).
 */
export async function countUnreadAnnouncementsByLeague(
  leagueIds: string[],
  userId: string
): Promise<Record<string, number>> {
  const unique = [...new Set(leagueIds.filter(Boolean))];
  const zeros: Record<string, number> = {};
  for (const id of unique) zeros[id] = 0;
  if (!unique.length || !userId) return zeros;

  const cacheKey = userId;
  const hit = annByLeagueCache.get(cacheKey);
  if (hit && Date.now() - hit.at < UNSEEN_TTL_MS) {
    // Return only requested leagues (still 0-filled)
    const out = { ...zeros };
    for (const id of unique) {
      if (typeof hit.byLeague[id] === "number") out[id] = hit.byLeague[id];
    }
    return out;
  }

  const inflight = annByLeagueInflight.get(cacheKey);
  if (inflight) {
    const full = await inflight;
    const out = { ...zeros };
    for (const id of unique) {
      if (typeof full[id] === "number") out[id] = full[id];
    }
    return out;
  }

  const promise = (async () => {
    const supabase = createClient();
    const { data: announcements, error: aErr } = await supabase
      .from("announcements")
      .select("id, league_id")
      .in("league_id", unique);

    if (aErr) throw aErr;

    const byLeague: Record<string, number> = { ...zeros };
    if (!announcements?.length) {
      annByLeagueCache.set(cacheKey, { at: Date.now(), byLeague });
      return byLeague;
    }

    const idsByLeague = new Map<string, string[]>();
    const allIds: string[] = [];
    for (const row of announcements as {
      id: string;
      league_id: string;
    }[]) {
      if (!row?.id || !row?.league_id) continue;
      // Ignore rows outside the membership boundary (defense in depth)
      if (!zeros.hasOwnProperty(row.league_id) && !unique.includes(row.league_id))
        continue;
      if (!unique.includes(row.league_id)) continue;
      const list = idsByLeague.get(row.league_id) || [];
      list.push(row.id);
      idsByLeague.set(row.league_id, list);
      allIds.push(row.id);
    }

    const readIds = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < allIds.length; i += CHUNK) {
      const chunk = allIds.slice(i, i + CHUNK);
      const { data: reads, error: rErr } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", userId)
        .in("announcement_id", chunk);
      if (rErr) throw rErr;
      for (const r of reads || []) {
        if (r?.announcement_id) readIds.add(r.announcement_id as string);
      }
    }

    for (const [lid, ids] of idsByLeague) {
      byLeague[lid] = ids.filter((id) => !readIds.has(id)).length;
    }

    annByLeagueCache.set(cacheKey, { at: Date.now(), byLeague });
    // Keep single-league nav cache warm for the active room
    try {
      const league = getLeague();
      if (league?.id && typeof byLeague[league.id] === "number") {
        annCache.set(`${league.id}:${userId}`, {
          at: Date.now(),
          n: byLeague[league.id],
        });
      }
    } catch {
      /* optional */
    }
    return byLeague;
  })().finally(() => {
    annByLeagueInflight.delete(cacheKey);
  });

  annByLeagueInflight.set(cacheKey, promise);
  return promise;
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
