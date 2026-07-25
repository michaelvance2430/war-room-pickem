"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import BracketView from "@/components/BracketView";
import { loadPlayers } from "@/lib/store";
import { seedToiletBowl, buildBracket, Bracket } from "@/lib/brackets";

export default function ToiletBowlPage() {
  const [bracket, setBracket] = useState<Bracket | null>(null);

  useEffect(() => {
    const players = loadPlayers();
    const seeded = seedToiletBowl(players);
    const b = buildBracket("toilet", seeded);
    setBracket(b);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-toilet">Toilet Bowl</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-toilet/10 text-toilet">
              Bottom 50%
            </span>
          </div>
          <p className="text-sm text-muted">
            Worst record gets the #1 seed (easiest path) • Same weekly card • Maximum chaos
          </p>
        </div>

        {/* Chaos banner */}
        <div className="rounded-xl border border-toilet/40 bg-toilet/5 p-4 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-toilet/10 rounded-full -translate-y-10 translate-x-10" />
          <div className="relative text-sm">
            <span className="font-semibold text-toilet">Flush rules:</span>{" "}
            <span className="text-muted">
              Single elimination. Higher score advances. Losers are done. Someone still has to win this thing.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted mb-6">
          <span>
            <span className="inline-block w-3 h-3 rounded-sm bg-toilet/20 border border-toilet/50 mr-1.5 align-middle" />
            Winner / advanced
          </span>
          <span>#1 seed = worst regular-season record</span>
          <span>Byes go to the bottom-dwellers</span>
          <span>Tiebreakers (worst first): Pts → H2H → ATS% → Avg → Best week → Streak → Best Bet% → Name</span>
        </div>

        {bracket ? (
          <>
            <div className="rounded-xl border border-toilet/30 bg-card p-4 mb-6">
              <BracketView bracket={bracket} accent="toilet" />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-3 text-sm">Toilet Bowl Seeding (worst → easiest path)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bracket.players.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-card-hover"
                  >
                    <span className="text-xs font-bold text-toilet w-5">{i + 1}</span>
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted ml-auto">{p.totalPoints}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
            Loading bracket…
          </div>
        )}
      </main>
    </div>
  );
}
