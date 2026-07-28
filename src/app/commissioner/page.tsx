"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { Game, Prop } from "@/lib/types";
import { fetchNcaafOdds } from "@/lib/odds";
import { formatMatchupConferences } from "@/lib/fbs-teams";
import { formatRankedTeam } from "@/lib/rankings";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { applyWeekScores } from "@/lib/store";
import {
  isCommissioner,
  getLeague,
  getSession,
  resetLeague,
  League,
} from "@/lib/league";
import {
  syncLeagueFromCloud,
  saveLeagueToCloud,
  regenerateCodeInCloud,
} from "@/lib/league-sync";
import {
  publishWeekCard,
  loadWeekCard,
  saveResultsAndScoreWeek,
} from "@/lib/cloud";

const PICKS_KEY = "warroom-picks-week-1";
const RESULTS_KEY = "warroom-results-week-1";
const CARD_KEY = "warroom-card-week-1";

export default function CommissionerPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"card" | "results" | "settings">("settings");
  const [league, setLeague] = useState<League | null>(null);
  const [leagueNameEdit, setLeagueNameEdit] = useState("");
  const [cutPercent, setCutPercent] = useState(50);
  const [seasonWeeks, setSeasonWeeks] = useState(12);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishedGames, setPublishedGames] = useState<Game[]>([]);
  const [prop, setProp] = useState<Prop>({
    id: "prop-w1",
    question: "Will the highest scoring game go over 55.5 total points?",
    options: ["Over", "Under"],
    points: 3,
  });
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState(false);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [demoScore, setDemoScore] = useState<{ totalPoints: number } | null>(null);
  const [hasPlayerPicks, setHasPlayerPicks] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreReport, setScoreReport] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(isCommissioner());
    async function load() {
      const lg = (await syncLeagueFromCloud()) || getLeague();
      if (lg) {
        setLeague(lg);
        setLeagueNameEdit(lg.name);
        setCutPercent(lg.settings?.cutPercent ?? 50);
        setSeasonWeeks(lg.settings?.regularSeasonWeeks ?? 12);
      }
    }
    load();
    loadWeekCard(1).then((cloud) => {
      if (cloud) {
        setPublishedGames(cloud.games);
        setProp(cloud.prop);
        setCardSaved(true);
      }
    });
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
    } catch {
      // ignore
    }
  }, []);

  async function pullOdds() {
    setLoadingOdds(true);
    setOddsError(null);
    try {
      const { games } = await fetchNcaafOdds();
      if (!games.length) {
        setAvailableGames([]);
        setSelectedIds(new Set());
        setOddsError(
          "No NCAA FBS games with spreads right now. Books often post little in the offseason — try again when Week 1 lines are up. Only SEC / Big Ten / ACC / Big 12 / G5 / Independents are shown."
        );
        return;
      }
      setAvailableGames(games);
      setSelectedIds(new Set());
      setOddsError(null);
    } catch (e: unknown) {
      setOddsError(e instanceof Error ? e.message : "Failed to pull odds");
      setAvailableGames([]);
      setSelectedIds(new Set());
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

  async function publishCard() {
    const selected = availableGames.filter((g) => selectedIds.has(g.id));
    if (selected.length !== 5) return;
    const result = await publishWeekCard({
      weekNumber: 1,
      games: selected,
      prop,
    });
    if (!result.ok) {
      alert(result.error || "Failed to publish to cloud");
      // still save locally
      setPublishedGames(selected);
      localStorage.setItem(CARD_KEY, JSON.stringify({ games: selected, prop }));
      setCardSaved(true);
      return;
    }
    const games = result.games || selected;
    setPublishedGames(games);
    setCardSaved(true);
  }

  function setGameWinner(gameId: string, side: "home" | "away" | "push") {
    setResults((prev) => ({ ...prev, [gameId]: { gameId, winner: side } }));
    setResultsSaved(false);
    setDemoScore(null);
  }

  async function handleSaveResults() {
    if (scoring) return;
    setScoring(true);
    setScoreReport(null);
    localStorage.setItem(RESULTS_KEY, JSON.stringify({ results, propResult }));

    // Local demo score for this browser's picks
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
        setDemoScore({ totalPoints: scored.totalPoints });
        setHasPlayerPicks(true);
      } else {
        setHasPlayerPicks(false);
      }
    } catch {
      setHasPlayerPicks(false);
    }

    const cloud = await saveResultsAndScoreWeek({
      weekNumber: 1,
      games: publishedGames,
      prop,
      results,
      propResult,
    });

    setResultsSaved(true);
    setScoring(false);

    if (!cloud.ok) {
      setScoreReport(cloud.error || "Cloud scoring failed");
      applyWeekScores();
      return;
    }

    if (cloud.scoredCount === 0) {
      setScoreReport(cloud.error || "Saved results. No locked cloud picks to score yet.");
      applyWeekScores();
      return;
    }

    const lines = (cloud.details || [])
      .map((d) => `${d.name}: ${d.points} pts`)
      .join(" · ");
    setScoreReport(`Scored ${cloud.scoredCount} player(s). ${lines}`);
  }

  async function saveSettings() {
    const result = await saveLeagueToCloud({
      name: leagueNameEdit,
      settings: {
        cutPercent,
        regularSeasonWeeks: seasonWeeks,
        gamesPerWeek: 5,
      },
    });
    if (result.ok && result.league) {
      setLeague(result.league);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 1500);
    } else {
      alert(result.error || "Failed to save settings");
    }
  }

  async function handleRegenCode() {
    if (!confirm("Generate a new code? The old code will stop working.")) return;
    const result = await regenerateCodeInCloud();
    if (result.ok && result.league) setLeague(result.league);
    else alert(result.error || "Failed to regenerate code");
  }

  function handleReset() {
    if (!confirm("Delete this league and all local data?")) return;
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
          <p className="text-sm text-muted">Settings • Build the card • Enter results</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setTab("settings")}
            className={
              tab === "settings"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Settings
          </button>
          <button
            onClick={() => setTab("card")}
            className={
              tab === "card"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Build Card
          </button>
          <button
            onClick={() => setTab("results")}
            className={
              tab === "results"
                ? "px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-black"
                : "px-4 py-1.5 rounded-full text-sm font-medium bg-card border border-border text-muted"
            }
          >
            Enter Results
          </button>
        </div>

        {tab === "settings" && league && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">League</h2>
              <div>
                <label className="text-xs text-muted block mb-1">League name</label>
                <input
                  value={leagueNameEdit}
                  onChange={(e) => setLeagueNameEdit(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
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
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleRegenCode}
                    className="px-3 py-2 text-xs rounded-lg border border-border"
                  >
                    New code
                  </button>
                </div>
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
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
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
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={saveSettings}
                className={
                  settingsSaved
                    ? "w-full py-3 rounded-xl font-semibold bg-primary/20 text-primary border border-primary"
                    : "w-full py-3 rounded-xl font-semibold bg-primary text-black"
                }
              >
                {settingsSaved ? "Settings saved" : "Save settings"}
              </button>
            </div>

            <div className="rounded-xl border border-danger/40 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-danger">Danger zone</h2>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-danger text-danger text-sm"
              >
                Delete league and reset app
              </button>
            </div>
          </div>
        )}

        {tab === "card" && (
          <div>
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">Pull Live Odds</h2>
                  <p className="text-xs text-muted">
                    Live NCAA FBS only — SEC, Big Ten, ACC, Big 12, G5, Independents
                  </p>
                </div>
                <button
                  onClick={pullOdds}
                  disabled={loadingOdds}
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled:opacity-50"
                >
                  {loadingOdds ? "Pulling..." : "Pull Odds"}
                </button>
              </div>
              {oddsError && <p className="text-sm text-danger mt-2">{oddsError}</p>}
            </div>

            {availableGames.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 mb-6">
                <h2 className="font-semibold mb-1">
                  Select 5 Games ({selectedIds.size}/5)
                </h2>
                <p className="text-xs text-muted mb-2">
                  {availableGames.length} FBS games with spreads (Power conf first)
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto mt-4">
                  {availableGames.map((g) => {
                    const selected = selectedIds.has(g.id);
                    const favLabel = formatRankedTeam(
                      g.favorite === "home" ? g.homeTeam : g.awayTeam,
                      g.favorite === "home" ? g.homeRank : g.awayRank
                    );
                    const confLine = formatMatchupConferences(
                      g.awayTeam,
                      g.homeTeam
                    );
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGame(g.id)}
                        className={
                          selected
                            ? "w-full text-left p-3 rounded-lg border border-primary bg-primary/10"
                            : "w-full text-left p-3 rounded-lg border border-border"
                        }
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {formatRankedTeam(g.awayTeam, g.awayRank)} @{" "}
                              {formatRankedTeam(g.homeTeam, g.homeRank)}
                            </div>
                            <div className="text-xs text-muted">
                              {confLine ? `${confLine} • ` : ""}
                              {g.startTime}
                              {g.bookmaker ? ` • ${g.bookmaker}` : ""}
                            </div>
                          </div>
                          <span className="text-sm text-primary shrink-0">
                            {favLabel}{" "}
                            {g.spread < 0
                              ? g.spread
                              : `-${Math.abs(g.spread)}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={selectedIds.size !== 5}
                  onClick={publishCard}
                  className={
                    selectedIds.size === 5
                      ? "w-full mt-4 py-3 rounded-xl font-semibold bg-primary text-black"
                      : "w-full mt-4 py-3 rounded-xl font-semibold bg-border text-muted cursor-not-allowed"
                  }
                >
                  Publish / Update Card
                </button>
              </div>
            )}

            {cardSaved && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary">
                Week card saved ({publishedGames.length} games). Publish again anytime to change games.
              </div>
            )}
          </div>
        )}

        {tab === "results" && (
          <div>
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
                        <button
                          onClick={() => setGameWinner(game.id, "away")}
                          className={
                            res?.winner === "away"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary"
                              : "py-2 rounded-lg text-sm border border-border"
                          }
                        >
                          {game.awayTeam}
                        </button>
                        <button
                          onClick={() => setGameWinner(game.id, "push")}
                          className={
                            res?.winner === "push"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary"
                              : "py-2 rounded-lg text-sm border border-border"
                          }
                        >
                          Push
                        </button>
                        <button
                          onClick={() => setGameWinner(game.id, "home")}
                          className={
                            res?.winner === "home"
                              ? "py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary"
                              : "py-2 rounded-lg text-sm border border-border"
                          }
                        >
                          {game.homeTeam}
                        </button>
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
                    className={
                      propResult === opt
                        ? "py-2.5 rounded-lg text-sm border border-primary bg-primary/10 text-primary"
                        : "py-2.5 rounded-lg text-sm border border-border"
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!allResultsIn}
              onClick={handleSaveResults}
              className={
                !allResultsIn
                  ? "w-full py-3 rounded-xl font-semibold mb-6 bg-border text-muted cursor-not-allowed"
                  : "w-full py-3 rounded-xl font-semibold mb-6 bg-primary text-black"
              }
            >
              {scoring ? "Scoring…" : resultsSaved ? "Results Saved — Score Again" : "Save Results & Score League"}
            </button>

            {scoreReport && (
              <div className="rounded-xl border border-primary/40 bg-card p-4 text-sm text-primary mb-4">
                {scoreReport}
              </div>
            )}
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
          </div>
        )}
      </main>
    </div>
  );
}
