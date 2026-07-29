"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import BracketView from "@/components/BracketView";
import YouBadge from "@/components/YouBadge";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession, getLeague } from "@/lib/league";
import { seedToiletBowl, buildBracket, Bracket } from "@/lib/brackets";
import { isSelfPlayer, selfNameClass, selfRowClass } from "@/lib/self-highlight";

export default function ToiletBowlPage() {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerCount, setPlayerCount] = useState(0);
  const [fieldSize, setFieldSize] = useState(0);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [cutPercent, setCutPercent] = useState(50);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    async function load() {
      setSelfId(getSession()?.playerId || null);
      const league = getLeague();
      setLeagueName(league?.name || "");
      const cut = league?.settings?.cutPercent ?? 50;
      setCutPercent(cut);

      const players = await loadLeaguePlayers();
      setPlayerCount(players.length);

      if (players.length < 2) {
        setBracket(null);
        setLoading(false);
        return;
      }

      const seeded = seedToiletBowl(players);
      setFieldSize(seeded.length);
      setBracket(buildBracket("toilet", seeded));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-toilet">Toilet Bowl</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-toilet/10 text-toilet">
              Bottom {cutPercent}%
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted">
              Projected
            </span>
          </div>
          <p className="text-sm text-muted">
            {leagueName ? `${leagueName} • ` : ""}
            Live standings preview • Worst record = #1 seed (easiest path) •
            Same weekly card in the real postseason
          </p>
        </div>

        <div className="rounded-xl border border-toilet/40 bg-toilet/5 p-4 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-toilet/10 rounded-full -translate-y-10 translate-x-10" />
          <div className="relative text-sm space-y-2">
            <p>
              <span className="font-semibold text-toilet">Flush rules:</span>{" "}
              <span className="text-muted">
                Single elimination. Higher weekly score advances. Losers are
                done. Someone still has to win this thing.
              </span>
            </p>
            <p className="text-muted">
              <span className="font-medium text-toilet">Not locked yet.</span>{" "}
              Seeds update when standings change. Field locks after the regular
              season cut.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted mb-6">
          <span>
            <span className="inline-block w-3 h-3 rounded-sm bg-toilet/20 border border-toilet/50 mr-1.5 align-middle" />
            Winner / advanced
          </span>
          <span>#1 seed = worst regular-season points</span>
          <span>Byes go to the bottom-dwellers</span>
          <span>
            Tiebreakers (worst first): Pts → H2H → ATS% → Avg → Best week →
            Streak → Best Bet% → Name
          </span>
        </div>

        {loading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
            Loading live roster…
          </div>
        )}

        {!loading && playerCount < 2 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium mb-2">Need more players</p>
            <p className="text-sm text-muted mb-4">
              Toilet Bowl needs at least 2 league members. Invite friends from
              Players.
            </p>
            <Link
              href="/players"
              className="text-sm text-toilet hover:underline"
            >
              Go to Players →
            </Link>
          </div>
        )}

        {!loading && playerCount >= 2 && bracket && (
          <>
            <p className="text-xs text-muted mb-3">
              {playerCount} in league → {fieldSize} projected in Toilet Bowl
              field
            </p>
            <div className="rounded-xl border border-toilet/30 bg-card p-4 mb-6 overflow-x-auto">
              <BracketView
                bracket={bracket}
                accent="toilet"
                selfId={selfId}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-3 text-sm">
                Projected seeding (worst → easiest path)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bracket.players.map((p, i) => {
                  const mine = isSelfPlayer(p.id, selfId);
                  return (
                  <div
                    key={p.id}
                    className={selfRowClass(
                      mine,
                      "flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-card-hover"
                    )}
                  >
                    <span className="text-xs font-bold text-toilet w-5">
                      {i + 1}
                    </span>
                    <span className={`truncate ${selfNameClass(mine, "")}`}>
                      {p.name}
                      {mine && <YouBadge />}
                    </span>
                    <span className="text-xs text-muted ml-auto shrink-0">
                      {p.totalPoints}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
