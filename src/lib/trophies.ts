import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

export type TrophyType =
  | "championship"
  | "toilet_bowl"
  | "crystal_ball"
  /** CFB conference / NFL division titles (one per compass slot) */
  | "division_north"
  | "division_south"
  | "division_east"
  | "division_west";

export type LeagueTrophy = {
  id: string;
  leagueId: string;
  seasonYear: number;
  trophyType: TrophyType;
  winnerName: string;
  winnerUserId: string | null;
  subtitle: string | null;
  notes: string | null;
  awardedAt: string;
};

export const TROPHY_META: Record<
  TrophyType,
  {
    title: string;
    short: string;
    emoji: string;
    blurb: string;
    accent: string;
    border: string;
    glow: string;
  }
> = {
  championship: {
    title: "Championship",
    short: "Champ",
    emoji: "🏆",
    blurb: "Top half. One path. The big one.",
    accent: "text-amber-300",
    border: "border-amber-400/40",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.12)]",
  },
  toilet_bowl: {
    title: "Toilet Bowl",
    short: "Toilet",
    emoji: "🚽",
    blurb: "Bottom half. Still a crown. Wear it proudly.",
    accent: "text-toilet",
    border: "border-toilet/40",
    glow: "shadow-[0_0_40px_rgba(168,85,247,0.12)]",
  },
  crystal_ball: {
    title: "Village Nerd Award",
    short: "Nerd",
    emoji: "🧠",
    blurb:
      "Big Brain Nerd Cup — crystal ball, textbooks, glasses. Zero points. Infinite smug.",
    accent: "text-sky-300",
    border: "border-sky-400/40",
    glow: "shadow-[0_0_40px_rgba(56,189,248,0.1)]",
  },
  division_north: {
    title: "Conference / Division Title",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race (SEC, AFC East, …).",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_south: {
    title: "Conference / Division Title",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_east: {
    title: "Conference / Division Title",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_west: {
    title: "Conference / Division Title",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
};

function mapRow(r: Record<string, unknown>): LeagueTrophy {
  return {
    id: r.id as string,
    leagueId: r.league_id as string,
    seasonYear: r.season_year as number,
    trophyType: r.trophy_type as TrophyType,
    winnerName: (r.winner_name as string) || "Unknown",
    winnerUserId: (r.winner_user_id as string) || null,
    subtitle: (r.subtitle as string) || null,
    notes: (r.notes as string) || null,
    awardedAt: (r.awarded_at as string) || new Date().toISOString(),
  };
}

/** Default season year for awards (CFB season spans fall). */
export function defaultSeasonYear(now = new Date()): number {
  // Jan–June → previous fall season still "belongs" to last year until new kickoff culture
  const m = now.getMonth(); // 0-indexed
  return m < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

export async function loadLeagueTrophies(): Promise<LeagueTrophy[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("league_trophies")
    .select(
      "id, league_id, season_year, trophy_type, winner_name, winner_user_id, subtitle, notes, awarded_at"
    )
    .eq("league_id", session.leagueId)
    .order("season_year", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function awardTrophy(opts: {
  seasonYear: number;
  trophyType: TrophyType;
  winnerName: string;
  winnerUserId?: string | null;
  subtitle?: string | null;
  notes?: string | null;
  /** Auto-engrave after cut (ops scoring) */
  allowOps?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  const { isOps } = await import("./league");
  const canAward =
    session?.leagueId &&
    (session.isCommissioner || (opts.allowOps && isOps()));
  if (!canAward || !session?.leagueId) {
    return { ok: false, error: "Only the commissioner can award trophies" };
  }
  const name = opts.winnerName.trim();
  if (!name) return { ok: false, error: "Winner name is required" };
  if (opts.seasonYear < 2000 || opts.seasonYear > 2100) {
    return { ok: false, error: "Invalid season year" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("league_trophies").upsert(
    {
      league_id: session.leagueId,
      season_year: opts.seasonYear,
      trophy_type: opts.trophyType,
      winner_name: name,
      winner_user_id: opts.winnerUserId || null,
      subtitle: opts.subtitle?.trim() || null,
      notes: opts.notes?.trim() || null,
      awarded_at: new Date().toISOString(),
      awarded_by: session.playerId,
    },
    { onConflict: "league_id,season_year,trophy_type" }
  );

  if (error) {
    if (
      error.message?.includes("league_trophies") ||
      error.code === "42P01" ||
      error.message?.toLowerCase().includes("does not exist")
    ) {
      return {
        ok: false,
        error:
          "Trophy Room table missing — run supabase/trophy-room.sql in Supabase SQL Editor once.",
      };
    }
    return { ok: false, error: error.message };
  }

  // Permanent badge grants for trophy hardware (tagged to this league)
  try {
    const { grantPermanentBadgeId } = await import("./permanent-badges");
    const uid = opts.winnerUserId;
    const lid = session?.leagueId || null;
    if (uid) {
      if (opts.trophyType === "championship") {
        grantPermanentBadgeId(uid, "championship_ring", { leagueId: lid });
        grantPermanentBadgeId(uid, "war_room_legend", { leagueId: lid });
      }
      if (opts.trophyType === "toilet_bowl") {
        grantPermanentBadgeId(uid, "toilet_crown", { leagueId: lid });
      }
      if (opts.trophyType === "crystal_ball") {
        grantPermanentBadgeId(uid, "national_nightmare", { leagueId: lid });
        grantPermanentBadgeId(uid, "war_room_legend", { leagueId: lid });
      }
    }
  } catch {
    /* ignore */
  }

  return { ok: true };
}

export async function removeTrophy(
  trophyId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can remove trophies" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("league_trophies")
    .delete()
    .eq("id", trophyId)
    .eq("league_id", session.leagueId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Sandbox season reset: wipe Trophy Room engravings so a dry-run "I won it all"
 * does not stick on profiles after reset.
 * Real-season reset keeps Trophy Room history.
 */
export async function wipeLeagueTrophiesForSandbox(
  leagueId: string
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  if (!leagueId) return { ok: false, error: "No league" };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("league_trophies")
      .delete()
      .eq("league_id", leagueId)
      .select("id");
    if (error) {
      if (/does not exist|schema cache/i.test(error.message || "")) {
        return { ok: true, deleted: 0 };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, deleted: data?.length ?? 0 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Trophy wipe failed",
    };
  }
}

export async function transferCommissioner(
  newCommissionerUserId: string,
  opts?: { leagueId?: string }
): Promise<{
  ok: boolean;
  error?: string;
  newCommissionerName?: string;
}> {
  const session = getSession();
  const leagueId = opts?.leagueId || session?.leagueId;
  if (!leagueId) {
    return { ok: false, error: "No league" };
  }
  if (newCommissionerUserId === session?.playerId) {
    return { ok: false, error: "Pick someone else" };
  }

  const supabase = createClient();
  // RPC enforces current commissioner — works from Account for any league you own
  const { data, error } = await supabase.rpc("transfer_commissioner", {
    p_league_id: leagueId,
    p_new_commissioner_id: newCommissionerUserId,
  });

  if (error) {
    if (
      error.message?.toLowerCase().includes("function") ||
      error.message?.toLowerCase().includes("does not exist")
    ) {
      return {
        ok: false,
        error:
          "Pass-commissioner function missing — run supabase/trophy-room.sql in Supabase SQL Editor once.",
      };
    }
    return { ok: false, error: error.message };
  }

  const row = (typeof data === "object" && data) || {};
  const name =
    (row as { newCommissionerName?: string }).newCommissionerName || "Player";

  // Demote local session if this was the active league
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("warroom-session");
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (s.leagueId === leagueId) {
          s.isCommissioner = false;
          localStorage.setItem("warroom-session", JSON.stringify(s));
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { ok: true, newCommissionerName: name };
}

/** Group trophies by season year (newest first). */
export function groupTrophiesBySeason(
  trophies: LeagueTrophy[]
): { year: number; items: LeagueTrophy[] }[] {
  const map = new Map<number, LeagueTrophy[]>();
  for (const t of trophies) {
    const list = map.get(t.seasonYear) || [];
    list.push(t);
    map.set(t.seasonYear, list);
  }
  const order: TrophyType[] = [
    "championship",
    "toilet_bowl",
    "crystal_ball",
    "division_north",
    "division_south",
    "division_east",
    "division_west",
  ];
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      items: [...items].sort(
        (a, b) => order.indexOf(a.trophyType) - order.indexOf(b.trophyType)
      ),
    }));
}
