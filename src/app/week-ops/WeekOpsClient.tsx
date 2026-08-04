"use client";

/**
 * Guided weekly card flow — nearly impossible to misunderstand.
 * Steps: 1 Games · 2 Details · 3 Prop · 4 Preview · Done
 * Or score path when week needs scoring.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getLeague,
  getSession,
  isOps,
} from "@/lib/league";
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
import { formatKickoff, isCardLockDeadlinePassed, weekTitle } from "@/lib/dates";
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

  const [available, setAvailable] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prop, setProp] = useState<Prop>(() =>
    propFromPreset(defaultPropPreset("cfb"), 0)
  );
  const [customQ, setCustomQ] = useState("");
  const [optA, setOptA] = useState("Over");
  const [optB, setOptB] = useState("Under");

  // Score path
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

      if (stepParam === "score" || (card?.games?.length && isCardLockDeadlinePassed(card.games) && !scored.includes(w))) {
        setScoreCard(card);
        setStep("score");
        if (card?.games) {
          const init: Record<string, GameResult> = {};
          for (const g of card.games) {
            init[g.id] = { gameId: g.id, winner: null };
          }
          setResults(init);
        }
        setLoading(false);
        return;
      }

      if (card?.games?.length) {
        setAvailable(card.games);
        setSelectedIds(card.games.map((g) => g.id));
        if (card.prop) setProp(card.prop);
      }

      const sp = stepParam ? parseInt(stepParam, 10) : NaN;
      if (sp >= 1 && sp <= 4) setStep(sp as Step);
      else if (card?.games?.length === NEED && card.prop?.question)
        setStep(4);
      else if (card?.games?.length === NEED) setStep(3);
      else setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open week ops");
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
      if (!res.games?.length) {
        setError(
          "No games returned. Try again or open Manage League for full tools."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pull odds");
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
  }

  function applyCustomProp() {
    const q = customQ.trim();
    if (!q || !optA.trim() || !optB.trim()) {
      setError("Prop needs a question and two answers.");
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
      setError(`Select exactly ${NEED} games.`);
      return;
    }
    if (!prop.question?.trim()) {
      setError("Add a weekly prop.");
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
        setBusy(false);
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
    const games = scoreCard.games;
    for (const g of games) {
      const r = results[g.id];
      if (!r || !r.winner) {
        setError("Set a cover (or push) for every game.");
        return;
      }
    }
    if (scoreCard.prop?.question && !propResult) {
      setError("Pick the prop result.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await saveResultsAndScoreWeek({
        weekNumber: week,
        games,
        prop: scoreCard.prop,
        results,
        propResult,
      });
      if (!res.ok) {
        setError(res.error || "Score failed");
        setBusy(false);
        return;
      }
      setDoneLabel(`${weekLabel} is scored.`);
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
        <p className="text-sm text-muted">Sign in to run the week.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (error && !isOps()) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
          <p className="text-sm text-danger">{error}</p>
          <Link href="/" className="text-primary font-semibold">
            Home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Week ops
          </p>
          <h1 className="text-2xl font-black mt-0.5">{weekLabel}</h1>
          {step !== "done" && step !== "score" && (
            <p className="text-xs text-muted mt-1">
              Step {typeof step === "number" ? step : "—"} of 4
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {/* ── SCORE PATH ───────────────────────────────────────── */}
        {step === "score" && scoreCard && (
          <div className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Mark who covered each game, then score the week.
            </p>
            {scoreCard.games.map((g) => {
              const r = results[g.id];
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-2"
                >
                  <p className="text-sm font-semibold">
                    {formatRankedTeam(g.awayTeam, g.awayRank)} @{" "}
                    {formatRankedTeam(g.homeTeam, g.homeRank)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatKickoff(g.commenceTime || g.startTime).full}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setResults((prev) => ({
                          ...prev,
                          [g.id]: { gameId: g.id, winner: "away" },
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                        r?.winner === "away"
                          ? "bg-primary text-black"
                          : "border border-border"
                      }`}
                    >
                      {g.awayTeam.split(" ").pop()} covers
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setResults((prev) => ({
                          ...prev,
                          [g.id]: { gameId: g.id, winner: "home" },
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                        r?.winner === "home"
                          ? "bg-primary text-black"
                          : "border border-border"
                      }`}
                    >
                      {g.homeTeam.split(" ").pop()} covers
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setResults((prev) => ({
                          ...prev,
                          [g.id]: { gameId: g.id, winner: "push" },
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                        r?.winner === "push"
                          ? "bg-primary text-black"
                          : "border border-border"
                      }`}
                    >
                      Push
                    </button>
                  </div>
                </div>
              );
            })}
            {scoreCard.prop?.question && (
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <p className="text-sm font-semibold">{scoreCard.prop.question}</p>
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
              {busy ? "Scoring…" : `Score ${weekLabel}`}
            </button>
          </div>
        )}

        {/* ── STEP 1: GAMES ────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
              1 · Choose {NEED} games
            </p>
            <p className="text-xs text-muted">
              {selectedIds.length}/{NEED} selected
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pullGames()}
              className="w-full min-h-[48px] rounded-xl border border-primary/50 text-primary font-bold disabled:opacity-50"
            >
              {busy ? "Pulling…" : available.length ? "Refresh games" : "Pull odds"}
            </button>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {available.map((g) => {
                const on = selectedIds.includes(g.id);
                const full = selectedIds.length >= NEED && !on;
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={full}
                    onClick={() => toggleGame(g.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 min-h-[52px] touch-manipulation disabled:opacity-40 ${
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
                        ? `Spread ${g.spread > 0 ? "+" : ""}${g.spread} fav ${g.favorite}`
                        : "No line"}
                      {" · "}
                      {formatKickoff(g.commenceTime || g.startTime).full}
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={selectedIds.length !== NEED}
              onClick={() => setStep(2)}
              className="w-full min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── STEP 2: DETAILS ──────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">2 · Confirm details</p>
            <ul className="space-y-2">
              {selectedGames.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-border bg-card px-3 py-3 text-sm"
                >
                  <p className="font-semibold">
                    {g.awayTeam} @ {g.homeTeam}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Line: {g.favorite === "home" ? g.homeTeam : g.awayTeam}{" "}
                    {g.spread != null ? g.spread : "—"} · Kickoff{" "}
                    {formatKickoff(g.commenceTime || g.startTime).full}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 min-h-[48px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 min-h-[48px] rounded-xl bg-primary text-black font-extrabold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PROP ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">3 · Weekly prop</p>
            {prop.question && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 text-sm">
                <p className="font-semibold">{prop.question}</p>
                <p className="text-xs text-muted mt-1">
                  {prop.options.join(" · ")} · {prop.points} pts
                </p>
              </div>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {PROP_PRESETS.filter((p) => presetFitsSport(p, sportId))
                .slice(0, 12)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/50"
                  >
                    {p.question}
                  </button>
                ))}
            </div>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-[10px] font-bold uppercase text-muted">
                Or write your own
              </p>
              <input
                value={customQ}
                onChange={(e) => setCustomQ(e.target.value)}
                placeholder="Prop question"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="Option A"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="Option B"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={applyCustomProp}
                className="w-full py-2 rounded-lg border border-border text-xs font-semibold"
              >
                Use custom prop
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 min-h-[48px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!prop.question?.trim()}
                onClick={() => setStep(4)}
                className="flex-1 min-h-[48px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-40"
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: PREVIEW ──────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">4 · Player preview</p>
            <p className="text-xs text-muted">
              This is how the room will see the card.
            </p>
            <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {weekLabel} · My Picks
              </p>
              {selectedGames.map((g, i) => (
                <div
                  key={g.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <p className="font-semibold">
                    {i + 1}. {g.awayTeam} @ {g.homeTeam}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatKickoff(g.commenceTime || g.startTime).full}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                <p className="text-[10px] uppercase text-primary font-bold">
                  Prop · {prop.points} pts
                </p>
                <p className="font-semibold mt-0.5">{prop.question}</p>
                <p className="text-xs text-muted mt-1">
                  {prop.options.join(" / ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 min-h-[48px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish()}
                className="flex-1 min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-50"
              >
                {busy ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-8 text-center space-y-4">
            <p className="text-2xl font-black text-foreground">{doneLabel}</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full min-h-[52px] rounded-xl bg-primary text-black font-extrabold"
            >
              Done
            </button>
          </div>
        )}

        {step !== "done" && (
          <p className="mt-8 text-center">
            <Link
              href="/commissioner"
              className="text-xs text-muted hover:text-foreground underline-offset-2 hover:underline"
            >
              Manage League
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
