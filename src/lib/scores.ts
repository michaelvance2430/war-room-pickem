import type { Game } from "./types";
import type { GameResult } from "./scoring";

export type OddsScoreEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Odds names often include mascot; allow prefix / contains on first tokens
  if (na.includes(nb) || nb.includes(na)) return true;
  const a0 = na.split(" ")[0];
  const b0 = nb.split(" ")[0];
  return a0.length >= 4 && a0 === b0;
}

/**
 * Home spread is stored as the book home line (negative = home favored).
 * ATS: home covers if (homeScore + homeSpread) > awayScore.
 */
export function atsWinnerFromScores(
  homeScore: number,
  awayScore: number,
  homeSpread: number
): "home" | "away" | "push" {
  const adj = homeScore + homeSpread - awayScore;
  if (Math.abs(adj) < 1e-9) return "push";
  return adj > 0 ? "home" : "away";
}

function parseScore(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function matchScoreEvent(
  game: Game,
  events: OddsScoreEvent[]
): OddsScoreEvent | null {
  // Prefer odds event id if we still have it
  if (game.oddsEventId) {
    const byId = events.find((e) => e.id === game.oddsEventId);
    if (byId) return byId;
  }

  for (const e of events) {
    if (
      teamsMatch(e.home_team, game.homeTeam) &&
      teamsMatch(e.away_team, game.awayTeam)
    ) {
      return e;
    }
  }
  return null;
}

export type FinalBoxScore = {
  gameId: string;
  homeScore: number;
  awayScore: number;
  atsWinner: "home" | "away" | "push";
};

/**
 * Meme final: 6–7 or 7–6 (order doesn't matter).
 * Kids of the timeline will not stop saying sixxxxx seveennnn.
 */
export function isSixSevenFinal(
  homeScore: number,
  awayScore: number
): boolean {
  const a = Math.round(Number(homeScore));
  const b = Math.round(Number(awayScore));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return (a === 6 && b === 7) || (a === 7 && b === 6);
}

/** True if any completed box is a 6–7 / 7–6 final. */
export function anySixSevenFinal(
  boxes: { homeScore: number; awayScore: number }[] | null | undefined
): boolean {
  if (!boxes?.length) return false;
  return boxes.some((b) => isSixSevenFinal(b.homeScore, b.awayScore));
}

export type AutoScoreResult = {
  results: Record<string, GameResult>;
  /** Completed games with numeric scores (for auto prop settle) */
  boxes: FinalBoxScore[];
  filled: number;
  pending: number;
  details: {
    gameId: string;
    label: string;
    status: "final" | "live" | "not_started" | "unmatched";
    scoreLine?: string;
    winner?: "home" | "away" | "push";
    homeScore?: number;
    awayScore?: number;
  }[];
};

/**
 * Build ATS results for card games from Odds API score events.
 * Only completed games get a winner; others stay unset.
 */
export function buildResultsFromScores(
  games: Game[],
  events: OddsScoreEvent[]
): AutoScoreResult {
  const results: Record<string, GameResult> = {};
  const boxes: FinalBoxScore[] = [];
  const details: AutoScoreResult["details"] = [];
  let filled = 0;
  let pending = 0;

  for (const game of games) {
    const label = `${game.awayTeam} @ ${game.homeTeam}`;
    const ev = matchScoreEvent(game, events);

    if (!ev) {
      pending += 1;
      details.push({ gameId: game.id, label, status: "unmatched" });
      continue;
    }

    if (!ev.completed || !ev.scores?.length) {
      pending += 1;
      details.push({
        gameId: game.id,
        label,
        status: ev.scores?.length ? "live" : "not_started",
        scoreLine: ev.scores
          ? `${ev.away_team} ${ev.scores.find((s) => teamsMatch(s.name, ev.away_team))?.score ?? "?"} – ${ev.home_team} ${ev.scores.find((s) => teamsMatch(s.name, ev.home_team))?.score ?? "?"}`
          : undefined,
      });
      continue;
    }

    const homeScore = parseScore(
      ev.scores.find((s) => teamsMatch(s.name, ev.home_team))?.score
    );
    const awayScore = parseScore(
      ev.scores.find((s) => teamsMatch(s.name, ev.away_team))?.score
    );

    if (homeScore == null || awayScore == null) {
      pending += 1;
      details.push({ gameId: game.id, label, status: "live" });
      continue;
    }

    // Our Game.spread is the home line from odds mapping
    const homeSpread = Number(game.spread);
    const winner = atsWinnerFromScores(homeScore, awayScore, homeSpread);
    results[game.id] = { gameId: game.id, winner };
    boxes.push({
      gameId: game.id,
      homeScore,
      awayScore,
      atsWinner: winner,
    });
    filled += 1;
    details.push({
      gameId: game.id,
      label,
      status: "final",
      scoreLine: `${game.awayTeam} ${awayScore} – ${game.homeTeam} ${homeScore}`,
      winner,
      homeScore,
      awayScore,
    });
  }

  return { results, boxes, filled, pending, details };
}

/** Client fetch of scores API — CFB or NFL. */
export async function fetchFootballScores(
  sport: "cfb" | "nfl" = "cfb",
  daysFrom = 3
): Promise<{
  events: OddsScoreEvent[];
  remaining?: string | null;
  used?: string | null;
  last?: string | null;
}> {
  const path = sport === "nfl" ? "/api/scores/nfl" : "/api/scores/ncaaf";
  const res = await fetch(`${path}?daysFrom=${daysFrom}`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(
      (body as { error?: string }).error || `Scores API error ${res.status}`
    ) as Error & { remaining?: string | null; used?: string | null };
    e.remaining = (body as { remaining?: string | null }).remaining;
    e.used = (body as { used?: string | null }).used;
    throw e;
  }
  return {
    events: ((body as { events?: OddsScoreEvent[] }).events ||
      []) as OddsScoreEvent[],
    remaining: (body as { remaining?: string | null }).remaining,
    used: (body as { used?: string | null }).used,
    last: (body as { last?: string | null }).last,
  };
}

/** @deprecated prefer fetchFootballScores("cfb", …) */
export async function fetchNcaafScores(daysFrom = 3) {
  return fetchFootballScores("cfb", daysFrom);
}

export async function fetchNflScores(daysFrom = 3) {
  return fetchFootballScores("nfl", daysFrom);
}
