"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import BracketView from "@/components/BracketView";
import { loadPlayers } from "@/lib/store";
import { seedChampionship, buildBracket, Bracket } from "@/lib/brackets";

export default function ChampionshipPage() {
  const [bracket, setBracket] = useState<Bracket | null>(null);

  useEffect(() => {
    const players = loadPlayers();
    const seeded = seedChampionship(players);
    const b = buildBracket("championship", seeded);
    setBracket(b);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-primary">Championship Bracket</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Top 50%
            </span>
          </div>
          <p className="text-sm text-muted">
            Single elimination • Division winners locked as seeds 1–4 • Higher weekly score advances
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted mb-6">
          <span>
            <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 border border-primary/50 mr-1.5 align-middle" />
            Winner / advanced
          </span>
          <span>Seeds 1–4 = division champions</span>
          <span>Byes auto-advance top seeds</span>
          <span>Tiebreakers: Pts → H2H → ATS% → Avg → Best week → Streak → Best Bet% → Name</span>
        </div>

        {bracket ? (
          <>
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <BracketView bracket={bracket} accent="primary" />
            </div>

            {/* Seed list */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-3 text-sm">Seeding Order</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bracket.players.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-card-hover"
                  >
                    <span className="text-xs font-bold text-primary w-5">{i + 1}</span>
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
