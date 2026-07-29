"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import { Player } from "@/lib/types";

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

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<StatKey>("totalPoints");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      setPlayers(await loadLeaguePlayers());
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

  const tabs: { key: StatKey; label: string }[] = [
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Player Stats</h1>
          <p className="text-sm text-muted">
            Season-long tracking • Live league data • Click a column to sort
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
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

        {!loading && players.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium">#</th>
                    <th className="text-left px-3 py-3 font-medium">Player</th>
                    <th className="text-right px-3 py-3 font-medium">Pts</th>
                    <th className="text-right px-3 py-3 font-medium">Avg</th>
                    <th className="text-right px-3 py-3 font-medium">Best</th>
                    <th className="text-right px-3 py-3 font-medium">ATS</th>
                    <th className="text-right px-3 py-3 font-medium">BB%</th>
                    <th className="text-right px-3 py-3 font-medium">Prop</th>
                    <th className="text-right px-3 py-3 font-medium">Perf</th>
                    <th className="text-right px-3 py-3 font-medium">Streak</th>
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
                      <td className="px-3 py-2.5 text-muted">{idx + 1}</td>
                      <td className={`px-3 py-2.5 ${selfNameClass(mine)}`}>
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
        )}

        <p className="text-xs text-muted mt-4 text-center">
          BB% = Best Bet hit rate • Perf = weeks scoring 18+ • Stats update when
          results are scored
        </p>
      </main>
    </div>
  );
}
