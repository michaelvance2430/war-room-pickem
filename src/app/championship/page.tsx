"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import BracketView from "@/components/BracketView";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getSession, getLeague } from "@/lib/league";
import { seedChampionship, buildBracket, Bracket } from "@/lib/brackets";

export default function ChampionshipPage() {
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

      // Top half by points (min 2 for a bracket; seedChampionship uses top half, min 4 when large)
      const seeded = seedChampionship(players);
      setFieldSize(seeded.length);
      setBracket(buildBracket("championship", seeded));
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
            <h1 className="text-2xl font-bold text-primary">
              Championship Bracket
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Top {cutPercent === 50 ? "50%" : `${100 - cutPercent}%`}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted">
              Projected
            </span>
          </div>
          <p className="text-sm text-muted">
            {leagueName ? `${leagueName} • ` : ""}
            Live standings preview • Division leaders preferred as seeds 1–4 •
            Higher weekly score advances in the real postseason
          </p>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm mb-6">
          <span className="font-medium text-primary">Not locked yet.</span>{" "}
          <span className="text-muted">
            Seeds update when standings change (after weeks are scored). Final
            field locks after the regular season cut.
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted mb-6">
          <span>
            <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 border border-primary/50 mr-1.5 align-middle" />
            Winner / advanced
          </span>
          <span>Seeds 1–4 prefer division leaders among the field</span>
          <span>Byes auto-advance when the field isn&apos;t a power of 2</span>
          <span>
            Tiebreakers: Pts → H2H → ATS% → Avg → Best week → Streak → Best Bet%
            → Name
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
              Brackets need at least 2 league members with standings data.
              Invite friends from Players.
            </p>
            <Link
              href="/players"
              className="text-sm text-primary hover:underline"
            >
              Go to Players →
            </Link>
          </div>
        )}

        {!loading && playerCount >= 2 && bracket && (
          <>
            <p className="text-xs text-muted mb-3">
              {playerCount} in league → {fieldSize} projected in Championship
              field
            </p>
            <div className="rounded-xl border border-border bg-card p-4 mb-6 overflow-x-auto">
              <BracketView bracket={bracket} accent="primary" />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-3 text-sm">
                Projected seeding order
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bracket.players.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-card-hover"
                  >
                    <span className="text-xs font-bold text-primary w-5">
                      {i + 1}
                    </span>
                    <span className="truncate">
                      {p.name}
                      {p.id === selfId && (
                        <span className="text-primary text-xs ml-1">(You)</span>
                      )}
                    </span>
                    <span className="text-xs text-muted ml-auto shrink-0">
                      {p.totalPoints}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
