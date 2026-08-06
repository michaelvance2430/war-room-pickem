/**
 * Cloud-backed easter egg finds + Ready Player One milestone flexes.
 *
 * D-02 P7 (local proposal — not on main until Mike authorizes merge):
 * - No direct easter_egg_finds upsert fallback (RPC-only).
 * - RPC failure → ok:false, cloudSynced:false.
 * - Durable per-user pending queue (survives logout / other-account login).
 * - Flush only the authenticated user's queue; never cross-send.
 * - Bounded exponential backoff via nextAttemptAt (no immediate retry loop).
 * - Permanent rejections stop automatic retry.
 */

import { createClient } from "@/lib/supabase/client";
import { listEasterEggDefs } from "@/lib/easter-eggs";
import { isApprovedEasterEggId } from "@/lib/easter-egg-db-catalog-seed";
import {
  interpretRecordEggRpcResponse,
  isPermanentEggSyncRejection,
  isTemporaryEggSyncFailure,
  type SyncEggResult,
} from "@/lib/egg-cloud-sync-core";
import {
  clearPendingEgg,
  enqueuePendingEgg,
  listPendingRetryIds,
  markPendingAttemptWithBackoff,
  markPendingPermanentRejected,
} from "@/lib/egg-cloud-pending";

export type { SyncEggResult } from "@/lib/egg-cloud-sync-core";
export {
  shouldDispatchEggFlex,
  shouldUpdateCloudEggCache,
  isTemporaryEggSyncFailure,
  isPermanentEggSyncRejection,
  shouldEnqueuePendingAfterSync,
} from "@/lib/egg-cloud-sync-core";
export {
  EGG_CLOUD_PENDING_STORAGE_KEY,
  listPendingRetryIds,
  clearPendingForUser,
  getPendingEntry,
  computeBackoffMs,
  computeNextAttemptAtIso,
} from "@/lib/egg-cloud-pending";

/** In-memory cache: userId → discovery ids from cloud */
const cloudEggCache = new Map<string, Set<string>>();

let eggFindsAvailable: boolean | null = null;
let eggFlexesAvailable: boolean | null = null;

let flushInFlight: Promise<FlushPendingResult> | null = null;

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
 * After a sync attempt: success clears pending; permanent stops retry;
 * temporary enqueues/updates with backoff (no recursive flush).
 */
function applyPendingOutcome(
  userId: string | null | undefined,
  discoveryId: string,
  result: SyncEggResult,
  opts?: { fromFlushAttempt?: boolean }
): void {
  if (!userId || !isApprovedEasterEggId(discoveryId)) return;

  if (result.cloudSynced && result.ok) {
    clearPendingEgg(userId, discoveryId);
    return;
  }

  if (isPermanentEggSyncRejection(result)) {
    markPendingPermanentRejected(userId, discoveryId, {
      error: result.error,
      reason: result.reason,
    });
    return;
  }

  if (isTemporaryEggSyncFailure(result)) {
    if (opts?.fromFlushAttempt) {
      // Consumed an attempt during flush → schedule nextAttemptAt in the future
      markPendingAttemptWithBackoff(userId, discoveryId, {
        error: result.error,
        reason: result.reason,
      });
    } else {
      // First-path failure after local grant: enqueue, eligible immediately once
      enqueuePendingEgg(userId, discoveryId, {
        error: result.error,
        reason: result.reason,
      });
    }
  }
}

/**
 * RPC-only sync. Never upserts easter_egg_finds.
 * Name/total not authoritative (dummy signature args only).
 */
export async function syncEasterEggFindToCloud(opts: {
  discoveryId: string;
  /** @deprecated Untrusted — ignored for authority. */
  playerName?: string;
  /** Must be the authenticated user; pending scoped to this id only. */
  userId?: string | null;
  /** When true, outcome uses backoff attempt path (flush). */
  fromFlushAttempt?: boolean;
}): Promise<SyncEggResult> {
  const { discoveryId } = opts;
  const clientCatalogTotal = listEasterEggDefs().length;

  let userId = opts.userId ?? null;
  if (!userId) {
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      userId = auth.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  if (!discoveryId?.startsWith("egg_")) {
    return {
      ok: false,
      cloudSynced: false,
      reason: "not_egg_prefix",
      error: "Not an egg id",
    };
  }

  if (!isApprovedEasterEggId(discoveryId)) {
    const result: SyncEggResult = {
      ok: false,
      cloudSynced: false,
      reason: "not_in_catalog",
      error: "Unknown discovery",
      total: clientCatalogTotal,
    };
    if (userId) {
      markPendingPermanentRejected(userId, discoveryId, {
        error: result.error,
        reason: result.reason,
      });
    }
    return result;
  }

  if (eggFindsAvailable === false) {
    const result: SyncEggResult = {
      ok: false,
      cloudSynced: false,
      reason: "cloud_disabled",
      error: "Egg cloud unavailable this session",
      total: clientCatalogTotal,
    };
    applyPendingOutcome(userId, discoveryId, result, {
      fromFlushAttempt: opts.fromFlushAttempt,
    });
    return result;
  }

  try {
    const supabase = createClient();
    if (!userId) {
      const { data: auth } = await supabase.auth.getUser();
      userId = auth.user?.id ?? null;
    }
    if (!userId) {
      return {
        ok: false,
        cloudSynced: false,
        reason: "unauthenticated",
        error: "Not authenticated",
        total: clientCatalogTotal,
      };
    }

    // Guard: never sync under mismatched session (belt-and-suspenders)
    const { data: authCheck } = await supabase.auth.getUser();
    const sessionUid = authCheck.user?.id;
    if (!sessionUid || sessionUid !== userId) {
      return {
        ok: false,
        cloudSynced: false,
        reason: "unauthenticated",
        error: "Session user mismatch — refusing cross-user pending flush",
        total: clientCatalogTotal,
      };
    }

    const { data, error } = await supabase.rpc("record_easter_egg_find", {
      p_discovery_id: discoveryId,
      p_player_name: "A player",
      p_total_eggs: 0,
    });

    if (error) {
      if (isMissingSchemaError(error)) eggFindsAvailable = false;
      const result = interpretRecordEggRpcResponse({
        data: null,
        error,
        clientCatalogTotal,
      });
      applyPendingOutcome(userId, discoveryId, result, {
        fromFlushAttempt: opts.fromFlushAttempt,
      });
      return result;
    }

    const row = data as {
      ok?: boolean;
      error?: string;
      found?: number;
      total?: number;
      flexesInserted?: number;
    } | null;

    const result = interpretRecordEggRpcResponse({
      data: row,
      error: null,
      clientCatalogTotal,
    });

    if (result.cloudSynced && result.ok) {
      eggFindsAvailable = true;
      addCloudEggToCache(userId, discoveryId);
    }
    applyPendingOutcome(userId, discoveryId, result, {
      fromFlushAttempt: opts.fromFlushAttempt,
    });
    return result;
  } catch (e) {
    const result: SyncEggResult = {
      ok: false,
      cloudSynced: false,
      reason: "exception",
      error: e instanceof Error ? e.message : "Exception during egg cloud sync",
      total: clientCatalogTotal,
    };
    applyPendingOutcome(userId, discoveryId, result, {
      fromFlushAttempt: opts.fromFlushAttempt,
    });
    return result;
  }
}

export type FlushPendingResult = {
  attempted: number;
  synced: number;
  skippedBackoff: number;
  stillPending: number;
  permanentRejected: number;
};

/**
 * Flush pending for the authenticated user only.
 * Respects nextAttemptAt unless force=true (manual/test path only).
 * Single-flighted. Does not prune other users' queues.
 */
export async function flushPendingEggCloudSyncs(
  userId: string,
  opts?: { force?: boolean }
): Promise<FlushPendingResult> {
  if (!userId) {
    return {
      attempted: 0,
      synced: 0,
      skippedBackoff: 0,
      stillPending: 0,
      permanentRejected: 0,
    };
  }
  if (flushInFlight) return flushInFlight;

  const force = opts?.force === true;

  flushInFlight = (async () => {
    // Session must match userId — never flush A under B
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id || auth.user.id !== userId) {
        return {
          attempted: 0,
          synced: 0,
          skippedBackoff: 0,
          stillPending: listPendingRetryIds(userId, { force: true }).length,
          permanentRejected: 0,
        };
      }
    } catch {
      return {
        attempted: 0,
        synced: 0,
        skippedBackoff: 0,
        stillPending: 0,
        permanentRejected: 0,
      };
    }

    const due = listPendingRetryIds(userId, { force });
    const allPending = listPendingRetryIds(userId, { force: true });
    const skippedBackoff = Math.max(0, allPending.length - due.length);

    let synced = 0;
    let permanentRejected = 0;

    for (const discoveryId of due) {
      const res = await syncEasterEggFindToCloud({
        discoveryId,
        userId,
        fromFlushAttempt: true,
      });
      // Temporary fail schedules nextAttemptAt in the future — no immediate re-loop
      if (res.cloudSynced && res.ok) {
        synced += 1;
      } else if (isPermanentEggSyncRejection(res)) {
        permanentRejected += 1;
      }
    }

    return {
      attempted: due.length,
      synced,
      skippedBackoff,
      stillPending: listPendingRetryIds(userId, { force: true }).length,
      permanentRejected,
    };
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
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
