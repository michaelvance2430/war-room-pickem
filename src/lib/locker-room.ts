import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

/** Hard cap — punchy trash talk, not essays. */
export const LOCKER_MAX_CHARS = 280;

/** Min seconds between posts (client + soft server courtesy). */
export const LOCKER_COOLDOWN_SEC = 8;

/** Quick-tap football / shit-talk emojis for the composer. */
export const LOCKER_EMOJIS = [
  "🏈",
  "🏆",
  "🚽",
  "🔥",
  "💀",
  "🤡",
  "😭",
  "😤",
  "💰",
  "🎯",
  "🧊",
  "🧨",
  "👀",
  "🙏",
  "💪",
  "🚫",
  "📉",
  "📈",
  "🐶", // dog
  "👑",
  "🧙",
  "😈",
  "🤮",
  "🫡",
] as const;

export type LockerMessage = {
  id: string;
  leagueId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export async function amILockerMuted(): Promise<boolean> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) return false;
  if (session.isCommissioner) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from("memberships")
    .select("locker_muted")
    .eq("league_id", session.leagueId)
    .eq("user_id", session.playerId)
    .maybeSingle();
  return !!(data as { locker_muted?: boolean } | null)?.locker_muted;
}

function mapRow(
  r: Record<string, unknown>,
  nameById: Map<string, string>
): LockerMessage {
  const uid = r.user_id as string;
  return {
    id: r.id as string,
    leagueId: r.league_id as string,
    userId: uid,
    body: (r.body as string) || "",
    createdAt: (r.created_at as string) || new Date().toISOString(),
    authorName: nameById.get(uid) || "Player",
  };
}

export async function loadLockerMessages(limit = 80): Promise<{
  ok: boolean;
  messages?: LockerMessage[];
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league selected" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("locker_messages")
    .select("id, league_id, user_id, body, created_at")
    .eq("league_id", session.leagueId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (
      /does not exist|schema cache|locker_messages/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Locker Room isn’t set up yet. Commissioner: run supabase/locker-room.sql in Supabase SQL Editor once.",
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

  // Oldest → newest for chat-style display
  const messages = rows.map((r) => mapRow(r, nameById)).reverse();
  return { ok: true, messages };
}

export async function postLockerMessage(body: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed in" };
  }
  const text = body.trim();
  if (!text) return { ok: false, error: "Say something." };
  if (text.length > LOCKER_MAX_CHARS) {
    return {
      ok: false,
      error: `Max ${LOCKER_MAX_CHARS} characters.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("locker_messages").insert({
    league_id: session.leagueId,
    user_id: session.playerId,
    body: text,
  });

  if (error) {
    if (
      /does not exist|schema cache|locker_messages/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Locker Room isn’t set up yet. Run supabase/locker-room.sql in Supabase SQL Editor once.",
      };
    }
    if (/policy|row-level|violates|muted|check/i.test(error.message || "")) {
      return {
        ok: false,
        error:
          "You can’t post right now — you may be muted by a moderator. Talk to the commissioner if that’s a mistake.",
      };
    }
    if (/check|280|length/i.test(error.message || "")) {
      return { ok: false, error: `Max ${LOCKER_MAX_CHARS} characters.` };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteLockerMessage(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) return { ok: false, error: "No league" };

  const supabase = createClient();
  const { error } = await supabase
    .from("locker_messages")
    .delete()
    .eq("id", id)
    .eq("league_id", session.leagueId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function formatLockerTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
