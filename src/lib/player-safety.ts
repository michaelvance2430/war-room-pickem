import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

export type ReportCategory = "harassment" | "hate" | "threats" | "spam" | "other";

export async function loadBlockedPlayerIds(): Promise<Set<string>> {
  const session = getSession();
  if (!session?.playerId) return new Set();
  const { data, error } = await createClient()
    .from("player_blocks")
    .select("blocked_id")
    .eq("blocker_id", session.playerId);
  if (error) return new Set();
  return new Set((data || []).map((row) => String(row.blocked_id)));
}

export async function setPlayerBlocked(blockedId: string, blocked: boolean) {
  const session = getSession();
  if (!session?.playerId || blockedId === session.playerId) return { ok: false, error: "Invalid player" };
  const query = createClient().from("player_blocks");
  const result = blocked
    ? await query.insert({ blocker_id: session.playerId, blocked_id: blockedId })
    : await query.delete().eq("blocker_id", session.playerId).eq("blocked_id", blockedId);
  return result.error ? { ok: false, error: "Safety controls are not available yet." } : { ok: true };
}

export async function reportPlayer(opts: { reportedId: string; category: ReportCategory; details: string }) {
  const session = getSession();
  if (!session?.leagueId || !session.playerId || opts.reportedId === session.playerId) {
    return { ok: false, error: "Invalid report" };
  }
  const { error } = await createClient().from("player_reports").insert({
    league_id: session.leagueId,
    reporter_id: session.playerId,
    reported_id: opts.reportedId,
    category: opts.category,
    details: opts.details.trim().slice(0, 500),
  });
  return error ? { ok: false, error: "Reports are not available yet." } : { ok: true };
}
