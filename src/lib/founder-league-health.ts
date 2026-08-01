/**
 * Foundry Hub — health of EVERY room the founder sits in.
 * Not just the active desk. Scales as multi-sport / multi-league grows.
 */

import { createClient } from "@/lib/supabase/client";
import {
  fetchMyMemberships,
  type LeagueMembership,
} from "@/lib/session-restore";
import { getSession } from "@/lib/league";
import { getSportPack, normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";

export type RoomLight = "green" | "yellow" | "red" | "gray";

export type RoomHealth = {
  leagueId: string;
  name: string;
  code: string;
  sportId: SportId;
  role: string;
  isActive: boolean;
  isOpen: boolean;
  humans: number;
  bots: number;
  /** Latest published week_cards.week_number */
  cardWeek: number | null;
  /** Highest scored week_results.week_number */
  scoredWeek: number | null;
  scoredCount: number;
  /** leagues.current_week if present */
  currentWeek: number | null;
  /** Locked human picks for cardWeek (if any) */
  lockedPicks: number | null;
  /** Human roster size with last_seen in 7d (best-effort) */
  active7d: number | null;
  light: RoomLight;
  /** One-line status for the hub */
  summary: string;
};

export type LeagueFleetHealth = {
  rooms: RoomHealth[];
  bySport: { sportId: SportId; label: string; emoji: string; rooms: RoomHealth[] }[];
  totals: {
    rooms: number;
    humans: number;
    bots: number;
    green: number;
    yellow: number;
    red: number;
    openRooms: number;
  };
  loadedAt: string;
};

function lightFor(r: Omit<RoomHealth, "light" | "summary">): {
  light: RoomLight;
  summary: string;
} {
  const humans = r.humans;
  if (humans < 1) {
    return { light: "red", summary: "Empty room — no humans" };
  }
  // No card ever
  if (r.cardWeek == null && r.scoredCount === 0) {
    if (humans === 1) {
      return {
        light: "yellow",
        summary: "Solo / preseason — no card published yet",
      };
    }
    return {
      light: "yellow",
      summary: `${humans} humans · waiting on first card`,
    };
  }
  // Card live, little/no scoring
  if (r.cardWeek != null && r.scoredCount === 0) {
    const locked = r.lockedPicks;
    if (locked != null && humans > 1 && locked < Math.max(1, humans - 1)) {
      return {
        light: "yellow",
        summary: `Card W${r.cardWeek} · ${locked}/${humans} locked`,
      };
    }
    return {
      light: "green",
      summary: `Card W${r.cardWeek} live · season not scored yet`,
    };
  }
  // Healthy scored season
  if (r.scoredCount > 0) {
    const lag =
      r.cardWeek != null && r.scoredWeek != null
        ? r.cardWeek - r.scoredWeek
        : 0;
    if (lag >= 2) {
      return {
        light: "yellow",
        summary: `Scored through W${r.scoredWeek} · card on W${r.cardWeek} (behind)`,
      };
    }
    return {
      light: "green",
      summary: `Live · ${r.scoredCount} week${r.scoredCount === 1 ? "" : "s"} scored · ${humans} humans`,
    };
  }
  return { light: "gray", summary: "Unknown state" };
}

/**
 * Probe every membership room (parallel, best-effort).
 * Safe for Founder only UI — uses normal authenticated client.
 */
export async function loadFounderLeagueFleetHealth(): Promise<LeagueFleetHealth> {
  const session = getSession();
  const memberships = await fetchMyMemberships();
  const activeId = session?.leagueId || null;
  const supabase = createClient();

  const rooms = await Promise.all(
    memberships.map(async (m): Promise<RoomHealth> => {
      const base = {
        leagueId: m.leagueId,
        name: m.leagueName || "War Room",
        code: m.code || "",
        sportId: normalizeSportId(m.sportId || "cfb"),
        role: m.role || "player",
        isActive: m.leagueId === activeId,
        isOpen: !!m.isOpen,
        humans: typeof m.humanCount === "number" ? m.humanCount : 0,
        bots: typeof m.botCount === "number" ? m.botCount : 0,
        cardWeek: null as number | null,
        scoredWeek: null as number | null,
        scoredCount: 0,
        currentWeek: null as number | null,
        lockedPicks: null as number | null,
        active7d: null as number | null,
      };

      try {
        const [
          leagueRes,
          cardRes,
          scoredRes,
          rosterRes,
        ] = await Promise.all([
          supabase
            .from("leagues")
            .select("current_week, sport_id, is_open")
            .eq("id", m.leagueId)
            .maybeSingle(),
          supabase
            .from("week_cards")
            .select("week_number")
            .eq("league_id", m.leagueId)
            .order("week_number", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("week_results")
            .select("week_number")
            .eq("league_id", m.leagueId)
            .order("week_number", { ascending: false }),
          supabase
            .from("memberships")
            .select("user_id, is_bot")
            .eq("league_id", m.leagueId),
        ]);

        if (leagueRes.data) {
          const cw = (leagueRes.data as { current_week?: number }).current_week;
          if (typeof cw === "number") base.currentWeek = cw;
          if ((leagueRes.data as { is_open?: boolean }).is_open === true) {
            base.isOpen = true;
          }
          const sid = (leagueRes.data as { sport_id?: string }).sport_id;
          if (sid) base.sportId = normalizeSportId(sid);
        }

        if (cardRes.data?.week_number != null) {
          base.cardWeek = Number(cardRes.data.week_number);
        }

        const scoredRows = (scoredRes.data || []) as { week_number: number }[];
        base.scoredCount = scoredRows.length;
        if (scoredRows.length) {
          base.scoredWeek = Math.max(
            ...scoredRows.map((r) => Number(r.week_number) || 0)
          );
        }

        // Re-count roster if membership tallies missing
        if (rosterRes.data?.length) {
          let humans = 0;
          let bots = 0;
          const humanIds: string[] = [];
          for (const row of rosterRes.data as {
            user_id: string;
            is_bot?: boolean;
          }[]) {
            if (row.is_bot) bots += 1;
            else {
              humans += 1;
              humanIds.push(row.user_id);
            }
          }
          base.humans = humans;
          base.bots = bots;

          // Active in last 7 days (profiles.last_seen_at)
          if (humanIds.length) {
            try {
              const since = new Date(
                Date.now() - 7 * 24 * 60 * 60 * 1000
              ).toISOString();
              const { data: seen } = await supabase
                .from("profiles")
                .select("id, last_seen_at")
                .in("id", humanIds)
                .gte("last_seen_at", since);
              base.active7d = seen?.length ?? 0;
            } catch {
              base.active7d = null;
            }
          }
        } else {
          base.humans = base.humans || (typeof m.humanCount === "number" ? m.humanCount : 0);
          base.bots = base.bots || (typeof m.botCount === "number" ? m.botCount : 0);
        }

        // Locked picks for latest card week
        if (base.cardWeek != null) {
          try {
            const { data: picks, count } = await supabase
              .from("picks")
              .select("id, user_id, locked_at", { count: "exact" })
              .eq("league_id", m.leagueId)
              .eq("week_number", base.cardWeek)
              .not("locked_at", "is", null);
            // Prefer counting distinct users with lock
            if (picks?.length) {
              const set = new Set(
                (picks as { user_id: string }[]).map((p) => p.user_id)
              );
              base.lockedPicks = set.size;
            } else if (typeof count === "number") {
              base.lockedPicks = count;
            } else {
              base.lockedPicks = 0;
            }
          } catch {
            base.lockedPicks = null;
          }
        }
      } catch {
        /* leave defaults */
      }

      const { light, summary } = lightFor(base);
      return { ...base, light, summary };
    })
  );

  // Sort: red first, then yellow, active, name
  const order: Record<RoomLight, number> = {
    red: 0,
    yellow: 1,
    gray: 2,
    green: 3,
  };
  rooms.sort((a, b) => {
    if (order[a.light] !== order[b.light]) return order[a.light] - order[b.light];
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const bySportMap = new Map<SportId, RoomHealth[]>();
  for (const r of rooms) {
    const arr = bySportMap.get(r.sportId) || [];
    arr.push(r);
    bySportMap.set(r.sportId, arr);
  }
  const bySport = [...bySportMap.entries()]
    .map(([sportId, list]) => {
      const pack = getSportPack(sportId);
      return {
        sportId,
        label: pack.shortLabel,
        emoji: pack.emoji,
        rooms: list,
      };
    })
    .sort(
      (a, b) =>
        getSportPack(a.sportId).sortOrder - getSportPack(b.sportId).sortOrder
    );

  const totals = {
    rooms: rooms.length,
    humans: rooms.reduce((n, r) => n + r.humans, 0),
    bots: rooms.reduce((n, r) => n + r.bots, 0),
    green: rooms.filter((r) => r.light === "green").length,
    yellow: rooms.filter((r) => r.light === "yellow").length,
    red: rooms.filter((r) => r.light === "red").length,
    openRooms: rooms.filter((r) => r.isOpen).length,
  };

  return {
    rooms,
    bySport,
    totals,
    loadedAt: new Date().toISOString(),
  };
}

/** @deprecated shape helper — memberships only */
export type { LeagueMembership };
