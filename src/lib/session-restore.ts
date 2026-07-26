import { createClient } from "@/lib/supabase/client";
import { League, Session } from "@/lib/league";

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";
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
    leagueId: membership.leagueId,
  };

  const league: League = {
    id: membership.leagueId,
    name: membership.leagueName,
    code: membership.code,
    commissionerId: membership.commissionerId,
    createdAt: membership.createdAt,
    settings: {
      cutPercent: membership.cutPercent ?? 50,
      regularSeasonWeeks: membership.regularSeasonWeeks ?? 12,
      gamesPerWeek: membership.gamesPerWeek ?? 5,
    },
  };

  if (canUseStorage()) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
    localStorage.setItem(ACTIVE_LEAGUE_KEY, membership.leagueId);
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

  const { data: rows, error } = await supabase
    .from("memberships")
    .select(
      "role, league_id, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week)"
    )
    .eq("user_id", userId);

  if (error || !rows) return [];

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
      regularSeasonWeeks: (L.regular_season_weeks as number) ?? 12,
      gamesPerWeek: (L.games_per_week as number) ?? 5,
      role: (row.role as string) || "player",
      displayName: metaName,
    });
  }
  return list;
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
