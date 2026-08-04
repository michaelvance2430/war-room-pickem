/**
 * Automated CFB season closeout + trophy ceremony resolver.
 *
 * One readiness reader. One protected close command.
 * UI must not scatter closeout writes.
 *
 * Idempotent: refresh / double-click / retry never duplicate grants.
 */

import { getLeague, getSession, isOps } from "@/lib/league";
import {
  defaultSeasonYear,
  loadLeagueTrophies,
  awardTrophy,
  type TrophyType,
} from "@/lib/trophies";
import { seasonMaxWeek } from "@/lib/season-calendar";
import {
  resolveCfbNationalChampionshipResult,
  type CfbTitleTeamResult,
} from "@/lib/cfb-championship-result";
import type { Player } from "@/lib/types";

export type FinalAward = {
  type: TrophyType | string;
  label: string;
  recipientIds: string[];
  recipientNames: string[];
  notes?: string;
};

export type SeasonCloseoutReadiness =
  | { status: "not-ready"; reason: string; nextHint?: string }
  | {
      status: "ready";
      version: string;
      seasonYear: number;
      nationalChampion: CfbTitleTeamResult;
      leagueChampionIds: string[];
      leagueChampionNames: string[];
      toiletBowlIds: string[];
      toiletBowlNames: string[];
      crystalBallWinnerIds: string[];
      crystalBallWinnerNames: string[];
      otherAwards: FinalAward[];
    }
  | { status: "already-closed"; closedAt: string; seasonYear: number };

const CLOSED_KEY = "warroom-season-closed-v1";
const CLOSE_LOCK_KEY = "warroom-season-closeout-lock-v1";

function closedStorageKey(leagueId: string, year: number) {
  return `${CLOSED_KEY}:${leagueId}:${year}`;
}

function readClosed(
  leagueId: string,
  year: number
): { closedAt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(closedStorageKey(leagueId, year));
    if (!raw) return null;
    const p = JSON.parse(raw) as { closedAt?: string };
    if (!p?.closedAt) return null;
    return { closedAt: p.closedAt };
  } catch {
    return null;
  }
}

function writeClosed(leagueId: string, year: number, closedAt: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      closedStorageKey(leagueId, year),
      JSON.stringify({ closedAt, leagueId, year })
    );
  } catch {
    /* ignore */
  }
}

/** Public: is this league/year closed on this device (and cloud signals). */
export function isSeasonClosedLocal(
  leagueId?: string | null,
  year?: number
): boolean {
  if (!leagueId) return false;
  const y = year ?? defaultSeasonYear();
  return !!readClosed(leagueId, y);
}

async function loadHumans(): Promise<Player[]> {
  const { loadLeaguePlayers } = await import("./cloud");
  const players = await loadLeaguePlayers();
  return (players || []).filter((p) => !p.isMock);
}

/**
 * Bracket finals when available; else null (not guessed from standings alone
 * if brackets exist but unfinished).
 */
async function resolveBracketWinners(players: Player[]): Promise<{
  champ: Player | null;
  toilet: Player | null;
  champReason: string;
  toiletReason: string;
}> {
  const {
    seedChampionship,
    seedToiletBowl,
    buildBracket,
    advanceBracketFromCfpWeeks,
  } = await import("./brackets");
  const sportId = getLeague()?.sportId;

  let scored: number[] = [];
  try {
    const { listScoredWeekNumbers } = await import("./cloud");
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }

  function finalOf(
    type: "championship" | "toilet"
  ): { player: Player; reason: string } | null {
    if (players.length < 2) return null;
    const seeded =
      type === "championship"
        ? seedChampionship(players)
        : seedToiletBowl(players);
    if (seeded.length < 2) return null;
    const built = buildBracket(type, seeded);
    const advanced = advanceBracketFromCfpWeeks(built, scored, sportId);
    const lastRound = advanced.rounds[advanced.rounds.length - 1];
    const final = lastRound?.[0];
    if (!final?.winnerId) return null;
    const winner =
      players.find((p) => p.id === final.winnerId) ||
      seeded.find((p) => p.id === final.winnerId);
    if (!winner) return null;
    return {
      player: winner,
      reason:
        type === "championship"
          ? "Championship bracket final"
          : "Toilet Bowl bracket final",
    };
  }

  const c = finalOf("championship");
  const t = finalOf("toilet");
  return {
    champ: c?.player || null,
    toilet: t?.player || null,
    champReason: c?.reason || "Bracket final not decided",
    toiletReason: t?.reason || "Toilet final not decided",
  };
}

async function loadCrystalBallWinners(
  champTeam: string
): Promise<{ ids: string[]; names: string[] }> {
  try {
    const { createClient } = await import("./supabase/client");
    const session = getSession();
    if (!session?.leagueId) return { ids: [], names: [] };
    const supabase = createClient();
    const { data, error } = await supabase
      .from("crystal_ball_picks")
      .select("user_id, team_name, profiles(display_name)")
      .eq("league_id", session.leagueId);
    if (error || !data?.length) {
      // Local fallback
      const { loadCrystalBall } = await import("./crystal-ball");
      const state = await loadCrystalBall();
      const hits = state.picks.filter(
        (p) => p.teamName.toLowerCase() === champTeam.toLowerCase()
      );
      return {
        ids: hits.map((h) => h.userId),
        names: hits.map((h) => h.displayName),
      };
    }
    const hits = (data as Record<string, unknown>[]).filter(
      (r) =>
        String(r.team_name || "").toLowerCase() === champTeam.toLowerCase()
    );
    return {
      ids: hits.map((r) => r.user_id as string),
      names: hits.map((r) => {
        const prof = r.profiles as { display_name?: string } | null;
        return prof?.display_name || "Player";
      }),
    };
  } catch {
    return { ids: [], names: [] };
  }
}

function readinessVersion(parts: {
  year: number;
  winner: string;
  champIds: string[];
  toiletIds: string[];
  nerdIds: string[];
}): string {
  return [
    parts.year,
    parts.winner,
    parts.champIds.join(","),
    parts.toiletIds.join(","),
    parts.nerdIds.join(","),
  ].join("|");
}

/**
 * Central closeout readiness for the active CFB league.
 */
export async function resolveSeasonCloseoutReadiness(): Promise<SeasonCloseoutReadiness> {
  const session = getSession();
  const league = getLeague();
  if (!session?.leagueId) {
    return { status: "not-ready", reason: "No league session." };
  }
  if (league?.sportId === "nfl") {
    return {
      status: "not-ready",
      reason: "Trophy ceremony automation is CFB-first this season.",
    };
  }

  const year = defaultSeasonYear();
  const closed = readClosed(session.leagueId, year);
  if (closed) {
    return {
      status: "already-closed",
      closedAt: closed.closedAt,
      seasonYear: year,
    };
  }

  // Cloud signal: championship + toilet trophies already for this year
  // AND crystal_ball_result set → treat as closed if local flag missing
  try {
    const trophies = await loadLeagueTrophies();
    const yearItems = trophies.filter((t) => t.seasonYear === year);
    const hasChamp = yearItems.some((t) => t.trophyType === "championship");
    const hasToilet = yearItems.some((t) => t.trophyType === "toilet_bowl");
    const { loadCrystalBall } = await import("./crystal-ball");
    const cb = await loadCrystalBall();
    if (hasChamp && hasToilet && cb.champion) {
      // Recover closed flag for multi-device consistency without re-granting
      writeClosed(session.leagueId, year, yearItems[0]?.awardedAt || new Date().toISOString());
      return {
        status: "already-closed",
        closedAt: yearItems[0]?.awardedAt || new Date().toISOString(),
        seasonYear: year,
      };
    }
  } catch {
    /* continue */
  }

  const maxW = seasonMaxWeek(league?.sportId || "cfb");
  let scored: number[] = [];
  try {
    const { listScoredWeekNumbers } = await import("./cloud");
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }
  if (!scored.includes(maxW)) {
    return {
      status: "not-ready",
      reason: `Final league week (Week ${maxW}) has not been scored yet.`,
      nextHint: "score_final_week",
    };
  }

  const title = await resolveCfbNationalChampionshipResult();
  if (title.status === "error") {
    return {
      status: "not-ready",
      reason: title.reason,
      nextHint: "api_unavailable",
    };
  }
  if (title.status === "not_confirmed") {
    return {
      status: "not-ready",
      reason: title.reason,
      nextHint: "wait_championship",
    };
  }

  const humans = await loadHumans();
  const brackets = await resolveBracketWinners(humans);
  if (!brackets.champ) {
    return {
      status: "not-ready",
      reason: `League Champion not decided yet — ${brackets.champReason}.`,
      nextHint: "bracket_incomplete",
    };
  }
  if (!brackets.toilet) {
    return {
      status: "not-ready",
      reason: `Toilet Bowl not decided yet — ${brackets.toiletReason}.`,
      nextHint: "bracket_incomplete",
    };
  }

  const nerds = await loadCrystalBallWinners(title.result.winnerTeam);

  const otherAwards: FinalAward[] = [];
  try {
    const { computeDivisionChampions } = await import("./division-champions");
    const divs = computeDivisionChampions(humans);
    for (const d of divs || []) {
      if (!d?.winner) continue;
      otherAwards.push({
        type: d.trophyType,
        label: d.conferenceLabel || "Division title",
        recipientIds: [d.winner.id],
        recipientNames: [d.winner.name],
      });
    }
  } catch {
    /* optional */
  }

  const version = readinessVersion({
    year,
    winner: title.result.winnerTeam,
    champIds: [brackets.champ.id],
    toiletIds: [brackets.toilet.id],
    nerdIds: nerds.ids,
  });

  return {
    status: "ready",
    version,
    seasonYear: year,
    nationalChampion: title.result,
    leagueChampionIds: [brackets.champ.id],
    leagueChampionNames: [brackets.champ.name],
    toiletBowlIds: [brackets.toilet.id],
    toiletBowlNames: [brackets.toilet.name],
    crystalBallWinnerIds: nerds.ids,
    crystalBallWinnerNames: nerds.names,
    otherAwards,
  };
}

/**
 * Home mission helper: should we show BEGIN TROPHY CEREMONY?
 * Does not surface when final week still needs scoring (score stays primary).
 */
export async function isTrophyCeremonyHomeReady(): Promise<boolean> {
  if (!isOps()) return false;
  const league = getLeague();
  if (league?.sportId === "nfl") return false;
  const r = await resolveSeasonCloseoutReadiness();
  return r.status === "ready";
}

export type CloseCfbSeasonResult =
  | {
      ok: true;
      alreadyClosed?: boolean;
      closedAt: string;
      seasonYear: number;
      winners: number;
      message: string;
    }
  | { ok: false; error: string };

/**
 * Protected, idempotent CFB season closeout.
 * Commissioner / ops only.
 */
export async function closeCfbSeason(opts?: {
  expectedReadinessVersion?: string;
}): Promise<CloseCfbSeasonResult> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league session." };
  }
  if (!isOps() && !session.isCommissioner) {
    return { ok: false, error: "Commissioner or deputy only." };
  }

  const year = defaultSeasonYear();
  const existing = readClosed(session.leagueId, year);
  if (existing) {
    return {
      ok: true,
      alreadyClosed: true,
      closedAt: existing.closedAt,
      seasonYear: year,
      winners: 0,
      message: "Season already closed.",
    };
  }

  // In-flight lock (same tab double-click)
  const lockKey = `${CLOSE_LOCK_KEY}:${session.leagueId}:${year}`;
  try {
    if (typeof window !== "undefined") {
      const locked = sessionStorage.getItem(lockKey);
      if (locked === "1") {
        return {
          ok: false,
          error: "Closeout already in progress — wait a moment.",
        };
      }
      sessionStorage.setItem(lockKey, "1");
    }
  } catch {
    /* ok */
  }

  try {
    const readiness = await resolveSeasonCloseoutReadiness();
    if (readiness.status === "already-closed") {
      return {
        ok: true,
        alreadyClosed: true,
        closedAt: readiness.closedAt,
        seasonYear: readiness.seasonYear,
        winners: 0,
        message: "Season already closed.",
      };
    }
    if (readiness.status !== "ready") {
      return { ok: false, error: readiness.reason };
    }
    if (
      opts?.expectedReadinessVersion &&
      opts.expectedReadinessVersion !== readiness.version
    ) {
      return {
        ok: false,
        error: "Awards preview changed — review again before confirming.",
      };
    }

    const champTeam = readiness.nationalChampion.winnerTeam;

    // 1–2) Persist national champion + CB achievements (idempotent upserts)
    const { crownNationalChampion } = await import("./crystal-ball");
    // crownNationalChampion requires isCommissioner — deputies use internal path
    let winners = 0;
    if (session.isCommissioner) {
      const crown = await crownNationalChampion(champTeam);
      if (!crown.ok) {
        // Still try internal path for ops deputies
        const internal = await grantCrystalBallForChampion(champTeam);
        if (!internal.ok) {
          return { ok: false, error: crown.error || internal.error || "Crown failed" };
        }
        winners = internal.winners;
      } else {
        winners = crown.winners ?? 0;
      }
    } else {
      const internal = await grantCrystalBallForChampion(champTeam);
      if (!internal.ok) {
        return { ok: false, error: internal.error || "Crown failed" };
      }
      winners = internal.winners;
    }

    // 3–7) Engrave hardware (upserts are unique per type/year)
    try {
      const { autoEngraveAllTrophies } = await import("./auto-trophies");
      await autoEngraveAllTrophies({});
    } catch {
      /* continue — award explicitly below */
    }

    // Explicit awards (idempotent) — multi Crystal Ball names in notes
    await awardIfNeeded({
      trophyType: "championship",
      winnerName: readiness.leagueChampionNames[0] || "Champion",
      winnerUserId: readiness.leagueChampionIds[0] || null,
      subtitle: "War Room Champion",
      notes: "Season closeout · Championship bracket final",
    });
    await awardIfNeeded({
      trophyType: "toilet_bowl",
      winnerName: readiness.toiletBowlNames[0] || "Toilet Bowl",
      winnerUserId: readiness.toiletBowlIds[0] || null,
      subtitle: "Toilet Bowl Champion",
      notes: "Season closeout · Toilet Bowl bracket final",
    });

    if (readiness.crystalBallWinnerIds.length > 0) {
      const names = readiness.crystalBallWinnerNames;
      await awardIfNeeded({
        trophyType: "crystal_ball",
        winnerName: names[0] || "Prophet",
        winnerUserId: readiness.crystalBallWinnerIds[0] || null,
        subtitle: `Predicted ${champTeam}`,
        notes:
          names.length > 1
            ? `Village Nerd · all correct: ${names.join(" · ")}`
            : `Village Nerd · only correct Crystal Ball on ${champTeam}`,
      });
      // Badges already granted in crown path for all winners
    }

    for (const o of readiness.otherAwards) {
      if (!o.recipientNames[0]) continue;
      await awardIfNeeded({
        trophyType: o.type as TrophyType,
        winnerName: o.recipientNames[0],
        winnerUserId: o.recipientIds[0] || null,
        subtitle: o.label,
        notes: "Season closeout · division title",
      });
    }

    // 8–9) Ceremony presentation: clear finale seen so SeasonFinale can fire
    try {
      if (typeof window !== "undefined") {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("warroom-season-finale-seen-v1:")) keys.push(k);
        }
        // Only clear for this league
        for (const k of keys) {
          if (k.includes(session.leagueId)) localStorage.removeItem(k);
        }
      }
    } catch {
      /* ignore */
    }

    // 10) Gazette season-complete — best effort if archive supports custom
    // Weekly gazette is score-driven; full season wrap not yet a separate edition.
    // Mark intent for future paper without inventing a fake edition.
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `warroom-season-complete-story-v1:${session.leagueId}:${year}`,
          JSON.stringify({
            at: new Date().toISOString(),
            champion: readiness.leagueChampionNames[0],
            national: champTeam,
          })
        );
      }
    } catch {
      /* ignore */
    }

    // 11) Mark season closed (local + durable enough for refresh)
    const closedAt = new Date().toISOString();
    writeClosed(session.leagueId, year, closedAt);

    // 12) Museum reads league_trophies — already written via awardTrophy

    return {
      ok: true,
      closedAt,
      seasonYear: year,
      winners,
      message: "Season closed. Hardware engraved.",
    };
  } finally {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(lockKey);
      }
    } catch {
      /* ok */
    }
  }
}

async function awardIfNeeded(opts: {
  trophyType: TrophyType;
  winnerName: string;
  winnerUserId: string | null;
  subtitle?: string;
  notes?: string;
}) {
  try {
    await awardTrophy({
      seasonYear: defaultSeasonYear(),
      trophyType: opts.trophyType,
      winnerName: opts.winnerName,
      winnerUserId: opts.winnerUserId,
      subtitle: opts.subtitle || null,
      notes: opts.notes || null,
      allowOps: true,
    });
  } catch {
    /* ignore single award failure */
  }
}

/**
 * Ops path when crownNationalChampion requires pure commissioner.
 * Mirrors crystal-ball crown upserts without UI.
 */
async function grantCrystalBallForChampion(
  teamName: string
): Promise<{ ok: boolean; error?: string; winners: number }> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "No session", winners: 0 };
  }
  if (!isOps()) {
    return { ok: false, error: "Ops only", winners: 0 };
  }
  const team = teamName.trim();
  if (!team) return { ok: false, error: "No champion team", winners: 0 };

  const nerds = await loadCrystalBallWinners(team);
  try {
    const { createClient } = await import("./supabase/client");
    const { achievementForCorrectPick } = await import("./crystal-ball");
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
    if (rErr) {
      return { ok: false, error: rErr.message, winners: 0 };
    }
    const ach = achievementForCorrectPick(team);
    for (let i = 0; i < nerds.ids.length; i++) {
      const uid = nerds.ids[i]!;
      await supabase.from("achievements").upsert(
        {
          league_id: session.leagueId,
          user_id: uid,
          code: ach.code,
          title: ach.title,
          flavor: ach.flavor,
          earned_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id,code" }
      );
      try {
        const { grantPermanentBadgeId } = await import("./permanent-badges");
        grantPermanentBadgeId(uid, "national_nightmare");
      } catch {
        /* ignore */
      }
    }
    return { ok: true, winners: nerds.ids.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Crown failed",
      winners: 0,
    };
  }
}
