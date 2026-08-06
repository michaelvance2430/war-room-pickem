/**
 * Pure helpers for Easter Egg cloud sync (P7).
 * Testable without Supabase network. No side effects.
 */

export type SyncEggResult = {
  /** True only when cloud RPC accepted the find (or confirmed duplicate with ok). */
  ok: boolean;
  /** True only when server recorded/confirmed the find; never true on local-only grant. */
  cloudSynced: boolean;
  found?: number;
  total?: number;
  flexesInserted?: number;
  error?: string;
  reason?:
    | "not_egg_prefix"
    | "not_in_catalog"
    | "cloud_disabled"
    | "rpc_error"
    | "rpc_rejected"
    | "exception"
    | "unauthenticated";
};

/** RPC JSON row shape from record_easter_egg_find */
export type RecordEggRpcRow = {
  ok?: boolean;
  error?: string;
  newFind?: boolean;
  found?: number;
  total?: number;
  flexesInserted?: number;
} | null;

export function interpretRecordEggRpcResponse(opts: {
  data: RecordEggRpcRow;
  error: { message?: string; code?: string } | null;
  clientCatalogTotal: number;
}): SyncEggResult {
  const { data, error, clientCatalogTotal } = opts;

  if (error) {
    return {
      ok: false,
      cloudSynced: false,
      error: error.message || "RPC error",
      reason: "rpc_error",
    };
  }

  if (!data || data.ok === false) {
    return {
      ok: false,
      cloudSynced: false,
      error: data?.error || "RPC rejected",
      reason: "rpc_rejected",
      found: data?.found,
      total: data?.total ?? clientCatalogTotal,
      flexesInserted: 0,
    };
  }

  return {
    ok: true,
    cloudSynced: true,
    found: data.found,
    total: data.total ?? clientCatalogTotal,
    flexesInserted: data.flexesInserted ?? 0,
  };
}

/** Flex UI should only fire when cloud actually inserted flex rows. */
export function shouldDispatchEggFlex(res: SyncEggResult): boolean {
  return (
    res.cloudSynced === true &&
    res.ok === true &&
    typeof res.flexesInserted === "number" &&
    res.flexesInserted > 0
  );
}

/** Cache cloud ids only after confirmed sync. */
export function shouldUpdateCloudEggCache(res: SyncEggResult): boolean {
  return res.cloudSynced === true && res.ok === true;
}

/**
 * Temporary failures → keep/retry pending.
 * Permanent rejections → do not auto-retry.
 */
export function isTemporaryEggSyncFailure(res: SyncEggResult): boolean {
  if (res.cloudSynced || res.ok) return false;
  const r = res.reason;
  return (
    r === "rpc_error" ||
    r === "cloud_disabled" ||
    r === "exception" ||
    r === "unauthenticated"
  );
}

export function isPermanentEggSyncRejection(res: SyncEggResult): boolean {
  if (res.cloudSynced || res.ok) return false;
  return (
    res.reason === "rpc_rejected" ||
    res.reason === "not_in_catalog" ||
    res.reason === "not_egg_prefix"
  );
}

/** Whether a successful local grant should enqueue durable pending on this result. */
export function shouldEnqueuePendingAfterSync(
  res: SyncEggResult,
  discoveryId: string,
  isApprovedId: (id: string) => boolean
): boolean {
  if (!isApprovedId(discoveryId)) return false;
  return isTemporaryEggSyncFailure(res);
}
