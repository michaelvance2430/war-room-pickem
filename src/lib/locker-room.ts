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
  ids: string[],
  leagueId?: string | null
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (!ids.length) return nameById;

  // Prefer league alias when we know the room
  if (leagueId) {
    const { data: mems } = await supabase
      .from("memberships")
      .select("user_id, display_name_override, profiles(display_name)")
      .eq("league_id", leagueId)
      .in("user_id", ids);
    if (mems?.length) {
      const { resolveLeagueDisplayName } = await import("./display-name");
      for (const m of mems) {
        const uid = (m as { user_id: string }).user_id;
        const prof = (m as { profiles?: { display_name?: string } | null })
          .profiles;
        const override = (m as { display_name_override?: string | null })
          .display_name_override;
        nameById.set(
          uid,
          resolveLeagueDisplayName({
            membershipOverride: override,
            profileDisplayName: prof?.display_name,
          })
        );
      }
      if (nameById.size >= ids.length) return nameById;
    }
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  for (const p of profiles || []) {
    const id = (p as { id: string }).id;
    if (nameById.has(id)) continue;
    nameById.set(
      id,
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
  // Guest tour: never hit Supabase with a fake league id (uuid errors = broken product).
  // Guests observe — membership unlock is the only message.
  

  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league selected" };
  }
  const { startIso, label } = getLockerWeekBounds();
  const supabase = createClient();

  void purgeStaleLockerMessages(session.leagueId, startIso);

  // Extra rows: reaction markers are hidden posts in the same table
  const fetchLimit = Math.min(400, Math.max(limit * 4, 150));
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
    // Never leak Postgres / uuid / infrastructure strings into the room
    const raw = error.message || "Could not load";
    if (
      /uuid|invalid input syntax|22P02|PGRST|permission|JWT|row-level/i.test(
        raw
      )
    ) {
      return {
        ok: false,
        error: "Couldn’t load Locker right now. Try again in a moment.",
      };
    }
    return { ok: false, error: raw };
  }

  const rows = (data || []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const nameById = await resolveNames(supabase, ids, session.leagueId);

  const chatRows: Record<string, unknown>[] = [];
  const rxRows: {
    messageId: string;
    userId: string;
    emoji: string;
    rowId: string;
  }[] = [];

  for (const r of rows) {
    const body = String(r.body || "");
    // I’m Bored fun lobbies — never mix into weekly league chat
    if (body.startsWith("WR_FUN|")) continue;
    const parsed = parseReactionMarker(body);
    if (parsed) {
      rxRows.push({
        messageId: parsed.messageId,
        userId: String(r.user_id || ""),
        emoji: parsed.emoji,
        rowId: String(r.id || ""),
      });
    } else {
      chatRows.push(r);
    }
  }

  const messages = chatRows
    .slice(0, limit)
    .map((r) => mapRow(r, nameById))
    .reverse();

  // Prefer table when present; always merge marker rows too (legacy + fallback)
  const withRx = await attachReactions(
    supabase,
    messages,
    session.playerId,
    rxRows
  );
  return { ok: true, messages: withRx, weekLabel: label };
}

/**
 * ASCII marker stored as a normal locker_messages row (hidden from chat UI).
 * Format: WR_RX|<uuid>|<emoji>
 * (No fancy unicode — § broke LIKE queries / wiped optimistic UI.)
 */
const RX_PREFIX = "WR_RX|";

function parseReactionMarker(
  body: string
): { messageId: string; emoji: string } | null {
  const raw = (body || "").trim();
  // New format
  if (raw.startsWith(RX_PREFIX)) {
    const parts = raw.split("|");
    // WR_RX | uuid | emoji... (emoji may contain | rarely — take rest)
    if (parts.length < 3) return null;
    const messageId = (parts[1] || "").trim();
    const emoji = parts.slice(2).join("|").trim();
    if (!/^[0-9a-f-]{36}$/i.test(messageId)) return null;
    if (!emoji || [...emoji].length > 12) return null;
    return { messageId, emoji };
  }
  // Legacy § format (still load old reactions)
  if (raw.startsWith("§WR_RX§")) {
    const rest = raw.slice("§WR_RX§".length);
    const sep = rest.indexOf("§");
    if (sep < 1) return null;
    const messageId = rest.slice(0, sep).trim();
    const emoji = rest.slice(sep + 1).trim();
    if (!/^[0-9a-f-]{36}$/i.test(messageId)) return null;
    if (!emoji || [...emoji].length > 12) return null;
    return { messageId, emoji };
  }
  return null;
}

function formatReactionMarker(messageId: string, emoji: string): string {
  return `${RX_PREFIX}${messageId}|${emoji}`;
}

/**
 * Session capability for dedicated reactions table.
 * null = unknown, true = works, false = missing (skip PostgREST for the tab).
 * Marker path in locker_messages still works either way.
 */
let reactionsTableAvailable: boolean | null = null;

function isMissingReactionsTable(err?: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | string | null): boolean {
  if (err == null) return false;
  if (typeof err === "string") {
    return /does not exist|schema cache|PGRST205|Could not find the table|locker_message_reactions|42P01/i.test(
      err
    );
  }
  const code = String(err.code || "");
  const blob = `${err.message || ""} ${err.details || ""} ${err.hint || ""}`;
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /does not exist|schema cache|Could not find the table|locker_message_reactions/i.test(
      blob
    )
  );
}

function markReactionsTableMissing(): void {
  reactionsTableAvailable = false;
}

function markReactionsTablePresent(): void {
  reactionsTableAvailable = true;
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
  let tableRows: RxRow[] = [];
  // Session suppress: one 404 must not fire on every Locker load
  if (reactionsTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from("locker_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds);
      if (error) {
        if (isMissingReactionsTable(error)) {
          markReactionsTableMissing();
        }
      } else if (data) {
        markReactionsTablePresent();
        tableRows = data as RxRow[];
      }
    } catch {
      /* network — keep unknown; markers still apply */
    }
  }

  const byMsg = new Map<
    string,
    Map<string, { count: number; mine: boolean }>
  >();

  function addRx(messageId: string, userId: string, emoji: string) {
    if (!messageId || !emoji) return;
    if (!byMsg.has(messageId)) byMsg.set(messageId, new Map());
    const em = byMsg.get(messageId)!;
    const prev = em.get(emoji) || { count: 0, mine: false };
    prev.count += 1;
    if (myUserId && userId === myUserId) prev.mine = true;
    em.set(emoji, prev);
  }

  for (const r of tableRows) addRx(r.message_id, r.user_id, r.emoji);
  // Markers always apply (works without table; survives dual-path)
  if (embeddedRx?.length) {
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

/** Reactions always available (table and/or marker fallback). */
export async function isLockerReactionsReady(): Promise<boolean> {
  return true;
}

/**
 * Toggle a reaction on ANY message (yours or theirs).
 *
 * Storage: hidden WR_RX| rows in locker_messages (table may not exist on prod).
 * Also tries locker_message_reactions when present — never required.
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
  if (!em || [...em].length > 12) {
    return { ok: false, error: "Pick a reaction emoji." };
  }
  if (!messageId || String(messageId).length < 8) {
    return { ok: false, error: "Invalid message." };
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
  // getSession is more reliable than getUser when token is refreshing
  const { data: authData } = await supabase.auth.getSession();
  const uid =
    authData.session?.user?.id ||
    (await supabase.auth.getUser()).data.user?.id ||
    session.playerId;
  if (!uid) {
    return { ok: false, error: "Session expired — sign in again to react." };
  }

  // Primary path: markers in locker_messages (always available if chat works)
  const markerRes = await toggleReactionViaMarkers(
    supabase,
    session.leagueId,
    messageId,
    em,
    uid
  );
  if (markerRes.ok) {
    // Best-effort dual-write only when table is known present/unknown
    if (reactionsTableAvailable !== false) {
      void toggleReactionViaTable(supabase, messageId, em, uid).catch(() => {});
    }
    return markerRes;
  }

  // Markers failed — try dedicated table once (skip if session knows it's gone)
  if (reactionsTableAvailable === false) {
    return {
      ok: false,
      error:
        markerRes.error ||
        "Could not save reaction. Try again.",
    };
  }
  const tableRes = await toggleReactionViaTable(
    supabase,
    messageId,
    em,
    uid
  );
  if (tableRes.ok) return tableRes;

  return {
    ok: false,
    error:
      markerRes.error ||
      tableRes.error ||
      "Could not save reaction. Try again.",
  };
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
  if (reactionsTableAvailable === false) {
    return { ok: false, needsSetup: true, error: "reactions table unavailable" };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("locker_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", uid)
    .eq("emoji", em)
    .maybeSingle();

  if (existingErr) {
    if (isMissingReactionsTable(existingErr)) {
      markReactionsTableMissing();
      return { ok: false, needsSetup: true, error: existingErr.message };
    }
    // Other select errors — still try insert path
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("locker_message_reactions")
      .delete()
      .eq("id", existing.id as string);
    if (error) {
      if (isMissingReactionsTable(error)) {
        markReactionsTableMissing();
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
      if (isMissingReactionsTable(error)) {
        markReactionsTableMissing();
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

  markReactionsTablePresent();

  const { data: all, error: allErr } = await supabase
    .from("locker_message_reactions")
    .select("user_id, emoji")
    .eq("message_id", messageId);

  if (allErr) {
    if (isMissingReactionsTable(allErr)) {
      markReactionsTableMissing();
      return { ok: false, needsSetup: true, error: allErr.message };
    }
    // Write succeeded — return at least this emoji so UI doesn't go empty
    return {
      ok: true,
      reactions: [{ emoji: em, count: 1, mine: true }],
    };
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
  const { startIso } = getLockerWeekBounds();

  // Load recent rows for this league (mine + others) — filter markers in JS
  const { data: weekRows, error: findErr } = await supabase
    .from("locker_messages")
    .select("id, user_id, body")
    .eq("league_id", leagueId)
    .gte("created_at", startIso)
    .order("created_at", { ascending: false })
    .limit(400);

  if (findErr) {
    return { ok: false, error: findErr.message };
  }

  const rows = (weekRows || []) as {
    id: string;
    user_id: string;
    body: string;
  }[];

  const mineSame = rows.find((r) => {
    if (r.user_id !== uid) return false;
    const parsed = parseReactionMarker(r.body || "");
    return !!parsed && parsed.messageId === messageId && parsed.emoji === em;
  });

  if (mineSame) {
    const { error } = await supabase
      .from("locker_messages")
      .delete()
      .eq("id", mineSame.id)
      .eq("user_id", uid);
    if (error) return { ok: false, error: error.message };
  } else {
    // RLS requires user_id = auth.uid() — use the uid we resolved from auth
    const { data: inserted, error } = await supabase
      .from("locker_messages")
      .insert({
        league_id: leagueId,
        user_id: uid,
        body: marker,
      })
      .select("id, user_id, body")
      .single();
    if (error) {
      if (/policy|row-level|muted|violates|42501/i.test(error.message || "")) {
        return {
          ok: false,
          error:
            "Can’t react right now — you may be muted, or not in this league.",
        };
      }
      return {
        ok: false,
        error: error.message || "Could not save reaction",
      };
    }
    // Ensure insert is in our local set for tally
    if (inserted) {
      rows.unshift(inserted as { id: string; user_id: string; body: string });
    } else {
      rows.unshift({ id: "local", user_id: uid, body: marker });
    }
  }

  // Tally from the set we already have (+ filter out deleted)
  const tallies = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    if (mineSame && r.id === mineSame.id) continue; // removed
    const parsed = parseReactionMarker(r.body || "");
    if (!parsed || parsed.messageId !== messageId) continue;
    const prev = tallies.get(parsed.emoji) || { count: 0, mine: false };
    prev.count += 1;
    if (r.user_id === uid) prev.mine = true;
    tallies.set(parsed.emoji, prev);
  }

  if (tallies.size === 0 && !mineSame) {
    // We just added — always return at least this react
    return { ok: true, reactions: [{ emoji: em, count: 1, mine: true }] };
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

  // Guest Mode: observe only — never hit Supabase as a fake member
  

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

  const nameById = await resolveNames(supabase, [uid], session.leagueId);
  // Prefer live session name (active-league resolved) if profile row is lagging
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
