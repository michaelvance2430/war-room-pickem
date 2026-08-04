"use client";

/**
 * Crew presence board.
 * Points / burn ranks only after an official scored week — never residue.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { loadLeaguePlayers, loadLeagueRoster } from "@/lib/cloud";
import { getSession } from "@/lib/league";
import {
  buildCrewCommitmentBoard,
  type CrewBoardRow,
} from "@/lib/crew-cheevos";
import { formatLastSeen, lastSeenToneClass } from "@/lib/last-seen";
import { hasOfficialScoredWeek } from "@/lib/season-scored";
import type { Player } from "@/lib/types";

const POLL_MS = 25_000;

type Props = {
  className?: string;
  /** Show burn ranks — ignored until a week is officially scored */
  showBurn?: boolean;
};

export default function CrewLiveBoard({
  className = "",
  showBurn = true,
}: Props) {
  const [rows, setRows] = useState<CrewBoardRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Competitive points only after real scored week */
  const [seasonScored, setSeasonScored] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const scored = await hasOfficialScoredWeek().catch(() => false);
      setSeasonScored(scored);

      const [players, roster] = await Promise.all([
        loadLeaguePlayers().catch(() => [] as Player[]),
        loadLeagueRoster().catch(() => []),
      ]);
      const lastSeenById: Record<string, string | null> = {};
      for (const m of roster) {
        if (m.userId) {
          lastSeenById[m.userId] = m.lastSeenAt ?? null;
        }
      }
      for (const p of players) {
        if (p.lastSeenAt && !lastSeenById[p.id]) {
          lastSeenById[p.id] = p.lastSeenAt;
        }
      }
      let field = players;
      if (!field.length && roster.length) {
        field = roster
          .filter((m) => !m.isBot)
          .map(
            (m) =>
              ({
                id: m.userId,
                name: m.name || "Player",
                division: "North",
                // Never seed residual points before official score
                totalPoints: scored ? m.totalPoints || 0 : 0,
                weeklyPoints: [],
                atsCorrect: 0,
                atsTotal: 0,
                currentStreak: 0,
                bestWeek: 0,
                worstWeek: 0,
                perfectWeeks: 0,
                bestBetHits: 0,
                bestBetTotal: 0,
                propHits: 0,
                propTotal: 0,
                weeksPlayed: 0,
                avatarUrl: m.avatarUrl || undefined,
                lastSeenAt: m.lastSeenAt || undefined,
              }) as Player
          );
      } else if (!scored && field.length) {
        // Strip residue season points — constitution: never invent achievement
        field = field.map((p) => ({
          ...p,
          totalPoints: 0,
          weeklyPoints: [],
          weeksPlayed: 0,
        }));
      }
      const board = buildCrewCommitmentBoard(field, {
        lastSeenById,
      });
      // Presence-first sort when no scored week (last in, then name)
      if (!scored) {
        board.sort((a, b) => {
          const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          if (bt !== at) return bt - at;
          return a.name.localeCompare(b.name);
        });
        board.forEach((r, i) => {
          r.burnRank = i + 1;
          r.totalPoints = 0;
          r.weeksPlayed = 0;
        });
      }
      setRows(board);
      setUpdatedAt(Date.now());
      setError(null);
    } catch {
      setError("Could not refresh live board");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    function onVis() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const selfId = getSession()?.playerId;
  const showPoints = showBurn && seasonScored;

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Live foxhole
          </p>
          <h2 className="text-sm font-bold text-foreground mt-0.5">
            Who&apos;s in — right now
          </h2>
        </div>
        <p className="text-[10px] text-muted tabular-nums">
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleTimeString()}`
            : "Connecting…"}
          {" · "}
          auto every {POLL_MS / 1000}s
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No roster yet.</p>
      ) : (
        <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {rows.map((r) => (
            <li
              key={r.playerId}
              className={`flex items-center gap-3 px-3 py-2.5 ${
                r.playerId === selfId ? "bg-primary/5" : ""
              }`}
            >
              {showPoints ? (
                <div className="w-7 shrink-0 text-center text-xs font-bold text-muted tabular-nums">
                  {r.burnRank}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <PlayerLink
                    id={r.playerId}
                    name={r.name}
                    className="text-sm font-semibold text-foreground truncate hover:text-primary"
                  />
                  {r.playerId === selfId && (
                    <span className="text-[10px] font-bold text-primary">
                      YOU
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] ${lastSeenToneClass(r.lastSeenAt)}`}
                  title={
                    r.lastSeenAt
                      ? new Date(r.lastSeenAt).toLocaleString()
                      : "No last-seen yet"
                  }
                >
                  Last in: {formatLastSeen(r.lastSeenAt)}
                </p>
              </div>
              {showPoints ? (
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {r.totalPoints}
                    <span className="text-[10px] font-medium text-muted ml-0.5">
                      pts
                    </span>
                  </p>
                  <p className="text-[10px] text-muted tabular-nums">
                    {r.weeksPlayed}w played
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted leading-relaxed">
        {showPoints
          ? "Live links = every name is a profile. Ranks = who is burning the most season points after a scored week. Last-in uses the same presence pulse as Standings."
          : "Presence only until a week is scored. No points, ranks, or burn board until football earns them."}
      </p>
      {showPoints ? (
        <Link href="/standings" className="text-xs font-bold text-primary">
          Full standings →
        </Link>
      ) : null}
    </section>
  );
}
