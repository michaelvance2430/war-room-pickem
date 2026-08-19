import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export type LobbyVisibility = "hidden" | "public" | "private";

export type LobbyRoom = {
  id: string;
  name: string;
  sportId: string;
  accessMode: "public" | "private";
  humanCount: number;
  maxHumanMembers: number;
  seatsLeft: number;
  isFull: boolean;
  isMember: boolean;
  requestStatus: "pending" | "approved" | "denied" | "cancelled" | null;
};

export type LobbyPlayerLeader = {
  gameHandle: string;
  leagueName: string;
  cheevoPoints: number;
};

export type LobbyCrewLeader = {
  crewName: string;
  cheevoPoints: number;
};

export type LobbyJoinRequest = {
  id: string;
  gameHandle: string;
  requestedAt: string;
};

function ready() {
  return hasSupabaseConfig() ? null : "The Lobby is not configured yet.";
}

function message(error: { message?: string } | null, fallback: string) {
  const raw = error?.message || fallback;
  if (/league_full/i.test(raw)) return "That room is full.";
  if (/not_requestable/i.test(raw)) return "That private room is not taking requests.";
  if (/not_authorized/i.test(raw)) return "Only the commissioner can do that.";
  if (/not_authenticated/i.test(raw)) return "Sign in to enter the Lobby.";
  return raw.replace(/^.*lobby:/i, "").replaceAll("_", " ") || fallback;
}

export async function listLobbyRooms(sportId?: string | null): Promise<{
  rooms: LobbyRoom[];
  error?: string;
}> {
  const configError = ready();
  if (configError) return { rooms: [], error: configError };
  const { data, error } = await createClient().rpc("list_lobby_rooms", {
    p_sport_id: sportId || null,
    p_limit: 60,
  });
  if (error) return { rooms: [], error: message(error, "Could not load rooms.") };
  const payload = data as { rooms?: Array<Record<string, unknown>> } | null;
  return {
    rooms: (payload?.rooms || []).map((room) => ({
      id: String(room.id || ""),
      name: String(room.name || "War Room"),
      sportId: String(room.sport_id || "cfb"),
      accessMode: room.access_mode === "private" ? "private" : "public",
      humanCount: Number(room.human_count || 0),
      maxHumanMembers: Number(room.max_human_members || 20),
      seatsLeft: Number(room.seats_left || 0),
      isFull: room.is_full === true,
      isMember: room.is_member === true,
      requestStatus: (room.request_status as LobbyRoom["requestStatus"]) || null,
    })),
  };
}

export async function requestPrivateRoomJoin(leagueId: string) {
  const configError = ready();
  if (configError) return { ok: false as const, error: configError };
  const { data, error } = await createClient().rpc("request_private_room_join", {
    p_league_id: leagueId,
  });
  if (error) return { ok: false as const, error: message(error, "Request failed.") };
  return { ok: true as const, status: String((data as { status?: string })?.status || "pending") };
}

export async function listLobbyLeaderboards(): Promise<{
  players: LobbyPlayerLeader[];
  crews: LobbyCrewLeader[];
  updatedAt: string | null;
  error?: string;
}> {
  const configError = ready();
  if (configError) return { players: [], crews: [], updatedAt: null, error: configError };
  const { data, error } = await createClient().rpc("list_lobby_leaderboards");
  if (error) return { players: [], crews: [], updatedAt: null, error: message(error, "Could not load Cheevo boards.") };
  const payload = data as {
    players?: Array<Record<string, unknown>>;
    crews?: Array<Record<string, unknown>>;
    updated_at?: string;
  } | null;
  return {
    players: (payload?.players || []).map((row) => ({
      gameHandle: String(row.game_handle || "Player"),
      leagueName: String(row.league_name || "War Room"),
      cheevoPoints: Number(row.cheevo_points || 0),
    })),
    crews: (payload?.crews || []).map((row) => ({
      crewName: String(row.crew_name || "War Room"),
      cheevoPoints: Number(row.cheevo_points || 0),
    })),
    updatedAt: payload?.updated_at || null,
  };
}

export async function setLeagueLobbyVisibility(leagueId: string, visibility: LobbyVisibility) {
  const configError = ready();
  if (configError) return { ok: false as const, error: configError };
  const { error } = await createClient().rpc("set_league_lobby_visibility", {
    p_league_id: leagueId,
    p_visibility: visibility,
  });
  if (error) return { ok: false as const, error: message(error, "Could not update Lobby access.") };
  return { ok: true as const };
}

export async function listPrivateRoomJoinRequests(leagueId: string): Promise<{
  requests: LobbyJoinRequest[];
  error?: string;
}> {
  const configError = ready();
  if (configError) return { requests: [], error: configError };
  const { data, error } = await createClient().rpc("list_private_room_join_requests", {
    p_league_id: leagueId,
  });
  if (error) return { requests: [], error: message(error, "Could not load requests.") };
  const rows = ((data as { requests?: Array<Record<string, unknown>> } | null)?.requests || []);
  return {
    requests: rows.map((row) => ({
      id: String(row.id || ""),
      gameHandle: String(row.game_handle || "Player"),
      requestedAt: String(row.requested_at || ""),
    })),
  };
}

export async function reviewPrivateRoomJoin(requestId: string, approve: boolean) {
  const configError = ready();
  if (configError) return { ok: false as const, error: configError };
  const { error } = await createClient().rpc("review_private_room_join", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) return { ok: false as const, error: message(error, "Could not review request.") };
  return { ok: true as const };
}
