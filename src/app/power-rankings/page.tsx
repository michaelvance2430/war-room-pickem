"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import SwingBadge from "@/components/SwingBadge";
import HotTakeTicker from "@/components/HotTakeTicker";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { powerBoardWithLabels } from "@/lib/fun-board";
import { Player } from "@/lib/types";

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

export default function PowerRankingsPage() {
  const [ranked, setRanked] = useState<
    ReturnType<typeof powerBoardWithLabels>
  >([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      const players = await loadLeaguePlayers();
      setRanked(powerBoardWithLabels(players, computePowerScore));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Power Rankings</h1>
          <p className="text-sm text-muted">
            Who is actually playing the best right now? • Swing labels from last
            scored week
          </p>
        </div>

        <HotTakeTicker className="mb-6" />

        {loading && (
          <p className="text-sm text-muted py-8 text-center">Loading…</p>
        )}

        {!loading && ranked.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted">
              No players in this league yet. Invite friends from Players.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {ranked.map((player, idx) => {
            const last4 = player.weeklyPoints.slice(-4);
            const last4Total = last4.reduce((a, b) => a + b, 0);

            return (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 sm:gap-4 hover:bg-card-hover transition"
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
                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                    <span>
                      {player.name}
                      {player.id === selfId && (
                        <span className="ml-2 text-xs text-primary">(You)</span>
                      )}
                    </span>
                    <SwingBadge swing={player.swing} />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {player.division} • Last 4: {last4Total} pts • ATS{" "}
                    {player.atsTotal
                      ? Math.round((player.atsCorrect / player.atsTotal) * 100)
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
          Labels (ON A HEATER, DROPPED THE BALL, etc.) track movement in{" "}
          <span className="text-foreground/80">season standings</span> after the
          latest scored week — not pure vibes. Power score still ranks form.
        </p>
      </main>
    </div>
  );
}
