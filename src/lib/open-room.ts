/**
 * Open-room matchmaking — fill one public league at a time, then the next.
 * Commissioners list rooms with is_open; lobby seats people FIFO into the fullest open room.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  MAX_LEAGUE_PLAYERS,
  isLeagueFull,
  leagueFullMessage,
  seatsRemaining,
} from "@/lib/league-limits";
import { applySeasonTheme } from "@/lib/season-theme";
import { applySportTheme } from "@/lib/sports/sport-theme";

export type OpenRoomListing = {
  id: string;
  name: string;
  code: string;
  sportId: string;
  commissionerId: string;
  memberCount: number;
  seatsLeft: number;
  openListedAt: string | null;
  createdAt: string;
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
 */
export async function listOpenRooms(opts?: {
  /** Skip these league ids (already tried / full / user declined) */
  excludeIds?: string[];
  sportId?: string | null;
}): Promise<{
  rooms: OpenRoomListing[];
  error?: string;
  sqlMissing?: boolean;
}> {
  if (!hasSupabaseConfig()) {
    return { rooms: [], error: "Supabase is not configured." };
  }
  const supabase = createClient();
  let q = supabase
    .from("leagues")
    .select(
      "id, name, code, sport_id, commissioner_id, created_at, is_open, open_listed_at"
    )
    .eq("is_open", true);

  if (opts?.sportId && opts.sportId !== "any") {
    q = q.eq("sport_id", opts.sportId);
  }

  const { data, error } = await q.limit(40);
  if (error) {
    if (/is_open|open_listed|column/i.test(error.message || "")) {
      return {
        rooms: [],
        error: openRoomsSqlMissingMessage(),
        sqlMissing: true,
      };
    }
    return { rooms: [], error: error.message };
  }

  const exclude = new Set(opts?.excludeIds || []);
  const rows = (data || []).filter(
    (r) => r && !exclude.has((r as { id: string }).id)
  );

  const rooms: OpenRoomListing[] = [];
  for (const raw of rows) {
    const r = raw as {
      id: string;
      name: string;
      code: string;
      sport_id?: string;
      commissioner_id: string;
      created_at: string;
      open_listed_at?: string | null;
    };
    const { count, error: cErr } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("league_id", r.id);
    if (cErr) continue;
    const memberCount = count ?? 0;
    if (isLeagueFull(memberCount)) continue;
    rooms.push({
      id: r.id,
      name: r.name || "War Room",
      code: r.code,
      sportId: r.sport_id || "cfb",
      commissionerId: r.commissioner_id,
      memberCount,
      seatsLeft: seatsRemaining(memberCount),
      openListedAt: r.open_listed_at || null,
      createdAt: r.created_at,
    });
  }

  // Fill one room at a time: highest occupancy first, then oldest listing
  rooms.sort((a, b) => {
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    const at = a.openListedAt || a.createdAt;
    const bt = b.openListedAt || b.createdAt;
    return at.localeCompare(bt);
  });

  return { rooms };
}

function leastPopulatedDivision(
  counts: Record<string, number>
): "North" | "South" | "East" | "West" {
  let division: "North" | "South" | "East" | "West" = "North";
  let best = Infinity;
  for (const d of ["North", "South", "East", "West"] as const) {
    if ((counts[d] || 0) < best) {
      best = counts[d] || 0;
      division = d;
    }
  }
  return division;
}

/**
 * Seat one player into a league. Returns full:true if no seat (friendly message).
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

  await supabase.from("profiles").upsert({
    id: userId,
    display_name: displayName.trim() || "Player",
  });

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select(
      "id, name, code, commissioner_id, created_at, cut_percent, games_per_week, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id, is_open"
    )
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) {
    return {
      ok: false,
      error: lErr?.message || "That room vanished. Try another open league.",
    };
  }

  const { data: existingMem } = await supabase
    .from("memberships")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMem) {
    const { count, error: countErr } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id);
    if (countErr) return { ok: false, error: countErr.message };
    if (isLeagueFull(count ?? 0)) {
      // Auto-unlist when full so lobby doesn’t keep pointing here
      try {
        await supabase
          .from("leagues")
          .update({ is_open: false })
          .eq("id", league.id)
          .eq("is_open", true);
      } catch {
        /* best-effort */
      }
      return {
        ok: false,
        full: true,
        error: leagueFullMessage(count ?? MAX_LEAGUE_PLAYERS),
      };
    }

    const { data: divRows } = await supabase
      .from("memberships")
      .select("division")
      .eq("league_id", league.id);
    const counts = { North: 0, South: 0, East: 0, West: 0 } as Record<
      string,
      number
    >;
    for (const row of divRows || []) {
      const d = (row as { division?: string }).division || "North";
      counts[d] = (counts[d] || 0) + 1;
    }
    const division = leastPopulatedDivision(counts);

    // Late joiners: 0 season pts (no catch-up). Still earn cheevos/trophies going forward.
    const { error: memError } = await supabase.from("memberships").insert({
      league_id: league.id,
      user_id: userId,
      role: "player",
      division,
      total_points: 0,
      weeks_played: 0,
    });
    if (memError) {
      if (/full|max 32|check_violation|duplicate|unique/i.test(memError.message || "")) {
        return {
          ok: false,
          full: true,
          error: leagueFullMessage(),
        };
      }
      return { ok: false, error: memError.message };
    }
    try {
      const { recordLeagueFirstJoin } = await import("@/lib/cloud");
      await recordLeagueFirstJoin(league.id);
    } catch {
      /* optional */
    }
  }

  const sportId =
    (league as { sport_id?: string }).sport_id || "cfb";
  const seasonThemeId =
    typeof league.season_theme_id === "string" && league.season_theme_id
      ? league.season_theme_id
      : "default";

  try {
    const { writeSessionAndLeague, saveActiveLeagueId } = await import(
      "@/lib/session-restore"
    );
    writeSessionAndLeague(
      {
        leagueId: league.id as string,
        leagueName: (league.name as string) || "War Room",
        code: (league.code as string) || "",
        commissionerId: league.commissioner_id as string,
        createdAt: (league.created_at as string) || "",
        cutPercent: (league.cut_percent as number) ?? 50,
        regularSeasonWeeks: 18,
        gamesPerWeek: (league.games_per_week as number) ?? 5,
        role:
          league.commissioner_id === userId ? "commissioner" : "player",
        displayName: displayName.trim() || "Player",
        crystalBallEnabled:
          sportId === "nfl"
            ? false
            : league.crystal_ball_enabled !== false,
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
        playerName: displayName.trim() || "Player",
        isCommissioner: league.commissioner_id === userId,
        leagueId: league.id,
      })
    );
    localStorage.setItem(
      "warroom-league",
      JSON.stringify({
        id: league.id,
        name: league.name,
        code: league.code,
        commissionerId: league.commissioner_id,
        createdAt: league.created_at,
        sportId,
        settings: {
          cutPercent: league.cut_percent ?? 50,
          regularSeasonWeeks: 18,
          gamesPerWeek: league.games_per_week ?? 5,
          crystalBallEnabled:
            sportId === "nfl"
              ? false
              : league.crystal_ball_enabled !== false,
          homeTaglineId: league.home_tagline_id || "good-teams",
          homeTaglineCustom: league.home_tagline_custom || "",
          seasonThemeId,
        },
      })
    );
    try {
      applySeasonTheme(seasonThemeId);
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
    leagueName: league.name,
    code: league.code,
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
  if (listed.error && listed.sqlMissing) {
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
      // Next room in the list
      continue;
    }
    // Hard error on this room — keep trying others
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
