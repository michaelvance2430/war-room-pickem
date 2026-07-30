"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import SwingBadge from "@/components/SwingBadge";
import HotTakeTicker from "@/components/HotTakeTicker";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { powerBoardWithLabels } from "@/lib/fun-board";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import { Player } from "@/lib/types";

type MainTab = "power" | "season";

type StatKey =
  | "totalPoints"
  | "avg"
  | "bestWeek"
  | "ats"
  | "bestBet"
  | "prop"
  | "perfectWeeks"
  | "streak";

function avg(p: Player) {
  if (!p.weeksPlayed && !p.weeklyPoints.length) return 0;
  const weeks = p.weeksPlayed || p.weeklyPoints.length;
  return weeks ? p.totalPoints / weeks : 0;
}

function atsPct(p: Player) {
  return p.atsTotal ? Math.round((p.atsCorrect / p.atsTotal) * 100) : 0;
}

function bestBetPct(p: Player) {
  return p.bestBetTotal
    ? Math.round((p.bestBetHits / p.bestBetTotal) * 100)
    : 0;
}

function propPct(p: Player) {
  return p.propTotal ? Math.round((p.propHits / p.propTotal) * 100) : 0;
}

function computePowerScore(p: Player): number {
  const last4 = p.weeklyPoints.slice(-4);
  const last4Avg = last4.length
    ? last4.reduce((a, b) => a + b, 0) / last4.length
    : 0;
  const ats = p.atsTotal ? p.atsCorrect / p.atsTotal : 0;
  const streakBonus = p.currentStreak * 1.5;
  const seasonAvg = p.weeklyPoints.length
    ? p.weeklyPoints.reduce((a, b) => a + b, 0) / p.weeklyPoints.length
    : 0;

  return last4Avg * 0.4 + ats * 20 * 0.25 + streakBonus * 0.15 + seasonAvg * 0.2;
}

export default function StatsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("power");
  const [players, setPlayers] = useState<Player[]>([]);
  const [ranked, setRanked] = useState<
    ReturnType<typeof powerBoardWithLabels>
  >([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<StatKey>("totalPoints");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      const list = await loadLeaguePlayers();
      setPlayers(list);
      setRanked(powerBoardWithLabels(list, computePowerScore));
      setLoading(false);
    }
    load();
  }, []);

  const sorted = [...players].sort((a, b) => {
    switch (sortBy) {
      case "avg":
        return avg(b) - avg(a);
      case "bestWeek":
        return (b.bestWeek || 0) - (a.bestWeek || 0);
      case "ats":
        return atsPct(b) - atsPct(a);
      case "bestBet":
        return bestBetPct(b) - bestBetPct(a);
      case "prop":
        return propPct(b) - propPct(a);
      case "perfectWeeks":
        return (b.perfectWeeks || 0) - (a.perfectWeeks || 0);
      case "streak":
        return b.currentStreak - a.currentStreak;
      default:
        return b.totalPoints - a.totalPoints;
    }
  });

  const sortTabs: { key: StatKey; label: string }[] = [
    { key: "totalPoints", label: "Points" },
    { key: "avg", label: "Avg/Week" },
    { key: "bestWeek", label: "Best Week" },
    { key: "ats", label: "ATS %" },
    { key: "bestBet", label: "Best Bet %" },
    { key: "prop", label: "Prop %" },
    { key: "perfectWeeks", label: "Perfect" },
    { key: "streak", label: "Streak" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Stats</h1>
          <p className="text-sm text-muted">
            Power rankings and season tracking • Live league data
          </p>
        </div>

        {/* Main: Power Rankings first, then Season table */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMainTab("power")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              mainTab === "power"
                ? "bg-primary text-black"
                : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            Power Rankings
          </button>
          <button
            type="button"
            onClick={() => setMainTab("season")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              mainTab === "season"
                ? "bg-primary text-black"
                : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            Season stats
          </button>
        </div>

        {loading && (
          <p className="text-sm text-muted py-8 text-center">Loading…</p>
        )}

        {!loading && players.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted">
              No players in this league yet. Invite friends from Players.
            </p>
          </div>
        )}

        {/* —— Power Rankings tab —— */}
        {mainTab === "power" && !loading && players.length > 0 && (
          <>
            <HotTakeTicker className="mb-6" />
            <p className="text-xs text-muted mb-4">
              Who is playing the best right now? Swing labels from the last
              scored week.
            </p>
            <div className="space-y-2 max-w-3xl">
              {ranked.map((player, idx) => {
                const last4 = player.weeklyPoints.slice(-4);
                const last4Total = last4.reduce((a, b) => a + b, 0);
                const mine = isSelfPlayer(player.id, selfId);

                return (
                  <div
                    key={player.id}
                    className={selfRowClass(
                      mine,
                      "rounded-xl border border-border bg-card p-4 flex items-center gap-3 sm:gap-4 hover:bg-card-hover transition"
                    )}
                  >
                    <div
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx < 3
                          ? "bg-primary text-black"
                          : "bg-card-hover text-muted"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`${selfNameClass(mine)} truncate flex items-center gap-2 flex-wrap`}
                      >
                        <span>
                          {player.name}
                          {mine && <YouBadge />}
                        </span>
                        <SwingBadge swing={player.swing} />
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {player.division} • Last 4: {last4Total} pts • ATS{" "}
                        {player.atsTotal
                          ? Math.round(
                              (player.atsCorrect / player.atsTotal) * 100
                            )
                          : 0}
                        %
                        {player.lastWeekPts != null && (
                          <> • Last card: {player.lastWeekPts}</>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">
                        {player.power.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted">
                        {player.currentStreak > 0
                          ? `W${player.currentStreak}`
                          : player.currentStreak < 0
                            ? `L${Math.abs(player.currentStreak)}`
                            : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-6 leading-relaxed">
              Labels (ON A HEATER, etc.) track movement in season standings
              after the latest scored week. Power score ranks recent form.
            </p>
          </>
        )}

        {/* —— Season stats table tab —— */}
        {mainTab === "season" && !loading && players.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {sortTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSortBy(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    sortBy === t.key
                      ? "bg-primary text-black"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-3 font-medium">#</th>
                      <th className="text-left px-3 py-3 font-medium">
                        Player
                      </th>
                      <th className="text-right px-3 py-3 font-medium">Pts</th>
                      <th className="text-right px-3 py-3 font-medium">Avg</th>
                      <th className="text-right px-3 py-3 font-medium">Best</th>
                      <th className="text-right px-3 py-3 font-medium">ATS</th>
                      <th className="text-right px-3 py-3 font-medium">BB%</th>
                      <th className="text-right px-3 py-3 font-medium">Prop</th>
                      <th className="text-right px-3 py-3 font-medium">Perf</th>
                      <th className="text-right px-3 py-3 font-medium">
                        Streak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, idx) => {
                      const mine = isSelfPlayer(p.id, selfId);
                      return (
                        <tr
                          key={p.id}
                          className={selfRowClass(
                            mine,
                            "border-t border-border hover:bg-card-hover transition"
                          )}
                        >
                          <td className="px-3 py-2.5 text-muted">
                            {idx + 1}
                          </td>
                          <td
                            className={`px-3 py-2.5 ${selfNameClass(mine)}`}
                          >
                            {p.name}
                            {mine && <YouBadge />}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            {p.totalPoints}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted">
                            {avg(p).toFixed(1)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {p.bestWeek || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted">
                            {atsPct(p)}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted">
                            {bestBetPct(p)}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted">
                            {propPct(p)}%
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {p.perfectWeeks || 0}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {p.currentStreak > 0 ? (
                              <span className="text-primary">
                                W{p.currentStreak}
                              </span>
                            ) : p.currentStreak < 0 ? (
                              <span className="text-danger">
                                L{Math.abs(p.currentStreak)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-muted mt-4 text-center">
              BB% = Best Bet hit rate • Perf = weeks scoring 18+ • Updates when
              results are scored
            </p>
          </>
        )}
      </main>
    </div>
  );
}
