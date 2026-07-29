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
  const locked = isCrystalBallLocked();
  const lockLabel = crystalBallLockLabel();
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
  if (isCrystalBallLocked()) {
    return {
      ok: false,
      error: `Crystal Ball locked at ${crystalBallLockLabel()}. No take-backs, oracle.`,
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
    if (!error) return { ok: true, cloud: true };
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
  return { ok: true, cloud: false };
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
  }
  writeLocal(session.leagueId, local);
  return { ok: true, winners: winners.length };
}
