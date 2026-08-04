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
import { formatRankedTeam } from "@/lib/rankings";
import {
  defaultPropPreset,
  propFromPreset,
  presetFitsSport,
  PROP_PRESETS,
} from "@/lib/prop-presets";
import type { GameResult } from "@/lib/scoring";

type Step = 1 | 2 | 3 | 4 | "score" | "done";

const NEED = 5;

const STEP_LABELS = ["Odds", "Games", "Prop", "Publish"] as const;

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

  const [week, setWeek] = useState(0);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [available, setAvailable] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prop, setProp] = useState<Prop>(() =>
    propFromPreset(defaultPropPreset("cfb"), 0)
  );
  const [customQ, setCustomQ] = useState("");
  const [optA, setOptA] = useState("Over");
  const [optB, setOptB] = useState("Under");

  const [scoreCard, setScoreCard] = useState<CloudCard | null>(null);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("");

  const sportId = getLeague()?.sportId || "cfb";
  const weekLabel = weekTitle(week, sportId);

  const selectedGames = useMemo(
    () =>
      selectedIds
        .map((id) => available.find((g) => g.id === id))
        .filter(Boolean) as Game[],
    [selectedIds, available]
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
        if (card.prop) setProp(card.prop);
        setLastSynced(new Date());
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

  function applyPreset(id: string) {
    const preset = PROP_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setProp(propFromPreset(preset, week));
    setCustomQ("");
    setError(null);
  }

  function applyCustomProp() {
    const q = customQ.trim();
    if (!q || !optA.trim() || !optB.trim()) {
      setError("Need question + two answers.");
      return;
    }
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
      setDoneLabel(`${weekLabel} is live.`);
      setStep("done");
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
            <p className="text-sm font-bold">Score covers</p>
            {scoreCard.games.map((g) => {
              const r = results[g.id];
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-2"
                >
                  <p className="text-sm font-semibold leading-snug">
                    {formatRankedTeam(g.awayTeam, g.awayRank)} @{" "}
                    {formatRankedTeam(g.homeTeam, g.homeRank)}
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
                        onClick={() =>
                          setResults((prev) => ({
                            ...prev,
                            [g.id]: {
                              gameId: g.id,
                              winner: w as "home" | "away" | "push",
                            },
                          }))
                        }
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
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold">
                {selectedIds.length}/{NEED}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pullGames()}
                className="text-xs text-muted font-semibold"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-2 max-h-[52vh] overflow-y-auto">
              {available.map((g) => {
                const on = selectedIds.includes(g.id);
                const full = selectedIds.length >= NEED && !on;
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={full}
                    onClick={() => toggleGame(g.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 min-h-[52px] touch-manipulation disabled:opacity-35 ${
                      on
                        ? "border-primary bg-primary/15"
                        : "border-border bg-card"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {on ? "✓ " : ""}
                      {formatRankedTeam(g.awayTeam, g.awayRank)} @{" "}
                      {formatRankedTeam(g.homeTeam, g.homeRank)}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {g.spread != null
                        ? `${g.favorite === "home" ? g.homeTeam.split(" ").pop() : g.awayTeam.split(" ").pop()} ${g.spread}`
                        : "—"}
                      {" · "}
                      {formatKickoff(g.commenceTime || g.startTime).full}
                    </p>
                  </button>
                );
              })}
              {!available.length && (
                <p className="text-sm text-muted text-center py-6">
                  Pull odds first.
                </p>
              )}
            </div>
            <div className="flex gap-2 sticky bottom-0 pt-2 bg-background/95">
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
            {prop.question && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                <p className="text-sm font-semibold">{prop.question}</p>
                <p className="text-xs text-muted mt-1">
                  {prop.options.join(" · ")}
                </p>
              </div>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {PROP_PRESETS.filter((p) => presetFitsSport(p, sportId))
                .slice(0, 10)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs min-h-[44px] ${
                      prop.question === p.question
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-border"
                    }`}
                  >
                    {p.label || p.question}
                  </button>
                ))}
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="text-xs text-muted font-semibold w-full text-left py-1"
            >
              {advancedOpen ? "▲" : "▼"} Custom prop
            </button>
            {advancedOpen && (
              <div className="space-y-2 rounded-xl border border-border p-3">
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

        {/* ── DONE ────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-10 text-center space-y-5">
            <p className="text-2xl font-black">{doneLabel}</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold"
            >
              Done
            </button>
          </div>
        )}

        {/* Advanced — rare path only */}
        {step !== "done" && (
          <details className="mt-10 group">
            <summary className="text-xs text-muted font-semibold cursor-pointer list-none flex items-center gap-1">
              <span className="group-open:hidden">▼</span>
              <span className="hidden group-open:inline">▲</span>
              Advanced
            </summary>
            <div className="mt-2 pl-1 space-y-2 text-xs">
              <Link
                href="/commissioner"
                className="block text-muted hover:text-foreground underline-offset-2 hover:underline py-1"
              >
                Manage League
              </Link>
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
