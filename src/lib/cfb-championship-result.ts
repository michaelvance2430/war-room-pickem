/**
 * Trusted CFB National Championship result source.
 *
 * Production: Odds API scores (completed game in CFP Final window).
 * Foundry: creator-only simulation key — never mutates production league data
 * unless the real closeout command is explicitly run.
 *
 * Do not guess. Ambiguous / missing → not confirmed.
 */

import { weekDateWindow } from "@/lib/season-calendar";
import { defaultSeasonYear } from "@/lib/trophies";

export type CfbTitleTeamResult = {
  winnerTeam: string;
  loserTeam: string;
  winnerScore: number;
  loserScore: number;
  completed: true;
  completedAt: string;
  source: "odds_api" | "foundry_sim";
  eventId?: string;
};

export type CfbTitleResultState =
  | { status: "confirmed"; result: CfbTitleTeamResult }
  | { status: "not_confirmed"; reason: string }
  | { status: "error"; reason: string };

/** Foundry key memory — creator session only. */
export const FOUNDRY_CFB_CHAMP_FINAL_KEY = "warroom-foundry-cfb-champ-final-v1";

export type FoundryCfbChampSim = {
  enabled: boolean;
  winnerTeam: string;
  loserTeam: string;
  winnerScore: number;
  loserScore: number;
  completedAt: string;
};

export function readFoundryCfbChampSim(): FoundryCfbChampSim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FOUNDRY_CFB_CHAMP_FINAL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as FoundryCfbChampSim;
    if (!p?.enabled || !p.winnerTeam) return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Creator-only: set / clear "CFB NATIONAL CHAMPIONSHIP IS FINAL" simulation.
 * Does not write league trophies, crystal_ball_result, or season close flags.
 */
export function setFoundryCfbChampSim(
  next: Omit<FoundryCfbChampSim, "enabled" | "completedAt"> | null
): { ok: boolean; error?: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "Client only" };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isFoundryBackstageUser } =
      require("./foundry-preview") as typeof import("./foundry-preview");
    if (!isFoundryBackstageUser()) {
      return { ok: false, error: "Creator only" };
    }
    if (!next) {
      localStorage.removeItem(FOUNDRY_CFB_CHAMP_FINAL_KEY);
      return { ok: true };
    }
    const payload: FoundryCfbChampSim = {
      enabled: true,
      winnerTeam: next.winnerTeam.trim(),
      loserTeam: next.loserTeam.trim(),
      winnerScore: Number(next.winnerScore) || 0,
      loserScore: Number(next.loserScore) || 0,
      completedAt: new Date().toISOString(),
    };
    if (!payload.winnerTeam) {
      return { ok: false, error: "Winner team required" };
    }
    localStorage.setItem(FOUNDRY_CFB_CHAMP_FINAL_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not set sim",
    };
  }
}

type OddsScoreEvent = {
  id?: string;
  commence_time?: string;
  completed?: boolean;
  home_team?: string;
  away_team?: string;
  scores?: { name: string; score: string | number }[] | null;
};

function parseScore(
  scores: OddsScoreEvent["scores"],
  team: string
): number | null {
  if (!scores?.length) return null;
  const row = scores.find(
    (s) => (s.name || "").toLowerCase() === team.toLowerCase()
  );
  if (!row) return null;
  const n = Number(row.score);
  return Number.isFinite(n) ? n : null;
}

function inCfpFinalWindow(commenceIso: string | undefined): boolean {
  if (!commenceIso) return false;
  const win = weekDateWindow(18, "cfb");
  if (!win) return false;
  const t = Date.parse(commenceIso);
  if (Number.isNaN(t)) return false;
  // ET calendar dates — compare by UTC noon of window endpoints ± 1 day slack
  const start = Date.parse(`${win.startDate}T00:00:00-05:00`);
  const end = Date.parse(`${win.endDate}T23:59:59-05:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const slack = 36 * 60 * 60 * 1000;
  return t >= start - slack && t <= end + slack;
}

function eventToResult(
  e: OddsScoreEvent,
  source: CfbTitleTeamResult["source"]
): CfbTitleTeamResult | null {
  if (!e.completed) return null;
  const home = (e.home_team || "").trim();
  const away = (e.away_team || "").trim();
  if (!home || !away) return null;
  const hs = parseScore(e.scores, home);
  const as = parseScore(e.scores, away);
  if (hs == null || as == null) return null;
  if (hs === as) return null; // ties not a championship result we accept
  const homeWins = hs > as;
  return {
    winnerTeam: homeWins ? home : away,
    loserTeam: homeWins ? away : home,
    winnerScore: homeWins ? hs : as,
    loserScore: homeWins ? as : hs,
    completed: true,
    completedAt: e.commence_time || new Date().toISOString(),
    source,
    eventId: e.id,
  };
}

/**
 * Resolve official CFB National Championship final.
 * Foundry sim wins only for creator backstage users (read path for ceremony testing).
 */
export async function resolveCfbNationalChampionshipResult(opts?: {
  /** Prefer live API even if Foundry sim is on */
  preferApi?: boolean;
  daysFrom?: number;
}): Promise<CfbTitleResultState> {
  // Foundry simulation (creator only)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isFoundryBackstageUser } =
      require("./foundry-preview") as typeof import("./foundry-preview");
    if (isFoundryBackstageUser() && !opts?.preferApi) {
      const sim = readFoundryCfbChampSim();
      if (sim?.enabled) {
        return {
          status: "confirmed",
          result: {
            winnerTeam: sim.winnerTeam,
            loserTeam: sim.loserTeam || "TBD",
            winnerScore: sim.winnerScore,
            loserScore: sim.loserScore,
            completed: true,
            completedAt: sim.completedAt,
            source: "foundry_sim",
          },
        };
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const days = Math.min(3, Math.max(1, opts?.daysFrom ?? 3));
    const headers: HeadersInit = {};
    try {
      const { createClient } = await import("./supabase/client");
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* ok */
    }
    const res = await fetch(`/api/scores/ncaaf?daysFrom=${days}`, {
      cache: "no-store",
      headers,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "error",
        reason:
          (body as { error?: string }).error ||
          `Scores API unavailable (${res.status})`,
      };
    }
    const events = ((body as { events?: OddsScoreEvent[] }).events ||
      []) as OddsScoreEvent[];

    const completedInWindow = events
      .filter((e) => e.completed && inCfpFinalWindow(e.commence_time))
      .map((e) => eventToResult(e, "odds_api"))
      .filter(Boolean) as CfbTitleTeamResult[];

    if (completedInWindow.length === 1) {
      return { status: "confirmed", result: completedInWindow[0]! };
    }
    if (completedInWindow.length > 1) {
      // Prefer latest commence_time
      completedInWindow.sort(
        (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
      );
      return { status: "confirmed", result: completedInWindow[0]! };
    }

    // Fallback: single completed game whose teams look title-game-ish is too
    // risky — do not guess. Season year context only for messaging.
    const year = defaultSeasonYear();
    return {
      status: "not_confirmed",
      reason: `Championship result not confirmed yet. No completed CFP National Championship game in the trusted window (${year} season).`,
    };
  } catch (e) {
    return {
      status: "error",
      reason:
        e instanceof Error
          ? e.message
          : "Could not reach championship scores source",
    };
  }
}
