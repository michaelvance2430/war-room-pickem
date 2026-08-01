import { createClient } from "@/lib/supabase/client";
import { League, Session } from "@/lib/league";
import { getSportPack } from "@/lib/sports/registry";

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";

async function paintSportFromLeague(sportId?: string | null) {
  try {
    const { applySportTheme } = await import("@/lib/sports/sport-theme");
    applySportTheme(sportId);
  } catch {
    /* ignore */
  }
}
const ACTIVE_LEAGUE_KEY = "warroom-active-league-id";

export interface LeagueMembership {
  leagueId: string;
  leagueName: string;
  code: string;
  commissionerId: string;
  createdAt: string;
  cutPercent: number;
  regularSeasonWeeks: number;
  gamesPerWeek: number;
  role: string;
  displayName: string;
  isModerator?: boolean;
  isDeputy?: boolean;
  crystalBallEnabled?: boolean;
  homeTaglineId?: string;
  homeTaglineCustom?: string;
  seasonThemeId?: string;
  /** Sport pack id (cfb, soccer_wwc, …) */
  sportId?: string;
  /** Open room lobby listing (public matchmaking) */
  isOpen?: boolean;
  /** Humans in the room (non-bot memberships) */
  humanCount?: number;
  /** Trial / padding bots in the room */
  botCount?: number;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function saveActiveLeagueId(leagueId: string) {
  if (canUseStorage()) localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
}

export function getActiveLeagueId(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACTIVE_LEAGUE_KEY);
}

export function writeSessionAndLeague(
  membership: LeagueMembership,
  userId: string
) {
  const isCommissioner =
    membership.role === "commissioner" ||
    membership.commissionerId === userId;

  const session: Session = {
    playerId: userId,
    playerName: membership.displayName || "Player",
    isCommissioner,
    isModerator: !isCommissioner && !!membership.isModerator,
    isDeputy: !isCommissioner && !!membership.isDeputy,
    leagueId: membership.leagueId,
  };

  const league: League = {
    id: membership.leagueId,
    name: membership.leagueName,
    code: membership.code,
    commissionerId: membership.commissionerId,
    createdAt: membership.createdAt,
    sportId: membership.sportId || "cfb",
    settings: {
      cutPercent: membership.cutPercent ?? 50,
      regularSeasonWeeks: membership.regularSeasonWeeks ?? 18,
      gamesPerWeek: membership.gamesPerWeek ?? 5,
      crystalBallEnabled: membership.crystalBallEnabled !== false,
      homeTaglineId: membership.homeTaglineId || "good-teams",
      homeTaglineCustom: membership.homeTaglineCustom || "",
      seasonThemeId: membership.seasonThemeId || "default",
    },
  };

  if (canUseStorage()) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
    localStorage.setItem(ACTIVE_LEAGUE_KEY, membership.leagueId);
  }

  // Paint commissioner theme + sport skin immediately for joiners / switchers
  if (typeof window !== "undefined") {
    try {
      void import("./season-theme").then(({ applySeasonTheme }) => {
        applySeasonTheme(league.settings.seasonThemeId);
      });
    } catch {
      /* ignore */
    }
    void paintSportFromLeague(league.sportId);
    // Multi-sport cheevo progress (Bare Minimum Dual, later rungs)
    try {
      void import("./sports-played").then(({ recordSportPlayed }) => {
        recordSportPlayed(userId, league.sportId);
      });
    } catch {
      /* ignore */
    }
  }

  return { session, league };
}

/** Load all leagues this user belongs to */
export async function fetchMyMemberships(): Promise<LeagueMembership[]> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const userId = auth.user.id;
  const metaName =
    (auth.user.user_metadata?.display_name as string | undefined) ||
    auth.user.email?.split("@")[0] ||
    "Player";

  let rows: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select(
        "role, is_moderator, is_deputy, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id, is_open)"
      )
      .eq("user_id", userId);
    if (res.error && /is_moderator|is_deputy|schema cache|column|season_theme|home_tagline|crystal_ball|sport_id|is_open/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("memberships")
        .select(
          "role, is_moderator, is_deputy, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id)"
        )
        .eq("user_id", userId);
      if (res2.error && /is_moderator|is_deputy|schema cache|column|season_theme|home_tagline|crystal_ball|sport_id/i.test(res2.error.message || "")) {
        const res3 = await supabase
          .from("memberships")
          .select(
            "role, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, sport_id)"
          )
          .eq("user_id", userId);
        if (res3.error && /sport_id/i.test(res3.error.message || "")) {
          const res4 = await supabase
            .from("memberships")
            .select(
              "role, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week)"
            )
            .eq("user_id", userId);
          rows = (res4.data as Record<string, unknown>[] | null) || null;
        } else {
          rows = (res3.data as Record<string, unknown>[] | null) || null;
        }
      } else {
        rows = (res2.data as Record<string, unknown>[] | null) || null;
      }
    } else {
      rows = (res.data as Record<string, unknown>[] | null) || null;
    }
  }

  if (!rows) return [];

  // Build list below; also stamp multi-sport tracker from all memberships
  const list: LeagueMembership[] = [];
  for (const row of rows) {
    const L = row.leagues as Record<string, unknown> | null;
    if (!L) continue;
    list.push({
      leagueId: L.id as string,
      leagueName: (L.name as string) || "League",
      code: (L.code as string) || "",
      commissionerId: L.commissioner_id as string,
      createdAt: (L.created_at as string) || "",
      cutPercent: (L.cut_percent as number) ?? 50,
      regularSeasonWeeks: (L.regular_season_weeks as number) ?? 18,
      gamesPerWeek: (L.games_per_week as number) ?? 5,
      role: (row.role as string) || "player",
      displayName: metaName,
      isModerator: !!row.is_moderator,
      isDeputy: !!row.is_deputy,
      crystalBallEnabled: L.crystal_ball_enabled !== false,
      homeTaglineId: (L.home_tagline_id as string) || "good-teams",
      homeTaglineCustom: (L.home_tagline_custom as string) || "",
      seasonThemeId: (L.season_theme_id as string) || "default",
      sportId: (L.sport_id as string) || "cfb",
      isOpen: L.is_open === true,
    });
  }

  // Roster counts (humans vs bots) for clear multi-league scan
  if (list.length) {
    try {
      const ids = list.map((m) => m.leagueId);
      const { data: rosterRows, error: rosterErr } = await supabase
        .from("memberships")
        .select("league_id, is_bot")
        .in("league_id", ids);
      if (!rosterErr && rosterRows?.length) {
        const tallies = new Map<string, { humans: number; bots: number }>();
        for (const r of rosterRows as { league_id: string; is_bot?: boolean }[]) {
          const lid = r.league_id;
          const t = tallies.get(lid) || { humans: 0, bots: 0 };
          if (r.is_bot) t.bots += 1;
          else t.humans += 1;
          tallies.set(lid, t);
        }
        for (const m of list) {
          const t = tallies.get(m.leagueId);
          if (t) {
            m.humanCount = t.humans;
            m.botCount = t.bots;
          }
        }
      }
    } catch {
      /* counts optional */
    }
  }

  try {
    const { mergeSportsFromMemberships } = require("./sports-played") as typeof import("./sports-played");
    mergeSportsFromMemberships(userId, list);
  } catch {
    /* ignore */
  }
  return list;
}

/** Role label for multi-league UI */
export function membershipRoleLabel(
  m: LeagueMembership,
  userId?: string | null
): string {
  const isCommish =
    m.role === "commissioner" ||
    (!!userId && m.commissionerId === userId);
  if (isCommish) return "Commissioner";
  if (m.isDeputy) return "Deputy";
  if (m.isModerator) return "Moderator";
  return "Player";
}

/** One-line scan summary under a league name */
export function membershipScanLine(
  m: LeagueMembership,
  userId?: string | null
): string {
  const pack = getSportPack(m.sportId || "cfb");
  const role = membershipRoleLabel(m, userId);
  const room = m.isOpen ? "Open room" : "Private";
  const bots =
    typeof m.botCount === "number"
      ? m.botCount > 0
        ? `${m.botCount} bot${m.botCount === 1 ? "" : "s"}`
        : "No bots"
      : null;
  const humans =
    typeof m.humanCount === "number"
      ? `${m.humanCount} player${m.humanCount === 1 ? "" : "s"}`
      : null;
  const seats = [humans, bots].filter(Boolean).join(" · ");
  return [`${pack.emoji} ${pack.shortLabel}`, role, room, seats || null, m.code]
    .filter(Boolean)
    .join(" · ");
}

export type RestoreResult =
  | { status: "no_auth" }
  | { status: "no_leagues" }
  | { status: "restored"; session: Session; league: League }
  | { status: "pick_league"; memberships: LeagueMembership[] };

/**
 * If local session missing, restore from Supabase memberships.
 * Prefer last active league, else single membership, else ask user to pick.
 */
export async function restoreSessionFromCloud(): Promise<RestoreResult> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "no_auth" };

  const userId = auth.user.id;
  const memberships = await fetchMyMemberships();
  if (!memberships.length) return { status: "no_leagues" };

  const activeId = getActiveLeagueId();
  let chosen =
    (activeId && memberships.find((m) => m.leagueId === activeId)) ||
    (memberships.length === 1 ? memberships[0] : null);

  // If local session already points at a valid membership, keep it
  if (!chosen && canUseStorage()) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        chosen = memberships.find((m) => m.leagueId === s.leagueId) || null;
      }
    } catch {
      // ignore
    }
  }

  if (chosen) {
    const { session, league } = writeSessionAndLeague(chosen, userId);
    return { status: "restored", session, league };
  }

  return { status: "pick_league", memberships };
}

export async function switchToLeague(leagueId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const memberships = await fetchMyMemberships();
  const m = memberships.find((x) => x.leagueId === leagueId);
  if (!m) return false;
  writeSessionAndLeague(m, auth.user.id);
  // Refresh full league (incl. season theme + sport skin) from cloud when possible
  try {
    const { syncLeagueFromCloud } = await import("./league-sync");
    const { applySeasonTheme } = await import("./season-theme");
    const lg = await syncLeagueFromCloud();
    if (lg?.sportId) {
      void paintSportFromLeague(lg.sportId);
    }
    if (lg?.settings?.seasonThemeId) {
      applySeasonTheme(lg.settings.seasonThemeId);
    }
  } catch {
    /* membership settings already applied */
  }
  return true;
}

export async function signOutFully() {
  const supabase = createClient();
  await supabase.auth.signOut();
  if (canUseStorage()) {
    localStorage.removeItem(SESSION_KEY);
    // keep league list preference optional — clear active only
    localStorage.removeItem(ACTIVE_LEAGUE_KEY);
    // leave warroom-league so switch can rehydrate; or clear:
    localStorage.removeItem(LEAGUE_KEY);
  }
}


export async function leaveLeague(leagueId: string): Promise<{
  ok: boolean;
  error?: string;
  /** Early leave forfeit summary (when season still open) */
  forfeitMessage?: string;
  forfeitedCount?: number;
}> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in" };

  // Commissioner must pass the role first so the league (and Trophy Room) stay owned
  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id, sport_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (league?.commissioner_id === auth.user.id) {
    return {
      ok: false,
      error:
        "You're the commissioner. Pass commissioner to another member first (Commissioner → Pass commissioner), then leave. That keeps the Trophy Room with the league.",
    };
  }

  // PRODUCT: leave before season ends → forfeit league-earned cheevos / hardware.
  // Knocked out of brackets but still in the room keeps everything.
  let forfeitMessage: string | undefined;
  let forfeitedCount = 0;
  try {
    const { forfeitRewardsOnEarlyLeave } = await import(
      "./league-earned-ledger"
    );
    const result = await forfeitRewardsOnEarlyLeave({
      playerId: auth.user.id,
      leagueId,
      sportId: (league as { sport_id?: string | null } | null)?.sport_id,
    });
    forfeitedCount = result.forfeitedBadgeIds.length;
    forfeitMessage = result.message;
  } catch {
    /* don't block leave if forfeit fails */
  }

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false, error: error.message };

  if (canUseStorage()) {
    const active = localStorage.getItem(ACTIVE_LEAGUE_KEY);
    if (active === leagueId) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEAGUE_KEY);
      localStorage.removeItem(ACTIVE_LEAGUE_KEY);
    }
  }
  return { ok: true, forfeitMessage, forfeitedCount };
}

/**
 * Commissioner only — deletes the league (cascades memberships, cards, etc.).
 * Mid-season with other humans: blocked (see league-delete-guard). Call
 * evaluateLeagueDelete first; hard-delete only when canHardDelete is true.
 */
export async function deleteLeague(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in" };

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league || league.commissioner_id !== auth.user.id) {
    return { ok: false, error: "Only the commissioner can delete this league" };
  }

  // Server-side belt: block nuke mid-season even if UI is bypassed
  try {
    const { evaluateLeagueDelete } = await import("./league-delete-guard");
    const eval_ = await evaluateLeagueDelete(leagueId);
    if (!eval_.canHardDelete) {
      return {
        ok: false,
        error:
          eval_.reason ||
          "Mid-season rooms can't be deleted. Keep the team together — pass the keys when someone is ready to jump in.",
      };
    }
  } catch {
    /* if eval fails, still allow delete only for empty rooms below */
  }

  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
  if (error) return { ok: false, error: error.message };

  if (canUseStorage()) {
    const active = localStorage.getItem(ACTIVE_LEAGUE_KEY);
    if (active === leagueId) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEAGUE_KEY);
      localStorage.removeItem(ACTIVE_LEAGUE_KEY);
    }
  }
  return { ok: true };
}
