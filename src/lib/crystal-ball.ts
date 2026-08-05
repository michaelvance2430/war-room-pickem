/**
 * Crystal Ball — preseason national champion pick (zero points).
 * Cloud when table exists; localStorage fallback so the tab always works.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { listFbsTeams } from "@/lib/fbs-teams";
import { listNflPrideTeams } from "@/lib/nfl-teams";

export type CrystalBallPick = {
  userId: string;
  displayName: string;
  teamName: string;
  pickedAt: string;
};

export type Achievement = {
  userId: string;
  code: string;
  title: string;
  flavor: string;
  earnedAt: string;
};

export type CrystalBallState = {
  myTeam: string | null;
  /**
   * Visible board picks. While open (pre-lock): only you (secret).
   * After lock / freeze: full room as permanent record.
   */
  picks: CrystalBallPick[];
  /** How many humans have a pick sealed (names hidden until reveal) */
  lockedCount: number;
  champion: string | null;
  achievements: Achievement[];
  /** True = picks frozen + board revealed */
  locked: boolean;
  lockLabel: string;
  /**
   * Authoritative lock instant (epoch ms) when known.
   * NFL: earliest valid start_time on published Week 1 card.
   * CFB: calendar noon deadline when that path applies; else opening-week kickoff.
   * null = no countdown inventable (e.g. NFL slate not published).
   */
  lockAtMs: number | null;
  /** True when a published opening-week kickoff exists for countdown. */
  kickoffKnown: boolean;
  cloud: boolean;
  /** Last cloud error (debug / soft UI) */
  cloudError?: string | null;
};

function resolveCbSport(sportId?: string | null): "cfb" | "nfl" {
  if (sportId === "nfl") return "nfl";
  if (sportId === "cfb") return "cfb";
  try {
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  } catch {
    return "cfb";
  }
}

/**
 * CFB calendar pride-pick freeze only (noon ET Week 0 Sat Aug 29, 2026).
 * NFL does NOT use a hardcoded noon deadline — Super Bowl pick locks at the
 * earliest valid start_time on the league’s published Week 1 slate
 * (see resolveCrystalBallLock).
 */
export function crystalBallLockMs(sportId?: string | null): number {
  if (resolveCbSport(sportId) === "nfl") {
    // Never lock NFL from calendar alone (sync callers).
    return Number.POSITIVE_INFINITY;
  }
  let t = Date.parse("2026-08-29T12:00:00-04:00");
  if (Number.isNaN(t)) {
    t = Date.parse("2026-08-29T16:00:00Z");
  }
  return t;
}

/** Sync CFB calendar gate only. Prefer resolveCrystalBallLock for real gates. */
export function isCrystalBallLocked(
  now = Date.now(),
  sportId?: string | null
): boolean {
  if (resolveCbSport(sportId) === "nfl") return false;
  return now >= crystalBallLockMs("cfb");
}

export function crystalBallLockLabel(sportId?: string | null): string {
  if (resolveCbSport(sportId) === "nfl") {
    return "Locks at Week 1's first kickoff. Countdown appears when the slate is published.";
  }
  const t = crystalBallLockMs("cfb");
  return new Date(t).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

export type CrystalBallLockInfo = {
  locked: boolean;
  /** Why it's locked / open, for UI copy */
  reason:
    | "open"
    | "calendar"
    | "week0_scored"
    | "week0_frozen"
    | "no_kickoff";
  lockLabel: string;
  /** Authoritative lock epoch ms when known; null if not inventable */
  lockAtMs: number | null;
  kickoffKnown: boolean;
};

const NFL_NO_SLATE_LABEL =
  "Locks at Week 1's first kickoff. Countdown appears when the slate is published.";

/**
 * Pride-pick freezes:
 * - NFL: earliest published Week 1 kickoff (no hardcoded noon). Also if Week 1 scored.
 * - CFB: calendar deadline OR Week 0 first kickoff freeze OR Week 0 scored.
 */
export async function resolveCrystalBallLock(
  now = Date.now(),
  sportId?: string | null
): Promise<CrystalBallLockInfo> {
  const sport = resolveCbSport(sportId);
  const openWeek = sport === "nfl" ? 1 : 0;

  // ── NFL: Week 1 *formally published* slate first kickoff is the only deadline ──
  if (sport === "nfl") {
    try {
      const { listScoredWeekNumbers, loadWeekCard } = await import("./cloud");
      const [scored, card] = await Promise.all([
        listScoredWeekNumbers().catch(() => [] as number[]),
        loadWeekCard(openWeek).catch(() => null),
      ]);
      if (scored.includes(openWeek)) {
        return {
          locked: true,
          reason: "week0_scored",
          lockLabel: "Locked at kickoff.",
          lockAtMs: null,
          kickoffKnown: false,
        };
      }

      // Authoritative slate = formally published Week 1 card (publishedAt + games)
      const formallyPublished = !!(
        card?.games?.length &&
        typeof card.publishedAt === "string" &&
        card.publishedAt.trim()
      );
      if (formallyPublished && card?.games?.length) {
        const { firstKickoffOnCardMs, isCardLockDeadlinePassed } = await import(
          "./dates"
        );
        const lockAt = firstKickoffOnCardMs(card.games);
        if (lockAt > 0) {
          if (isCardLockDeadlinePassed(card.games, now) || now >= lockAt) {
            return {
              locked: true,
              reason: "week0_frozen",
              lockLabel: "Locked at kickoff.",
              lockAtMs: lockAt,
              kickoffKnown: true,
            };
          }
          return {
            locked: false,
            reason: "open",
            lockLabel: "Week 1 first kickoff",
            lockAtMs: lockAt,
            kickoffKnown: true,
          };
        }
      }

      return {
        locked: false,
        reason: "no_kickoff",
        lockLabel: NFL_NO_SLATE_LABEL,
        lockAtMs: null,
        kickoffKnown: false,
      };
    } catch {
      // Fail closed only when we cannot re-verify after a score mark would apply —
      // without a known kickoff, stay open (no invented lock).
      return {
        locked: false,
        reason: "no_kickoff",
        lockLabel: NFL_NO_SLATE_LABEL,
        lockAtMs: null,
        kickoffKnown: false,
      };
    }
  }

  // ── CFB: calendar OR Week 0 freeze/score ──
  const calendarMs = crystalBallLockMs("cfb");
  const calendarLabel = crystalBallLockLabel("cfb");
  if (now >= calendarMs) {
    return {
      locked: true,
      reason: "calendar",
      lockLabel: calendarLabel,
      lockAtMs: calendarMs,
      kickoffKnown: true,
    };
  }

  try {
    const { listScoredWeekNumbers, loadWeekCard } = await import("./cloud");
    const [scored, card] = await Promise.all([
      listScoredWeekNumbers().catch(() => [] as number[]),
      loadWeekCard(openWeek).catch(() => null),
    ]);
    if (scored.includes(openWeek)) {
      return {
        locked: true,
        reason: "week0_scored",
        lockLabel:
          "Week 0 scored — Crystal Ball is closed. No late prophecies.",
        lockAtMs: calendarMs,
        kickoffKnown: true,
      };
    }
    // Prefer formally published Week 0 for kickoff; fall back to games if present
    const formallyPublished = !!(
      card?.games?.length &&
      typeof card.publishedAt === "string" &&
      card.publishedAt.trim()
    );
    if (formallyPublished || card?.games?.length) {
      const { firstKickoffOnCardMs, isCardLockDeadlinePassed } = await import(
        "./dates"
      );
      const kickMs = firstKickoffOnCardMs(card!.games);
      if (isCardLockDeadlinePassed(card!.games, now)) {
        return {
          locked: true,
          reason: "week0_frozen",
          lockLabel:
            "Week 0 locked — Crystal Ball closed with first kickoff. No take-backs.",
          lockAtMs: kickMs > 0 ? kickMs : calendarMs,
          kickoffKnown: kickMs > 0,
        };
      }
      // Open: countdown to earlier of calendar vs first kickoff
      const lockAt =
        kickMs > 0 ? Math.min(calendarMs, kickMs) : calendarMs;
      return {
        locked: false,
        reason: "open",
        lockLabel: calendarLabel,
        lockAtMs: lockAt,
        kickoffKnown: kickMs > 0,
      };
    }
  } catch {
    // Fail closed once calendar deadline is known and has passed
    if (now >= calendarMs) {
      return {
        locked: true,
        reason: "calendar",
        lockLabel: calendarLabel,
        lockAtMs: calendarMs,
        kickoffKnown: true,
      };
    }
  }

  return {
    locked: false,
    reason: "open",
    lockLabel: calendarLabel,
    lockAtMs: calendarMs,
    kickoffKnown: false,
  };
}

/**
 * Pride-pick roster for Crystal Ball / Super Bowl flex.
 * NFL leagues get 32 pro teams — never the FBS list.
 */
export function crystalBallTeams(sportId?: string | null): {
  name: string;
  conference: string;
}[] {
  const sid =
    sportId ??
    (() => {
      try {
        return getLeague()?.sportId;
      } catch {
        return null;
      }
    })();
  if (sid === "nfl") return listNflPrideTeams();
  return listFbsTeams();
}

/** Sarcastic achievement for nailing the national champ with zero points on the line. */
export function achievementForCorrectPick(teamName: string): {
  code: string;
  title: string;
  flavor: string;
} {
  const flavors = [
    `You called ${teamName} in August. No points. Just vibes. And a faintly concerning aura.`,
    `Zero fantasy points. Infinite "I told you so" equity. ${teamName} believers unite.`,
    `The standings ignored you. History did not. ${teamName} — you absolute spellbook.`,
    `Not a wizard. Just chronically online about ${teamName}. We respect the commitment.`,
  ];
  const i =
    Math.abs(
      teamName.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % flavors.length;
  return {
    code: "crystal_ball_correct",
    title: "Village Witch / Wizard Nerd",
    flavor: flavors[i],
  };
}

function localKey(leagueId: string) {
  return `warroom-crystal-ball-${leagueId}`;
}

type LocalStore = {
  picks: Record<string, { teamName: string; pickedAt: string; name: string }>;
  champion: string | null;
  achievements: Achievement[];
};

function readLocal(leagueId: string): LocalStore {
  try {
    const raw = localStorage.getItem(localKey(leagueId));
    if (!raw) return { picks: {}, champion: null, achievements: [] };
    return JSON.parse(raw) as LocalStore;
  } catch {
    return { picks: {}, champion: null, achievements: [] };
  }
}

function writeLocal(leagueId: string, data: LocalStore) {
  try {
    localStorage.setItem(localKey(leagueId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Instant paint from localStorage — no network. Cloud fills in via loadCrystalBall. */
export function peekLocalCrystalBall(): CrystalBallState {
  const session = getSession();
  const sport = resolveCbSport();
  const lockLabel = crystalBallLockLabel(sport);
  // NFL lock is async (Week 1 kickoff) — never invent locked from local calendar.
  const locked =
    sport === "nfl" ? false : isCrystalBallLocked(Date.now(), "cfb");
  const lockAtMs =
    sport === "nfl" ? null : crystalBallLockMs("cfb");
  const empty: CrystalBallState = {
    myTeam: null,
    picks: [],
    lockedCount: 0,
    champion: null,
    achievements: [],
    locked,
    lockLabel,
    lockAtMs,
    kickoffKnown: sport !== "nfl" && lockAtMs != null,
    cloud: false,
  };
  if (!session?.leagueId) return empty;
  const local = readLocal(session.leagueId);
  const mine = local.picks[session.playerId];
  // Pre-lock: never flash other devices' local picks as a public board
  const picks: CrystalBallPick[] =
    mine && session.playerId
      ? [
          {
            userId: session.playerId,
            displayName: mine.name || session.playerName || "You",
            teamName: mine.teamName,
            pickedAt: mine.pickedAt,
          },
        ]
      : [];
  return {
    myTeam: mine?.teamName || null,
    picks,
    lockedCount: mine ? 1 : 0,
    champion: locked ? local.champion : null,
    achievements: locked ? local.achievements : [],
    locked,
    lockLabel,
    lockAtMs,
    kickoffKnown: sport !== "nfl" && lockAtMs != null,
    cloud: false,
  };
}

export async function loadCrystalBall(): Promise<CrystalBallState> {
  const session = getSession();
  const emptyBase = peekLocalCrystalBall();
  if (!session?.leagueId || !session.playerId) return emptyBase;

  try {
    const supabase = createClient();
    // Resolve lock first so we know whether the board is secret or public
    const lockInfo = await resolveCrystalBallLock();
    const locked = lockInfo.locked;
    const lockLabel = lockInfo.lockLabel;

    // Pre-lock: only fetch YOUR pick (+ count). Post-lock: full board.
    const pickQuery = locked
      ? supabase
          .from("crystal_ball_picks")
          .select("user_id, team_name, picked_at, profiles(display_name)")
          .eq("league_id", session.leagueId)
      : supabase
          .from("crystal_ball_picks")
          .select("user_id, team_name, picked_at, profiles(display_name)")
          .eq("league_id", session.leagueId)
          .eq("user_id", session.playerId);

    const [pickRes, countRpc, resultRes, achRes] = await Promise.all([
      pickQuery,
      // Security definer count — total sealed without revealing teams
      supabase.rpc("crystal_ball_lock_count", {
        p_league_id: session.leagueId,
      }),
      locked
        ? supabase
            .from("crystal_ball_result")
            .select("champion_team")
            .eq("league_id", session.leagueId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      locked
        ? supabase
            .from("achievements")
            .select("user_id, code, title, flavor, earned_at")
            .eq("league_id", session.leagueId)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    if (pickRes.error) {
      // Table missing / RLS — keep local secret shell
      return {
        ...emptyBase,
        locked,
        lockLabel,
        lockAtMs: lockInfo.lockAtMs,
        kickoffKnown: lockInfo.kickoffKnown,
        cloud: false,
        cloudError: pickRes.error.message,
      };
    }

    const rawPicks = (pickRes.data || []) as Record<string, unknown>[];
    const allPicks: CrystalBallPick[] = rawPicks.map((r) => {
      const prof = r.profiles as { display_name?: string } | null;
      return {
        userId: r.user_id as string,
        displayName: prof?.display_name || "Player",
        teamName: r.team_name as string,
        pickedAt: r.picked_at as string,
      };
    });
    const mine = allPicks.find((p) => p.userId === session.playerId);
    let lockedCount = allPicks.length;
    if (!countRpc.error && typeof countRpc.data === "number") {
      lockedCount = countRpc.data;
    } else if (!locked && mine) {
      lockedCount = Math.max(1, lockedCount);
    }

    // Secret until lock: board only shows you. After lock: full permanent record.
    const visiblePicks = locked
      ? allPicks.sort((a, b) => a.displayName.localeCompare(b.displayName))
      : mine
        ? [mine]
        : [];

    // Cache own pick locally for fast reopen
    if (mine) {
      const local = readLocal(session.leagueId);
      local.picks[session.playerId] = {
        teamName: mine.teamName,
        pickedAt: mine.pickedAt,
        name: mine.displayName,
      };
      writeLocal(session.leagueId, local);
    }

    return {
      myTeam: mine?.teamName || emptyBase.myTeam,
      picks: visiblePicks,
      lockedCount,
      champion: locked
        ? ((resultRes.data as { champion_team?: string } | null)
            ?.champion_team as string) || null
        : null,
      achievements: locked
        ? ((achRes.data || []) as Record<string, unknown>[]).map((a) => ({
            userId: a.user_id as string,
            code: a.code as string,
            title: a.title as string,
            flavor: a.flavor as string,
            earnedAt: a.earned_at as string,
          }))
        : [],
      locked,
      lockLabel,
      lockAtMs: lockInfo.lockAtMs,
      kickoffKnown: lockInfo.kickoffKnown,
      cloud: true,
      cloudError: null,
    };
  } catch {
    /* fall through */
  }

  try {
    const lockInfo = await resolveCrystalBallLock();
    return {
      ...emptyBase,
      locked: lockInfo.locked,
      lockLabel: lockInfo.lockLabel,
      lockAtMs: lockInfo.lockAtMs,
      kickoffKnown: lockInfo.kickoffKnown,
    };
  } catch {
    return emptyBase;
  }
}

export async function saveCrystalBallPick(
  teamName: string
): Promise<{ ok: boolean; error?: string; cloud?: boolean; cloudError?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Join a league first." };
  }
  // Re-resolve lock at write time (no stale local deadline).
  const lockInfo = await resolveCrystalBallLock();
  if (lockInfo.locked) {
    return {
      ok: false,
      error:
        lockInfo.lockLabel === "Locked at kickoff."
          ? "Locked at kickoff. No take-backs."
          : `${lockInfo.lockLabel} No take-backs, oracle.`,
    };
  }
  // Double-check kickoff if known (client clock vs authoritative start_time)
  if (
    lockInfo.lockAtMs != null &&
    lockInfo.lockAtMs > 0 &&
    Date.now() >= lockInfo.lockAtMs
  ) {
    return { ok: false, error: "Locked at kickoff. No take-backs." };
  }
  const team = teamName.trim();
  if (!team) return { ok: false, error: "Pick a team." };

  const pickedAt = new Date().toISOString();
  // Cache locally only after lock gate passes (still secret to this device)
  const local = readLocal(session.leagueId);
  local.picks[session.playerId] = {
    teamName: team,
    pickedAt,
    name: session.playerName || "You",
  };
  writeLocal(session.leagueId, local);
  // Walk-the-dog coach: advance without waiting on cloud
  try {
    sessionStorage.setItem("warroom-tut-cb-selected", "1");
    window.dispatchEvent(new CustomEvent("warroom-player-tutorial"));
  } catch {
    /* ignore */
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.from("crystal_ball_picks").upsert(
      {
        league_id: session.leagueId,
        user_id: session.playerId,
        team_name: team,
        picked_at: pickedAt,
      },
      { onConflict: "league_id,user_id" }
    );
    if (!error) {
      try {
        const { markEngagement } = await import("./engagement");
        markEngagement(session.playerId, "crystal_ball_picked");
      } catch {
        /* ignore */
      }
      return { ok: true, cloud: true };
    }
    // Table/RLS — pick is still on this device until SQL is live
    try {
      const { markEngagement } = await import("./engagement");
      markEngagement(session.playerId, "crystal_ball_picked");
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      cloud: false,
      cloudError: error.message,
    };
  } catch (e: unknown) {
    try {
      const { markEngagement } = await import("./engagement");
      markEngagement(session.playerId, "crystal_ball_picked");
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      cloud: false,
      cloudError: e instanceof Error ? e.message : "cloud unavailable",
    };
  }
}

/** Humans who never submitted a Crystal Ball pick (excludes bots). */
export async function loadCrystalBallNoPickNames(): Promise<string[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  try {
    const supabase = createClient();
    const { data: members, error: memErr } = await supabase
      .from("memberships")
      .select("user_id, is_bot, profiles(display_name)")
      .eq("league_id", session.leagueId);
    if (memErr || !members?.length) {
      // Local fallback: only know yourself
      const local = readLocal(session.leagueId);
      if (!local.picks[session.playerId] && session.playerName) {
        return [session.playerName];
      }
      return [];
    }
    const { data: picks } = await supabase
      .from("crystal_ball_picks")
      .select("user_id")
      .eq("league_id", session.leagueId);
    const picked = new Set((picks || []).map((p) => p.user_id as string));
    // Merge local for this device
    try {
      const local = readLocal(session.leagueId);
      for (const uid of Object.keys(local.picks)) picked.add(uid);
    } catch {
      /* ignore */
    }
    const names: string[] = [];
    for (const m of members) {
      if (m.is_bot) continue;
      const uid = m.user_id as string;
      if (picked.has(uid)) continue;
      const prof = m.profiles as { display_name?: string } | null;
      names.push(prof?.display_name || "Player");
    }
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function crownNationalChampion(
  teamName: string
): Promise<{ ok: boolean; error?: string; winners?: number }> {
  const session = getSession();
  const league = getLeague();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only." };
  }
  const team = teamName.trim();
  if (!team) return { ok: false, error: "Pick the champion team." };

  const state = await loadCrystalBall();
  const winners = state.picks.filter(
    (p) => p.teamName.toLowerCase() === team.toLowerCase()
  );
  const ach = achievementForCorrectPick(team);

  try {
    const supabase = createClient();
    const { error: rErr } = await supabase.from("crystal_ball_result").upsert(
      {
        league_id: session.leagueId,
        champion_team: team,
        crowned_at: new Date().toISOString(),
        crowned_by: session.playerId,
      },
      { onConflict: "league_id" }
    );
    if (!rErr) {
      for (const w of winners) {
        await supabase.from("achievements").upsert(
          {
            league_id: session.leagueId,
            user_id: w.userId,
            code: ach.code,
            title: ach.title,
            flavor: ach.flavor,
            earned_at: new Date().toISOString(),
          },
          { onConflict: "league_id,user_id,code" }
        );
        try {
          const { grantPermanentBadgeId } = await import("./permanent-badges");
          grantPermanentBadgeId(w.userId, "national_nightmare");
        } catch {
          /* ignore */
        }
      }
      // Auto-engrave Village Nerd when champ is crowned
      try {
        const { autoEngraveAllTrophies } = await import("./auto-trophies");
        await autoEngraveAllTrophies({});
      } catch {
        /* best-effort */
      }
      return { ok: true, winners: winners.length };
    }
  } catch {
    /* local */
  }

  const local = readLocal(session.leagueId);
  local.champion = team;
  for (const w of winners) {
    if (
      !local.achievements.some(
        (a) => a.userId === w.userId && a.code === ach.code
      )
    ) {
      local.achievements.push({
        userId: w.userId,
        code: ach.code,
        title: ach.title,
        flavor: ach.flavor,
        earnedAt: new Date().toISOString(),
      });
    }
    try {
      const { grantPermanentBadgeId } = await import("./permanent-badges");
      grantPermanentBadgeId(w.userId, "national_nightmare");
    } catch {
      /* ignore */
    }
  }
  writeLocal(session.leagueId, local);
  try {
    const { autoEngraveAllTrophies } = await import("./auto-trophies");
    await autoEngraveAllTrophies({});
  } catch {
    /* best-effort */
  }
  return { ok: true, winners: winners.length };
}

/**
 * Pre-season / sandbox: every trial bot gets a Crystal Ball (or Super Bowl) pick
 * so the board fills and crown/display can be smoke-tested.
 * Needs supabase/bot-crystal-ball.sql once.
 */
export async function seedBotCrystalBallPicks(opts?: {
  sportId?: string | null;
}): Promise<{
  ok: boolean;
  inserted?: number;
  skipped?: number;
  error?: string;
}> {
  const session = getSession();
  const league = getLeague();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  // Skip if pride pick is off for this league
  if (league?.settings?.crystalBallEnabled === false) {
    return { ok: true, inserted: 0, skipped: 0 };
  }

  const sport =
    opts?.sportId ?? league?.sportId ?? "cfb";
  const teams = crystalBallTeams(sport);
  if (!teams.length) {
    return { ok: false, error: "No teams available for pride pick" };
  }

  let bots: { userId: string; name: string }[] = [];
  try {
    const { loadLeagueRoster } = await import("./cloud");
    const roster = await loadLeagueRoster();
    bots = roster
      .filter((m) => m.isBot)
      .map((m) => ({ userId: m.userId, name: m.name }));
  } catch {
    return { ok: false, error: "Could not load roster" };
  }

  if (!bots.length) {
    return {
      ok: false,
      error: "No trial bots yet — pad bots first.",
    };
  }

  // Deterministic spread of popular + random teams so the board isn't all chalk
  const picks = bots.map((b, i) => {
    const idx =
      (b.userId.charCodeAt(0) + b.userId.charCodeAt(1) * 17 + i * 3) %
      teams.length;
    return {
      user_id: b.userId,
      team_name: teams[idx].name,
    };
  });

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("seed_bot_crystal_ball_picks", {
      p_league_id: session.leagueId,
      p_picks: picks,
    });
    if (error) {
      const msg = error.message || "RPC failed";
      if (/does not exist|schema cache|seed_bot_crystal/i.test(msg)) {
        return {
          ok: false,
          error:
            "Run supabase/bot-crystal-ball.sql in Supabase SQL Editor once.",
        };
      }
      // Fallback: local picks for bots (device-only board)
      const local = readLocal(session.leagueId);
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        const team = picks[i].team_name;
        local.picks[b.userId] = {
          teamName: team,
          pickedAt: new Date().toISOString(),
          name: b.name,
        };
      }
      writeLocal(session.leagueId, local);
      return {
        ok: true,
        inserted: bots.length,
        skipped: 0,
        error: "Cloud RPC missing — bot picks saved on this device only.",
      };
    }
    const row = (data || {}) as {
      ok?: boolean;
      inserted?: number;
      skipped?: number;
      error?: string;
    };
    if (row.ok === false) {
      return { ok: false, error: row.error || "seed failed" };
    }
    return {
      ok: true,
      inserted: row.inserted ?? picks.length,
      skipped: row.skipped ?? 0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to seed bot crystal ball",
    };
  }
}
