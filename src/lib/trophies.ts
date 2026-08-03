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
    title: "Division / Conference",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race (SEC, AFC East, …). Stack years on the profile shelf.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_south: {
    title: "Division / Conference",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race. Stack years on the profile shelf.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_east: {
    title: "Division / Conference",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race. Stack years on the profile shelf.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
  division_west: {
    title: "Division / Conference",
    short: "Title",
    emoji: "🛡️",
    blurb: "Won your conference or division race. Stack years on the profile shelf.",
    accent: "text-primary",
    border: "border-primary/40",
    glow: "shadow-[0_0_40px_rgba(34,197,94,0.1)]",
  },
};

function mapRow(r: Record<string, unknown>): LeagueTrophy {
  // Coerce season_year — PostgREST can surface numeric as string; strict ===
  // against PRIOR_SEASON_YEAR (number) then drops prior plaques from the wall.
  const yearRaw = r.season_year;
  const seasonYear =
    typeof yearRaw === "number"
      ? yearRaw
      : Number.parseInt(String(yearRaw ?? ""), 10) || 0;
  return {
    id: r.id as string,
    leagueId: r.league_id as string,
    seasonYear,
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

/** Trophy row with room identity for multi-league career cases */
export type CareerLeagueTrophy = LeagueTrophy & {
  leagueName: string;
  sportId: string | null;
  leagueCode: string | null;
};

type LeagueEmbed = {
  id?: string;
  name?: string;
  sport_id?: string;
  code?: string;
} | null;

function mapCareerRow(
  r: Record<string, unknown>,
  fallback?: {
    leagueName?: string;
    sportId?: string | null;
    leagueCode?: string | null;
  }
): CareerLeagueTrophy {
  const base = mapRow(r);
  const lg = r.leagues as LeagueEmbed | LeagueEmbed[] | undefined;
  const embed = Array.isArray(lg) ? lg[0] : lg;
  return {
    ...base,
    leagueId: base.leagueId || (embed?.id as string) || fallback?.leagueName || "",
    leagueName:
      (embed?.name as string) ||
      fallback?.leagueName ||
      "War Room",
    sportId:
      (embed?.sport_id as string) ||
      fallback?.sportId ||
      null,
    leagueCode:
      (embed?.code as string) ||
      fallback?.leagueCode ||
      null,
  };
}

/**
 * Career hardware for a player across every league the *viewer* can read
 * (membership RLS) — plus name-match engravings in those rooms.
 * Self profile + multi-league memberships → full showcase.
 */
export async function loadCareerTrophiesWonByUser(
  userId: string,
  opts?: { playerName?: string | null }
): Promise<CareerLeagueTrophy[]> {
  if (!userId) return [];
  const supabase = createClient();
  const byId = new Map<string, CareerLeagueTrophy>();
  const name = (opts?.playerName || "").trim();

  // 1) Direct winner link (works for every league RLS allows the viewer to see)
  try {
    const { data, error } = await supabase
      .from("league_trophies")
      .select(
        "id, league_id, season_year, trophy_type, winner_name, winner_user_id, subtitle, notes, awarded_at, leagues(id, name, sport_id, code)"
      )
      .eq("winner_user_id", userId)
      .order("season_year", { ascending: false });
    if (!error && data) {
      for (const raw of data as Record<string, unknown>[]) {
        const row = mapCareerRow(raw);
        if (row.id) byId.set(row.id, row);
      }
    }
  } catch {
    /* optional */
  }

  // 2) Walk viewer's memberships in parallel (was N sequential queries — profile lag)
  try {
    const { fetchMyMemberships } = await import("@/lib/session-restore");
    const memberships = await fetchMyMemberships();
    const rooms = memberships.filter((m) => m.leagueId);
    await Promise.all(
      rooms.map(async (m) => {
        try {
          const { data, error } = await supabase
            .from("league_trophies")
            .select(
              "id, league_id, season_year, trophy_type, winner_name, winner_user_id, subtitle, notes, awarded_at"
            )
            .eq("league_id", m.leagueId)
            .order("season_year", { ascending: false });
          if (error || !data) return;
          for (const raw of data as Record<string, unknown>[]) {
            const base = mapRow(raw);
            // Include all plaques from rooms we can read; getProfileHardware
            // filters to this player (id or name). Keeps Excel name-only wins.
            if (byId.has(base.id)) continue;
            byId.set(base.id, {
              ...base,
              leagueName: m.leagueName || "War Room",
              sportId: m.sportId || null,
              leagueCode: m.code || null,
            });
          }
        } catch {
          /* next league */
        }
      })
    );
  } catch {
    /* offline */
  }

  // 3) Always merge active league (name match for peers in this room)
  try {
    const session = getSession();
    const activeId = session?.leagueId;
    if (activeId && ![...byId.values()].some((t) => t.leagueId === activeId)) {
      const list = await loadLeagueTrophies();
      const { getLeague } = await import("@/lib/league");
      const lg = getLeague();
      for (const t of list) {
        if (byId.has(t.id)) continue;
        const isId = t.winnerUserId === userId;
        if (!isId && !name) continue;
        byId.set(t.id, {
          ...t,
          leagueName: lg?.name || "War Room",
          sportId: lg?.sportId || null,
          leagueCode: lg?.code || null,
        });
      }
    } else if (activeId) {
      // Refresh active league name-only rows even if some trophies already loaded
      const list = await loadLeagueTrophies();
      const { getLeague } = await import("@/lib/league");
      const lg = getLeague();
      for (const t of list) {
        if (byId.has(t.id)) continue;
        byId.set(t.id, {
          ...t,
          leagueName: lg?.name || "War Room",
          sportId: lg?.sportId || null,
          leagueCode: lg?.code || null,
        });
      }
    }
  } catch {
    /* ok */
  }

  return [...byId.values()].sort((a, b) => b.seasonYear - a.seasonYear);
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
  const payload = {
    league_id: session.leagueId,
    season_year: opts.seasonYear,
    trophy_type: opts.trophyType,
    winner_name: name,
    winner_user_id: opts.winnerUserId || null,
    subtitle: opts.subtitle?.trim() || null,
    notes: opts.notes?.trim() || null,
    awarded_at: new Date().toISOString(),
    awarded_by: session.playerId,
  };
  const { error } = await supabase.from("league_trophies").upsert(payload, {
    onConflict: "league_id,season_year,trophy_type",
  });

  if (error) {
    // Surface full PostgREST body for ops (not silent) — no retry loop
    const full = [
      error.message,
      error.code ? `code=${error.code}` : null,
      error.details ? `details=${error.details}` : null,
      error.hint ? `hint=${error.hint}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    try {
      console.warn("[league_trophies upsert]", full, {
        trophyType: opts.trophyType,
        seasonYear: opts.seasonYear,
        leagueId: session.leagueId,
      });
    } catch {
      /* ok */
    }
    if (
      error.code === "42P01" ||
      /does not exist|schema cache|PGRST205/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Trophy Room table missing — run supabase/trophy-room.sql (then FIX-LEAGUE-TROPHIES-UPSERT.sql) in Supabase SQL Editor.",
      };
    }
    if (
      error.code === "42P10" ||
      /no unique or exclusion constraint matching the ON CONFLICT/i.test(
        error.message || ""
      )
    ) {
      return {
        ok: false,
        error:
          "Trophy upsert needs UNIQUE (league_id, season_year, trophy_type) — run supabase/FIX-LEAGUE-TROPHIES-UPSERT.sql in Supabase.",
      };
    }
    if (
      error.code === "23514" ||
      /trophy_type|check constraint/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Trophy type not allowed on this database (need division types) — run supabase/FIX-LEAGUE-TROPHIES-UPSERT.sql (or division-trophies.sql).",
      };
    }
    if (
      error.code === "42501" ||
      /row-level security|violates row-level/i.test(error.message || "")
    ) {
      return {
        ok: false,
        error:
          "Not allowed to write trophies (commissioner only per RLS). " + full,
      };
    }
    return { ok: false, error: full || error.message };
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
