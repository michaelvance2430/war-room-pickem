"use client";

/**
 * Standings — competitive columns only after an official scored week.
 * Constitution: never invent achievement.
 */

import { useState, useEffect, Fragment } from "react";
import SwingBadge from "@/components/SwingBadge";
import CrownAndShame from "@/components/CrownAndShame";
import SeasonNotStartedEmpty from "@/components/SeasonNotStartedEmpty";
import { loadLeaguePlayers } from "@/lib/cloud";
import { pageLoad } from "@/lib/smooth";
import { getSession, getLeague } from "@/lib/league";
import { rankPlayersWithSwings } from "@/lib/fun-board";
import { compareForSeed } from "@/lib/brackets";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { standingsHardwareFlair } from "@/lib/profile-hardware";
import { Division, Player } from "@/lib/types";
import { divisionTabLabel } from "@/lib/divisions";
import {
  formatLeaguePulse,
  lastSeenToneClass,
} from "@/lib/last-seen";
import { hasOfficialScoredWeek } from "@/lib/season-scored";

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
  const [loading, setLoading] = useState(true);
  const [seasonStarted, setSeasonStarted] = useState(false);
  const [swingById, setSwingById] = useState<
    Record<string, ReturnType<typeof rankPlayersWithSwings>[0]["swing"]>
  >({});
  const [selfId, setSelfId] = useState<string | null>(null);
  const [active, setActive] = useState<Division | "Overall">("Overall");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const t0 = performance.now();
      const mark = (label: string, extra?: string) => {
        try {
          if (
            process.env.NODE_ENV === "development" ||
            localStorage.getItem("warroom-runtime-debug") === "1"
          ) {
            console.log(
              `[WR-PERF][standings] ${label} +${Math.round(performance.now() - t0)}ms`,
              extra || ""
            );
          }
          performance.mark(`wr-standings:${label}`);
        } catch {
          /* ok */
        }
      };
      mark("effect-start");
      const sid = getSession()?.playerId || null;
      setSelfId(sid);
      if (sid) {
        try {
          const { markEngagement } = await import("@/lib/engagement");
          markEngagement(sid, "opened_standings");
        } catch {
          /* ignore */
        }
      }
      const failSafe = window.setTimeout(() => {
        if (!cancelled) {
          mark("failSafe-3.5s-clear-loading");
          setLoading(false);
        }
      }, 3_500);
      try {
        const scored = await hasOfficialScoredWeek();
        if (cancelled) return;
        setSeasonStarted(scored);

        mark("loadLeaguePlayers-start");
        const list = await pageLoad(loadLeaguePlayers(), []);
        mark(
          "loadLeaguePlayers-done",
          `n=${Array.isArray(list) ? list.length : 0} scored=${scored}`
        );
        if (cancelled) return;
        setPlayers(Array.isArray(list) ? list : []);

        if (scored) {
          try {
            const ranked = rankPlayersWithSwings(
              Array.isArray(list) ? list : [],
              getLeague()?.sportId
            );
            const map: Record<string, (typeof ranked)[0]["swing"]> = {};
            for (const r of ranked) map[r.id] = r.swing;
            setSwingById(map);
            mark("swing-calc-done");
          } catch {
            setSwingById({});
          }
        } else {
          setSwingById({});
        }
      } catch {
        if (!cancelled) setPlayers([]);
        mark("load-error");
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
        mark("loading-false-interactive");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    active === "Overall"
      ? [...players].sort((a, b) => a.name.localeCompare(b.name))
      : players
          .filter((p) => p.division === active)
          .sort((a, b) => a.name.localeCompare(b.name));

  const competitive = seasonStarted
    ? active === "Overall"
      ? [...players].sort(compareForSeed)
      : players
          .filter((p) => p.division === active)
          .sort(compareForSeed)
    : filtered;

  const cutIndex =
    seasonStarted && active !== "Overall"
      ? Math.floor(competitive.length / 2)
      : -1;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Standings</h1>
          <p className="text-sm text-muted">
            {seasonStarted
              ? "Live points · Bottom 50% of each division gets flushed · Swing labels after each scored week"
              : "No standings until the first week is scored. Right now everybody is undefeated."}
          </p>
          {seasonStarted && (
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              Under each name: league pulse (online / last seen). Color is for
              scanning only — is the room alive?
            </p>
          )}
        </div>

        {loading && (
          <div className="mb-6 rounded-xl border border-border bg-card/50 px-4 py-8 text-center">
            <p className="font-medium mb-1 text-muted">Loading the board…</p>
            <p className="text-sm text-muted">Pulling live standings.</p>
          </div>
        )}

        {!loading && !seasonStarted && (
          <div className="mb-6">
            <SeasonNotStartedEmpty />
          </div>
        )}

        {!loading && !seasonStarted && players.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
              Room · {players.length} joined
            </p>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium">
                      Player
                    </th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium">
                      Division
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((player) => {
                    const pulse = formatLeaguePulse(player.lastSeenAt);
                    return (
                    <tr
                      key={player.id}
                      className={selfRowClass(
                        isSelfPlayer(player.id, selfId),
                        "border-t border-border hover:bg-card-hover transition"
                      )}
                    >
                      <td className="px-3 sm:px-4 py-3.5 font-medium">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span
                            className={selfNameClass(
                              isSelfPlayer(player.id, selfId)
                            )}
                          >
                            <PlayerLink id={player.id} name={player.name} />
                            {isSelfPlayer(player.id, selfId) && <YouBadge />}
                          </span>
                          <span
                            className={`text-[11px] inline-flex items-center gap-1 ${lastSeenToneClass(player.lastSeenAt)}`}
                          >
                            <span aria-hidden>
                              {pulse.online ? "🟢" : "○"}
                            </span>
                            {pulse.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3.5 text-muted text-xs sm:text-sm">
                        {divisionTabLabel(
                          player.division,
                          getLeague()?.sportId
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted mt-2 leading-relaxed">
              Competitive ranks, points, ATS, and streaks light up after the
              first week is scored.
            </p>
          </div>
        )}

        {/* Always mount Crown/Shame: empty state when no official score; never fake pts */}
        {!loading && (
          <CrownAndShame className="mb-6" players={players} />
        )}

        {!loading && players.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
            <p className="font-medium mb-1">Nobody on the board yet</p>
            <p className="text-sm text-muted">
              Share the league invite code. When friends join, they show up
              here.
            </p>
          </div>
        )}

        {!loading && seasonStarted && players.length > 0 && (
          <>
            <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible mb-5">
              {divisions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActive(d)}
                  className={`px-4 py-2.5 min-h-[44px] rounded-full text-sm font-semibold transition touch-manipulation ${
                    active === d
                      ? "bg-primary text-black"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {divisionTabLabel(d, getLeague()?.sportId)}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium">#</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium">
                      Player
                    </th>
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
                  {competitive.map((player, idx) => (
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
                        <td className="px-3 sm:px-4 py-3.5 text-muted align-middle">
                          {idx + 1}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 font-medium align-middle">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className={selfNameClass(
                                isSelfPlayer(player.id, selfId)
                              )}
                            >
                              <PlayerLink id={player.id} name={player.name} />
                              {standingsHardwareFlair(player.name).map((f) => (
                                <span
                                  key={f.title}
                                  className="ml-1 inline-block text-sm align-middle"
                                  title={f.title}
                                  aria-label={f.title}
                                >
                                  {f.emoji}
                                </span>
                              ))}
                              {isSelfPlayer(player.id, selfId) && <YouBadge />}
                            </span>
                            {(() => {
                              const pulse = formatLeaguePulse(
                                player.lastSeenAt
                              );
                              return (
                                <span
                                  className={`text-[11px] inline-flex items-center gap-1 ${lastSeenToneClass(player.lastSeenAt)}`}
                                >
                                  <span aria-hidden>
                                    {pulse.online ? "🟢" : "○"}
                                  </span>
                                  {pulse.label}
                                </span>
                              );
                            })()}
                            {swingById[player.id] && (
                              <span className="md:hidden">
                                <SwingBadge swing={swingById[player.id]} />
                              </span>
                            )}
                          </div>
                        </td>
                        {active === "Overall" && (
                          <td className="px-3 sm:px-4 py-3.5 text-muted align-middle text-xs sm:text-sm">
                            {divisionTabLabel(
                              player.division,
                              getLeague()?.sportId
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3.5 hidden md:table-cell align-middle">
                          {swingById[player.id] ? (
                            <SwingBadge swing={swingById[player.id]} />
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 text-right font-semibold align-middle text-base">
                          {player.totalPoints}
                        </td>
                        <td className="px-4 py-3.5 text-right text-muted hidden sm:table-cell align-middle">
                          {atsPct(player)}
                        </td>
                        <td className="px-3 sm:px-4 py-3.5 text-right align-middle">
                          {streakDisplay(player.currentStreak)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
