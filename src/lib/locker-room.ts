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
  "🐶",
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

/**
 * Football chat week: Monday 00:00 → Sunday night (America/New_York).
 * Board only shows posts from the current Mon–Sun window; older ones purge.
 */
export function getLockerWeekBounds(now = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const etDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) =>
    etDateParts.find((p) => p.type === t)?.value || "01";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = map[weekday] ?? 1;
  const daysFromMonday = dow === 0 ? 6 : dow - 1;

  // Calendar Monday (noon UTC as anchor, then step back)
  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0) - daysFromMonday * 86400000;
  const mon = new Date(anchor);
  const my = mon.getUTCFullYear();
  const mm = String(mon.getUTCMonth() + 1).padStart(2, "0");
  const md = String(mon.getUTCDate()).padStart(2, "0");
  const monStr = `${my}-${mm}-${md}`;

  // Monday 00:00 ET → pick correct offset (-04 or -05)
  let start = new Date(`${monStr}T04:00:00.000Z`); // EDT default
  for (const off of ["-04:00", "-05:00"] as const) {
    const candidate = new Date(`${monStr}T00:00:00${off}`);
    const etDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(candidate);
    const etHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(candidate)
    );
    if (etDay === monStr && (etHour === 0 || etHour === 24)) {
      start = candidate;
      break;
    }
  }

  const end = new Date(start.getTime() + 7 * 86400000);
  const labelStart = start.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const labelEnd = new Date(end.getTime() - 1000).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${labelStart} – ${labelEnd} (ET)`,
  };
}

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

async function resolveNames(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (!ids.length) return nameById;
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
  return nameById;
}

/** Best-effort: wipe posts from before this Mon–Sun week. */
async function purgeStaleLockerMessages(
  leagueId: string,
  weekStartIso: string
): Promise<void> {
  const supabase = createClient();
  // Prefer RPC (security definer) so any member can trigger league cleanup
  const { error: rpcErr } = await supabase.rpc("purge_locker_before", {
    p_league_id: leagueId,
    p_before: weekStartIso,
  });
  if (!rpcErr) return;

  // Fallback: delete own old posts only (RLS); staff delete all if allowed
  await supabase
    .from("locker_messages")
    .delete()
    .eq("league_id", leagueId)
    .lt("created_at", weekStartIso);
}

export async function loadLockerMessages(limit = 100): Promise<{
  ok: boolean;
  messages?: LockerMessage[];
  weekLabel?: string;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league selected" };
  }
  const { startIso, label } = getLockerWeekBounds();
  const supabase = createClient();

  // Fresh board each Mon–Sun — don't keep season-long history
  void purgeStaleLockerMessages(session.leagueId, startIso);

  const { data, error } = await supabase
    .from("locker_messages")
    .select("id, league_id, user_id, body, created_at")
    .eq("league_id", session.leagueId)
    .gte("created_at", startIso)
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
  const nameById = await resolveNames(supabase, ids);

  // Oldest → newest for chat-style display
  const messages = rows.map((r) => mapRow(r, nameById)).reverse();
  return { ok: true, messages, weekLabel: label };
}

export async function postLockerMessage(body: string): Promise<{
  ok: boolean;
  message?: LockerMessage;
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
  // Ensure auth uid matches session (common cause of “posted but can’t see”)
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id || session.playerId;

  const { data, error } = await supabase
    .from("locker_messages")
    .insert({
      league_id: session.leagueId,
      user_id: uid,
      body: text,
    })
    .select("id, league_id, user_id, body, created_at")
    .single();

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

  const nameById = await resolveNames(supabase, [uid]);
  // Prefer live session name if profile row is lagging
  if (session.playerName) {
    nameById.set(uid, session.playerName);
  }

  const message = mapRow(
    (data || {
      id: crypto.randomUUID(),
      league_id: session.leagueId,
      user_id: uid,
      body: text,
      created_at: new Date().toISOString(),
    }) as Record<string, unknown>,
    nameById
  );

  return { ok: true, message };
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
