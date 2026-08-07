"use client";

/**
 * Standings — same page; heartbeat evolves with the league:
 *  preseason  → room pulse (joined / online / seats)
 *  regular    → competition pulse (crown / streak / locks)
 *  offseason  → legacy pulse (champ / seasons / next open)
 *
 * Never invent achievement. Preseason practice scores do not unlock competition.
 * Removing competitive columns must never empty the room.
 */

import { useState, useEffect, Fragment, useMemo } from "react";
import SwingBadge from "@/components/SwingBadge";
import CrownAndShame from "@/components/CrownAndShame";
import {
  countLockedPicksForWeek,
  hydratePlayersLastSeen,
  loadLeaguePlayers,
} from "@/lib/cloud";
import { pageLoad } from "@/lib/smooth";
import { getSession, getLeague } from "@/lib/league";
import { rankPlayersWithSwings } from "@/lib/fun-board";
import { compareForSeed, seedChampionship } from "@/lib/brackets";
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
import { hasCompetitiveAchievementData } from "@/lib/season-scored";
import { markStandingsWarm } from "@/lib/profile-nav-trace";
import { isProductionMode } from "@/lib/league-mode";
import {
  buildStandingsPulseCards,
  resolveStandingsPulsePhase,
  standingsPulsePhaseCopy,
  type StandingsPulseCard,
  type StandingsPulsePhase,
} from "@/lib/standings-pulse";

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
  const [pulsePhase, setPulsePhase] =
    useState<StandingsPulsePhase>("preseason");
  const [picksLocked, setPicksLocked] = useState<{
    locked: number;
    expected: number;
  } | null>(null);
  const [defendingChamp, setDefendingChamp] = useState<{
    name: string;
    userId?: string | null;
  } | null>(null);
  const [seasonsPlayed, setSeasonsPlayed] = useState<number | null>(null);
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
      // Direct links can arrive before the local room session is hydrated.
      // Restore it before rendering a fake empty league.
      if (!getSession()?.leagueId) {
        try {
          const { restoreSessionFromCloud } = await import(
            "@/lib/session-restore"
          );
          const restored = await restoreSessionFromCloud();
          if (cancelled) return;
          if (restored.status === "no_auth") {
            window.location.replace("/login");
            return;
          }
          if (restored.status === "no_leagues") {
            window.location.replace("/join");
            return;
          }
          if (restored.status === "pick_league") {
            window.location.replace("/");
            return;
          }
          if (restored.status === "network_error") {
            throw new Error("Could not restore league session");
          }
        } catch {
          // Home owns the retry UI and can distinguish auth from network state.
          window.location.replace("/");
          return;
        }
      }
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
        const competitive = await hasCompetitiveAchievementData({
          allowFoundryDisplay: true,
        });
        if (cancelled) return;
        setSeasonStarted(competitive);
        setPreseasonPractice(!isProductionMode());

        let latestScored: number | null = null;
        let liveWeek: number | null = null;
        try {
          const { loadLeagueTruth } = await import("@/lib/league-truth");
          const truth = await loadLeagueTruth();
          latestScored = truth.latestScoredWeek;
          liveWeek = truth.trustedLiveWeek;
        } catch {
          /* phase falls back to competitive gate only */
        }
        const sport = getLeague()?.sportId;
        const phase = resolveStandingsPulsePhase({
          seasonHasOfficialScore: competitive,
          latestScoredWeek: latestScored,
          sportId: sport,
        });
        if (cancelled) return;
        setPulsePhase(phase);

        mark("loadLeaguePlayers-start");
        const list = await pageLoad(
          loadLeaguePlayers("StandingsPage.load"),
          []
        );
        mark(
          "loadLeaguePlayers-done",
          `n=${Array.isArray(list) ? list.length : 0} phase=${phase}`
        );
        if (cancelled) return;
        setPlayers(Array.isArray(list) ? list : []);

        // Regular-season pulse: pick lock counts (privacy-safe)
        if (phase === "regular" && liveWeek != null) {
          try {
            const locks = await countLockedPicksForWeek(liveWeek);
            if (!cancelled) setPicksLocked(locks);
          } catch {
            if (!cancelled) setPicksLocked(null);
          }
        } else {
          setPicksLocked(null);
        }

        // Offseason / legacy: trophies
        if (phase === "offseason" || phase === "regular") {
          try {
            const { loadLeagueTrophies } = await import("@/lib/trophies");
            const trophies = await loadLeagueTrophies();
            const champs = trophies.filter((t) => t.trophyType === "championship");
            const years = new Set(trophies.map((t) => t.seasonYear));
            if (!cancelled) {
              setSeasonsPlayed(years.size || (competitive ? 1 : null));
              const top = champs[0];
              setDefendingChamp(
                top
                  ? { name: top.winnerName, userId: top.winnerUserId }
                  : null
              );
            }
          } catch {
            if (!cancelled) {
              setDefendingChamp(null);
              setSeasonsPlayed(competitive ? 1 : null);
            }
          }
        }

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

  const sportId = getLeague()?.sportId;
  const phaseCopy = standingsPulsePhaseCopy(pulsePhase);
  const pulseCards: StandingsPulseCard[] = useMemo(
    () =>
      buildStandingsPulseCards({
        phase: pulsePhase,
        players,
        sportId,
        picksLocked,
        defendingChamp,
        seasonsPlayed,
      }),
    [pulsePhase, players, sportId, picksLocked, defendingChamp, seasonsPlayed]
  );

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

  const preseasonCutIndex =
    active === "Overall" ? -1 : Math.ceil(pulseRows.length / 2);
  const championshipIds = new Set(seedChampionship(players).map((p) => p.id));
  const cutIndex =
    seasonStarted && active !== "Overall"
      ? competitiveRows.filter((p) => championshipIds.has(p.id)).length
      : -1;
  const activeConferenceLabel =
    active === "Overall" ? null : divisionTabLabel(active, sportId);

  const overallCompetitive = seasonStarted
    ? [...players].sort(compareForSeed)
    : [];
  const leader = overallCompetitive[0] || null;
  const selfOverallIndex = overallCompetitive.findIndex((p) => p.id === selfId);
  const selfOverall = selfOverallIndex >= 0 ? overallCompetitive[selfOverallIndex] : null;
  const pointsBack =
    leader && selfOverall
      ? Math.max(0, leader.totalPoints - selfOverall.totalPoints)
      : null;
  const isCfb = (sportId || "cfb") === "cfb";

  return (
    <div
      className={`min-h-screen flex flex-col ${isCfb ? "cfb-standings-page" : ""}`}
      data-standings-phase={pulsePhase}
    >
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        {isCfb && (
          <section className="cfb-scoreboard-hero" aria-labelledby="standings-title">
            <div className="cfb-scoreboard-screen">
              <div className="cfb-scoreboard-topline">
                <span>War Room Stadium</span>
                <span className="cfb-scoreboard-live">
                  <i aria-hidden /> House scoreboard
                </span>
              </div>
              <div
                className="cfb-scoreboard-matchup"
                aria-label="War Room 42, Everyone Else 3. Final."
              >
                <div className="cfb-scoreboard-team cfb-scoreboard-team-home">
                  <span className="cfb-scoreboard-side">Home</span>
                  <strong>War Room</strong>
                  <b>42</b>
                </div>
                <div className="cfb-scoreboard-game-state">
                  <span>Final</span>
                  <i aria-hidden />
                  <small>We remain humble.</small>
                </div>
                <div className="cfb-scoreboard-team cfb-scoreboard-team-away">
                  <span className="cfb-scoreboard-side">Away</span>
                  <strong>Everyone Else</strong>
                  <b>03</b>
                </div>
              </div>
              <div className="cfb-scoreboard-footer">
                <span>{pulsePhase === "regular" ? "Season live" : pulsePhase}</span>
                <span>Saturday command board</span>
              </div>
            </div>
            <div className="cfb-scoreboard-title-lockup">
              <p>War Room Pick&apos;Em</p>
              <h1 id="standings-title">Standings</h1>
            </div>
          </section>
        )}

        {isCfb && (
          <section className="cfb-command-strip" aria-label="Standings snapshot">
            {seasonStarted && selfOverall ? (
              <>
                <div className="cfb-command-rank">
                  <span>Your rank</span>
                  <strong>#{selfOverallIndex + 1}</strong>
                </div>
                <div className="cfb-command-copy">
                  <span>{selfOverall.name}</span>
                  <p>
                    {pointsBack === 0
                      ? "You own the board. Everybody else is chasing."
                      : `${pointsBack} point${pointsBack === 1 ? "" : "s"} behind the leader.`}
                  </p>
                </div>
                {leader && (
                  <div className="cfb-command-leader">
                    <span>Leader</span>
                    <strong><PlayerLink id={leader.id} name={leader.name} /></strong>
                    <small>{leader.totalPoints} pts</small>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="cfb-command-rank">
                  <span>Status</span>
                  <strong>PRE</strong>
                </div>
                <div className="cfb-command-copy">
                  <span>Room systems online</span>
                  <p>Activity board below. Competition wakes with Week 1.</p>
                </div>
                <div className="cfb-command-status">
                  <i aria-hidden />
                  <span>{loading ? "Loading" : "Ready"}</span>
                </div>
              </>
            )}
          </section>
        )}

        <div className={`mb-6 ${isCfb ? "cfb-standings-intro" : ""}`}>
          {!isCfb && <h1 className="text-2xl font-bold">Standings</h1>}
          <p className="text-sm text-muted">{phaseCopy.headline}</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {phaseCopy.subline}
          </p>
          {preseasonPractice && pulsePhase === "preseason" && !isCfb && (
            <p className="text-xs text-amber-200/90 mt-1.5 leading-relaxed">
              Practice cards and scores are theater. Crowns, points, and ranks
              wait for the real season — the room stays visible either way.
            </p>
          )}
          {players.length > 0 && !isCfb && (
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              <span className="text-primary font-medium">
                Tap a green name → open their profile
              </span>
              {pulsePhase === "preseason"
                ? " · PTS, ATS, Crown, and Shame stay off until Week 1 is scored."
                : pulsePhase === "regular"
                  ? " · Bottom 50% of each division gets flushed · swing after each scored week."
                  : " · History on the board. Next season starts when the doors open."}
            </p>
          )}
        </div>

        {loading && (
          <div className="mb-6 rounded-xl border border-border bg-card/50 px-4 py-8 text-center">
            <p className="font-medium mb-1 text-muted">Loading the room…</p>
            <p className="text-sm text-muted">Pulling the league pulse.</p>
          </div>
        )}

        {/* ── Evolving pulse hero — same slots, different season ── */}
        {!loading && players.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
              {pulsePhase === "preseason"
                ? "Room pulse"
                : pulsePhase === "regular"
                  ? "Competition pulse"
                  : "Legacy pulse"}
            </p>
            <div className="cfb-pulse-grid grid grid-cols-2 sm:grid-cols-4 gap-2">
              {pulseCards.map((card) => (
                <div
                  key={card.key}
                  className="cfb-pulse-card rounded-xl border border-border bg-card px-3 py-2.5 min-h-[4.5rem]"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
                    {card.label}
                  </p>
                  <p
                    className={`text-lg font-black tabular-nums mt-0.5 ${
                      card.valueClass || "text-foreground"
                    }`}
                  >
                    {card.playerId ? (
                      <PlayerLink id={card.playerId} name={card.value} />
                    ) : (
                      card.value
                    )}
                    {card.sub && card.key === "joined" ? (
                      <span className="text-sm font-semibold text-muted">
                        {" "}
                        {card.sub}
                      </span>
                    ) : null}
                  </p>
                  {card.sub && card.key !== "joined" ? (
                    <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">
                      {card.sub}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competition chrome only during live season */}
        {!loading && seasonStarted && pulsePhase === "regular" && (
          <CrownAndShame className="mb-6" players={players} />
        )}

        {!loading && pulsePhase === "offseason" && players.length > 0 && (
          <div className="mb-5 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Season complete — ranks are history
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              The table below is the final board. Hardware lives in the Trophy
              Room. Next chapter when the doors open.
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
            <div className="cfb-division-tabs phone-h-scroll sm:flex-wrap sm:overflow-visible mb-4">
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
                <div className="cfb-rank-board rounded-xl border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-card text-muted text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium">
                          Player
                        </th>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium">
                          Division
                        </th>
                        <th className="text-left px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">
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
                      {pulseRows.map((player, idx) => {
                        const pulse = formatLeaguePulse(player.lastSeenAt);
                        const showPulse = !player.isMock;
                        return (
                          <Fragment key={player.id}>
                          {idx === preseasonCutIndex && (
                            <tr
                              className="cfb-cut-line is-preseason"
                              aria-label="Conference advancement boundary. Top three advance when competitive standings begin."
                            >
                              <td colSpan={5} className="px-3 py-0">
                                <div className="cfb-cut-line-inner">
                                  <span aria-hidden>▼</span>
                                  <div>
                                    <strong>{activeConferenceLabel} Cut Line</strong>
                                    <small>Top half advance · Rankings activate after Week 1</small>
                                  </div>
                                  <span aria-hidden>▼</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
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
                                {isSelfPlayer(player.id, selfId) && (
                                  <YouBadge />
                                )}
                              </span>
                              <span
                                className={`sm:hidden mt-0.5 text-[11px] font-normal flex items-center gap-1 ${
                                  showPulse
                                    ? lastSeenToneClass(player.lastSeenAt)
                                    : "text-muted"
                                }`}
                              >
                                <span aria-hidden>
                                  {showPulse ? (pulse.online ? "🟢" : "○") : "•"}
                                </span>
                                {showPulse ? pulse.label : "Bot"}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3.5 text-muted text-xs sm:text-sm">
                              {divisionTabLabel(player.division, sportId)}
                            </td>
                            <td className="px-3 sm:px-4 py-3.5 hidden sm:table-cell">
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
                          </Fragment>
                        );
                      })}
                      {active !== "Overall" && preseasonCutIndex >= pulseRows.length && (
                        <tr
                          className="cfb-cut-line is-preseason"
                          aria-label="Conference advancement boundary. Top three advance when competitive standings begin."
                        >
                          <td colSpan={5} className="px-3 py-0">
                            <div className="cfb-cut-line-inner">
                              <span aria-hidden>▼</span>
                              <div>
                                <strong>{activeConferenceLabel} Cut Line</strong>
                                <small>Top half advance · Rankings activate after Week 1</small>
                              </div>
                              <span aria-hidden>▼</span>
                            </div>
                          </td>
                        </tr>
                      )}
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
              <div className="cfb-rank-board rounded-xl border border-border overflow-hidden overflow-x-auto">
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
                          <tr
                            className="cfb-cut-line"
                            aria-label="Playoff cut. Top three advance; players below enter the Toilet Bowl."
                          >
                            <td
                              colSpan={active === "Overall" ? 7 : 6}
                              className="px-3 py-0"
                            >
                              <div className="cfb-cut-line-inner">
                                <span aria-hidden>▼</span>
                                <div>
                                  <strong>
                                    {activeConferenceLabel} Survival Line
                                  </strong>
                                  <small>Above advances · Below gets flushed</small>
                                </div>
                                <span aria-hidden>▼</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr
                          className={selfRowClass(
                            isSelfPlayer(player.id, selfId),
                            `cfb-rank-row border-t border-border hover:bg-card-hover transition ${
                              idx < 3 ? `cfb-rank-row-top cfb-rank-row-${idx + 1}` : ""
                            } ${
                              cutIndex >= 0 &&
                              idx >= cutIndex &&
                              !isSelfPlayer(player.id, selfId)
                                ? "opacity-60"
                                : ""
                            }`
                          )}
                        >
                          <td className="px-3 sm:px-4 py-3.5 text-muted align-middle">
                            <span className="cfb-rank-number">
                              {idx === 0 ? "♛" : idx + 1}
                            </span>
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
                    {active !== "Overall" && cutIndex >= competitiveRows.length && (
                      <tr
                        className="cfb-cut-line"
                        aria-label="Playoff cut. Top three advance; players below enter the Toilet Bowl."
                      >
                        <td colSpan={6} className="px-3 py-0">
                          <div className="cfb-cut-line-inner">
                            <span aria-hidden>▼</span>
                            <div>
                              <strong>{activeConferenceLabel} Survival Line</strong>
                              <small>Above advances · Below gets flushed</small>
                            </div>
                            <span aria-hidden>▼</span>
                          </div>
                        </td>
                      </tr>
                    )}
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
