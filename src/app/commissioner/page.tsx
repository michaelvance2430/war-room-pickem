"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { currentWeek } from "@/lib/mock-data";
import { Game, Prop } from "@/lib/types";
import { getMockOddsGames, fetchNcaafOdds } from "@/lib/odds";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { isCommissioner, getSession } from "@/lib/league";
import { applyWeekScores } from "@/lib/store";

const PICKS_KEY = "warroom-picks-week-1";
const RESULTS_KEY = "warroom-results-week-1";
const CARD_KEY = "warroom-card-week-1";

export default function CommissionerPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"card" | "results">("card");

  useEffect(() => {
    setAllowed(isCommissioner());
  }, []);

  // Card building
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishedGames, setPublishedGames] = useState<Game[]>(currentWeek.games);
  const [prop, setProp] = useState<Prop>(currentWeek.prop);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState(false);

  // Results
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [demoScore, setDemoScore] = useState<ReturnType<typeof scoreWeek> | null>(null);
  const [hasPlayerPicks, setHasPlayerPicks] = useState(false);

  useEffect(() => {
    try {
      const cardRaw = localStorage.getItem(CARD_KEY);
      if (cardRaw) {
        const data = JSON.parse(cardRaw);
        if (data.games) setPublishedGames(data.games);
        if (data.prop) setProp(data.prop);
        setCardSaved(true);
      }
      const resRaw = localStorage.getItem(RESULTS_KEY);
      if (resRaw) {
        const data = JSON.parse(resRaw);
        setResults(data.results || {});
        setPropResult(data.propResult || null);
        setResultsSaved(true);
      }
    } catch {}
  }, []);

  async function pullOdds() {
    setLoadingOdds(true);
    setOddsError(null);
    try {
      // Try real API first if key exists, otherwise use rich mock
      const key = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ODDS_API_KEY : undefined;
      let games: Game[];
      if (key) {
        games = await fetchNcaafOdds(key);
      } else {
        // Simulated network delay
        await new Promise((r) => setTimeout(r, 600));
        games = getMockOddsGames();
      }
      setAvailableGames(games);
      setSelectedIds(new Set());
    } catch (e: any) {
      setOddsError(e.message || "Failed to pull odds");
      // fallback
      setAvailableGames(getMockOddsGames());
    } finally {
      setLoadingOdds(false);
    }
  }

  function toggleGame(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 5) return prev; // max 5
        next.add(id);
      }
      return next;
    });
  }

  function publishCard() {
    const selected = availableGames.filter((g) => selectedIds.has(g.id));
    if (selected.length !== 5) return;
    setPublishedGames(selected);
    const payload = { games: selected, prop };
    localStorage.setItem(CARD_KEY, JSON.stringify(payload));
    setCardSaved(true);
  }

  function setGameWinner(gameId: string, side: "home" | "away" | "push") {
    setResults((prev) => ({ ...prev, [gameId]: { gameId, winner: side } }));
    setResultsSaved(false);
    setDemoScore(null);
  }

  function handleSaveResults() {
    localStorage.setItem(RESULTS_KEY, JSON.stringify({ results, propResult }));
    setResultsSaved(true);

    // Update standings with this week's points
    applyWeekScores();

    try {
      const raw = localStorage.getItem(PICKS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const scored = scoreWeek(
          data.picks || {},
          data.bestBetId || null,
          data.propChoice || null,
          publishedGames,
          results,
          prop,
          propResult
        );
        setDemoScore(scored);
        setHasPlayerPicks(true);
      } else {
        setHasPlayerPicks(false);
      }
    } catch {
      setHasPlayerPicks(false);
    }
  }

  const allResultsIn =
    publishedGames.every((g) => results[g.id]?.winner) && propResult !== null;

  if (allowed === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">Loading…</main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center rounded-xl border border-border bg-card p-6">
            <h1 className="text-xl font-bold mb-2">Commissioner only</h1>
            <p className="text-sm text-muted">
              Only the league commissioner can open these tools.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Commissioner Tools</h1>
          <p className="text-sm text-muted">Pull live odds • Build the card • Enter results</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("card")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === "card" ? "bg-primary text-black" : "bg-card border border-border text-muted"
            }`}
          >
            Build Card
          </button>
          <button
            onClick={() => setTab("results")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === "results" ? "bg-primary text-black" : "bg-card border border-border text-muted"
            }`}
          >
            Enter Results
          </button>
        </div>

        {tab === "card" && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">Pull Live Odds</h2>
                  <p className="text-xs text-muted">
                    {process.env.NEXT_PUBLIC_ODDS_API_KEY
                      ? "Using The Odds API"
                      : "Using demo data (add API key for live lines)"}
                  </p>
                </div>
                <button
                  onClick={pullOdds}
                  disabled={loadingOdds}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dim disabled:opacity-50"
                >
                  {loadingOdds ? "Pulling…" : "Pull Odds"}
                </button>
              </div>
              {oddsError && <p className="text-sm text-danger">{oddsError}</p>}
            </div>

            {availableGames.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 mb-6">
                <h2 className="font-semibold mb-1">
                  Select 5 Games ({selectedIds.size}/5)
                </h2>
                <p className="text-xs text-muted mb-4">
                  Click games to add them to this week’s card
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableGames.map((g) => {
                    const selected = selectedIds.has(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGame(g.id)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">
                              {g.awayTeam} @ {g.homeTeam}
                            </span>
                            <span className="text-xs text-muted ml-2">{g.startTime}</span>
                          </div>
                          <div className="text-sm">
                            {g.favorite === "home" ? g.homeTeam : g.awayTeam}{" "}
                            <span className="text-primary">
                              {g.spread > 0 ? `+${g.spread}` : g.spread}
                            </span>
                          </div>
                        </div>
                        {g.bookmaker && (
                          <div className="text-xs text-muted mt-1">{g.bookmaker}</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={selectedIds.size !== 5}
                  onClick={publishCard}
                  className={`w-full mt-4 py-3 rounded-xl font-semibold transition ${
                    selectedIds.size === 5
                      ? "bg-primary text-black hover:bg-primary-dim"
                      : "bg-border text-muted cursor-not-allowed"
                  }`}
                >
                  {selectedIds.size === 5
                    ? "Publish These 5 Games"
                    : `Select ${5 - selectedIds.size} more`}
                </button>
              </div>
            )}

            {cardSaved && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary">
                ✓ Week card published with {publishedGames.length} games. Players can now pick.
              </div>
            )}
          </>
        )}

        {tab === "results" && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-4">Enter Results</h2>
              <div className="space-y-4">
                {publishedGames.map((game) => {
                  const res = results[game.id];
                  return (
                    <div key={game.id} className="border border-border rounded-lg p-4">
                      <div className="font-medium mb-3">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["away", "push", "home"] as const).map((side) => (
                          <button
                            key={side}
                            onClick={() => setGameWinner(game.id, side)}
                            className={`py-2 rounded-lg text-sm border transition ${
                              res?.winner === side
                                ? side === "push"
                                  ? "border-warning bg-warning/10 text-warning"
                                  : "border-primary bg-primary/10 text-primary"
                                : "border-border"
                            }`}
                          >
                            {side === "away"
                              ? game.awayTeam
                              : side === "home"
                                ? game.homeTeam
                                : "Push"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="font-semibold mb-2">Prop Result</h2>
              <p className="text-sm text-muted mb-3">{prop.question}</p>
              <div className="grid grid-cols-2 gap-3">
                {prop.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setPropResult(opt);
                      setResultsSaved(false);
                    }}
                    className={`py-2.5 rounded-lg text-sm border ${
                      propResult === opt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!allResultsIn}
              onClick={handleSaveResults}
              className={`w-full py-3 rounded-xl font-semibold mb-6 ${
                !allResultsIn
                  ? "bg-border text-muted cursor-not-allowed"
                  : "bg-primary text-black"
              }`}
            >
              {resultsSaved ? "✓ Results Saved" : "Save Results & Score"}
            </button>

            {demoScore && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold mb-3">Your Picks Scored</h3>
                <div className="text-2xl font-bold text-primary">{demoScore.totalPoints} pts</div>
              </div>
            )}
            {resultsSaved && !hasPlayerPicks && (
              <p className="text-sm text-muted mt-3">
                No picks found. Make picks first, then re-save results.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
