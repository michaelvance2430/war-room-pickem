"use client";

import { useState, useEffect } from "react";
import SwingBadge from "@/components/SwingBadge";
import HotTakeTicker from "@/components/HotTakeTicker";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { powerBoardWithLabels } from "@/lib/fun-board";
import { buildLeagueLoreCards, type LoreCard } from "@/lib/league-lore";
import { loadLeagueTrophies } from "@/lib/trophies";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import SeasonNotStartedEmpty from "@/components/SeasonNotStartedEmpty";
import { hasOfficialScoredWeek } from "@/lib/season-scored";
import { Player } from "@/lib/types";

type MainTab = "power" | "season" | "lore";

const LORE_TONE: Record<
  LoreCard["tone"],
  { border: string; glow: string; stat: string }
> = {
  fire: {
    border: "border-orange-400/40",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.12)]",
    stat: "text-orange-300",
  },
  up: {
    border: "border-primary/40",
    glow: "shadow-[0_0_24px_rgba(34,197,94,0.1)]",
    stat: "text-primary",
  },
  gold: {
    border: "border-amber-400/40",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.12)]",
    stat: "text-amber-300",
  },
  champ: {
    border: "border-yellow-400/35",
    glow: "shadow-[0_0_24px_rgba(250,204,21,0.1)]",
    stat: "text-yellow-200",
  },
  muted: {
    border: "border-border",
    glow: "",
    stat: "text-muted",
  },
};

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
  const [loreCards, setLoreCards] = useState<LoreCard[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<StatKey>("totalPoints");
  const [loading, setLoading] = useState(true);
  const [seasonStarted, setSeasonStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const disarm = (() => {
      try {
        const { armLoadingFailSafe } =
          require("@/lib/boot-safety") as typeof import("@/lib/boot-safety");
        return armLoadingFailSafe(setLoading, 5_000);
      } catch {
        return () => {};
      }
    })();
    async function load() {
      setSelfId(getSession()?.playerId || null);
      try {
        const scored = await hasOfficialScoredWeek();
        if (cancelled) return;
        setSeasonStarted(scored);

        const [list, trophies] = await Promise.all([
          loadLeaguePlayers(),
          loadLeagueTrophies(),
        ]);
        if (cancelled) return;
        setPlayers(list);
        // Lore can use prior-season trophies; power/season ranks only after score
        setLoreCards(buildLeagueLoreCards(list, trophies));
        if (scored) {
          setRanked(powerBoardWithLabels(list, computePowerScore));
        } else {
          setRanked([]);
        }
      } catch {
        /* empty board — still leave spinner */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      disarm();
    };
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
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-4">
      <h1 className="text-2xl font-bold">Stats</h1>
      <p className="text-sm text-muted">
            Power rankings, season table, and league lore
          </p>
      </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              { id: "power" as const, label: "Power Rankings" },
              { id: "season" as const, label: "Season stats" },
              { id: "lore" as const, label: "League lore" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                mainTab === t.id
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

        {!loading &&
          !seasonStarted &&
          (mainTab === "power" || mainTab === "season") && (
            <SeasonNotStartedEmpty
              className="mb-6"
              footnote="No power ranks, ATS, or streaks until football produces a scored week."
            />
          )}

        {/* —— Power Rankings tab —— */}
        {mainTab === "power" && !loading && seasonStarted && players.length > 0 && (
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
                          <PlayerLink id={player.id} name={player.name} />
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
        {mainTab === "season" && !loading && seasonStarted && players.length > 0 && (
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
                            <PlayerLink id={p.id} name={p.name} />
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

        {/* —— League lore cards —— */}
        {mainTab === "lore" && !loading && players.length > 0 && (
          <>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Pride, heaters, and hardware — one glance. Empty cards stay hidden
              until the season (or Trophy Room) has something to brag about.
            </p>
            {loreCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-12 text-center">
      <div className="text-3xl mb-2" aria-hidden>
                  🏆🔥
                </div>
      <p className="text-sm font-medium">No lore yet</p>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Score a couple weeks for streaks and jumps. Engrave a
                  Championship in the Trophy Room for rings and a defending
                  champ.
                </p>
      </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loreCards.map((card) => {
                  const tone = LORE_TONE[card.tone];
                  const mine = isSelfPlayer(card.userId, selfId);
                  return (
                    <div
                      key={card.id}
                      className={`rounded-xl border bg-card p-4 ${tone.border} ${tone.glow} ${
                        mine ? "ring-1 ring-inset ring-primary/30" : ""
                      }`}
                    >
      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-2xl" aria-hidden>
                          {card.emoji}
                        </div>
      <div
                          className={`text-lg font-bold font-mono ${tone.stat}`}
                        >
                          {card.stat}
                        </div>
      </div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
                        {card.title}
                      </p>
      <p className={selfNameClass(mine, "text-base font-bold")}>
                        <PlayerLink id={card.userId} name={card.name} />
                        {mine && <YouBadge />}
                      </p>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">
                        {card.blurb}
                      </p>
      </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted mt-6 leading-relaxed">
              More boards later (underdogs, SEC, heartbreak) once the data is
              clean. Rings &amp; defending champ need Trophy Room engravings.
            </p>
          </>
        )}
      </main>
      </div>
  );
}
