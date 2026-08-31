"use client";

/**
 * Production Build Card — five-minute checklist, not an admin console.
 *
 * Philosophy: Does this help publish this week's card?
 * If no → remove or bury under Advanced.
 *
 * Flow: Pull odds → pick 5 → prop → preview → publish.
 * One primary action per step. Scan labels, not paragraphs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLeague, getSession, isOps } from "@/lib/league";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  listScoredWeekNumbers,
  publishWeekCard,
  saveResultsAndScoreWeek,
  type CloudCard,
} from "@/lib/cloud";
import { fetchFootballOdds } from "@/lib/odds";
import { Game, Prop } from "@/lib/types";
import {
  formatKickoff,
  isCardLockDeadlinePassed,
  weekTitle,
} from "@/lib/dates";
import {
  formatRankedTeam,
  rankedTeamTextClass,
} from "@/lib/rankings";
import {
  defaultPropPreset,
  propFromPreset,
  propCategoriesForSport,
  presetsForCategory,
  getPropPreset,
  matchPresetId,
  categoryForPresetId,
  CUSTOM_PROP_ID,
  type PropCategory,
} from "@/lib/prop-presets";
import type { GameResult } from "@/lib/scoring";
import {
  buildResultsFromScores,
  fetchFootballScores,
  type FinalBoxScore,
} from "@/lib/scores";
import { settlePropFromScores } from "@/lib/prop-settle";
import {
  loadLeagueFavoriteTeamCounts,
  resolveGameLeagueInterest,
  sortGamesByLeagueInterest,
  type LeagueFavoriteCounts,
} from "@/lib/league-favorite-interest";
import LeagueInterestGameMeta, {
  leagueInterestShellClass,
  leagueInterestShellStyle,
} from "@/components/LeagueInterestGameMeta";

type Step = 1 | 2 | 3 | 4 | "score" | "done";

const NEED = 5;

const STEP_LABELS = ["Odds", "Games", "Prop", "Publish"] as const;

/** Favorite line: always beside the favored team, never "fav home" puzzles. */
function favoriteSpreadLabel(spread: number | null | undefined): string {
  if (spread == null || Number.isNaN(Number(spread))) return "";
  const n = Number(spread);
  // Stored as favorite's line (typically negative); show as-is if signed, else −abs
  if (n === 0) return "PK";
  if (n < 0) return String(n);
  return `-${Math.abs(n)}`;
}

function formatSynced(d: Date): string {
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

export default function WeekOpsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const stepParam = searchParams.get("step");
  const sportId = getLeague()?.sportId || "cfb";
  const initialWeek = sportId === "nfl" ? 1 : 0;
  const initialPropPreset = defaultPropPreset(sportId);

  const [week, setWeek] = useState(initialWeek);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const [available, setAvailable] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [leagueFavCounts, setLeagueFavCounts] =
    useState<LeagueFavoriteCounts>({});
  const [gameListSort, setGameListSort] = useState<
    "default" | "league-interest"
  >("default");
  const [propCategory, setPropCategory] = useState<PropCategory>(() =>
    initialPropPreset.category
  );
  const [propPresetId, setPropPresetId] = useState<string>(
    () => initialPropPreset.id
  );
  const [prop, setProp] = useState<Prop>(() =>
    propFromPreset(initialPropPreset, initialWeek)
  );
  const [customQ, setCustomQ] = useState("");
  const [optA, setOptA] = useState("Over");
  const [optB, setOptB] = useState("Under");

  const [scoreCard, setScoreCard] = useState<CloudCard | null>(null);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [finalBoxes, setFinalBoxes] = useState<FinalBoxScore[]>([]);
  const [scoreSyncReport, setScoreSyncReport] = useState<string | null>(null);
  const [manualCorrections, setManualCorrections] = useState<string[]>([]);
  const [doneLabel, setDoneLabel] = useState("");
  /** First-hour host: room just set, or first card path */
  const [roomJustReady, setRoomJustReady] = useState<string | null>(null);
  const isFirstHour =
    searchParams.get("first") === "1" || roomJustReady != null;

  const weekLabel = weekTitle(week, sportId);

  const selectedGames = useMemo(
    () =>
      selectedIds
        .map((id) => available.find((g) => g.id === id))
        .filter(Boolean) as Game[],
    [selectedIds, available]
  );

  const displayedGames = useMemo(
    () =>
      gameListSort === "league-interest"
        ? sortGamesByLeagueInterest(available, leagueFavCounts, sportId)
        : available,
    [available, gameListSort, leagueFavCounts, sportId]
  );

  const boot = useCallback(async () => {
    if (!isOps()) {
      setError("Commissioner or deputy only.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let w =
        weekParam != null && weekParam !== ""
          ? parseInt(weekParam, 10)
          : await loadLeagueActiveWeek();
      if (!Number.isFinite(w)) w = sportId === "nfl" ? 1 : 0;
      setWeek(w);

      const scored = await listScoredWeekNumbers().catch(() => [] as number[]);
      const card = await loadWeekCard(w).catch(() => null);

      const needsScore =
        stepParam === "score" ||
        (!!card?.games?.length &&
          isCardLockDeadlinePassed(card.games) &&
          !scored.includes(w));

      if (needsScore && card) {
        setScoreCard(card);
        setStep("score");
        const init: Record<string, GameResult> = {};
        for (const g of card.games) {
          init[g.id] = { gameId: g.id, winner: null };
        }
        setResults(init);
        setLoading(false);
        return;
      }

      if (card?.games?.length) {
        setAvailable(card.games);
        setSelectedIds(card.games.map((g) => g.id));
        if (card.prop) {
          setProp(card.prop);
          const pid = matchPresetId(card.prop);
          setPropPresetId(pid);
          if (pid !== CUSTOM_PROP_ID) {
            setPropCategory(categoryForPresetId(pid));
          }
        }
        setLastSynced(new Date());
      }

      try {
        const counts = await loadLeagueFavoriteTeamCounts(sportId);
        setLeagueFavCounts(counts);
      } catch {
        setLeagueFavCounts({});
      }

      const sp = stepParam ? parseInt(stepParam, 10) : NaN;
      if (sp >= 1 && sp <= 4) setStep(sp as Step);
      else if (card?.games?.length === NEED && card.prop?.question)
        setStep(4);
      else if (card?.games?.length === NEED) setStep(3);
      else if (card?.games?.length) setStep(2);
      else setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open");
    } finally {
      setLoading(false);
    }
  }, [weekParam, stepParam, sportId]);

  useEffect(() => {
    void boot();
  }, [boot]);

  // Rule of Closure handoff from League Build
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("warroom-league-build-just-done");
      if (!raw) return;
      sessionStorage.removeItem("warroom-league-build-just-done");
      const p = JSON.parse(raw) as { at?: number; name?: string };
      if (p.at && Date.now() - p.at > 15 * 60_000) return;
      setRoomJustReady(p.name?.trim() || getLeague()?.name || "Your room");
    } catch {
      /* ignore */
    }
  }, []);

  async function pullGames() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchFootballOdds(
        sportId === "nfl" ? "nfl" : "cfb",
        week
      );
      setAvailable(res.games || []);
      setLastSynced(new Date());
      void loadLeagueFavoriteTeamCounts(sportId).then(setLeagueFavCounts);
      if (!res.games?.length) setError("No games available.");
      else if (selectedIds.length < NEED) setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleGame(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= NEED) return prev;
      return [...prev, id];
    });
  }

  function applyPreset(preset: ReturnType<typeof getPropPreset>) {
    if (!preset) return;
    setPropPresetId(preset.id);
    setPropCategory(preset.category);
    setProp(propFromPreset(preset, week));
    setCustomQ("");
    setCustomOpen(false);
    setError(null);
  }

  function applyPropCategory(cat: PropCategory) {
    setPropCategory(cat);
    const list = presetsForCategory(cat, sportId);
    const first = list[0];
    if (first) applyPreset(first);
  }

  function applyCustomProp() {
    const q = customQ.trim();
    if (!q || !optA.trim() || !optB.trim()) {
      setError("Need question + two answers.");
      return;
    }
    setPropPresetId(CUSTOM_PROP_ID);
    setProp({
      id: "custom",
      question: q,
      options: [optA.trim(), optB.trim()],
      points: 3,
    });
    setError(null);
  }

  async function publish() {
    if (selectedGames.length !== NEED) {
      setError(`Pick ${NEED} games.`);
      return;
    }
    if (!prop.question?.trim()) {
      setError("Choose a prop.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await publishWeekCard({
        weekNumber: week,
        games: selectedGames,
        prop,
      });
      if (!res.ok) {
        setError(res.error || "Publish failed");
        return;
      }
      setDoneLabel(`${weekLabel} is LIVE.`);
      setStep("done");
      setRoomJustReady(null);
      try {
        const { notifyCardPublished } = await import("@/lib/first-session");
        notifyCardPublished({
          weekNumber: week,
          weekLabel,
        });
      } catch {
        /* optional */
      }
      try {
        const { onWeekCardPublished } = await import("@/lib/coaching/complete");
        onWeekCardPublished(getLeague()?.id);
      } catch {
        /* optional */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function scoreWeek() {
    if (!scoreCard?.games?.length) return;
    for (const g of scoreCard.games) {
      if (!results[g.id]?.winner) {
        setError("Set every game.");
        return;
      }
    }
    if (scoreCard.prop?.question && !propResult) {
      setError("Set prop result.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await saveResultsAndScoreWeek({
        weekNumber: week,
        games: scoreCard.games,
        prop: scoreCard.prop,
        results,
        propResult,
        finalBoxes,
      });
      if (!res.ok) {
        setError(res.error || "Score failed");
        return;
      }
      setDoneLabel(`${weekLabel} scored.`);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Score failed");
    } finally {
      setBusy(false);
    }
  }

  async function fetchFinalScores() {
    if (!scoreCard?.games?.length) return;
    setBusy(true);
    setError(null);
    setScoreSyncReport(null);
    try {
      const response = await fetchFootballScores(
        sportId === "nfl" ? "nfl" : "cfb",
        3
      );
      const built = buildResultsFromScores(scoreCard.games, response.events);
      setResults((current) => ({ ...current, ...built.results }));
      setFinalBoxes(built.boxes);
      setManualCorrections([]);

      const settled = settlePropFromScores({
        prop: scoreCard.prop,
        games: scoreCard.games,
        boxes: built.boxes,
      });
      if (settled.status === "settled" && settled.propResult) {
        setPropResult(settled.propResult);
      }

      setScoreSyncReport(
        built.pending
          ? `${built.filled} final · ${built.pending} pending or unmatched. Fill the rest manually.`
          : `${built.filled} finals loaded. Review every cover before scoring.`
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Final-score retrieval failed"} Manual scoring remains available below.`
      );
    } finally {
      setBusy(false);
    }
  }

  function goHomeDone() {
    router.push("/");
  }

  if (!getSession()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-muted">Sign in</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-muted">…</p>
      </div>
    );
  }

  if (!isOps()) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-3">
          <p className="text-sm text-danger">Host only.</p>
          <Link href="/" className="text-primary font-semibold text-sm">
            Home
          </Link>
        </main>
      </div>
    );
  }

  const buildStep = typeof step === "number" ? step : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        {/* Identity — scannable, not a manual */}
        <header className="mb-5">
          <h1 className="text-2xl font-black tracking-tight">{weekLabel}</h1>
          {lastSynced && step !== "done" && step !== "score" && (
            <p className="text-xs text-muted mt-1">
              Last synced · {formatSynced(lastSynced)}
            </p>
          )}
        </header>

        {/* First-hour: room saved → one job left */}
        {roomJustReady && step !== "done" && step !== "score" && (
          <div className="mb-5 rounded-2xl border-2 border-primary/45 bg-primary/10 px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Room ready
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">
              {roomJustReady} is set.
            </p>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              One job left: pull odds, pick 5 games, add a prop, publish. Then
              friends can open My Picks.
            </p>
          </div>
        )}

        {isFirstHour && !roomJustReady && step === 1 && (
          <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              First card
            </p>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Four steps. One button each. When you hit Publish, the week goes
              live.
            </p>
          </div>
        )}

        {/* Progress — completed steps quiet, current loud */}
        {buildStep >= 1 && buildStep <= 4 && (
          <ol className="flex gap-1 mb-6" aria-label="Progress">
            {STEP_LABELS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const done = buildStep > n;
              const current = buildStep === n;
              return (
                <li
                  key={label}
                  className={`flex-1 rounded-lg px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide ${
                    current
                      ? "bg-primary text-black"
                      : done
                        ? "bg-primary/15 text-primary/80"
                        : "bg-card border border-border text-muted"
                  }`}
                >
                  {done ? "✓" : n} {label}
                </li>
              );
            })}
          </ol>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {/* ── SCORE ───────────────────────────────────────────── */}
        {step === "score" && scoreCard && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void fetchFinalScores()}
              className="w-full min-h-[52px] rounded-xl border-2 border-primary bg-primary/10 text-primary font-extrabold disabled:opacity-50"
            >
              {busy ? "Fetching finals…" : "Fetch Final Scores"}
            </button>
            <p className="text-xs text-muted">
              One tap fills completed games. Every result remains editable before you score.
            </p>
            {scoreSyncReport && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                {scoreSyncReport}
              </p>
            )}
            {manualCorrections.length > 0 && (
              <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Manual correction applied to {manualCorrections.length} game{manualCorrections.length === 1 ? "" : "s"}. Imported box scores for those games will not be archived.
              </p>
            )}
            <p className="text-sm font-bold">Score covers</p>
            {scoreCard.games.map((g) => {
              const r = results[g.id];
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-2"
                >
                  <p className="text-sm font-semibold leading-snug">
                    <span className={rankedTeamTextClass(g.awayRank)}>
                      {formatRankedTeam(g.awayTeam, g.awayRank)}
                    </span>{" "}
                    @{" "}
                    <span className={rankedTeamTextClass(g.homeRank)}>
                      {formatRankedTeam(g.homeTeam, g.homeRank)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["away", g.awayTeam.split(" ").pop() || "Away"],
                        ["home", g.homeTeam.split(" ").pop() || "Home"],
                        ["push", "Push"],
                      ] as const
                    ).map(([w, lab]) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setFinalBoxes((boxes) => boxes.filter((box) => box.gameId !== g.id));
                          setManualCorrections((ids) =>
                            ids.includes(g.id) ? ids : [...ids, g.id]
                          );
                          setResults((prev) => ({
                            ...prev,
                            [g.id]: {
                              gameId: g.id,
                              winner: w as "home" | "away" | "push",
                            },
                          }));
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                          r?.winner === w
                            ? "bg-primary text-black"
                            : "border border-border"
                        }`}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {scoreCard.prop?.question && (
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {scoreCard.prop.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {scoreCard.prop.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPropResult(opt)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                        propResult === opt
                          ? "bg-primary text-black"
                          : "border border-border"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void scoreWeek()}
              className="w-full min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-50"
            >
              {busy ? "…" : `Score ${weekLabel}`}
            </button>
          </div>
        )}

        {/* ── 1 PULL ODDS ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void pullGames()}
              className="w-full min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold disabled:opacity-50 touch-manipulation"
            >
              {busy ? "…" : "Pull Odds"}
            </button>
            {available.length > 0 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full min-h-[48px] rounded-xl border border-border font-semibold"
              >
                Continue · {available.length} games
              </button>
            )}
          </div>
        )}

        {/* ── 2 CHOOSE GAMES ──────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            {/* Progress: five dots — brain sees “two left”, no reading */}
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-2"
                aria-label={`${selectedIds.length} of ${NEED} selected`}
              >
                {Array.from({ length: NEED }, (_, i) => {
                  const filled = i < selectedIds.length;
                  return (
                    <span
                      key={i}
                      className={`inline-block w-3.5 h-3.5 rounded-full transition ${
                        filled
                          ? "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.55)]"
                          : "border-2 border-border bg-transparent"
                      }`}
                      aria-hidden
                    />
                  );
                })}
                {selectedIds.length === NEED && (
                  <span className="text-primary text-lg font-black leading-none ml-0.5">
                    ✓
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pullGames()}
                className="text-xs text-muted font-semibold min-h-[40px] px-2 shrink-0"
              >
                {busy ? "…" : "Sync Odds"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                Sort
              </p>
              <button
                type="button"
                onClick={() => setGameListSort("default")}
                className={`px-3 py-1.5 min-h-[36px] rounded-full text-[11px] font-bold border ${
                  gameListSort === "default"
                    ? "bg-primary/15 border-primary text-primary"
                    : "border-border text-muted"
                }`}
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setGameListSort("league-interest")}
                className={`px-3 py-1.5 min-h-[36px] rounded-full text-[11px] font-bold border ${
                  gameListSort === "league-interest"
                    ? "bg-sky-500/15 border-sky-500/60 text-sky-300"
                    : "border-border text-muted"
                }`}
                title="Does not auto-select games"
              >
                League Interest
              </button>
            </div>

            <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pb-1">
              {displayedGames.map((g) => {
                const on = selectedIds.includes(g.id);
                const full = selectedIds.length >= NEED && !on;
                const awayFav = g.favorite === "away";
                const homeFav = g.favorite === "home";
                const line = favoriteSpreadLabel(g.spread);
                const kick = formatKickoff(g.commenceTime || g.startTime);
                const leagueInterest = resolveGameLeagueInterest(
                  g,
                  leagueFavCounts,
                  sportId
                );

                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={full}
                    onClick={() => toggleGame(g.id)}
                    className={`relative w-full text-left rounded-2xl border-2 px-3.5 py-3.5 min-h-[88px] touch-manipulation transition active:scale-[0.99] disabled:opacity-35 ${
                      on
                        ? "border-primary bg-primary/15 ring-2 ring-primary/30 shadow-[0_0_24px_rgba(34,197,94,0.2)]"
                        : `border-border bg-card hover:border-border/80 ${leagueInterestShellClass(
                            leagueInterest,
                            on
                          )}`
                    }`}
                    style={leagueInterestShellStyle(leagueInterest, on)}
                  >
                    {on && (
                      <span
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center text-lg font-black"
                        aria-hidden
                      >
                        ✓
                      </span>
                    )}

                    {/* AWAY */}
                    <div className={`pr-10 ${on ? "" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                          Away
                        </span>
                        {awayFav && line && (
                          <span className="text-sm font-extrabold text-primary tabular-nums">
                            ⭐ {line}
                          </span>
                        )}
                      </div>
                      <p className={`text-base sm:text-[17px] font-bold leading-snug mt-0.5 ${rankedTeamTextClass(g.awayRank) || "text-foreground"}`}>
                        {formatRankedTeam(g.awayTeam, g.awayRank)}
                      </p>
                    </div>

                    {/* HOME */}
                    <div className="mt-2.5 pr-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                          Home
                        </span>
                        {homeFav && line && (
                          <span className="text-sm font-extrabold text-primary tabular-nums">
                            ⭐ {line}
                          </span>
                        )}
                      </div>
                      <p className={`text-base sm:text-[17px] font-bold leading-snug mt-0.5 ${rankedTeamTextClass(g.homeRank) || "text-foreground"}`}>
                        {formatRankedTeam(g.homeTeam, g.homeRank)}
                      </p>
                    </div>

                    <LeagueInterestGameMeta interest={leagueInterest} />

                    <p className="text-[11px] text-muted mt-2.5">
                      {kick.full}
                    </p>
                  </button>
                );
              })}
              {!available.length && (
                <p className="text-sm text-muted text-center py-6">
                  Sync odds first.
                </p>
              )}
            </div>

            <div className="flex gap-2 sticky bottom-0 pt-2 pb-1 bg-background/95 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 min-h-[52px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={selectedIds.length !== NEED}
                onClick={() => setStep(3)}
                className="flex-1 min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-35"
              >
                Next · Prop
              </button>
            </div>
          </div>
        )}

        {/* ── 3 PROP ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            {/* Four categories — pick type first */}
            <div className="grid grid-cols-4 gap-1.5">
              {propCategoriesForSport(sportId).map((c) => {
                const on = propCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyPropCategory(c.id)}
                    className={`min-h-[44px] rounded-xl text-[11px] font-extrabold uppercase tracking-wide touch-manipulation ${
                      on
                        ? "bg-primary text-black"
                        : "border border-border bg-card text-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted leading-snug">
              {
                propCategoriesForSport(sportId).find(
                  (c) => c.id === propCategory
                )?.blurb
              }
            </p>

            {prop.question && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                <p className="text-sm font-semibold">{prop.question}</p>
                <p className="text-xs text-muted mt-1">
                  {prop.options.join(" · ")}
                </p>
                {getPropPreset(propPresetId)?.settle === "manual" && (
                  <p className="text-xs font-semibold text-warning mt-2">
                    ⚠️ Manual scoring required
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 max-h-[42vh] overflow-y-auto">
              {presetsForCategory(propCategory, sportId).map((p) => {
                const active = propPresetId === p.id;
                const manual = p.settle === "manual";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`w-full text-left rounded-xl border px-3 py-3 min-h-[52px] touch-manipulation transition ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span
                      className={`block text-sm leading-snug ${
                        active ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {active ? "✓ " : ""}
                      {p.label || p.question}
                    </span>
                    {manual && (
                      <span className="block text-[11px] font-semibold text-warning mt-1">
                        ⚠️ Manual scoring required
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              className="text-xs text-muted font-semibold w-full text-left py-1"
            >
              {customOpen ? "▲" : "▼"} Custom prop
            </button>
            {customOpen && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-[11px] font-semibold text-warning">
                  ⚠️ Manual scoring required
                </p>
                <input
                  value={customQ}
                  onChange={(e) => setCustomQ(e.target.value)}
                  placeholder="Question"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={optA}
                    onChange={(e) => setOptA(e.target.value)}
                    placeholder="A"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={optB}
                    onChange={(e) => setOptB(e.target.value)}
                    placeholder="B"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCustomProp}
                  className="w-full py-2.5 rounded-lg border border-border text-xs font-bold min-h-[40px]"
                >
                  Use custom
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 min-h-[52px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!prop.question?.trim()}
                onClick={() => setStep(4)}
                className="flex-1 min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-35"
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {/* ── 4 PREVIEW + PUBLISH ─────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {weekLabel}
              </p>
              {selectedGames.map((g, i) => (
                <div key={g.id} className="text-sm">
                  <span className="text-muted tabular-nums mr-1.5">
                    {i + 1}.
                  </span>
                  <span className="font-semibold">
                    {g.awayTeam} @ {g.homeTeam}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border text-sm">
                <p className="font-semibold">{prop.question}</p>
                <p className="text-xs text-muted mt-0.5">
                  {prop.options.join(" / ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 min-h-[52px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish()}
                className="flex-1 min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold disabled:opacity-50"
              >
                {busy ? "…" : "Publish"}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE — Rule of Closure ──────────────────────────── */}
        {step === "done" && (
          <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-8 text-center space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              It worked
            </p>
            <p className="text-2xl font-black leading-tight">{doneLabel}</p>
            <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
              {/LIVE/i.test(doneLabel)
                ? "Friends can open My Picks now. Home is your resting place."
                : "Standings and the room update from real results. Head Home when you’re ready."}
            </p>
            <button
              type="button"
              onClick={goHomeDone}
              className="w-full min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold touch-manipulation"
            >
              Done → Home
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
