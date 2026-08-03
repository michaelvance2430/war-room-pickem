/**
 * “I’m Bored” fun lobbies — temporary social rooms, not Practice Mode.
 *
 * Same locker_messages table, hidden channel via body prefix.
 * League Week chat never shows these rows.
 * No picks. No scores. No practice/live dual reality.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import {
  LOCKER_MAX_CHARS,
  type LockerMessage,
} from "@/lib/locker-room";

/** Stored as WR_FUN|<roomId>|<message> in locker_messages.body */
export const FUN_PREFIX = "WR_FUN|";

export type FunRoom = {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
};

/** Rotating lobbies — pick one when you tap I’m Bored */
export const FUN_ROOMS: FunRoom[] = [
  {
    id: "happy-hour",
    emoji: "🍻",
    name: "Happy Hour",
    blurb: "Loose talk. No scoreboard.",
  },
  {
    id: "trash-arena",
    emoji: "🔥",
    name: "Trash Talk Arena",
    blurb: "Warm up the chirps.",
  },
  {
    id: "morning-coffee",
    emoji: "☕",
    name: "Morning Coffee",
    blurb: "Low energy. High opinions.",
  },
  {
    id: "meme-dumpster",
    emoji: "🤡",
    name: "Meme Dumpster",
    blurb: "Send it. No judgment.",
  },
  {
    id: "random-lobby",
    emoji: "🎲",
    name: "Random Lobby",
    blurb: "Whoever’s here is here.",
  },
];

export function getFunRoom(id: string | null | undefined): FunRoom {
  return FUN_ROOMS.find((r) => r.id === id) || FUN_ROOMS[0]!;
}

export function pickRandomFunRoom(seed?: string): FunRoom {
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return FUN_ROOMS[h % FUN_ROOMS.length]!;
  }
  return FUN_ROOMS[Math.floor(Math.random() * FUN_ROOMS.length)]!;
}

export function parseFunLobbyBody(
  body: string
): { roomId: string; text: string } | null {
  const raw = (body || "").trim();
  if (!raw.startsWith(FUN_PREFIX)) return null;
  const rest = raw.slice(FUN_PREFIX.length);
  const sep = rest.indexOf("|");
  if (sep < 1) return null;
  const roomId = rest.slice(0, sep).trim();
  const text = rest.slice(sep + 1);
  if (!roomId || !/^[a-z0-9-]{2,32}$/i.test(roomId)) return null;
  return { roomId, text };
}

export function isFunLobbyBody(body: string): boolean {
  return !!parseFunLobbyBody(body);
}

export function formatFunLobbyBody(roomId: string, text: string): string {
  return `${FUN_PREFIX}${roomId}|${text.trim()}`;
}

export async function loadFunLobbyMessages(
  roomId: string,
  limit = 80
): Promise<{
  ok: boolean;
  messages?: LockerMessage[];
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league selected" };
  }
  const room = getFunRoom(roomId);
  const supabase = createClient();
  const prefix = `${FUN_PREFIX}${room.id}|`;

  const { data, error } = await supabase
    .from("locker_messages")
    .select("id, league_id, user_id, body, created_at")
    .eq("league_id", session.leagueId)
    .like("body", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, limit * 2));

  if (error) {
    if (/does not exist|schema cache|locker_messages/i.test(error.message || "")) {
      return {
        ok: false,
        error:
          "Chat isn’t set up yet. Commissioner: run locker-room SQL once in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  const rows = (data || []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profiles || []) {
      nameById.set(
        (p as { id: string }).id,
        (p as { display_name?: string }).display_name || "Player"
      );
    }
  }

  const messages: LockerMessage[] = rows
    .map((r) => {
      const parsed = parseFunLobbyBody(String(r.body || ""));
      if (!parsed || parsed.roomId !== room.id) return null;
      const uid = r.user_id as string;
      return {
        id: r.id as string,
        leagueId: r.league_id as string,
        userId: uid,
        body: parsed.text,
        createdAt: (r.created_at as string) || new Date().toISOString(),
        authorName: nameById.get(uid) || "Player",
      };
    })
    .filter(Boolean)
    .reverse() as LockerMessage[];

  return { ok: true, messages: messages.slice(-limit) };
}

export async function postFunLobbyMessage(
  roomId: string,
  body: string
): Promise<{ ok: boolean; message?: LockerMessage; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed in" };
  }
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const { GUEST_LOCKER_POST_CODE } = await import("./guest-copy");
      return { ok: false, error: GUEST_LOCKER_POST_CODE };
    }
  } catch {
    /* continue */
  }

  const text = body.trim();
  if (!text) return { ok: false, error: "Say something." };
  if (text.length > LOCKER_MAX_CHARS) {
    return { ok: false, error: `Max ${LOCKER_MAX_CHARS} characters.` };
  }

  const room = getFunRoom(roomId);
  const encoded = formatFunLobbyBody(room.id, text);
  // Prefix eats a few chars — still store under DB check if any
  if (encoded.length > LOCKER_MAX_CHARS + 40) {
    return { ok: false, error: "Message too long." };
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id || session.playerId;

  const { data, error } = await supabase
    .from("locker_messages")
    .insert({
      league_id: session.leagueId,
      user_id: uid,
      body: encoded,
    })
    .select("id, league_id, user_id, body, created_at")
    .single();

  if (error) {
    if (/does not exist|schema cache|locker_messages/i.test(error.message || "")) {
      return {
        ok: false,
        error: "Chat isn’t set up yet. Run locker-room SQL once.",
      };
    }
    if (/policy|row-level|muted|check/i.test(error.message || "")) {
      return {
        ok: false,
        error: "You can’t post right now — check with the host.",
      };
    }
    return { ok: false, error: error.message };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", uid)
    .maybeSingle();

  const parsed = parseFunLobbyBody(String((data as { body?: string }).body || ""));
  return {
    ok: true,
    message: {
      id: (data as { id: string }).id,
      leagueId: (data as { league_id: string }).league_id,
      userId: uid,
      body: parsed?.text || text,
      createdAt:
        (data as { created_at?: string }).created_at ||
        new Date().toISOString(),
      authorName:
        (prof as { display_name?: string } | null)?.display_name || "Player",
    },
  };
}
