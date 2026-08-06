/**
 * Open-room matchmaking — fill one public league at a time, then the next.
 * Commissioners list rooms with is_open; lobby seats people FIFO into the fullest open room.
 *
 * D1B-B: discovery and seating go through list_open_leagues_public +
 * join_open_league_by_id. Public listings never include join codes (B3).
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  MAX_LEAGUE_PLAYERS,
  leagueFullMessage,
} from "@/lib/league-limits";
import { applySportTheme } from "@/lib/sports/sport-theme";
import {
  fetchLeagueRowForMember,
  joinOpenLeagueById,
  listOpenLeaguesPublic,
} from "@/lib/d1b-b-membership";

/**
 * Public open-room card — no join code, no commissioner id (B3 / R5).
 */
export type OpenRoomListing = {
  id: string;
  name: string;
  sportId: string;
  memberCount: number;
  seatsLeft: number;
  openListedAt: string | null;
  createdAt: string;
  maxHumanMembers: number;
};

/** How long to wait before offering “try a different open league?” */
export const OPEN_ROOM_WAIT_OFFER_MS = 40_000;

/** Poll while searching */
export const OPEN_ROOM_POLL_MS = 4_000;

export function openRoomsSqlMissingMessage(): string {
  return "Open rooms aren’t set up on this database yet. Commish: run supabase/open-rooms.sql once in Supabase, then list your league as open under Settings.";
}

/**
 * List open leagues that still have seats.
 * Prefer fullest rooms first (finish a room fast), then oldest listing.
 * Codes are never returned (D1B-B B3).
 */
export async function listOpenRooms(opts?: {
  /** Skip these league ids (already tried / full / user declined) */
  excludeIds?: string[];
  sportId?: string | null;
}): Promise<{
  rooms: OpenRoomListing[];
  error?: string;
  sqlMissing?: boolean;
  rpcMissing?: boolean;
}> {
  if (!hasSupabaseConfig()) {
    return { rooms: [], error: "Supabase is not configured." };
  }

  const listed = await listOpenLeaguesPublic({
    sportId: opts?.sportId,
    limit: 40,
  });

  if (!listed.ok) {
    if (listed.rpcMissing) {
      return {
        rooms: [],
        error: listed.message,
        rpcMissing: true,
        sqlMissing: true,
      };
    }
    if (/is_open|open_listed|column/i.test(listed.message || "")) {
      return {
        rooms: [],
        error: openRoomsSqlMissingMessage(),
        sqlMissing: true,
      };
    }
    return { rooms: [], error: listed.message };
  }

  const exclude = new Set(opts?.excludeIds || []);
  const rooms: OpenRoomListing[] = listed.rooms
    .filter((r) => r && !exclude.has(r.id) && r.seatsLeft > 0)
    .map((r) => ({
      id: r.id,
      name: r.name || "War Room",
      sportId: r.sportId || "cfb",
      memberCount: r.humanCount,
      seatsLeft: r.seatsLeft,
      openListedAt: r.openListedAt,
      createdAt: r.createdAt,
      maxHumanMembers: r.maxHumanMembers || MAX_LEAGUE_PLAYERS,
    }));

  // Fill one room at a time: highest occupancy first, then oldest listing
  rooms.sort((a, b) => {
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    const at = a.openListedAt || a.createdAt;
    const bt = b.openListedAt || b.createdAt;
    return at.localeCompare(bt);
  });

  return { rooms };
}

/**
 * Seat one player into an open league via join_open_league_by_id.
 * No direct membership INSERT. Fair Entry + first-join run inside the RPC.
 */
export async function seatPlayerInLeague(opts: {
  leagueId: string;
  userId: string;
  displayName: string;
}): Promise<
  | { ok: true; leagueName: string; code: string; sportId: string }
  | { ok: false; full?: boolean; error: string }
> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const supabase = createClient();
  const { userId, leagueId, displayName } = opts;

  // Never overwrite global account name with a league alias
  try {
    const { ensureProfileRowExists } = await import("@/lib/league-display-name");
    await ensureProfileRowExists(userId);
  } catch {
    /* ignore */
  }
  const { data: profRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const accountName =
    (profRow?.display_name as string)?.trim() || "Player";

  const joinRes = await joinOpenLeagueById(leagueId);
  if (!joinRes.ok) {
    if (joinRes.code === "league_full") {
      return { ok: false, full: true, error: joinRes.message };
    }
    if (joinRes.code === "not_open" || joinRes.code === "not_found") {
      return { ok: false, full: true, error: joinRes.message };
    }
    return { ok: false, error: joinRes.message };
  }

  // Fair Entry notice only — points already applied server-side
  const startPts = joinRes.totalPoints ?? 0;
  if (startPts > 0 && !joinRes.alreadyMember) {
    try {
      const { markFairEntryPendingNotice, bandForLatestScoredWeek } =
        await import("@/lib/fair-entry");
      const { listScoredWeekNumbers } = await import("@/lib/cloud");
      const scored = await listScoredWeekNumbers();
      const latest =
        scored.length > 0 ? Math.max(...scored.filter((w) => w >= 0)) : null;
      const band = bandForLatestScoredWeek(latest);
      if (band) {
        markFairEntryPendingNotice(leagueId, userId, {
          points: startPts,
          bandId: band.id,
        });
      }
    } catch {
      /* notice is optional chrome */
    }
  }

  // Member-scoped hydrate (code OK for own league session / invite — not discovery)
  const fetched = await fetchLeagueRowForMember(leagueId);
  if (!fetched.ok) {
    // Seated but hydrate failed — still success with RPC payload
    const sportId = joinRes.sportId || "cfb";
    try {
      const { writeSessionAndLeague, saveActiveLeagueId } = await import(
        "@/lib/session-restore"
      );
      writeSessionAndLeague(
        {
          leagueId,
          leagueName: joinRes.name || "War Room",
          code: "",
          commissionerId: "",
          createdAt: "",
          cutPercent: 50,
          regularSeasonWeeks: 18,
          gamesPerWeek: 5,
          role: "player",
          displayName: accountName,
          displayNameOverride: null,
          crystalBallEnabled: sportId === "nfl" || sportId === "cfb",
          homeTaglineId: "good-teams",
          homeTaglineCustom: "",
          seasonThemeId: "default",
          sportId,
          isOpen: true,
        },
        userId
      );
      saveActiveLeagueId(leagueId);
    } catch {
      /* best-effort */
    }
    return {
      ok: true,
      leagueName: joinRes.name || "War Room",
      code: "",
      sportId,
    };
  }

  const league = fetched.row;

  // Optional per-league alias after membership exists
  let resolvedName = accountName;
  let override: string | null = null;
  const nick = (displayName || "").trim();
  if (nick) {
    try {
      const { setMyLeagueDisplayName } = await import(
        "@/lib/league-display-name"
      );
      const aliasRes = await setMyLeagueDisplayName(leagueId, nick);
      if (aliasRes.ok) {
        resolvedName = aliasRes.resolved;
        override = aliasRes.override;
      }
    } catch {
      /* migration pending — keep account name */
    }
  } else {
    try {
      const { data: mem } = await supabase
        .from("memberships")
        .select("display_name_override")
        .eq("league_id", leagueId)
        .eq("user_id", userId)
        .maybeSingle();
      const { resolveLeagueDisplayName } = await import("./display-name");
      override =
        (mem as { display_name_override?: string | null } | null)
          ?.display_name_override ?? null;
      resolvedName = resolveLeagueDisplayName({
        membershipOverride: override,
        profileDisplayName: accountName,
      });
    } catch {
      resolvedName = accountName;
    }
  }

  const sportId =
    (league.sport_id as string) || joinRes.sportId || "cfb";
  const seasonThemeId =
    typeof league.season_theme_id === "string" && league.season_theme_id
      ? (league.season_theme_id as string)
      : "default";
  const leagueCode = (league.code as string) || "";
  const commissionerId = (league.commissioner_id as string) || "";

  try {
    const { writeSessionAndLeague, saveActiveLeagueId } = await import(
      "@/lib/session-restore"
    );
    writeSessionAndLeague(
      {
        leagueId: league.id as string,
        leagueName: (league.name as string) || joinRes.name || "War Room",
        code: leagueCode,
        commissionerId,
        createdAt: (league.created_at as string) || "",
        cutPercent: (league.cut_percent as number) ?? 50,
        regularSeasonWeeks: 18,
        gamesPerWeek: (league.games_per_week as number) ?? 5,
        role: commissionerId === userId ? "commissioner" : "player",
        displayName: resolvedName,
        displayNameOverride: override,
        crystalBallEnabled:
          typeof league.crystal_ball_enabled === "boolean"
            ? !!league.crystal_ball_enabled
            : sportId === "nfl" || sportId === "cfb",
        homeTaglineId: (league.home_tagline_id as string) || "good-teams",
        homeTaglineCustom: (league.home_tagline_custom as string) || "",
        seasonThemeId,
        sportId,
        isOpen: true,
      },
      userId
    );
    saveActiveLeagueId(league.id as string);
  } catch {
    localStorage.setItem(
      "warroom-session",
      JSON.stringify({
        playerId: userId,
        playerName: resolvedName,
        isCommissioner: commissionerId === userId,
        leagueId: league.id,
      })
    );
    localStorage.setItem(
      "warroom-league",
      JSON.stringify({
        id: league.id,
        name: league.name,
        code: leagueCode,
        commissionerId,
        createdAt: league.created_at,
        sportId,
        settings: {
          cutPercent: league.cut_percent ?? 50,
          regularSeasonWeeks: 18,
          gamesPerWeek: league.games_per_week ?? 5,
          crystalBallEnabled:
            typeof league.crystal_ball_enabled === "boolean"
              ? !!league.crystal_ball_enabled
              : sportId === "nfl" || sportId === "cfb",
          homeTaglineId: league.home_tagline_id || "good-teams",
          homeTaglineCustom: league.home_tagline_custom || "",
          seasonThemeId,
        },
      })
    );
    try {
      const { paintAutomaticSeasonTheme } = await import("@/lib/season-theme");
      void paintAutomaticSeasonTheme();
    } catch {
      /* ignore */
    }
    try {
      applySportTheme(sportId);
    } catch {
      /* ignore */
    }
  }

  return {
    ok: true,
    leagueName: (league.name as string) || joinRes.name || "War Room",
    code: leagueCode,
    sportId,
  };
}

/**
 * Claim the next open seat: fullest open room first.
 * Skips excludeIds (failed/full attempts).
 */
export async function claimNextOpenSeat(opts: {
  userId: string;
  displayName: string;
  excludeIds?: string[];
  sportId?: string | null;
}): Promise<
  | {
      status: "seated";
      leagueName: string;
      code: string;
      sportId: string;
      roomId: string;
    }
  | { status: "waiting"; roomsSeen: number; message: string }
  | { status: "error"; error: string; full?: boolean }
> {
  const listed = await listOpenRooms({
    excludeIds: opts.excludeIds,
    sportId: opts.sportId,
  });
  if (listed.error && (listed.sqlMissing || listed.rpcMissing)) {
    return { status: "error", error: listed.error };
  }
  if (listed.error) {
    return { status: "error", error: listed.error };
  }
  if (!listed.rooms.length) {
    return {
      status: "waiting",
      roomsSeen: 0,
      message:
        "No open seats right now. Hang tight — or host an open room so others can find you.",
    };
  }

  // Try rooms in fill order until one seats us
  const tried: string[] = [];
  for (const room of listed.rooms) {
    tried.push(room.id);
    const res = await seatPlayerInLeague({
      leagueId: room.id,
      userId: opts.userId,
      displayName: opts.displayName,
    });
    if (res.ok) {
      return {
        status: "seated",
        leagueName: res.leagueName,
        code: res.code,
        sportId: res.sportId,
        roomId: room.id,
      };
    }
    if (res.full) {
      continue;
    }
    continue;
  }

  return {
    status: "waiting",
    roomsSeen: tried.length,
    message:
      tried.length > 0
        ? "Those rooms just filled up. Looking for the next open seat…"
        : "Still looking for an open seat…",
  };
}

export async function setLeagueOpenListing(
  leagueId: string,
  isOpen: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const supabase = createClient();
  const patch: Record<string, unknown> = {
    is_open: isOpen,
  };
  if (isOpen) {
    patch.open_listed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("leagues")
    .update(patch)
    .eq("id", leagueId);
  if (error) {
    if (/is_open|open_listed|column/i.test(error.message || "")) {
      return { ok: false, error: openRoomsSqlMissingMessage() };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Re-export for callers that still import full-message helper from this module path */
export { leagueFullMessage };
