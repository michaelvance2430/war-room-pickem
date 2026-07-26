"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { currentWeek } from "@/lib/mock-data";
import { Game, UserPick, Prop } from "@/lib/types";
import { loadWeekCard, savePicksToCloud, loadMyPicks } from "@/lib/cloud";

function formatSpread(spread: number, favorite: "home" | "away", side: "home" | "away") {
  const isFavorite = favorite === side;
  if (isFavorite) {
    return spread < 0 ? `${spread}` : `-${Math.abs(spread)}`;
  }
  return `+${Math.abs(spread)}`;
}

const STORAGE_KEY = "warroom-picks-week-1";
const CARD_KEY = "warroom-card-week-1";

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>(currentWeek.games);
  const [picks, setPicks] = useState<Record<string, UserPick>>({});
  const [bestBetId, setBestBetId] = useState<string | null>(null);
  const [propChoice, setPropChoice] = useState<string | null>(null);
  const [usedConfidence, setUsedConfidence] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prop, setProp] = useState<Prop>(currentWeek.prop);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cloud = await loadWeekCard(1);
        if (cloud) {
          setGames(cloud.games);
          setProp(cloud.prop);
        } else {
          const cardRaw = localStorage.getItem(CARD_KEY);
          if (cardRaw) {
            const data = JSON.parse(cardRaw);
            if (data.games?.length) setGames(data.games);
            if (data.prop) setProp(data.prop);
          }
        }

        const mine = await loadMyPicks(1);
        if (mine) {
          setPicks(mine.picks || {});
          setBestBetId(mine.bestBetId || null);
          setPropChoice(mine.propChoice || null);
          setSaved(!!mine.lockedAt);
          const used = Object.values(mine.picks || {})
            .map((p) => p.confidence)
            .filter((c) => c > 0);
          setUsedConfidence(used);
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            setPicks(data.picks || {});
            setBestBetId(data.bestBetId || null);
            setPropChoice(data.propChoice || null);
            setUsedConfidence(data.usedConfidence || []);
            setSaved(!!data.lockedAt);
          }
        }
      } catch {
        // fall back silent
      }
      setLoaded(true);
    }
    load();
  }, []);

  const confidenceOptions = [1, 2, 3, 4, 5];

  function selectSide(gameId: string, side: "home" | "away") {
    /* editable until kickoff */
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    setPicks((prev) => ({
      ...prev,
      [gameId]: {
        gameId,
        pick: side,
        confidence: prev[gameId]?.confidence ?? 0,
        isBestBet: bestBetId === gameId,
        lockedSpread: game.spread,
        lockedFavorite: game.favorite,
      },
    }));
  }

  function selectConfidence(gameId: string, conf: number) {
    // Must pick a side first
    if (!picks[gameId]?.pick) {
      return;
    }
    // Confidence 1-5 must be unique across the 5 games
    const takenByOther = Object.entries(picks).some(
      ([id, p]) => id !== gameId && p.confidence === conf
    );
    if (takenByOther) return;

    const game = games.find((g) => g.id === gameId);
    setPicks((prev) => {
      const next = {
        ...prev,
        [gameId]: {
          gameId,
          pick: prev[gameId]?.pick ?? "home",
          confidence: conf,
          isBestBet: bestBetId === gameId,
          lockedSpread: game?.spread ?? prev[gameId]?.lockedSpread ?? 0,
          lockedFavorite: game?.favorite ?? prev[gameId]?.lockedFavorite ?? "home",
        },
      };
      // Keep usedConfidence in sync from picks
      const used = Object.values(next)
        .map((p) => p.confidence)
        .filter((c) => c >= 1 && c <= 5);
      setUsedConfidence(used);
      return next;
    });
  }

  function toggleBestBet(gameId: string) {
    /* editable until kickoff */
    if (bestBetId === gameId) {
      setBestBetId(null);
      setPicks((prev) => {
        const existing = prev[gameId];
        if (!existing) return prev;
        return { ...prev, [gameId]: { ...existing, isBestBet: false } };
      });
    } else {
      setPicks((prev) => {
        const next = { ...prev };
        if (bestBetId && next[bestBetId]) {
          next[bestBetId] = { ...next[bestBetId], isBestBet: false };
        }
        const game = games.find((g) => g.id === gameId);
        next[gameId] = {
          gameId,
          pick: next[gameId]?.pick ?? "home",
          confidence: next[gameId]?.confidence ?? 0,
          isBestBet: true,
          lockedSpread: game?.spread ?? 0,
          lockedFavorite: game?.favorite ?? "home",
        };
        return next;
      });
      setBestBetId(gameId);
    }
  }

  async function savePicks() {
    if (saving) return;
    const lockedPicks: Record<string, UserPick> = {};
    for (const g of games) {
      const p = picks[g.id];
      if (!p) continue;
      lockedPicks[g.id] = {
        ...p,
        lockedSpread: g.spread,
        lockedFavorite: g.favorite,
        isBestBet: bestBetId === g.id,
      };
    }

    setSaving(true);
    setSaveError(null);
    const cloud = await savePicksToCloud({
      weekNumber: 1,
      picks: lockedPicks,
      bestBetId,
      propChoice,
    });

    const payload = {
      picks: lockedPicks,
      bestBetId,
      propChoice,
      usedConfidence,
      lockedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setPicks(lockedPicks);

    if (!cloud.ok) {
      setSaveError(cloud.error || "Cloud save failed — picks kept on this device");
    }
    setSaved(true);
    setSaving(false);
  }

  const allGamesPicked =
    games.every((g) => picks[g.id]?.pick && (picks[g.id]?.confidence ?? 0) > 0) &&
    propChoice !== null &&
    bestBetId !== null;

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Week 1 Picks</h1>
          <p className="text-sm text-muted">
            {saved
              ? "Picks saved. You can change them anytime before kickoff — lines freeze at game start."
              : "Save your picks anytime. Change them until kickoff; lines freeze when each game starts."}
          </p>
        </div>

        {saveError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {saveError}
          </div>
        )}
        {saved && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
            ✓ Picks saved to the league. Edit below and Save again before kickoff if you change your mind.
          </div>
        )}

        <div className="space-y-4 mb-8">
          {games.map((game) => {
            const pick = picks[game.id];
            const isBest = bestBetId === game.id;
            // Show locked spread if already saved, otherwise current
            const displaySpread = pick?.lockedSpread ?? game.spread;
            const displayFavorite = pick?.lockedFavorite ?? game.favorite;

            return (
              <div
                key={game.id}
                className={`rounded-xl border bg-card p-4 transition ${
                  isBest ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
                } `}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted">{game.startTime}</span>
                  {isBest && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      BEST BET (2×)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    disabled={false}
                    onClick={() => selectSide(game.id, "away")}
                    className={`p-3 rounded-lg border text-left transition ${
                      pick?.pick === "away"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted"
                    } `}
                  >
                    <div className="font-medium">{game.awayTeam}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatSpread(displaySpread, displayFavorite, "away")}
                    </div>
                  </button>

                  <button
                    disabled={false}
                    onClick={() => selectSide(game.id, "home")}
                    className={`p-3 rounded-lg border text-left transition ${
                      pick?.pick === "home"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted"
                    } `}
                  >
                    <div className="font-medium">{game.homeTeam}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatSpread(displaySpread, displayFavorite, "home")}
                    </div>
                  </button>
                </div>

                {true && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1.5 items-center">
                      {!pick?.pick && (
                        <span className="text-xs text-muted mr-2">Pick a team first</span>
                      )}
                      {confidenceOptions.map((c) => {
                        const usedElsewhere = Object.entries(picks).some(
                          ([id, p]) => id !== game.id && p.confidence === c
                        );
                        return (
                          <button
                            key={c}
                            type="button"
                            disabled={usedElsewhere || !pick?.pick}
                            onClick={() => selectConfidence(game.id, c)}
                            className={`w-8 h-8 rounded text-sm font-medium transition ${
                              pick?.confidence === c
                                ? "bg-primary text-black"
                                : usedElsewhere
                                  ? "bg-border text-muted cursor-not-allowed"
                                  : "bg-card-hover hover:bg-border"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => toggleBestBet(game.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        isBest
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border text-muted"
                      }`}
                    >
                      {isBest ? "★ Best Bet" : "Set Best Bet"}
                    </button>
                  </div>
                )}

                {saved && pick && (
                  <div className="text-xs text-muted">
                    Last saved line for scoring snapshot:{" "}
                    {formatSpread(pick.lockedSpread, pick.lockedFavorite, pick.pick)}
                    {" "}(updates when you Save again)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 mb-8">
          <div className="text-xs text-muted mb-1">Weekly Prop • {prop.points} pts</div>
          <div className="font-medium mb-3">{prop.question}</div>
          <div className="grid grid-cols-2 gap-3">
            {prop.options.map((opt) => (
              <button
                key={opt}
                disabled={false}
                onClick={() => setPropChoice(opt)}
                className={`p-3 rounded-lg border text-sm transition ${
                  propChoice === opt
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!allGamesPicked || saving}
          onClick={savePicks}
          className={`w-full py-3 rounded-xl font-semibold transition ${
            allGamesPicked
              ? "bg-primary text-black hover:bg-primary-dim"
              : "bg-border text-muted cursor-not-allowed"
          }`}
        >
          {allGamesPicked
            ? saving
              ? "Saving…"
              : saved
                ? "Save changes"
                : "Save picks"
            : "Finish all picks + Best Bet + Prop"}
        </button>
        <p className="text-center text-xs text-muted mt-3">
          Final lock is at kickoff for each game. Save as often as you want until then.
        </p>
      </main>
    </div>
  );
}
