"use client";

import { useState, useEffect, Fragment } from "react";
import Nav from "@/components/Nav";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { compareForSeed } from "@/lib/brackets";
import { Division, Player } from "@/lib/types";

const divisions: (Division | "Overall")[] = ["Overall", "North", "South", "East", "West"];

function atsPct(p: Player) {
  if (p.atsTotal === 0) return "—";
  return `${Math.round((p.atsCorrect / p.atsTotal) * 100)}%`;
}

function streakDisplay(streak: number) {
  if (streak > 0) return <span className="text-primary">W{streak}</span>;
  if (streak < 0) return <span className="text-danger">L{Math.abs(streak)}</span>;
  return <span className="text-muted">—</span>;
}

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [active, setActive] = useState<Division | "Overall">("Overall");

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      setPlayers(await loadLeaguePlayers());
    }
    load();
  }, []);

  const filtered =
    active === "Overall"
      ? [...players].sort(compareForSeed)
      : players
          .filter((p) => p.division === active)
          .sort(compareForSeed);

  const cutIndex = active !== "Overall" ? Math.floor(filtered.length / 2) : -1;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Standings</h1>
          <p className="text-sm text-muted">
            Live points • Bottom 50% of each division gets flushed
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {divisions.map((d) => (
            <button
              key={d}
              onClick={() => setActive(d)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                active === d
                  ? "bg-primary text-black"
                  : "bg-card border border-border text-muted hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Player</th>
                {active === "Overall" && (
                  <th className="text-left px-4 py-3 font-medium">Div</th>
                )}
                <th className="text-right px-4 py-3 font-medium">Pts</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">ATS%</th>
                <th className="text-right px-4 py-3 font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player, idx) => (
                <Fragment key={player.id}>
                  {idx === cutIndex && (
                    <tr className="bg-danger/10">
                      <td
                        colSpan={active === "Overall" ? 6 : 5}
                        className="px-4 py-1.5 text-center text-xs text-danger font-medium"
                      >
                        — Cut Line (bottom 50% → Toilet Bowl) —
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-t border-border hover:bg-card-hover transition ${
                      cutIndex >= 0 && idx >= cutIndex ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-muted">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {player.name}
                      {player.id === selfId && (
                        <span className="ml-2 text-xs text-primary">(You)</span>
                      )}
                    </td>
                    {active === "Overall" && (
                      <td className="px-4 py-3 text-muted">{player.division}</td>
                    )}
                    <td className="px-4 py-3 text-right font-semibold">
                      {player.totalPoints}
                    </td>
                    <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">
                      {atsPct(player)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {streakDisplay(player.currentStreak)}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
