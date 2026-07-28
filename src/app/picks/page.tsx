"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { Game, UserPick, Prop } from "@/lib/types";
import { getSession, getLeague } from "@/lib/league";
import {
  loadWeekCard,
  savePicksToCloud,
  loadMyPicks,
  loadLeagueActiveWeek,
  cardRevision,
} from "@/lib/cloud";
import { createClient } from "@/lib/supabase/client";
import { formatRankedTeam } from "@/lib/rankings";
import {
  formatKickoff,
  formatCardDateRange,
  weekTitle,
  weekSubtitle,
} from "@/lib/dates";

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

const POLL_MS = 12_000;

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
  const [cardNotice, setCardNotice] = useState<string | null>(null);

  const revisionRef = useRef<string>("");
  const picksRef = useRef(picks);
  const bestBetRef = useRef(bestBetId);
  const propChoiceRef = useRef(propChoice);
  const savedRef = useRef(saved);
  picksRef.current = picks;
  bestBetRef.current = bestBetId;
  propChoiceRef.current = propChoice;
  savedRef.current = saved;

  const applyCard = useCallback(
    async (
      cloud: NonNullable<Awaited<ReturnType<typeof loadWeekCard>>>,
      opts: { isInitial: boolean }
    ) => {
      const rev = cardRevision(cloud);
      const changed =
        !!revisionRef.current && revisionRef.current !== rev;

      setWeekNumber(cloud.weekNumber);
      setHasCard(true);
      setGames(cloud.games);
      setProp(cloud.prop);
      setLoadError(null);

      if (opts.isInitial || !revisionRef.current) {
        revisionRef.current = rev;
        const mine = await loadMyPicks(cloud.weekNumber);
        if (mine) {
          // Keep only picks that still match current card game ids
          const validIds = new Set(cloud.games.map((g) => g.id));
          const filtered: Record<string, UserPick> = {};
          for (const [id, p] of Object.entries(mine.picks || {})) {
            if (validIds.has(id)) filtered[id] = p;
          }
          picksRef.current = filtered;
          setPicks(filtered);
          const bb =
            mine.bestBetId && validIds.has(mine.bestBetId)
              ? mine.bestBetId
              : null;
          bestBetRef.current = bb;
          setBestBetId(bb);
          const propOk =
            mine.propChoice &&
            cloud.prop.options.includes(mine.propChoice)
              ? mine.propChoice
              : null;
          propChoiceRef.current = propOk;
          setPropChoice(propOk);
          setSaved(
            !!mine.lockedAt &&
              Object.keys(filtered).length === cloud.games.length
          );
          const used = Object.values(filtered)
            .map((p) => p.confidence)
            .filter((c) => c > 0);
          setUsedConfidence(used);
        } else {
          picksRef.current = {};
          bestBetRef.current = null;
          propChoiceRef.current = null;
          setPicks({});
          setBestBetId(null);
          setPropChoice(null);
          setSaved(false);
          setUsedConfidence([]);
        }
        return;
      }

      if (!changed) return;

      revisionRef.current = rev;
      const validIds = new Set(cloud.games.map((g) => g.id));
      const prev = picksRef.current;
      const kept: Record<string, UserPick> = {};
      for (const [id, p] of Object.entries(prev)) {
        if (validIds.has(id)) kept[id] = p;
      }
      const dropped = Object.keys(prev).length - Object.keys(kept).length;
      picksRef.current = kept;
      setPicks(kept);

      let bb = bestBetRef.current;
      if (bb && !validIds.has(bb)) {
        bb = null;
        bestBetRef.current = null;
        setBestBetId(null);
      }

      if (
        propChoiceRef.current &&
        !cloud.prop.options.includes(propChoiceRef.current)
      ) {
        propChoiceRef.current = null;
        setPropChoice(null);
      }

      const used = Object.values(kept)
        .map((p) => p.confidence)
        .filter((c) => c > 0);
      setUsedConfidence(used);

      if (dropped > 0 || Object.keys(kept).length < cloud.games.length) {
        setSaved(false);
        setCardNotice(
          "Commissioner updated this week’s games. Your card refreshed automatically — re-check picks and Save again."
        );
      } else {
        setCardNotice(
          "Commissioner updated the card (lines/prop). Review and Save if needed."
        );
      }
    },
    []
  );

  const refreshFromCloud = useCallback(
    async (opts: { isInitial?: boolean } = {}) => {
      const session = getSession();
      const league = getLeague();
      if (!session?.leagueId) {
        if (opts.isInitial) {
          setLoadError("No league selected. Go home and join or create a league.");
          setLoaded(true);
        }
        return null;
      }

      if (opts.isInitial) {
        setLeagueName(league?.name || "");
        setLoadError(null);
      }

      try {
        let week = await loadLeagueActiveWeek();
        let cloud = await loadWeekCard(week);

        // Fallback: find any published week if active week has no card yet
        if (!cloud?.games?.length) {
          const max = league?.settings?.regularSeasonWeeks ?? 13;
          for (let w = 0; w <= max; w++) {
            const tryCard = await loadWeekCard(w);
            if (tryCard?.games?.length) {
              cloud = tryCard;
              week = w;
              break;
            }
          }
        }

        if (!cloud || !cloud.games.length) {
          setHasCard(false);
          setGames([]);
          setWeekNumber(week);
          if (opts.isInitial) setLoaded(true);
          return null;
        }

        await applyCard(cloud, { isInitial: !!opts.isInitial });
        return cloud;
      } catch (e: unknown) {
        if (opts.isInitial) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load weekly card"
          );
        }
        return null;
      } finally {
        if (opts.isInitial) setLoaded(true);
      }
    },
    [applyCard]
  );

  useEffect(() => {
    void refreshFromCloud({ isInitial: true });

    const poll = setInterval(() => {
      void refreshFromCloud({ isInitial: false });
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFromCloud({ isInitial: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Live push when Supabase Realtime is enabled on the project
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    try {
      const session = getSession();
      if (session?.leagueId) {
        const supabase = createClient();
        channel = supabase
          .channel(`week-card-${session.leagueId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "week_cards",
              filter: `league_id=eq.${session.leagueId}`,
            },
            () => {
              void refreshFromCloud({ isInitial: false });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "card_games",
            },
            () => {
              void refreshFromCloud({ isInitial: false });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "leagues",
              filter: `id=eq.${session.leagueId}`,
            },
            () => {
              void refreshFromCloud({ isInitial: false });
            }
          )
          .subscribe();
      }
    } catch {
      /* polling still works */
    }

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (channel) {
        try {
          const supabase = createClient();
          void supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [refreshFromCloud]);

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
    setSaving(true);
    setSaveError(null);

    // Pull latest card so we never save against a stale slate
    const latest = await refreshFromCloud({ isInitial: false });
    const cardGames = latest?.games ?? games;
    const cardWeek = latest?.weekNumber ?? weekNumber;
    const currentPicks = picksRef.current;
    const currentBest = bestBetRef.current;
    const currentProp = propChoiceRef.current;

    const lockedPicks: Record<string, UserPick> = {};
    for (const g of cardGames) {
      const p = currentPicks[g.id];
      if (!p) continue;
      lockedPicks[g.id] = {
        ...p,
        lockedSpread: g.spread,
        lockedFavorite: g.favorite,
        isBestBet: currentBest === g.id,
      };
    }

    if (Object.keys(lockedPicks).length !== cardGames.length) {
      setSaveError(
        "Pick a side and confidence for every game on the current card."
      );
      setSaving(false);
      return;
    }
    if (!currentProp || !currentBest) {
      setSaveError("Need a Best Bet and a prop choice.");
      setSaving(false);
      return;
    }

    const result = await savePicksToCloud({
      weekNumber: cardWeek,
      picks: lockedPicks,
      bestBetId: currentBest,
      propChoice: currentProp,
    });

    if (!result.ok) {
      setSaveError(result.error || "Cloud save failed — try again");
      setSaving(false);
      return;
    }

    setPicks(lockedPicks);
    setSaved(true);
    setCardNotice(null);
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
          <h1 className="text-2xl font-bold">{weekTitle(weekNumber)} Picks</h1>
          <p className="text-sm text-muted">
            {leagueName ? `${leagueName} • ` : ""}
            {weekSubtitle(weekNumber)}
            {games.length
              ? ` • ${formatCardDateRange(games) || "dates on each game"}`
              : ""}
          </p>
          <p className="text-xs text-muted mt-1">
            Private: only you see your picks. Card updates from the commissioner
            show up automatically.
          </p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {loadError}
          </div>
        )}

        {cardNotice && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary flex items-start justify-between gap-3">
            <span>{cardNotice}</span>
            <button
              type="button"
              className="text-xs shrink-0 underline"
              onClick={() => setCardNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!loadError && !hasCard && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium mb-2">No week card published yet</p>
            <p className="text-sm text-muted mb-4">
              The commissioner has to publish a {weekTitle(weekNumber)} card
              before anyone can pick. This page will pick it up automatically.
            </p>
            <button
              type="button"
              onClick={() => void refreshFromCloud({ isInitial: false })}
              className="text-sm text-primary hover:underline"
            >
              Check again
            </button>
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
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">
                          {formatRankedTeam(game.awayTeam, game.awayRank)} @{" "}
                          {formatRankedTeam(game.homeTeam, game.homeRank)}
                        </div>
                        {isBest && (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                            BEST BET (2×)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-primary mt-1">
                        {formatKickoff(game.commenceTime || game.startTime).full}
                      </div>
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
                        <div className="font-medium">
                          {formatRankedTeam(game.awayTeam, game.awayRank)}
                        </div>
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
                        <div className="font-medium">
                          {formatRankedTeam(game.homeTeam, game.homeRank)}
                        </div>
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
