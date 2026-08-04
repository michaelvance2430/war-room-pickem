"use client";

/**
 * Standings — two jobs:
 *  1. League pulse (always): who's in the room, divisions, last seen, joined.
 *  2. Competition (after official scored week): PTS, ATS, streak, swing, cut.
 *
 * Never invent achievement. Preseason practice scores do not unlock competition.
 * Removing competitive columns must never empty the room.
 */

import { useState, useEffect, Fragment, useMemo } from "react";
import SwingBadge from "@/components/SwingBadge";
import CrownAndShame from "@/components/CrownAndShame";
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
  touchLastSeen,
} from "@/lib/last-seen";
import { hydratePlayersLastSeen } from "@/lib/cloud";
import { hasCompetitiveAchievementData } from "@/lib/season-scored";
import { markStandingsWarm } from "@/lib/profile-nav-trace";
import { isProductionMode } from "@/lib/league-mode";
import { MAX_LEAGUE_PLAYERS } from "@/lib/league-limits";

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

/** Compact joined date for pulse column */
function formatJoined(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Pulse sort: online → recent → alpha (room vitality, not standings) */
function compareForPulse(a: Player, b: Player): number {
  const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
  const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
  if (tb !== ta) return tb - ta;
  return a.name.localeCompare(b.name);
}

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  /** Competitive crown/PTS table — production + official scores only */
  const [seasonStarted, setSeasonStarted] = useState(false);
  const [preseasonPractice, setPreseasonPractice] = useState(false);
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
        // Presence: mark activity when opening Standings (meaningful open, not a hidden tab)
        void touchLastSeen();
      }
      const failSafe = window.setTimeout(() => {
        if (!cancelled) {
          mark("failSafe-3.5s-clear-loading");
          setLoading(false);
        }
      }, 3_500);
      try {
        // Competitive UI only in production reality — preseason scores stay theater
        const competitive = await hasCompetitiveAchievementData();
        if (cancelled) return;
        setSeasonStarted(competitive);
        setPreseasonPractice(!isProductionMode());

        mark("loadLeaguePlayers-start");
        const list = await pageLoad(
          loadLeaguePlayers("StandingsPage.load"),
          []
        );
        mark(
          "loadLeaguePlayers-done",
          `n=${Array.isArray(list) ? list.length : 0} competitive=${competitive}`
        );
        if (cancelled) return;
        setPlayers(Array.isArray(list) ? list : []);

        // Fix: was `scored` (undefined) → ReferenceError wiped roster in catch
        if (competitive) {
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
        // Do not clear an already-loaded roster on partial failures
        mark("load-error");
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
        mark("loading-false-interactive");
        markStandingsWarm();
      }
    }
    load();

    // Live presence: stay Online now while this tab is open; refresh others' pulse
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void touchLastSeen();
      setPlayers((prev) => {
        if (!prev.length) return prev;
        void hydratePlayersLastSeen(prev).then((next) => {
          if (!cancelled) setPlayers(next);
        });
        return prev;
      });
    }, 40_000);

    function onVis() {
      if (document.visibilityState === "visible") {
        void touchLastSeen();
        setPlayers((prev) => {
          if (!prev.length) return prev;
          void hydratePlayersLastSeen(prev).then((next) => {
            if (!cancelled) setPlayers(next);
          });
          return prev;
        });
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const pulseStats = useMemo(() => {
    const humans = players.filter((p) => !p.isMock);
    const roster = humans.length > 0 ? humans : players;
    let online = 0;
    let seenRecently = 0; // within 24h
    const now = Date.now();
    for (const p of roster) {
      const pulse = formatLeaguePulse(p.lastSeenAt, now);
      if (pulse.online) online += 1;
      if (p.lastSeenAt) {
        const t = new Date(p.lastSeenAt).getTime();
        if (!Number.isNaN(t) && now - t < 24 * 60 * 60 * 1000) {
          seenRecently += 1;
        }
      }
    }
    return {
      joined: players.length,
      humans: humans.length,
      online,
      seenRecently,
      seatsLeft: Math.max(0, MAX_LEAGUE_PLAYERS - players.length),
    };
  }, [players]);

  const pulseRows =
    active === "Overall"
      ? [...players].sort(compareForPulse)
      : players
          .filter((p) => p.division === active)
          .sort(compareForPulse);

  const competitiveRows = seasonStarted
    ? active === "Overall"
      ? [...players].sort(compareForSeed)
      : players
          .filter((p) => p.division === active)
          .sort(compareForSeed)
    : pulseRows;

  const cutIndex =
    seasonStarted && active !== "Overall"
      ? Math.floor(competitiveRows.length / 2)
      : -1;

  const sportId = getLeague()?.sportId;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Standings</h1>
          <p className="text-sm text-muted">
            {seasonStarted
              ? "League pulse + live competition · Bottom 50% of each division gets flushed · Swing after each scored week"
              : "League pulse — who’s in the room. Competition lights up after the first scored week."}
          </p>
          {preseasonPractice && !seasonStarted && (
            <p className="text-xs text-amber-200/90 mt-1.5 leading-relaxed">
              Practice cards and scores are theater. Crowns, points, and ranks
              wait for the real season — the room stays visible either way.
            </p>
          )}
          {players.length > 0 && (
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              <span className="text-primary font-medium">
                Tap a green name → open their profile
              </span>
              {!seasonStarted
                ? " · PTS, ATS, Crown, and Shame stay off until Week 1 is scored."
                : " · Under each name: online / last seen."}
            </p>
          )}
        </div>

        {loading && (
          <div className="mb-6 rounded-xl border border-border bg-card/50 px-4 py-8 text-center">
            <p className="font-medium mb-1 text-muted">Loading the room…</p>
            <p className="text-sm text-muted">Pulling the league pulse.</p>
          </div>
        )}

        {/* ── League pulse hero (always when people exist) ── */}
        {!loading && players.length > 0 && (
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
                Joined
              </p>
              <p className="text-lg font-black text-foreground tabular-nums">
                {pulseStats.joined}
                <span className="text-sm font-semibold text-muted">
                  {" "}
                  / {MAX_LEAGUE_PLAYERS}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
                Online now
              </p>
              <p className="text-lg font-black text-emerald-400 tabular-nums">
                {pulseStats.online}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
                Active today
              </p>
              <p className="text-lg font-black text-foreground tabular-nums">
                {pulseStats.seenRecently}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
                Seats left
              </p>
              <p className="text-lg font-black text-foreground tabular-nums">
                {pulseStats.seatsLeft}
              </p>
            </div>
          </div>
        )}

        {/* Competition chrome only after official score */}
        {!loading && seasonStarted && (
          <CrownAndShame className="mb-6" players={players} />
        )}

        {/* Preseason: compact note that competition is waiting — not an empty room */}
        {!loading && !seasonStarted && players.length > 0 && (
          <div className="mb-5 rounded-xl border border-dashed border-border bg-card/40 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Season competition starts after the first scored week
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              PTS · ATS% · Streak · Crown · Wall of Shame · Swing stay off so
              preseason never looks competitive. The roster below is the pulse
              of the room.
            </p>
          </div>
        )}

        {!loading && players.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
            <p className="font-medium mb-1">Nobody in the room yet</p>
            <p className="text-sm text-muted">
              Share the league invite code. When friends join, they show up
              here — long before anyone has points.
            </p>
          </div>
        )}

        {!loading && players.length > 0 && (
          <>
            <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible mb-4">
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
                  {divisionTabLabel(d, sportId)}
                </button>
              ))}
            </div>

            {!seasonStarted ? (
              /* ── Pulse table: people first, no fake competition ── */
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
                  Room pulse · {pulseRows.length}
                  {active !== "Overall" ? ` in ${active}` : " members"}
                </p>
                <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium">
                          Player
                        </th>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium">
                          Division
                        </th>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium">
                          Last seen
                        </th>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">
                          Joined
                        </th>
                        <th className="text-right px-3 sm:px-4 py-3 font-medium text-muted/70">
                          Season
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pulseRows.map((player) => {
                        const pulse = formatLeaguePulse(player.lastSeenAt);
                        const showPulse = !player.isMock;
                        return (
                          <tr
                            key={player.id}
                            className={selfRowClass(
                              isSelfPlayer(player.id, selfId),
                              "border-t border-border hover:bg-card-hover transition"
                            )}
                          >
                            <td className="px-3 sm:px-4 py-3.5 font-medium">
                              <span
                                className={selfNameClass(
                                  isSelfPlayer(player.id, selfId)
                                )}
                              >
                                <PlayerLink id={player.id} name={player.name} />
                                {isSelfPlayer(player.id, selfId) && (
                                  <YouBadge />
                                )}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3.5 text-muted text-xs sm:text-sm">
                              {divisionTabLabel(player.division, sportId)}
                            </td>
                            <td className="px-3 sm:px-4 py-3.5">
                              {showPulse ? (
                                <span
                                  className={`text-xs sm:text-sm inline-flex items-center gap-1 ${lastSeenToneClass(player.lastSeenAt)}`}
                                >
                                  <span aria-hidden>
                                    {pulse.online ? "🟢" : "○"}
                                  </span>
                                  {pulse.label}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">Bot</span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3.5 text-muted text-xs hidden sm:table-cell">
                              {formatJoined(player.memberSince)}
                            </td>
                            <td className="px-3 sm:px-4 py-3.5 text-right text-[11px] text-muted/70">
                              Week 1
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted mt-2 leading-relaxed">
                  Sorted by recent activity. Competitive ranks, points, ATS, and
                  streaks unlock after the first week is scored.
                </p>
              </div>
            ) : (
              /* ── Competitive table ── */
              <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 sm:px-4 py-3 font-medium">
                        #
                      </th>
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
                      <th className="text-right px-4 py-3 font-medium">
                        Streak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitiveRows.map((player, idx) => (
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
                                <PlayerLink
                                  id={player.id}
                                  name={player.name}
                                />
                                {standingsHardwareFlair(player.name).map(
                                  (f) => (
                                    <span
                                      key={f.title}
                                      className="ml-1 inline-block text-sm align-middle"
                                      title={f.title}
                                      aria-label={f.title}
                                    >
                                      {f.emoji}
                                    </span>
                                  )
                                )}
                                {isSelfPlayer(player.id, selfId) && (
                                  <YouBadge />
                                )}
                              </span>
                              {!player.isMock &&
                                (() => {
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
                              {divisionTabLabel(player.division, sportId)}
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
