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
  /**
   * Resolved name for this league only:
   * membership.display_name_override ?? profiles.display_name
   */
  displayName: string;
  /** Raw alias stored on membership (null = use account name). */
  displayNameOverride?: string | null;
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

  // playerName = active-league resolved identity only (never a global cache key)
  const session: Session = {
    playerId: userId,
    playerName: membership.displayName || "Player",
    isCommissioner,
    isModerator: !isCommissioner && !!membership.isModerator,
    isDeputy: !isCommissioner && !!membership.isDeputy,
    leagueId: membership.leagueId,
  };

  let sportId = (membership.sportId || "cfb").trim() || "cfb";
  try {
    const {
      resolveLeagueSportId,
      stampLeagueSport,
    } = require("./sports/sport-theme") as typeof import("./sports/sport-theme");
    // Membership.sportId is cloud-sourced; local never overwrites cloud.
    sportId = resolveLeagueSportId({
      leagueId: membership.leagueId,
      cloudSportId: membership.sportId,
      localSportId: sportId,
    });
    // Local stamp only — never force-pin / never cloud UPDATE on session land
    stampLeagueSport(membership.leagueId, sportId, {
      cloudConfirmed: true,
    });
  } catch {
    /* keep sportId */
  }
  // CFB + NFL pride pick default ON when cloud flag absent.
  // Other packs stay off unless cloud says true.
  const crystalBallEnabled =
    typeof membership.crystalBallEnabled === "boolean"
      ? membership.crystalBallEnabled
      : sportId === "cfb" || sportId === "nfl";

  const league: League = {
    id: membership.leagueId,
    name: membership.leagueName,
    code: membership.code,
    commissionerId: membership.commissionerId,
    createdAt: membership.createdAt,
    sportId,
    settings: {
      cutPercent: membership.cutPercent ?? 50,
      regularSeasonWeeks: membership.regularSeasonWeeks ?? 18,
      gamesPerWeek: membership.gamesPerWeek ?? 5,
      crystalBallEnabled,
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
      void import("./sport-room-scope").then(({ setSportScope }) => {
        if (league.sportId) setSportScope(league.sportId);
      });
    } catch {
      /* ignore */
    }
    try {
      void import("./season-theme").then(({ paintAutomaticSeasonTheme }) => {
        void paintAutomaticSeasonTheme();
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

const membershipsCache = new Map<
  string,
  { at: number; list: LeagueMembership[] }
>();
const membershipsInflight = new Map<string, Promise<LeagueMembership[]>>();
const MEMBERSHIPS_TTL_MS = 20_000;

/** Clear membership list cache (e.g. after league alias change). */
export function invalidateMembershipsCache(userId?: string | null) {
  if (userId) {
    membershipsCache.delete(userId);
    membershipsInflight.delete(userId);
    return;
  }
  membershipsCache.clear();
  membershipsInflight.clear();
}

/** Load all leagues this user belongs to */
export async function fetchMyMemberships(): Promise<LeagueMembership[]> {
  const supabase = createClient();
  // Prefer local session id — auth.getUser() is a network hop and freezes Home hub
  let userId: string | null = null;
  let metaName = "Player";
  try {
    const { getSession } = await import("@/lib/league");
    userId = getSession()?.playerId || null;
    metaName = getSession()?.playerName || "Player";
  } catch {
    userId = null;
  }
  if (!userId) {
    const { data: auth } = await supabase.auth.getSession();
    userId = auth.session?.user?.id || null;
    if (auth.session?.user) {
      metaName =
        (auth.session.user.user_metadata?.display_name as string | undefined) ||
        auth.session.user.email?.split("@")[0] ||
        "Player";
    }
  }
  if (!userId) return [];

  const hit = membershipsCache.get(userId);
  if (hit && Date.now() - hit.at < MEMBERSHIPS_TTL_MS) return hit.list;
  const inflight = membershipsInflight.get(userId);
  if (inflight) return inflight;

  const promise = fetchMyMembershipsFresh(userId, metaName).finally(() => {
    membershipsInflight.delete(userId!);
  });
  membershipsInflight.set(userId, promise);
  return promise;
}

async function fetchMyMembershipsFresh(
  userId: string,
  metaName: string
): Promise<LeagueMembership[]> {
  const supabase = createClient();

  let rows: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select(
        "role, is_moderator, is_deputy, league_id, display_name_override, leagues(id, name, code, commissioner_id, created_at, cut_percent, regular_season_weeks, games_per_week, crystal_ball_enabled, home_tagline_id, home_tagline_custom, season_theme_id, sport_id, is_open)"
      )
      .eq("user_id", userId);
    if (res.error && /is_moderator|is_deputy|display_name_override|schema cache|column|season_theme|home_tagline|crystal_ball|sport_id|is_open/i.test(res.error.message || "")) {
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

  // Account name from profiles (not session meta — session may be a league alias)
  let accountName = metaName;
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.display_name) {
      accountName = (prof.display_name as string) || accountName;
    }
  } catch {
    /* keep metaName */
  }

  const { resolveLeagueDisplayName } = await import("./display-name");

  // Build list below; also stamp multi-sport tracker from all memberships
  const list: LeagueMembership[] = [];
  for (const row of rows) {
    const L = row.leagues as Record<string, unknown> | null;
    if (!L) continue;
    const override =
      (row.display_name_override as string | null | undefined) ?? null;
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
      displayName: resolveLeagueDisplayName({
        membershipOverride: override,
        profileDisplayName: accountName,
      }),
      displayNameOverride: override,
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

  // Align local stamps to cloud sport only — never UPDATE leagues.sport_id here.
  try {
    const { resolveLeagueSportId } = require("./sports/sport-theme") as typeof import("./sports/sport-theme");
    for (const m of list) {
      // Embedded league sport_id is authoritative when present (incl. cfb).
      const cloudSport = m.sportId || "cfb";
      const resolved = resolveLeagueSportId({
        leagueId: m.leagueId,
        cloudSportId: cloudSport,
      });
      m.sportId = resolved;
      if (resolved === "soccer_wwc") {
        // Event packs: only honor explicit cloud true
        if (m.crystalBallEnabled !== true) {
          m.crystalBallEnabled = false;
        }
      } else if (resolved === "nfl") {
        // NFL Super Bowl pick defaults ON when membership flag unset
        if (typeof m.crystalBallEnabled !== "boolean") {
          m.crystalBallEnabled = true;
        }
      }
    }
  } catch {
    /* ignore */
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
  membershipsCache.set(userId, { at: Date.now(), list });
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
  /** Auth ok but memberships fetch timed out / failed — do not bounce to /join */
  | { status: "network_error" }
  | { status: "restored"; session: Session; league: League }
  | { status: "pick_league"; memberships: LeagueMembership[] };

/**
 * If local session missing, restore from Supabase memberships.
 * Prefer last active league, else single membership, else ask user to pick.
 *
 * Uses auth.getSession() (local JWT) — NOT getUser() which network-validates
 * and hangs forever on flaky mobile, freezing Home on "Loading…".
 */
export async function restoreSessionFromCloud(): Promise<RestoreResult> {
  const supabase = createClient();
  let userId: string | null = null;
  {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id || null;
  }
  if (!userId) {
    // One short hydrate wait — iOS Safari sometimes lags localStorage → GoTrue
    await new Promise((r) => setTimeout(r, 250));
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id || null;
  }
  if (!userId) return { status: "no_auth" };

  // Cap membership fetch — never block app open on a stuck PostgREST call
  let membershipsTimedOut = false;
  const memberships = await new Promise<LeagueMembership[]>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      membershipsTimedOut = true;
      resolve([]);
    }, 8_000);
    fetchMyMemberships()
      .then((list) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(list);
      })
      .catch(() => {
        if (done) return;
        done = true;
        membershipsTimedOut = true;
        clearTimeout(t);
        resolve([]);
      });
  });
  if (!memberships.length) {
    // Flaky phone radio: empty after timeout ≠ "create a league"
    if (membershipsTimedOut) return { status: "network_error" };
    return { status: "no_leagues" };
  }

  // Prefer the league this browser is already pointed at (create / join / switch)
  // over a stale warroom-active-league-id from an older CFB room.
  let chosen: LeagueMembership | null = null;
  if (canUseStorage()) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        if (s?.leagueId) {
          chosen =
            memberships.find((m) => m.leagueId === s.leagueId) || null;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!chosen) {
    const activeId = getActiveLeagueId();
    chosen =
      (activeId && memberships.find((m) => m.leagueId === activeId)) ||
      (memberships.length === 1 ? memberships[0] : null);
  }

  if (chosen) {
    const { session, league } = writeSessionAndLeague(chosen, userId);
    return { status: "restored", session, league };
  }

  return { status: "pick_league", memberships };
}

export async function switchToLeague(leagueId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return false;
  const memberships = await fetchMyMemberships();
  const m = memberships.find((x) => x.leagueId === leagueId);
  if (!m) return false;
  writeSessionAndLeague(m, userId);
  // Sandbox host hop bar is per-room — never carry into another league
  try {
    const { clearSandboxHostHopOnLeagueSwitch } = await import(
      "./sandbox-host-hop"
    );
    clearSandboxHostHopOnLeagueSwitch();
  } catch {
    /* ignore */
  }
  // Keep multi-sport “desk” filter on this room’s sport
  try {
    const { setSportScope } = await import("./sport-room-scope");
    if (m.sportId) setSportScope(m.sportId);
  } catch {
    /* ignore */
  }
  // Refresh full league (incl. season theme + sport skin) from cloud when possible
  try {
    const { syncLeagueFromCloud } = await import("./league-sync");
    const { paintAutomaticSeasonTheme } = await import("./season-theme");
    const {
      reapplySportThemeFromLocal,
      getLeagueSportIdFromLocal,
    } = await import("./sports/sport-theme");
    const lg = await syncLeagueFromCloud();
    // Always paint from resolved local stamp (not a raw cloud cfb flash)
    reapplySportThemeFromLocal();
    const sport = getLeagueSportIdFromLocal() || lg?.sportId;
    if (sport) {
      void paintSportFromLeague(sport);
      try {
        const { setSportScope } = await import("./sport-room-scope");
        setSportScope(sport);
      } catch {
        /* ignore */
      }
    }
    // Atmosphere is automatic — never honor stored season_theme_id
    void paintAutomaticSeasonTheme();
  } catch {
    /* membership settings already applied */
  }
  return true;
}

export async function signOutFully() {
  const supabase = createClient();
  await supabase.auth.signOut();
  if (canUseStorage()) {
    // Keep warroom-league-sport-stamps-v1 — league sport desks must survive logout
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
  /** Only when penalties apply — new Blue Falcon Count after this quit */
  blueFalconCount?: number;
  /** Season already finished — no Blue Falcon / forfeit */
  seasonFinished?: boolean;
  /** After opening week + not finished */
  penaltiesApplied?: boolean;
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

  const sportId = (league as { sport_id?: string | null } | null)?.sport_id;

  // PRODUCT: Blue Falcon + forfeit ONLY after opening week has started
  // and before the season is finished. Preseason leave is clean.
  let forfeitMessage: string | undefined;
  let forfeitedCount = 0;
  let seasonFinished = false;
  let blueFalconCount: number | undefined;
  /** True when leave should hit Blue Falcon + reward forfeit */
  let penaltiesApply = false;

  try {
    const {
      isLeagueSeasonFinishedForRewards,
      forfeitRewardsOnEarlyLeave,
      leaveAppliesPenalties,
    } = await import("./league-earned-ledger");
    seasonFinished = await isLeagueSeasonFinishedForRewards(leagueId, sportId);
    penaltiesApply = leaveAppliesPenalties({
      sportId,
      seasonFinished,
    });

    if (penaltiesApply) {
      const result = await forfeitRewardsOnEarlyLeave({
        playerId: auth.user.id,
        leagueId,
        sportId,
      });
      forfeitedCount = result.forfeitedBadgeIds.length;
      forfeitMessage = result.message;

      // Blue Falcon Count + commissioner open-room nudge (before membership delete)
      try {
        const { incrementBlueFalconCount, getBlueFalconCount } = await import(
          "./blue-falcon"
        );
        const { data: authProf } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", auth.user.id)
          .maybeSingle();
        const leftName =
          (authProf as { display_name?: string } | null)?.display_name ||
          "A player";

        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "record_early_leave",
          {
            p_league_id: leagueId,
            p_left_name: leftName,
          }
        );
        if (!rpcErr && rpcData && typeof rpcData === "object") {
          const c = Number(
            (rpcData as { blueFalconCount?: number }).blueFalconCount
          );
          if (Number.isFinite(c) && c > 0) {
            const { setBlueFalconCountLocal } = await import("./blue-falcon");
            setBlueFalconCountLocal(auth.user.id, c);
            blueFalconCount = c;
          } else {
            blueFalconCount = await incrementBlueFalconCount(auth.user.id);
          }
        } else {
          blueFalconCount = await incrementBlueFalconCount(auth.user.id);
          const { flagOpenRoomNudgeAfterLeave } = await import(
            "./open-room-nudge"
          );
          await flagOpenRoomNudgeAfterLeave({
            leagueId,
            leftName,
          });
        }
        if (blueFalconCount == null) {
          blueFalconCount = getBlueFalconCount(auth.user.id);
        }
      } catch {
        try {
          const { incrementBlueFalconCount } = await import("./blue-falcon");
          blueFalconCount = await incrementBlueFalconCount(auth.user.id);
        } catch {
          /* ignore */
        }
      }
    } else {
      // Preseason or finished: clear ledger, no Blue Falcon
      const result = await forfeitRewardsOnEarlyLeave({
        playerId: auth.user.id,
        leagueId,
        sportId,
      });
      forfeitMessage = result.message;
      // Still nudge host if someone left after open… only when penalties;
      // preseason leave: optional open-room flag if mid-season style needed later
      if (!seasonFinished) {
        try {
          const { data: authProf } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", auth.user.id)
            .maybeSingle();
          const { flagOpenRoomNudgeAfterLeave } = await import(
            "./open-room-nudge"
          );
          await flagOpenRoomNudgeAfterLeave({
            leagueId,
            leftName:
              (authProf as { display_name?: string } | null)?.display_name ||
              "A player",
          });
        } catch {
          /* ignore */
        }
      }
    }
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
  return {
    ok: true,
    forfeitMessage,
    forfeitedCount,
    blueFalconCount,
    seasonFinished,
    penaltiesApplied: penaltiesApply,
  };
}

/**
 * Commissioner only — hard-delete disposable empty solo rooms only.
 * Constitution: community owns league history; production rooms with people
 * or play cannot be erased by one click (see league-delete-guard).
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

  // Belt: never hard-delete when community/history exists — even if UI is bypassed
  try {
    const { evaluateLeagueDelete } = await import("./league-delete-guard");
    const eval_ = await evaluateLeagueDelete(leagueId);
    if (!eval_.canHardDelete) {
      return {
        ok: false,
        error:
          eval_.reason ||
          "This league belongs to the community. Pass the keys — you cannot erase its history.",
      };
    }
  } catch {
    // Fail closed: if we cannot prove the room is disposable, do not delete
    return {
      ok: false,
      error:
        "Could not verify league status. Rooms with players or history cannot be deleted.",
    };
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
