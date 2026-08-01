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

/**
 * One-tap reactions on a message (no full reply needed).
 * Witty room energy — keep the set short and phone-fat-finger friendly.
 */
export const LOCKER_REACTION_EMOJIS = [
  "😂", // laugh-cry
  "🔥", // heat
  "😭", // pain
  "😤", // mad
  "💀", // dead
  "🤬", // cussing
  "👏", // respect
  "👀", // watching
  "🤡", // clown
  "🫡", // respect / noted
] as const;

export type LockerReactionSummary = {
  emoji: string;
  count: number;
  /** Current user already tapped this emoji */
  mine: boolean;
};

export type LockerMessage = {
  id: string;
  leagueId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  reactions?: LockerReactionSummary[];
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

  // Extra rows: some may be hidden reaction markers (fallback storage)
  const fetchLimit = Math.min(300, Math.max(limit * 3, 120));
  const { data, error } = await supabase
    .from("locker_messages")
    .select("id, league_id, user_id, body, created_at")
    .eq("league_id", session.leagueId)
    .gte("created_at", startIso)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

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

  const chatRows: Record<string, unknown>[] = [];
  const rxRows: {
    messageId: string;
    userId: string;
    emoji: string;
    rowId: string;
  }[] = [];
  for (const r of rows) {
    const body = String(r.body || "");
    const parsed = parseReactionMarker(body);
    if (parsed) {
      rxRows.push({
        messageId: parsed.messageId,
        userId: r.user_id as string,
        emoji: parsed.emoji,
        rowId: r.id as string,
      });
    } else {
      chatRows.push(r);
    }
  }

  // Oldest → newest for chat-style display
  const messages = chatRows
    .slice(0, limit)
    .map((r) => mapRow(r, nameById))
    .reverse();

  const withRx = await attachReactions(
    supabase,
    messages,
    session.playerId,
    rxRows
  );
  return { ok: true, messages: withRx, weekLabel: label };
}

/**
 * Hidden body format when locker_message_reactions table is missing.
 * Filtered out of the chat list; tallied as emoji reactions.
 */
const RX_MARKER = "§WR_RX§";

function parseReactionMarker(
  body: string
): { messageId: string; emoji: string } | null {
  if (!body || !body.startsWith(RX_MARKER)) return null;
  const rest = body.slice(RX_MARKER.length);
  const sep = rest.indexOf("§");
  if (sep < 1) return null;
  const messageId = rest.slice(0, sep).trim();
  const emoji = rest.slice(sep + 1).trim();
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return null;
  if (!emoji || [...emoji].length > 8) return null;
  return { messageId, emoji };
}

function formatReactionMarker(messageId: string, emoji: string): string {
  return `${RX_MARKER}${messageId}§${emoji}`;
}

function isMissingReactionsTable(message?: string | null): boolean {
  return /does not exist|schema cache|PGRST205|locker_message_reactions/i.test(
    message || ""
  );
}

async function attachReactions(
  supabase: ReturnType<typeof createClient>,
  messages: LockerMessage[],
  myUserId?: string | null,
  embeddedRx?: {
    messageId: string;
    userId: string;
    emoji: string;
    rowId: string;
  }[]
): Promise<LockerMessage[]> {
  if (!messages.length) return messages;

  const messageIds = messages.map((m) => m.id);
  type RxRow = { message_id: string; user_id: string; emoji: string };
  let tableRows: RxRow[] | null = null;
  try {
    const { data, error } = await supabase
      .from("locker_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds);
    if (!error) {
      tableRows = (data || []) as RxRow[];
    } else if (!isMissingReactionsTable(error.message)) {
      tableRows = [];
    }
  } catch {
    tableRows = null;
  }

  const byMsg = new Map<
    string,
    Map<string, { count: number; mine: boolean }>
  >();

  function addRx(messageId: string, userId: string, emoji: string) {
    if (!byMsg.has(messageId)) byMsg.set(messageId, new Map());
    const em = byMsg.get(messageId)!;
    const prev = em.get(emoji) || { count: 0, mine: false };
    prev.count += 1;
    if (myUserId && userId === myUserId) prev.mine = true;
    em.set(emoji, prev);
  }

  if (tableRows) {
    for (const r of tableRows) addRx(r.message_id, r.user_id, r.emoji);
  } else if (embeddedRx?.length) {
    for (const r of embeddedRx) addRx(r.messageId, r.userId, r.emoji);
  }

  return messages.map((m) => {
    const em = byMsg.get(m.id);
    if (!em || em.size === 0) return { ...m, reactions: [] };
    const reactions: LockerReactionSummary[] = [...em.entries()]
      .map(([emoji, v]) => ({
        emoji,
        count: v.count,
        mine: v.mine,
      }))
      .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    return { ...m, reactions };
  });
}

/** Reactions always available — table preferred, marker fallback otherwise. */
export async function isLockerReactionsReady(): Promise<boolean> {
  return true;
}

/**
 * Toggle a reaction on a locker message (tap again to remove).
 * Prefers locker_message_reactions; falls back to hidden marker posts.
 */
export async function toggleLockerReaction(
  messageId: string,
  emoji: string
): Promise<{
  ok: boolean;
  reactions?: LockerReactionSummary[];
  error?: string;
  needsSetup?: boolean;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed in" };
  }
  const em = (emoji || "").trim();
  if (!em || [...em].length > 8) {
    return { ok: false, error: "Pick a reaction emoji." };
  }

  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return {
        ok: false,
        error: "PREVIEW mode — reactions stay off the real room.",
      };
    }
  } catch {
    /* continue */
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    return { ok: false, error: "Session expired — sign in again to react." };
  }

  let useTable = true;
  {
    const { error: probeErr } = await supabase
      .from("locker_message_reactions")
      .select("id")
      .limit(1);
    if (probeErr && isMissingReactionsTable(probeErr.message)) {
      useTable = false;
    }
  }

  if (useTable) {
    const tableRes = await toggleReactionViaTable(
      supabase,
      messageId,
      em,
      uid
    );
    if (tableRes.ok || !tableRes.needsSetup) return tableRes;
    useTable = false;
  }

  return toggleReactionViaMarkers(
    supabase,
    session.leagueId,
    messageId,
    em,
    uid
  );
}

async function toggleReactionViaTable(
  supabase: ReturnType<typeof createClient>,
  messageId: string,
  em: string,
  uid: string
): Promise<{
  ok: boolean;
  reactions?: LockerReactionSummary[];
  error?: string;
  needsSetup?: boolean;
}> {
  const { data: existing, error: existingErr } = await supabase
    .from("locker_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", uid)
    .eq("emoji", em)
    .maybeSingle();

  if (existingErr && isMissingReactionsTable(existingErr.message)) {
    return { ok: false, needsSetup: true, error: existingErr.message };
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("locker_message_reactions")
      .delete()
      .eq("id", existing.id as string);
    if (error) {
      if (isMissingReactionsTable(error.message)) {
        return { ok: false, needsSetup: true, error: error.message };
      }
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("locker_message_reactions").insert({
      message_id: messageId,
      user_id: uid,
      emoji: em,
    });
    if (error) {
      if (isMissingReactionsTable(error.message)) {
        return { ok: false, needsSetup: true, error: error.message };
      }
      if (/policy|row-level|muted|violates|42501/i.test(error.message || "")) {
        return {
          ok: false,
          error:
            "Can’t react right now — you may be muted, or not in this league.",
        };
      }
      if (!/duplicate|unique/i.test(error.message || "")) {
        return { ok: false, error: error.message };
      }
    }
  }

  const { data: all, error: allErr } = await supabase
    .from("locker_message_reactions")
    .select("user_id, emoji")
    .eq("message_id", messageId);

  if (allErr && isMissingReactionsTable(allErr.message)) {
    return { ok: false, needsSetup: true, error: allErr.message };
  }

  return { ok: true, reactions: tallyReactions(all || [], uid) };
}

async function toggleReactionViaMarkers(
  supabase: ReturnType<typeof createClient>,
  leagueId: string,
  messageId: string,
  em: string,
  uid: string
): Promise<{
  ok: boolean;
  reactions?: LockerReactionSummary[];
  error?: string;
}> {
  const marker = formatReactionMarker(messageId, em);

  const { data: mine, error: findErr } = await supabase
    .from("locker_messages")
    .select("id, body")
    .eq("league_id", leagueId)
    .eq("user_id", uid)
    .eq("body", marker)
    .limit(5);

  if (findErr) {
    return { ok: false, error: findErr.message };
  }

  const hadMine = !!(mine && mine.length > 0);

  if (hadMine) {
    const { error } = await supabase
      .from("locker_messages")
      .delete()
      .eq("id", (mine![0] as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("locker_messages").insert({
      league_id: leagueId,
      user_id: uid,
      body: marker,
    });
    if (error) {
      if (/policy|row-level|muted|violates|42501/i.test(error.message || "")) {
        return {
          ok: false,
          error:
            "Can’t react right now — you may be muted, or not in this league.",
        };
      }
      return { ok: false, error: error.message };
    }
  }

  const { startIso } = getLockerWeekBounds();
  const { data: allRows, error: allErr } = await supabase
    .from("locker_messages")
    .select("user_id, body")
    .eq("league_id", leagueId)
    .gte("created_at", startIso)
    .like("body", `${RX_MARKER}${messageId}§%`);

  if (allErr) {
    return {
      ok: true,
      reactions: hadMine
        ? []
        : [{ emoji: em, count: 1, mine: true }],
    };
  }

  const tallies = new Map<string, { count: number; mine: boolean }>();
  for (const r of allRows || []) {
    const parsed = parseReactionMarker(
      String((r as { body?: string }).body || "")
    );
    if (!parsed || parsed.messageId !== messageId) continue;
    const prev = tallies.get(parsed.emoji) || { count: 0, mine: false };
    prev.count += 1;
    if ((r as { user_id: string }).user_id === uid) prev.mine = true;
    tallies.set(parsed.emoji, prev);
  }
  const reactions: LockerReactionSummary[] = [...tallies.entries()]
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));

  return { ok: true, reactions };
}

function tallyReactions(
  rows: { user_id?: string; emoji?: string }[] | Record<string, unknown>[],
  uid: string
): LockerReactionSummary[] {
  const tally = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows || []) {
    const row = r as { user_id: string; emoji: string };
    if (!row.emoji) continue;
    const prev = tally.get(row.emoji) || { count: 0, mine: false };
    prev.count += 1;
    if (row.user_id === uid) prev.mine = true;
    tally.set(row.emoji, prev);
  }
  return [...tally.entries()]
    .map(([emojiKey, v]) => ({
      emoji: emojiKey,
      count: v.count,
      mine: v.mine,
    }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
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

  // Creator eyes: never post into the real locker
  try {
    const eyes = await import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return {
        ok: false,
        error:
          "PREVIEW mode — Locker posts stay off the real room. Exit → Foundry to post for real.",
      };
    }
  } catch {
    /* continue */
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
