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
  resetLeague,
  League,
} from "@/lib/league";
import {
  syncLeagueFromCloud,
  saveLeagueToCloud,
  regenerateCodeInCloud,
} from "@/lib/league-sync";

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
  const [publishedGames, setPublishedGames] = useState<Game[]>(currentWeek.games);
  const [prop, setProp] = useState<Prop>(currentWeek.prop);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState(false);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [demoScore, setDemoScore] = useState<ReturnType<typeof scoreWeek> | null>(null);
  const [hasPlayerPicks, setHasPlayerPicks] = useState(false);

  useEffect(() => {
    setAllowed(isCommissioner());
    (async () => {
      const lg = (await syncLeagueFromCloud()) || getLeague();
      if (lg) {
        setLeague(lg);
        setLeagueNameEdit(lg.name);
        setCutPercent(lg.settings?.cutPercent ?? 50);
        setSeasonWeeks(lg.settings?.regularSeasonWeeks ?? 12);
      }
    })();
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
            <p className="text-sm text-muted">Only the league commissioner can open these tools.</p>
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
                tab === id ? "bg-primary text-black" : "bg-card border border-border text-muted"
              }`}
            >
              {label}
            </button>
          ))}
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
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Invite code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-2xl tracking-[0.25em] text-primary font-bold">
                    {league.code}
                  </div>
                  <button onClick={copyCode} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-card-hover">
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button onClick={handleRegenCode} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-card-hover">
                    New code
                  </button>
                </div>
              </div>
              <div className="text-sm text-muted">
                Commissioner:{" "}
                <span className="text-foreground font-medium">{session?.playerName || "You"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">Season rules</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1">Cut line (% to Toilet Bowl)</label>
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
                  <label className="text-xs text-muted block mb-1">Regular season weeks</label>
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
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-danger text-danger text-sm hover:bg-danger/10"
              >
                Delete league & reset app
              </button>
            </div>
          </div>
        )}

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
                  className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium disabled