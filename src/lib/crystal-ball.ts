/**
 * Crystal Ball — preseason national champion pick (zero points).
 * Cloud when table exists; localStorage fallback so the tab always works.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { listFbsTeams } from "@/lib/fbs-teams";

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
  picks: CrystalBallPick[];
  champion: string | null;
  achievements: Achievement[];
  locked: boolean;
  lockLabel: string;
  cloud: boolean;
};

/** Locks at noon ET on Week 0 Saturday (Aug 29, 2026) — before typical kickoffs. */
export function crystalBallLockMs(): number {
  let t = Date.parse("2026-08-29T12:00:00-04:00");
  if (Number.isNaN(t)) t = Date.parse("2026-08-29T16:00:00Z");
  return t;
}

/** Calendar deadline only (sync). Prefer resolveCrystalBallLock for real gates. */
export function isCrystalBallLocked(now = Date.now()): boolean {
  return now >= crystalBallLockMs();
}

export function crystalBallLockLabel(): string {
  const t = crystalBallLockMs();
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
  /** Why it's locked, for UI copy */
  reason: "open" | "calendar" | "week0_scored" | "week0_frozen";
  lockLabel: string;
};

/**
 * Crystal Ball freezes if:
 * - Calendar: noon ET Sat Aug 29, 2026, OR
 * - Week 0 pick'em card already locked (first kickoff), OR
 * - Week 0 has been scored (sandbox / late sim still freezes forever)
 */
export async function resolveCrystalBallLock(
  now = Date.now()
): Promise<CrystalBallLockInfo> {
  const calendarLabel = crystalBallLockLabel();
  if (now >= crystalBallLockMs()) {
    return {
      locked: true,
      reason: "calendar",
      lockLabel: calendarLabel,
    };
  }

  try {
    const { listScoredWeekNumbers, loadWeekCard } = await import("./cloud");
    const scored = await listScoredWeekNumbers();
    if (scored.includes(0)) {
      return {
        locked: true,
        reason: "week0_scored",
        lockLabel:
          "Week 0 scored — Crystal Ball is closed. No late prophecies.",
      };
    }
    const card = await loadWeekCard(0);
    if (card?.games?.length) {
      const { isCardLockDeadlinePassed } = await import("./dates");
      if (isCardLockDeadlinePassed(card.games, now)) {
        return {
          locked: true,
          reason: "week0_frozen",
          lockLabel:
            "Week 0 locked — Crystal Ball closed with first kickoff. No take-backs.",
        };
      }
    }
  } catch {
    /* ignore cloud; fall through open */
  }

  return {
    locked: false,
    reason: "open",
    lockLabel: calendarLabel,
  };
}

export function crystalBallTeams() {
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

export async function loadCrystalBall(): Promise<CrystalBallState> {
  const session = getSession();
  const league = getLeague();
  const lockInfo = await resolveCrystalBallLock();
  const locked = lockInfo.locked;
  const lockLabel = lockInfo.lockLabel;
  const empty: CrystalBallState = {
    myTeam: null,
    picks: [],
    champion: null,
    achievements: [],
    locked,
    lockLabel,
    cloud: false,
  };
  if (!session?.leagueId) return empty;

  // Try cloud
  try {
    const supabase = createClient();
    const { data: pickRows, error } = await supabase
      .from("crystal_ball_picks")
      .select("user_id, team_name, picked_at, profiles(display_name)")
      .eq("league_id", session.leagueId);

    if (!error && pickRows) {
      const picks: CrystalBallPick[] = pickRows.map((r) => {
        const prof = r.profiles as { display_name?: string } | null;
        return {
          userId: r.user_id as string,
          displayName: prof?.display_name || "Player",
          teamName: r.team_name as string,
          pickedAt: r.picked_at as string,
        };
      });
      const mine = picks.find((p) => p.userId === session.playerId);

      const { data: result } = await supabase
        .from("crystal_ball_result")
        .select("champion_team")
        .eq("league_id", session.leagueId)
        .maybeSingle();

      const { data: ach } = await supabase
        .from("achievements")
        .select("user_id, code, title, flavor, earned_at")
        .eq("league_id", session.leagueId);

      return {
        myTeam: mine?.teamName || null,
        picks: picks.sort((a, b) => a.displayName.localeCompare(b.displayName)),
        champion: (result?.champion_team as string) || null,
        achievements: (ach || []).map((a) => ({
          userId: a.user_id as string,
          code: a.code as string,
          title: a.title as string,
          flavor: a.flavor as string,
          earnedAt: a.earned_at as string,
        })),
        locked,
        lockLabel,
        cloud: true,
      };
    }
  } catch {
    /* fall through to local */
  }

  // Local fallback
  const local = readLocal(session.leagueId);
  const picks: CrystalBallPick[] = Object.entries(local.picks).map(
    ([userId, p]) => ({
      userId,
      displayName: p.name,
      teamName: p.teamName,
      pickedAt: p.pickedAt,
    })
  );
  const mine = local.picks[session.playerId];
  return {
    myTeam: mine?.teamName || null,
    picks: picks.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    champion: local.champion,
    achievements: local.achievements,
    locked,
    lockLabel,
    cloud: false,
  };
}

export async function saveCrystalBallPick(
  teamName: string
): Promise<{ ok: boolean; error?: string; cloud?: boolean }> {
  const session = getSession();
  const league = getLeague();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Join a league first." };
  }
  const lockInfo = await resolveCrystalBallLock();
  if (lockInfo.locked) {
    return {
      ok: false,
      error: `${lockInfo.lockLabel} No take-backs, oracle.`,
    };
  }
  const team = teamName.trim();
  if (!team) return { ok: false, error: "Pick a team." };

  try {
    const supabase = createClient();
    const { error } = await supabase.from("crystal_ball_picks").upsert(
      {
        league_id: session.leagueId,
        user_id: session.playerId,
        team_name: team,
        picked_at: new Date().toISOString(),
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
    // table missing or RLS — local
  } catch {
    /* local */
  }

  const local = readLocal(session.leagueId);
  local.picks[session.playerId] = {
    teamName: team,
    pickedAt: new Date().toISOString(),
    name: session.playerName || "You",
  };
  writeLocal(session.leagueId, local);
  try {
    const { markEngagement } = await import("./engagement");
    markEngagement(session.playerId, "crystal_ball_picked");
  } catch {
    /* ignore */
  }
  return { ok: true, cloud: false };
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
  return { ok: true, winners: winners.length };
}
