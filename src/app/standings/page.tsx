"use client";

import { useState, useEffect, Fragment } from "react";
import Nav from "@/components/Nav";
import SwingBadge from "@/components/SwingBadge";
import CrownAndShame from "@/components/CrownAndShame";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { rankPlayersWithSwings } from "@/lib/fun-board";
import { compareForSeed } from "@/lib/brackets";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { Division, Player } from "@/lib/types";

const divisions: (Division | "Overall")[] = [
  "Overall",
  "North",
  "South",
  "East",
  "West",
];

function atsPct(p: Player) {
  if (p.atsTotal === 0) return "—";
  return `${Math.round((p.atsCorrect / p.atsTotal) * 100)}%`;
}

function streakDisplay(streak: number) {
  if (streak > 0) return <span className="text-primary">W{streak}</span>;
  if (streak < 0)
    return <span className="text-danger">L{Math.abs(streak)}</span>;
  return <span className="text-muted">—</span>;
}

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [swingById, setSwingById] = useState<
    Record<string, ReturnType<typeof rankPlayersWithSwings>[0]["swing"]>
  >({});
  const [selfId, setSelfId] = useState<string | null>(null);
  const [active, setActive] = useState<Division | "Overall">("Overall");

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      const list = await loadLeaguePlayers();
      setPlayers(list);
      const ranked = rankPlayersWithSwings(list);
      const map: Record<string, (typeof ranked)[0]["swing"]> = {};
      for (const r of ranked) map[r.id] = r.swing;
      setSwingById(map);
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
            Live points • Bottom 50% of each division gets flushed • Swing labels
            after each scored week
          </p>
        </div>

        <CrownAndShame className="mb-6" />

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
                <th className="text-left px-3 py-3 font-medium hidden md:table-cell">
                  Swing
                </th>
                <th className="text-right px-4 py-3 font-medium">Pts</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                  ATS%
                </th>
                <th className="text-right px-4 py-3 font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player, idx) => (
                <Fragment key={player.id}>
                  {idx === cutIndex && (
                    <tr className="bg-danger/10">
                      <td
                        colSpan={active === "Overall" ? 7 : 6}
                        className="px-4 py-1.5 text-center text-xs text-danger font-medium"
                      >
                        — Cut Line (bottom 50% → Toilet Bowl) —
                      </td>
                    </tr>
                  )}
                  <tr
                    className={selfRowClass(
                      isSelfPlayer(player.id, selfId),
                      `border-t border-border hover:bg-card-hover transition ${
                        cutIndex >= 0 &&
                        idx >= cutIndex &&
                        !isSelfPlayer(player.id, selfId)
                          ? "opacity-60"
                          : ""
                      }`
                    )}
                  >
                    <td className="px-4 py-3 text-muted">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span
                          className={selfNameClass(
                            isSelfPlayer(player.id, selfId)
                          )}
                        >
                          <PlayerLink id={player.id} name={player.name} />
                          {isSelfPlayer(player.id, selfId) && <YouBadge />}
                        </span>
                        {swingById[player.id] && (
                          <span className="md:hidden">
                            <SwingBadge swing={swingById[player.id]} />
                          </span>
                        )}
                      </div>
                    </td>
                    {active === "Overall" && (
                      <td className="px-4 py-3 text-muted">{player.division}</td>
                    )}
                    <td className="px-3 py-3 hidden md:table-cell">
                      {swingById[player.id] ? (
                        <SwingBadge swing={swingById[player.id]} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
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
