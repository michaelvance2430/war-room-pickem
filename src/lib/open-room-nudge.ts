/**
 * After a member leaves mid-season, prompt the commissioner to open the
 * room so late joiners (0 pts, enjoy the ride) can fill the seat.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

const LOCAL_KEY = "warroom-open-room-nudge-v1";

export type OpenRoomNudge = {
  leagueId: string;
  leftName: string;
  at: string;
};

type LocalMap = Record<string, OpenRoomNudge>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLocal(): LocalMap {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as LocalMap;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeLocal(map: LocalMap) {
  if (!canUse()) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Call when a player leaves early — flags the league for the commissioner. */
export async function flagOpenRoomNudgeAfterLeave(opts: {
  leagueId: string;
  leftName: string;
}): Promise<void> {
  const { leagueId, leftName } = opts;
  if (!leagueId) return;

  const payload: OpenRoomNudge = {
    leagueId,
    leftName: leftName.trim() || "A player",
    at: new Date().toISOString(),
  };

  // Local fallback (same browser / shared device)
  const local = readLocal();
  local[leagueId] = payload;
  writeLocal(local);

  // Cloud: leagues.open_room_nudge_* or RPC
  try {
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("flag_open_room_nudge", {
      p_league_id: leagueId,
      p_left_name: payload.leftName,
    });
    if (!rpcErr) return;

    // Direct column update (needs SQL + policy / security definer)
    const { error } = await supabase
      .from("leagues")
      .update({
        open_room_nudge_pending: true,
        open_room_nudge_left_name: payload.leftName,
        open_room_nudge_at: payload.at,
      })
      .eq("id", leagueId);
    void error;
  } catch {
    /* local only */
  }
}

/** Commissioner: load pending nudge for a league (cloud first). */
export async function loadOpenRoomNudge(
  leagueId: string
): Promise<OpenRoomNudge | null> {
  if (!leagueId) return null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leagues")
      .select(
        "open_room_nudge_pending, open_room_nudge_left_name, open_room_nudge_at, is_open"
      )
      .eq("id", leagueId)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        open_room_nudge_pending?: boolean | null;
        open_room_nudge_left_name?: string | null;
        open_room_nudge_at?: string | null;
        is_open?: boolean | null;
      };
      // Already open — nothing to ask
      if (row.is_open) {
        await dismissOpenRoomNudge(leagueId);
        return null;
      }
      if (row.open_room_nudge_pending) {
        return {
          leagueId,
          leftName: row.open_room_nudge_left_name || "A player",
          at: row.open_room_nudge_at || new Date().toISOString(),
        };
      }
    }
  } catch {
    /* fall through */
  }

  const local = readLocal()[leagueId];
  return local || null;
}

export async function dismissOpenRoomNudge(leagueId: string): Promise<void> {
  if (!leagueId) return;
  const local = readLocal();
  delete local[leagueId];
  writeLocal(local);

  try {
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("clear_open_room_nudge", {
      p_league_id: leagueId,
    });
    if (!rpcErr) return;
    await supabase
      .from("leagues")
      .update({
        open_room_nudge_pending: false,
        open_room_nudge_left_name: null,
        open_room_nudge_at: null,
      })
      .eq("id", leagueId);
  } catch {
    /* ignore */
  }
}

/** True if current user is commissioner of this league session. */
export function isActiveLeagueCommissioner(leagueId: string): boolean {
  const s = getSession();
  return !!(s?.isCommissioner && s.leagueId === leagueId);
}
