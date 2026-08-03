/**
 * Cloud-backed easter egg finds + Ready Player One milestone flexes.
 *
 * Production may lag migrations (schema drift). After one missing-table /
 * missing-function error we stop re-hitting PostgREST for the session so
 * profile "Load details" does not spam 404s. Local egg state still works.
 * Full schema: supabase/easter-eggs.sql / FIX-EASTER-EGG-FINDS.sql
 */

import { createClient } from "@/lib/supabase/client";
import { listEasterEggDefs } from "@/lib/easter-eggs";

/** In-memory cache: userId → discovery ids from cloud */
const cloudEggCache = new Map<string, Set<string>>();

/**
 * Session capability: easter_egg_finds + record_easter_egg_find package.
 * null = unknown, true = works, false = missing (skip further requests).
 */
let eggFindsAvailable: boolean | null = null;
/** Separate flag for egg_milestone_flexes reads */
let eggFlexesAvailable: boolean | null = null;

function isMissingSchemaError(err: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const blob = `${err.message || ""} ${err.details || ""} ${err.hint || ""}`;
  return (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    /could not find the table|could not find the function|relation .* does not exist|schema cache/i.test(
      blob
    )
  );
}

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
  if (eggFindsAvailable === false) return getCachedCloudEggIds(userId);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("easter_egg_finds")
      .select("discovery_id")
      .eq("user_id", userId);
    if (error) {
      if (isMissingSchemaError(error)) eggFindsAvailable = false;
      return getCachedCloudEggIds(userId);
    }
    eggFindsAvailable = true;
    if (!data) return getCachedCloudEggIds(userId);
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
  if (eggFindsAvailable === false) return { ok: false };
  try {
    const supabase = createClient();
    const total = listEasterEggDefs().length;
    const { data, error } = await supabase.rpc("record_easter_egg_find", {
      p_discovery_id: discoveryId,
      p_player_name: playerName || "A player",
      p_total_eggs: total,
    });
    if (error) {
      if (isMissingSchemaError(error)) {
        eggFindsAvailable = false;
        return { ok: false };
      }
      // Fallback: direct insert if RPC missing but table exists
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { ok: false };
      const { error: insErr } = await supabase.from("easter_egg_finds").upsert({
        user_id: uid,
        discovery_id: discoveryId,
        found_at: new Date().toISOString(),
      });
      if (insErr) {
        if (isMissingSchemaError(insErr)) eggFindsAvailable = false;
        return { ok: false };
      }
      eggFindsAvailable = true;
      addCloudEggToCache(uid, discoveryId);
      return { ok: true };
    }
    eggFindsAvailable = true;
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

/**
 * Unseen milestone newspapers — PLATFORM-WIDE.
 * Every signed-in player in every league / sport can see them.
 * Eggs are account-wide, not sport-specific.
 */
export async function loadUnseenEggFlexes(): Promise<EggMilestoneFlex[]> {
  if (eggFlexesAvailable === false) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("egg_milestone_flexes")
      .select(
        "id, finder_user_id, finder_name, found, total, milestone, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      if (isMissingSchemaError(error)) eggFlexesAvailable = false;
      return [];
    }
    eggFlexesAvailable = true;
    if (!data) return [];
    const seen = readSeenFlexIds();
    return data
      .map((r) => ({
        id: r.id as string,
        finderUserId: r.finder_user_id as string,
        finderName: (r.finder_name as string) || "A player",
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
