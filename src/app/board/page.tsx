"use client";

/**
 * League pick board — after a week is scored, see everyone's slips.
 * Cross-talk: who took the dog, who maxed confidence, who nailed the prop.
 */

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import PlayerLink from "@/components/PlayerLink";
import {
  loadWeekCard,
  loadWeekResultsFromCloud,
  loadLeagueWeekBoard,
  listPublishedWeekNumbers,
  listScoredWeekNumbers,
  loadLeagueActiveWeek,
  type WeekBoardSlip,
  type CloudCard,
} from "@/lib/cloud";
import { scoreWeek, type GameResult } from "@/lib/scoring";
import { weekTitle } from "@/lib/dates";
import { getSession } from "@/lib/league";
import { formatRankedTeam } from "@/lib/rankings";

function BoardInner() {
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  const [week, setWeek] = useState(1);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [card, setCard] = useState<CloudCard | null>(null);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [slips, setSlips] = useState<WeekBoardSlip[]>([]);
  const [scored, setScored] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  const load = useCallback(async (w: number) => {
    setLoading(true);
    setError(null);
    setSelfId(getSession()?.playerId || null);
    try {
      const [pub, scoredList, active] = await Promise.all([
        listPublishedWeekNumbers(),
        listScoredWeekNumbers(),
        loadLeagueActiveWeek(),
      ]);
      const all = [...new Set([...pub, ...scoredList, active])].sort(
        (a, b) => a - b
      );
      setWeeks(all);
      setScoredWeeks(scoredList);

      let target = w;
      if (!all.includes(target)) {
        target =
          scoredList[scoredList.length - 1] ??
          all[all.length - 1] ??
          active;
      }
      setWeek(target);

      const [c, res, board] = await Promise.all([
        loadWeekCard(target),
        loadWeekResultsFromCloud(target),
        loadLeagueWeekBoard(target),
      ]);
      setCard(c);
      setResults(res?.results || {});
      setPropResult(res?.propResult ?? null);
      setScored(board.scored || scoredList.includes(target));
      setLockedOpen(board.lockedOpen || board.scored);
      if (!board.ok) {
        setSlips([]);
        setError(
          board.error ||
            "Board unlocks at first kickoff — when the card freezes, every slip opens."
        );
      } else {
        setSlips(board.slips);
        setError(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const w =
      weekParam != null && weekParam !== ""
        ? parseInt(weekParam, 10)
        : NaN;
    void load(Number.isNaN(w) ? 1 : w);
  }, [weekParam, load]);

  const games = card?.games || [];
  const prop = card?.prop;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            After the whistle
          </p>
          <h1 className="text-2xl font-black mt-1">The Board</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed max-w-xl">
            When the first kickoff hits, the card locks and everyone&apos;s picks
            open up. See who took the dog, who stacked the 5, who rode the prop
            — live trash talk, not just a total score on Monday.
          </p>
        </div>

        {weeks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {weeks.map((w) => {
              const isScored = scoredWeeks.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => void load(w)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    w === week
                      ? "bg-primary text-black"
                      : isScored
                        ? "border border-primary/40 text-primary hover:bg-primary/10"
                        : "border border-border text-muted"
                  }`}
                >
                  {weekTitle(w)}
                  {isScored ? " · scored" : ""}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6 text-sm">
          <Link
            href={`/picks`}
            className="text-primary font-medium hover:underline"
          >
            ← My Picks
          </Link>
          <span className="text-muted">·</span>
          <Link
            href="/standings"
            className="text-muted hover:text-foreground hover:underline"
          >
            Standings
          </Link>
        </div>

        {loading && (
          <p className="text-sm text-muted py-12 text-center">
            Opening the board…
          </p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-4 mb-6">
            <p className="text-sm text-warning font-medium">{error}</p>
            <p className="text-xs text-muted mt-2">
              Privacy: picks stay secret until the first kickoff on this card
              (same moment your card freezes). After that, The Board opens for
              the whole room — even before final scores.
            </p>
            <Link
              href="/picks"
              className="inline-block mt-3 text-sm text-primary font-semibold hover:underline"
            >
              Back to your card →
            </Link>
          </div>
        )}

        {!loading && !error && !games.length && (
          <p className="text-sm text-muted text-center py-8">
            No card for {weekTitle(week)}.
          </p>
        )}

        {!loading && !error && games.length > 0 && (
          <>
            {lockedOpen && (
              <p className="text-xs text-primary font-medium mb-4">
                {scored
                  ? `${weekTitle(week)} is scored — full room reveal with results.`
                  : `${weekTitle(week)} is locked (first kickoff hit) — slips are open. Results fill in when the commish scores.`}
              </p>
            )}

            {/* Compact matrix: players × games */}
            <div className="rounded-xl border border-border bg-card overflow-x-auto mb-6">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-2 sticky left-0 bg-card z-10 min-w-[7rem]">
                      Player
                    </th>
                    {games.map((g, i) => (
                      <th key={g.id} className="p-2 font-medium min-w-[5.5rem]">
                        <div className="text-[10px] text-muted">G{i + 1}</div>
                        <div className="truncate max-w-[5.5rem]" title={`${g.awayTeam} @ ${g.homeTeam}`}>
                          {g.awayTeam.split(" ").pop()} @{" "}
                          {g.homeTeam.split(" ").pop()}
                        </div>
                        {results[g.id]?.winner && (
                          <div className="text-[10px] text-primary mt-0.5">
                            {results[g.id].winner === "push"
                              ? "Push"
                              : results[g.id].winner === "away"
                                ? "Away"
                                : "Home"}
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="p-2">Prop</th>
                    <th className="p-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((s) => {
                    const scoredSlip =
                      scored && prop
                        ? scoreWeek(
                            s.picks,
                            s.bestBetId,
                            s.propChoice,
                            games,
                            results,
                            prop,
                            propResult
                          )
                        : null;
                    const pts =
                      s.totalPoints != null
                        ? s.totalPoints
                        : scoredSlip?.totalPoints;
                    return (
                      <tr
                        key={s.userId}
                        className={`border-b border-border/60 ${
                          s.userId === selfId ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-2 sticky left-0 bg-card z-10 font-medium">
                          <PlayerLink id={s.userId} name={s.name} />
                          {!s.lockedAt && (
                            <span className="block text-[10px] text-danger">
                              No lock
                            </span>
                          )}
                        </td>
                        {games.map((g) => {
                          const pk = s.picks[g.id];
                          const res = results[g.id];
                          let tone = "text-muted";
                          if (pk && res?.winner) {
                            if (res.winner === "push") tone = "text-muted";
                            else if (pk.pick === res.winner)
                              tone = "text-primary font-semibold";
                            else tone = "text-danger/80";
                          }
                          if (!pk) {
                            return (
                              <td key={g.id} className="p-2 text-muted">
                                —
                              </td>
                            );
                          }
                          const side =
                            pk.pick === "away"
                              ? formatRankedTeam(g.awayTeam, g.awayRank).replace(
                                  /^#\d+\s*/,
                                  ""
                                )
                              : formatRankedTeam(g.homeTeam, g.homeRank).replace(
                                  /^#\d+\s*/,
                                  ""
                                );
                          const short = side.split(" ").pop() || side;
                          return (
                            <td key={g.id} className={`p-2 ${tone}`}>
                              <span className="font-mono">{pk.confidence}</span>
                              {pk.isBestBet || s.bestBetId === g.id ? (
                                <span className="text-primary">×2</span>
                              ) : null}{" "}
                              {short}
                            </td>
                          );
                        })}
                        <td className="p-2">
                          {s.propChoice ? (
                            <span
                              className={
                                propResult && s.propChoice === propResult
                                  ? "text-primary font-semibold"
                                  : propResult
                                    ? "text-danger/80"
                                    : ""
                              }
                            >
                              {s.propChoice}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="p-2 font-bold tabular-nums">
                          {pts != null ? pts : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {prop?.question && (
              <p className="text-xs text-muted mb-4">
                Prop: {prop.question}
                {propResult ? (
                  <span className="text-primary font-medium">
                    {" "}
                    · Result: {propResult}
                  </span>
                ) : null}
              </p>
            )}

            <p className="text-[11px] text-muted leading-relaxed">
              Green-ish / primary = correct · red = wrong · confidence number
              shown first. Best Bet marked ×2. Sort order = week points when
              available.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading board…
        </div>
      }
    >
      <BoardInner />
    </Suspense>
  );
}
