/**
 * D1B-B membership authority — application wrappers for REVIEW-ONLY RPCs.
 *
 * Ordinary human create / join-by-code / join-open / list-open go through these
 * RPCs only. Do not direct-INSERT human memberships from ordinary UI flows.
 *
 * Prerequisites (not production until separately authorized):
 *   supabase/review-only/D1B-B/01…06 applied on target DB
 *
 * Out of scope here:
 *   - sport-pool multi-seat (privileged path — see cutover doc)
 *   - bot seed DEFINER paths
 *   - file 07 / INSERT policy drop
 *   - production SQL apply
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { leagueFullMessage } from "@/lib/league-limits";

/** Stable server error tokens from d1b_b_raise */
export type D1bBErrorCode =
  | "not_authenticated"
  | "invalid_code"
  | "not_found"
  | "not_open"
  | "league_full"
  | "validation_failed"
  | "rpc_unavailable"
  | "unknown";

export type D1bBAppError = {
  ok: false;
  code: D1bBErrorCode;
  /** Stable machine detail token when present (e.g. name, sport) */
  detail?: string;
  /** User-facing message — no secrets, no raw SQL */
  message: string;
  /** True when PostgREST reports the function is missing on this project */
  rpcMissing?: boolean;
};

export type CreateLeagueResult =
  | {
      ok: true;
      leagueId: string;
      code: string;
      sportId: string;
      name: string;
      cutPercent: number;
      maxHumanMembers: number;
      isOpen: boolean;
      currentWeek: number;
    }
  | D1bBAppError;

export type JoinByCodeResult =
  | {
      ok: true;
      alreadyMember: boolean;
      leagueId: string;
      code: string;
      sportId: string;
      name: string;
      division?: string;
      totalPoints?: number;
    }
  | D1bBAppError;

export type JoinOpenResult =
  | {
      ok: true;
      alreadyMember: boolean;
      leagueId: string;
      name: string;
      sportId: string;
      division?: string;
      totalPoints?: number;
      /** Omitted by open-join RPC (B3); hydrate via member fetch after seat */
      code?: string;
    }
  | D1bBAppError;

export type ListOpenRoomRow = {
  id: string;
  name: string;
  sportId: string;
  createdAt: string;
  openListedAt: string | null;
  humanCount: number;
  maxHumanMembers: number;
  seatsLeft: number;
};

export type ListOpenResult =
  | { ok: true; rooms: ListOpenRoomRow[] }
  | D1bBAppError;

const D1B_PREFIX = /^d1b_b:([a-z_]+)(?:\s+([a-z0-9_]+))?/i;

function isRpcMissingError(err: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const blob = `${err.message || ""} ${err.details || ""} ${err.hint || ""}`;
  return (
    code === "PGRST202" ||
    /could not find the function|function .* does not exist|schema cache/i.test(
      blob
    )
  );
}

/** Parse d1b_b:<code> [detail] from PostgREST / Postgres error text */
export function parseD1bBErrorMessage(raw: string | null | undefined): {
  code: D1bBErrorCode;
  detail?: string;
} {
  const text = (raw || "").trim();
  const m = text.match(D1B_PREFIX);
  if (m) {
    const code = m[1].toLowerCase() as D1bBErrorCode;
    const allowed: D1bBErrorCode[] = [
      "not_authenticated",
      "invalid_code",
      "not_found",
      "not_open",
      "league_full",
      "validation_failed",
    ];
    if (allowed.includes(code)) {
      return { code, detail: m[2]?.toLowerCase() };
    }
  }
  if (/full|max.?human|capacity/i.test(text)) return { code: "league_full" };
  if (/invalid.?code|not found/i.test(text)) return { code: "invalid_code" };
  if (/not.?open|is_open/i.test(text)) return { code: "not_open" };
  if (/auth|JWT|permission denied for/i.test(text))
    return { code: "not_authenticated" };
  return { code: "unknown" };
}

/**
 * Map RPC / PostgREST failures to stable user-facing copy.
 * Preserves existing product language where possible.
 */
export function mapD1bBError(
  raw: string | null | undefined,
  opts?: { context?: "create" | "join_code" | "join_open" | "list_open" }
): D1bBAppError {
  const { code, detail } = parseD1bBErrorMessage(raw);
  const ctx = opts?.context;

  if (code === "not_authenticated") {
    return {
      ok: false,
      code,
      detail,
      message: "Sign in to continue.",
    };
  }
  if (code === "invalid_code") {
    return {
      ok: false,
      code,
      detail,
      message: "Invalid league code",
    };
  }
  if (code === "league_full") {
    return {
      ok: false,
      code,
      detail,
      message: leagueFullMessage(),
    };
  }
  if (code === "not_open") {
    return {
      ok: false,
      code,
      detail,
      message:
        "That room isn’t open for matchmaking right now. Try another open room or join with a code.",
    };
  }
  if (code === "not_found") {
    return {
      ok: false,
      code,
      detail,
      message:
        ctx === "join_open"
          ? "That room vanished. Try another open league."
          : "League not found.",
    };
  }
  if (code === "validation_failed") {
    const field = detail || "";
    if (field === "name") {
      return {
        ok: false,
        code,
        detail,
        message: "Name your room — every league starts a new story.",
      };
    }
    if (field === "sport") {
      return {
        ok: false,
        code,
        detail,
        message: "Pick a live sport (CFB or NFL) for this room.",
      };
    }
    if (field === "cut_percent") {
      return {
        ok: false,
        code,
        detail,
        message: "Cut percent must be between 10 and 75.",
      };
    }
    return {
      ok: false,
      code,
      detail,
      message:
        ctx === "create"
          ? "Could not create league — check the room name and sport."
          : "Could not complete that request.",
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: (raw || "").trim() || "Something went wrong. Try again.",
  };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function rpcUnavailable(
  context: "create" | "join_code" | "join_open" | "list_open"
): D1bBAppError {
  return {
    ok: false,
    code: "rpc_unavailable",
    rpcMissing: true,
    message:
      context === "list_open"
        ? "Open-room discovery isn’t available on this database yet (D1B-B RPCs not installed)."
        : "League create/join isn’t available on this database yet (D1B-B RPCs not installed). Apply review-only package 01–06 on a disposable branch — not production without Mike auth.",
  };
}

function configError(): D1bBAppError {
  return {
    ok: false,
    code: "unknown",
    message: "Supabase is not configured.",
  };
}

// ---------------------------------------------------------------------------
// RPC wrappers
// ---------------------------------------------------------------------------

export async function createLeagueWithCommissionerSeat(input: {
  name: string;
  sportId: string;
  listAsOpen?: boolean;
  crystalBallEnabled?: boolean;
  currentWeek?: number;
  cutPercent?: number;
  maxHumanMembers?: number;
}): Promise<CreateLeagueResult> {
  if (!hasSupabaseConfig()) return configError();
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "create_league_with_commissioner_seat",
    {
      p_name: input.name,
      p_sport_id: input.sportId,
      p_list_as_open: input.listAsOpen ?? false,
      p_crystal_ball_enabled: input.crystalBallEnabled ?? true,
      p_current_week: input.currentWeek ?? 0,
      p_cut_percent: input.cutPercent ?? 50,
      p_max_human_members: input.maxHumanMembers ?? 32,
    }
  );

  if (error) {
    if (isRpcMissingError(error)) return rpcUnavailable("create");
    return mapD1bBError(error.message, { context: "create" });
  }

  const row = asRecord(data);
  if (!row || row.ok === false) {
    return mapD1bBError("validation_failed", { context: "create" });
  }

  const leagueId = String(row.league_id || "");
  const code = String(row.code || "");
  if (!leagueId || !code) {
    return {
      ok: false,
      code: "unknown",
      message: "Create succeeded without league id or code.",
    };
  }

  return {
    ok: true,
    leagueId,
    code,
    sportId: String(row.sport_id || input.sportId || "cfb"),
    name: String(row.name || input.name),
    cutPercent: Number(row.cut_percent ?? 50),
    maxHumanMembers: Number(row.max_human_members ?? 32),
    isOpen: row.is_open === true,
    currentWeek: Number(row.current_week ?? input.currentWeek ?? 0),
  };
}

export async function joinLeagueByCode(
  code: string
): Promise<JoinByCodeResult> {
  if (!hasSupabaseConfig()) return configError();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: (code || "").trim().toUpperCase(),
  });

  if (error) {
    if (isRpcMissingError(error)) return rpcUnavailable("join_code");
    return mapD1bBError(error.message, { context: "join_code" });
  }

  const row = asRecord(data);
  if (!row) {
    return mapD1bBError("validation_failed", { context: "join_code" });
  }

  const leagueId = String(row.league_id || "");
  if (!leagueId) {
    return {
      ok: false,
      code: "unknown",
      message: "Join returned no league id.",
    };
  }

  return {
    ok: true,
    alreadyMember: row.already_member === true,
    leagueId,
    code: String(row.code || code.trim().toUpperCase()),
    sportId: String(row.sport_id || "cfb"),
    name: String(row.name || "War Room"),
    division: row.division != null ? String(row.division) : undefined,
    totalPoints:
      typeof row.total_points === "number"
        ? row.total_points
        : row.total_points != null
          ? Number(row.total_points)
          : undefined,
  };
}

export async function joinOpenLeagueById(
  leagueId: string
): Promise<JoinOpenResult> {
  if (!hasSupabaseConfig()) return configError();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_open_league_by_id", {
    p_league_id: leagueId,
  });

  if (error) {
    if (isRpcMissingError(error)) return rpcUnavailable("join_open");
    return mapD1bBError(error.message, { context: "join_open" });
  }

  const row = asRecord(data);
  if (!row) {
    return mapD1bBError("validation_failed", { context: "join_open" });
  }

  const id = String(row.league_id || leagueId || "");
  if (!id) {
    return {
      ok: false,
      code: "unknown",
      message: "Open join returned no league id.",
    };
  }

  return {
    ok: true,
    alreadyMember: row.already_member === true,
    leagueId: id,
    name: String(row.name || "War Room"),
    sportId: String(row.sport_id || "cfb"),
    division: row.division != null ? String(row.division) : undefined,
    totalPoints:
      typeof row.total_points === "number"
        ? row.total_points
        : row.total_points != null
          ? Number(row.total_points)
          : undefined,
  };
}

export async function listOpenLeaguesPublic(opts?: {
  sportId?: string | null;
  limit?: number;
}): Promise<ListOpenResult> {
  if (!hasSupabaseConfig()) return configError();
  const supabase = createClient();
  const sport =
    opts?.sportId && opts.sportId !== "any" ? opts.sportId : null;
  const { data, error } = await supabase.rpc("list_open_leagues_public", {
    p_sport_id: sport,
    p_limit: opts?.limit ?? 40,
  });

  if (error) {
    if (isRpcMissingError(error)) return rpcUnavailable("list_open");
    return mapD1bBError(error.message, { context: "list_open" });
  }

  const root = asRecord(data);
  const roomsRaw = root?.rooms;
  let list: unknown[] = [];
  if (Array.isArray(roomsRaw)) list = roomsRaw;
  else if (typeof roomsRaw === "string") {
    try {
      const p = JSON.parse(roomsRaw);
      if (Array.isArray(p)) list = p;
    } catch {
      list = [];
    }
  }

  const rooms: ListOpenRoomRow[] = [];
  for (const item of list) {
    const r = asRecord(item);
    if (!r?.id) continue;
    rooms.push({
      id: String(r.id),
      name: String(r.name || "War Room"),
      sportId: String(r.sport_id || "cfb"),
      createdAt: String(r.created_at || ""),
      openListedAt:
        r.open_listed_at != null ? String(r.open_listed_at) : null,
      humanCount: Number(r.human_count ?? 0),
      maxHumanMembers: Number(r.max_human_members ?? 32),
      seatsLeft: Number(
        r.seats_left ??
          Math.max(
            0,
            Number(r.max_human_members ?? 32) - Number(r.human_count ?? 0)
          )
      ),
    });
  }

  return { ok: true, rooms };
}

/**
 * Member-scoped league row for session hydration after create/join.
 * Prefer this over code-based lookup (B3: codes are inputs, not browse keys).
 * Does not select for open discovery.
 */
export async function fetchLeagueRowForMember(leagueId: string): Promise<{
  ok: true;
  row: Record<string, unknown>;
} | D1bBAppError> {
  if (!hasSupabaseConfig()) return configError();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leagues")
    .select(
      "id, name, code, commissioner_id, created_at, cut_percent, games_per_week, regular_season_weeks, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id, is_open, current_week"
    )
    .eq("id", leagueId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "unknown",
      message: error.message || "Could not load league.",
    };
  }
  if (!data) {
    return {
      ok: false,
      code: "not_found",
      message: "League not found after join.",
    };
  }
  return { ok: true, row: data as Record<string, unknown> };
}
