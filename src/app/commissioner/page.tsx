"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { currentWeek } from "@/lib/mock-data";
import { Game, Prop } from "@/lib/types";
import { getMockOddsGames, fetchNcaafOdds } from "@/lib/odds";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { applyWeekScores } from "@/lib/store";
import {
  isCommissioner,
  getLeague,
  getSession,
  updateLeagueName,
  updateLeagueSettings,
  regenerateCode,
  resetLeague,
  League,
} from "@/lib/league";

const PICKS_KEY = "warroom-picks-week-1";
const RESULTS_KEY = "warroom-results-week-1";
const CARD_KEY = "warroom-card-week-1";

export default function CommissionerPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"card" | "results" | "settings">("settings");

  // League settings
  const [league, setLeague] = useState<League | null>(null);
  const [leagueNameEdit, setLeagueNameEdit] = useState("");
  const [cutPercent, setCutPercent] = useState(50);
  const [seasonWeeks, setSeasonWeeks] = useState(12);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Card
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
    setAllowed(isCommissioner());
    const lg = getLeague();
    if (lg) {
      setLeague(lg);
      setLeagueNameEdit(lg.name);
      setCutPercent(lg.settings?.cutPercent ?? 50);
      setSeasonWeeks(lg.settings?.regularSeasonWeeks ?? 12);
    }
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
      const key =
        typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ODDS_API_KEY : undefined;
      let games: Game[];
      if (key) {
        games = await fetchNcaafOdds(key);
      } else {
        await new Promise((r) => setTimeout(r, 500));
        games = getMockOddsGames();
      }
      setAvailableGames(games);
      setSelectedIds(new Set());
    } catch (e: unknown) {
      setOddsError(e instanceof Error ? e.message : "Failed to pull odds");
      setAvailableGames(getMockOddsGames());
    } finally {
      setLoadingOdds(false);
    }
  }

  function toggleGame(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  function publishCard() {
    const selected = availableGames.filter((g) => selectedIds.has(g.id));
    if (selected.length !== 5) return;
    setPublishedGames(selected);
    localStorage.setItem(CARD_KEY, JSON.stringify({ games: selected, prop }));
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

  function saveSettings() {
    updateLeagueName(leagueNameEdit);
    const updated = updateLeagueSettings({
      cutPercent,
      regularSeasonWeeks: seasonWeeks,
      gamesPerWeek: 5,
    });
    if (updated) setLeague(updated);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1500);
  }

  function handleRegenCode() {
    if (!confirm("Generate a new code? The old code will stop working.")) return;
    const updated = regenerateCode();
    if (updated) setLeague(updated);
  }

  function handleReset() {
    if (
      !confirm(
        "Delete this league and all local data? You will need to create or join again."
      )
    )
      return;
    resetLeague();
    router.push("/join");
  }

  function copyCode() {
    if (!league) return;
    navigator.clipboard?.writeText(league.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const allResultsIn =
    publishedGames.every((g) => results[g.id]?.winner) && propResult !== null;

  if (allowed === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">
          Loading…
        </main>
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

  const session = getSession();

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Commissioner Tools</h1>
          <p className="text-sm text-muted">
            Settings • Build the card • Enter results
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["settings", "Settings"],
              ["card", "Build Card"],
              ["results", "Enter Results"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tab === id
                  ? "bg-primary text-black"
                  : "bg-card border border-border text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SETTINGS */}
        {tab === "settings" && league && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">League</h2>
              <div>
                <label className="text-xs text-muted block mb-1">League name</label>
                <input
                  value={leagueNameEdit}
                  onChange={(e) => setLeagueNameEdit(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Invite code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-2xl tracking-[0.25em] text-primary font-bold">
                    {league.code}
                  </div>
                  <button
                    onClick={copyCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-card-hover"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleRegenCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-card-hover"
                  >
                    New code
                  </button>
                </div>
                <p className="text-xs text-muted mt-2">
                  Friends join at /join with this code (same device in demo mode).
                </p>
              </div>
              <div className="text-sm text-muted">
                Commissioner:{" "}
                <span className="text-foreground font-medium">
                  {session?.playerName || "You"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">Season rules</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Cut line (% to Toilet Bowl)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={75}
                    value={cutPercent}
                    onChange={(e) => setCutPercent(parseInt(e.target.value) || 50)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Regular season weeks
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={16}
                    value={seasonWeeks}
                    onChange={(e) => setSeasonWeeks(parseInt(e.target.value) || 12)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <p className="text-xs text-muted">
                Games per week is fixed at 5. Bottom {cutPercent}% of each division
                goes to the Toilet Bowl after week {seasonWeeks}.
              </p>
              <button
                onClick={saveSettings}
                className={`w-full py-3 rounded-xl font-semibold transition ${
                  settingsSaved
                    ? "bg-primary/20 text-primary border border-primary"
                    : "bg-primary text-black"
                }`}
              >
                {settingsSaved ? "✓ Settings saved" : "Save settings"}
              </button>
            </div>

            <div className="rounded-xl border border-danger/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-danger">Danger zone</h2>
              <p className="text-xs text-muted">
                Resets league, players, picks, and results on this device.
              </p>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-danger text-danger text-sm hover:bg-danger/10"
              >
                Delete league & reset app
              </button>
            </div>
          </div>
        )}

        {/* BUILD CARD */}
        {tab === "card" && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">Pull Live Odds</h2>
                  <p className="text-xs text-muted">Demo data unless API key is set</p>
                </div>
                <button
                  onClick={pullOdds}
                  disabled={loadingOdds}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled:opacity-50"
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
                <div className="space-y-2 max-h-96 overflow-y-auto mt-4">
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
                          <span className="font-medium">
                            {g.awayTeam} @ {g.homeTeam}
                          </span>
                          <span className="text-sm text-primary">
                            {g.spread > 0 ? `+${g.spread}` : g.spread}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={selectedIds.size !== 5}
                  onClick={publishCard}
                  className={`w-full mt-4 py-3 rounded-xl font-semibold ${
                    selectedIds.size === 5
                      ? "bg-primary text-black"
                      : "bg-border text-muted cursor-not-allowed"
                  }`}
                >
                  Publish These 5 Games
                </button>
              </div>
            )}

            {cardSaved && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary">
                ✓ Week card published ({publishedGames.length} games)
              </div>
            )}
          </>
        )}

        {/* RESULTS */}
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
                            className={`py-2 rounded-lg text-sm border ${
                              res?.winner === side
                                ? "border-primary bg-primary/10 text-primary"
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
                <div className="text-2xl font-bold text-primary">
                  {demoScore.totalPoints} pts
                </div>
              </div>
            )}
            {resultsSaved && !hasPlayerPicks && (
              <p className="text-sm text-muted mt-3">
                No picks found. Lock picks first, then re-save results.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
