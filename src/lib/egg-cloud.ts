/**
 * Cloud-backed easter egg finds + Ready Player One milestone flexes.
 */

import { createClient } from "@/lib/supabase/client";
import { listEasterEggDefs } from "@/lib/easter-eggs";

/** In-memory cache: userId → discovery ids from cloud */
const cloudEggCache = new Map<string, Set<string>>();

export function getCachedCloudEggIds(userId: string): string[] {
  if (!userId) return [];
  return [...(cloudEggCache.get(userId) || new Set())];
}

export function hasCachedCloudEgg(userId: string, discoveryId: string): boolean {
  return cloudEggCache.get(userId)?.has(discoveryId) ?? false;
}

export function seedCloudEggCache(userId: string, ids: string[]) {
  if (!userId) return;
  cloudEggCache.set(userId, new Set(ids.filter((id) => id.startsWith("egg_"))));
}

export function addCloudEggToCache(userId: string, discoveryId: string) {
  if (!userId || !discoveryId.startsWith("egg_")) return;
  const set = cloudEggCache.get(userId) || new Set<string>();
  set.add(discoveryId);
  cloudEggCache.set(userId, set);
}

/** Load egg finds for a profile (self or league mate). */
export async function loadCloudEggFinds(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("easter_egg_finds")
      .select("discovery_id")
      .eq("user_id", userId);
    if (error || !data) return getCachedCloudEggIds(userId);
    const ids = data
      .map((r) => r.discovery_id as string)
      .filter((id) => id?.startsWith("egg_"));
    seedCloudEggCache(userId, ids);
    return ids;
  } catch {
    return getCachedCloudEggIds(userId);
  }
}

/**
 * Persist a find + maybe fire 7 / 10 / full flexes into every league.
 * Call after local grantDiscovery succeeds for egg_*.
 */
export async function syncEasterEggFindToCloud(opts: {
  discoveryId: string;
  playerName: string;
}): Promise<{
  ok: boolean;
  found?: number;
  total?: number;
  flexesInserted?: number;
}> {
  const { discoveryId, playerName } = opts;
  if (!discoveryId?.startsWith("egg_")) return { ok: false };
  try {
    const supabase = createClient();
    const total = listEasterEggDefs().length;
    const { data, error } = await supabase.rpc("record_easter_egg_find", {
      p_discovery_id: discoveryId,
      p_player_name: playerName || "A player",
      p_total_eggs: total,
    });
    if (error) {
      // Fallback: direct insert if RPC missing
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { ok: false };
      await supabase.from("easter_egg_finds").upsert({
        user_id: uid,
        discovery_id: discoveryId,
        found_at: new Date().toISOString(),
      });
      addCloudEggToCache(uid, discoveryId);
      return { ok: true };
    }
    const row = data as {
      ok?: boolean;
      found?: number;
      total?: number;
      flexesInserted?: number;
    } | null;
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user?.id) addCloudEggToCache(auth.user.id, discoveryId);
    return {
      ok: row?.ok !== false,
      found: row?.found,
      total: row?.total ?? total,
      flexesInserted: row?.flexesInserted ?? 0,
    };
  } catch {
    return { ok: false };
  }
}

export type EggMilestoneFlex = {
  id: string;
  finderUserId: string;
  finderName: string;
  leagueId: string;
  found: number;
  total: number;
  milestone: number;
  createdAt: string;
};

const SEEN_FLEX_KEY = "warroom-egg-flex-seen-v1";

function readSeenFlexIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_FLEX_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeenFlexIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_FLEX_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function markEggFlexSeen(flexId: string) {
  const s = readSeenFlexIds();
  s.add(flexId);
  writeSeenFlexIds(s);
}

/** Unseen milestone newspapers for leagues you're in. */
export async function loadUnseenEggFlexes(
  leagueId: string | null | undefined
): Promise<EggMilestoneFlex[]> {
  if (!leagueId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("egg_milestone_flexes")
      .select(
        "id, finder_user_id, finder_name, league_id, found, total, milestone, created_at"
      )
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    const seen = readSeenFlexIds();
    return data
      .map((r) => ({
        id: r.id as string,
        finderUserId: r.finder_user_id as string,
        finderName: (r.finder_name as string) || "A player",
        leagueId: r.league_id as string,
        found: r.found as number,
        total: r.total as number,
        milestone: r.milestone as number,
        createdAt: (r.created_at as string) || new Date().toISOString(),
      }))
      .filter((f) => !seen.has(f.id));
  } catch {
    return [];
  }
}
