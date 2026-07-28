"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { Game, UserPick, Prop } from "@/lib/types";
import { getSession, getLeague } from "@/lib/league";
import { loadWeekCard, savePicksToCloud, loadMyPicks } from "@/lib/cloud";

function formatSpread(
  spread: number,
  favorite: "home" | "away",
  side: "home" | "away"
) {
  const isFavorite = favorite === side;
  if (isFavorite) {
    return spread < 0 ? `${spread}` : `-${Math.abs(spread)}`;
  }
  return `+${Math.abs(spread)}`;
}

const EMPTY_PROP: Prop = {
  id: "prop",
  question: "",
  options: ["A", "B"],
  points: 3,
};

export default function PicksPage() {
  const [weekNumber, setWeekNumber] = useState(1);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Record<string, UserPick>>({});
  const [bestBetId, setBestBetId] = useState<string | null>(null);
  const [propChoice, setPropChoice] = useState<string | null>(null);
  const [usedConfidence, setUsedConfidence] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prop, setProp] = useState<Prop>(EMPTY_PROP);
  const [hasCard, setHasCard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    async function load() {
      setLoadError(null);
      const session = getSession();
      const league = getLeague();
      setLeagueName(league?.name || "");

      if (!session?.leagueId) {
        setLoadError("No league selected. Go home and join or create a league.");
        setLoaded(true);
        return;
      }

      // Prefer league current week from settings cache if present later; default 1
      const week = 1;
      setWeekNumber(week);

      try {
        const cloud = await loadWeekCard(week);
        if (!cloud || !cloud.games.length) {
          setHasCard(false);
          setGames([]);
          setLoaded(true);
          return;
        }

        setHasCard(true);
        setGames(cloud.games);
        setProp(cloud.prop);

        const mine = await loadMyPicks(week);
        if (mine) {
          setPicks(mine.picks || {});
          setBestBetId(mine.bestBetId || null);
          setPropChoice(mine.propChoice || null);
          setSaved(!!mine.lockedAt);
          const used = Object.values(mine.picks || {})
            .map((p) => p.confidence)
            .filter((c) => c > 0);
          setUsedConfidence(used);
        }
      } catch (e: unknown) {
        setLoadError(
          e instanceof Error ? e.message : "Failed to load weekly card"
        );
      }
      setLoaded(true);
    }
    load();
  }, []);

  const confidenceOptions = [1, 2, 3, 4, 5];

  function selectSide(gameId: string, side: "home" | "away") {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    setSaved(false);
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
    if (!picks[gameId]?.pick) return;
    const takenByOther = Object.entries(picks).some(
      ([id, p]) => id !== gameId && p.confidence === conf
    );
    if (takenByOther) return;

    const game = games.find((g) => g.id === gameId);
    setSaved(false);
    setPicks((prev) => {
      const next = {
        ...prev,
        [gameId]: {
          gameId,
          pick: prev[gameId]?.pick ?? "home",
          confidence: conf,
          isBestBet: bestBetId === gameId,
          lockedSpread: game?.spread ?? prev[gameId]?.lockedSpread ?? 0,
          lockedFavorite:
            game?.favorite ?? prev[gameId]?.lockedFavorite ?? "home",
        },
      };
      const used = Object.values(next)
        .map((p) => p.confidence)
        .filter((c) => c >= 1 && c <= 5);
      setUsedConfidence(used);
      return next;
    });
  }

  function toggleBestBet(gameId: string) {
    setSaved(false);
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
    if (saving || !hasCard) return;
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

    if (Object.keys(lockedPicks).length !== games.length) {
      setSaveError("Pick a side and confidence for every game.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    const cloud = await savePicksToCloud({
      weekNumber,
      picks: lockedPicks,
      bestBetId,
      propChoice,
    });

    if (!cloud.ok) {
      setSaveError(cloud.error || "Cloud save failed — try again");
      setSaving(false);
      return;
    }

    setPicks(lockedPicks);
    setSaved(true);
    setSaving(false);
  }

  const allGamesPicked =
    hasCard &&
    games.length > 0 &&
    games.every((g) => picks[g.id]?.pick && (picks[g.id]?.confidence ?? 0) > 0) &&
    propChoice !== null &&
    bestBetId !== null &&
    usedConfidence.length === games.length;

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Week {weekNumber} Picks</h1>
          <p className="text-sm text-muted">
            {leagueName ? `${leagueName} • ` : ""}
            Live league card • Saves to the cloud for everyone
          </p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {loadError}
          </div>
        )}

        {!loadError && !hasCard && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium mb-2">No week card published yet</p>
            <p className="text-sm text-muted mb-4">
              The commissioner has to publish Week {weekNumber} games and the prop
              before anyone can pick.
            </p>
            <Link
              href="/commissioner"
              className="text-sm text-primary hover:underline"
            >
              Go to Commissioner tools →
            </Link>
          </div>
        )}

        {hasCard && (
          <>
            {saveError && (
              <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
                {saveError}
              </div>
            )}
            {saved && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
                ✓ Picks saved to the league. Edit below and Save again before
                kickoff if you change your mind.
              </div>
            )}

            <div className="space-y-4 mb-8">
              {games.map((game) => {
                const pick = picks[game.id];
                const isBest = bestBetId === game.id;
                const displaySpread = pick?.lockedSpread ?? game.spread;
                const displayFavorite = pick?.lockedFavorite ?? game.favorite;

                return (
                  <div
                    key={game.id}
                    className={`rounded-xl border bg-card p-4 transition ${
                      isBest
                        ? "border-primary/60 ring-1 ring-primary/30"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted">
                        {game.startTime || "TBD"}
                      </span>
                      {isBest && (
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          BEST BET (2×)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => selectSide(game.id, "away")}
                        className={`p-3 rounded-lg border text-left transition ${
                          pick?.pick === "away"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Away
                        </div>
                        <div className="font-medium">{game.awayTeam}</div>
                        <div className="text-xs text-muted mt-0.5">
                          {formatSpread(displaySpread, displayFavorite, "away")}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => selectSide(game.id, "home")}
                        className={`p-3 rounded-lg border text-left transition ${
                          pick?.pick === "home"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                          Home
                        </div>
                        <div className="font-medium">{game.homeTeam}</div>
                        <div className="text-xs text-muted mt-0.5">
                          {formatSpread(displaySpread, displayFavorite, "home")}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1.5 items-center">
                        {!pick?.pick && (
                          <span className="text-xs text-muted mr-2">
                            Pick a team first
                          </span>
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
                        type="button"
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

                    {saved && pick && (
                      <div className="text-xs text-muted mt-2">
                        Last saved line for scoring snapshot:{" "}
                        {formatSpread(
                          pick.lockedSpread,
                          pick.lockedFavorite,
                          pick.pick
                        )}{" "}
                        (updates when you Save again)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 mb-8">
              <div className="text-xs text-muted mb-1">
                Weekly Prop • {prop.points} pts
              </div>
              <div className="font-medium mb-3">{prop.question}</div>
              <div className="grid grid-cols-2 gap-3">
                {prop.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setPropChoice(opt);
                    }}
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
              type="button"
              onClick={savePicks}
              disabled={!allGamesPicked || saving}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Update Picks" : "Save Picks"}
            </button>
            {!allGamesPicked && (
              <p className="text-xs text-muted text-center mt-2">
                Need: side + unique confidence 1–5 on every game, one Best Bet,
                and a prop choice.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
