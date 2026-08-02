"use client";

import { useState, useEffect, Fragment } from "react";
import dynamic from "next/dynamic";
import SwingBadge from "@/components/SwingBadge";
import { loadLeaguePlayers } from "@/lib/cloud";
import { pageLoad } from "@/lib/smooth";

const CrownAndShame = dynamic(() => import("@/components/CrownAndShame"), {
  ssr: false,
});
import { getSession, getLeague } from "@/lib/league";
import { rankPlayersWithSwings } from "@/lib/fun-board";
import { compareForSeed } from "@/lib/brackets";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { standingsHardwareFlair } from "@/lib/profile-hardware";
import { Division, Player } from "@/lib/types";
import { divisionTabLabel } from "@/lib/divisions";
import { formatLastSeen, lastSeenToneClass } from "@/lib/last-seen";

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

const TIP_KEY = "warroom-tip-tap-names-v1";

export default function StandingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [swingById, setSwingById] = useState<
    Record<string, ReturnType<typeof rankPlayersWithSwings>[0]["swing"]>
  >({});
  const [selfId, setSelfId] = useState<string | null>(null);
  const [active, setActive] = useState<Division | "Overall">("Overall");
  const [showNameTip, setShowNameTip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
      // Fail-safe: never leave standings stuck on spinner if cloud hangs
      const failSafe = window.setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 3_500);
      try {
        const list = await pageLoad(loadLeaguePlayers(), []);
        if (cancelled) return;
        setPlayers(list);
        const ranked = rankPlayersWithSwings(list, getLeague()?.sportId);
        const map: Record<string, (typeof ranked)[0]["swing"]> = {};
        for (const r of ranked) map[r.id] = r.swing;
        setSwingById(map);
      } catch {
        /* offline / cloud — leave empty after loading clears */
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    try {
      if (localStorage.getItem(TIP_KEY) !== "1") setShowNameTip(true);
    } catch {
      setShowNameTip(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    active === "Overall"
      ? [...players].sort(compareForSeed)
      : players
          .filter((p) => p.division === active)
          .sort(compareForSeed);

  const cutIndex = active !== "Overall" ? Math.floor(filtered.length / 2) : -1;
  const anyScored = players.some(
    (p) => p.totalPoints > 0 || (p.weeklyPoints?.length || 0) > 0
  );
  const preseason = players.length > 0 && !anyScored;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-6">
      <h1 className="text-2xl font-bold">Standings</h1>
      <p className="text-sm text-muted">
            {preseason
              ? "No weeks scored yet — everyone is tied at zero until the first card is locked and scored."
              : "Live points · Bottom 50% of each division gets flushed · Swing labels after each scored week"}
          </p>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">
            <span className="text-primary font-medium">Last in</span> = how
            recently they opened the app (same on CFB and NFL rooms). Works on
            phone via the <strong className="text-foreground">Table</strong>{" "}
            tab.
          </p>
      <p className="text-xs text-primary/90 mt-1 font-medium">
            Tap a green name → open their profile (badges &amp; trophies).
          </p>
          {showNameTip && (
            <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 flex items-start justify-between gap-2">
      <p className="text-xs text-foreground leading-relaxed">
                <strong className="text-primary">Tip:</strong> Names in{" "}
                <span className="font-semibold text-primary underline decoration-2">
                  green
                </span>{" "}
                are links. Tap anyone to roast their trophy case.
              </p>
      <button
                type="button"
                onClick={() => {
                  setShowNameTip(false);
                  try {
                    localStorage.setItem(TIP_KEY, "1");
                  } catch {
                    /* ignore */
                  }
                }}
                className="shrink-0 text-[11px] text-muted hover:text-foreground px-1"
              >
                Got it
              </button>
      </div>
          )}
        </div>

        {preseason && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              Preseason board
            </p>
      <p className="text-sm text-foreground leading-relaxed">
              This isn&apos;t broken — the season hasn&apos;t posted points yet.
              Names, divisions, and hardware flair are live. Points and swing
              labels light up after the commissioner scores week one.{" "}
              <span className="text-muted">
                Go lock picks when the card is published.
              </span>
      </p>
          </div>
        )}

        {!loading && !preseason && (
          <CrownAndShame className="mb-6" players={players} />
        )}

        {loading && (
          <div className="mb-6 rounded-xl border border-border bg-card/50 px-4 py-8 text-center">
      <p className="font-medium mb-1 text-muted">Loading the board…</p>
      <p className="text-sm text-muted">Pulling live standings.</p>
      </div>
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

        <p className="text-[11px] text-muted mb-3 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-foreground/80">Last in</span>
      <span className="inline-flex items-center gap-1">
            <span className="text-emerald-400 font-bold">●</span> ≤6h
          </span>
      <span className="inline-flex items-center gap-1">
            <span className="text-amber-400 font-bold">●</span> 6–18h
          </span>
      <span className="inline-flex items-center gap-1">
            <span className="text-red-400 font-bold">●</span> 18h+
          </span>
      </p>

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
      <th className="text-right px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">
                  Last in
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
                        colSpan={active === "Overall" ? 8 : 7}
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
                      <div className="flex flex-col gap-1 min-w-0">
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
                        {/* Phone: last-in under the name */}
                        <span
                          className={`text-[11px] sm:hidden ${lastSeenToneClass(player.lastSeenAt)}`}
                          title={
                            player.lastSeenAt
                              ? `Last in: ${new Date(player.lastSeenAt).toLocaleString()}`
                              : "Not seen in the app yet"
                          }
                        >
                          {formatLastSeen(player.lastSeenAt)}
                        </span>
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
      <td
                      className={`px-3 sm:px-4 py-3.5 text-right align-middle text-xs hidden sm:table-cell ${lastSeenToneClass(player.lastSeenAt)}`}
                      title={
                        player.lastSeenAt
                          ? `Last in: ${new Date(player.lastSeenAt).toLocaleString()}`
                          : "Not seen in the app yet"
                      }
                    >
                      {formatLastSeen(player.lastSeenAt)}
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
      </main>
    </div>
  );
}
