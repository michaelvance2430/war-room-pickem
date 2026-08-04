"use client";

/**
 * Trophy Ceremony — CFB season closeout.
 * Commissioner presides; does not calculate.
 *
 * Flow: Import result → Awards preview → Review → Begin → Season Complete → Home
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, isOps } from "@/lib/league";
import {
  closeCfbSeason,
  resolveSeasonCloseoutReadiness,
  type SeasonCloseoutReadiness,
} from "@/lib/season-closeout";

type Step = "load" | "import" | "awards" | "review" | "working" | "done" | "blocked";

export default function TrophyCeremonyClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("load");
  const [readiness, setReadiness] = useState<SeasonCloseoutReadiness | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const boot = useCallback(async () => {
    if (!isOps()) {
      setError("Commissioner or deputy only.");
      setStep("blocked");
      return;
    }
    setError(null);
    setStep("load");
    try {
      const r = await resolveSeasonCloseoutReadiness();
      setReadiness(r);
      if (r.status === "already-closed") {
        setStep("done");
        return;
      }
      if (r.status === "not-ready") {
        setError(r.reason);
        setStep("blocked");
        return;
      }
      setStep("import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load closeout");
      setStep("blocked");
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  async function beginCeremony() {
    if (busy) return;
    if (!readiness || readiness.status !== "ready") return;
    setBusy(true);
    setError(null);
    setStep("working");
    try {
      const res = await closeCfbSeason({
        expectedReadinessVersion: readiness.version,
      });
      if (!res.ok) {
        setError(res.error);
        setStep("review");
        return;
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Closeout failed");
      setStep("review");
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

  const ready = readiness?.status === "ready" ? readiness : null;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-6 sm:py-10">
        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
            End of season
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Trophy Ceremony
          </h1>
        </header>

        {error && step !== "done" && (
          <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {step === "load" && (
          <p className="text-sm text-muted">Checking championship state…</p>
        )}

        {step === "blocked" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card px-4 py-6">
              <p className="font-bold mb-1">Ceremony not ready</p>
              <p className="text-sm text-muted leading-relaxed">
                {error ||
                  "Championship result not confirmed yet, or the final league week still needs scoring."}
              </p>
              <p className="text-xs text-muted mt-3">
                War Room will not guess. When the title game is final and the last
                week is scored, this door opens on Home.
              </p>
            </div>
            <Link
              href="/"
              className="flex w-full min-h-[52px] items-center justify-center rounded-2xl border border-border font-bold"
            >
              Return Home
            </Link>
          </div>
        )}

        {step === "import" && ready && (
          <div className="space-y-5">
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/10 px-5 py-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">
                National Champion
              </p>
              <p className="text-2xl sm:text-3xl font-black text-foreground">
                {ready.nationalChampion.winnerTeam}
              </p>
              <p className="text-sm text-muted mt-3 tabular-nums">
                Final: {ready.nationalChampion.winnerScore}–
                {ready.nationalChampion.loserScore}
              </p>
              <p className="text-[11px] text-muted mt-1">
                over {ready.nationalChampion.loserTeam}
                {ready.nationalChampion.source === "foundry_sim"
                  ? " · Foundry sim"
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("awards")}
              className="w-full min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold"
            >
              Continue
            </button>
            <Link
              href="/"
              className="block text-center text-sm text-muted font-semibold py-2"
            >
              Cancel
            </Link>
          </div>
        )}

        {step === "awards" && ready && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Calculated from standings, brackets, and Crystal Ball — review only.
            </p>
            <AwardsCard ready={ready} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("import")}
                className="px-4 min-h-[52px] rounded-xl border border-border font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("review")}
                className="flex-1 min-h-[52px] rounded-xl bg-primary text-black font-extrabold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "review" && ready && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card px-4 py-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Season Awards
              </p>
              <AwardsCard ready={ready} compact />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Confirming locks the season, engraves the Museum, and starts the
              ceremony. Safe to retry — awards never duplicate.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("awards")}
                disabled={busy}
                className="px-4 min-h-[52px] rounded-xl border border-border font-semibold disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void beginCeremony()}
                className="flex-1 min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold disabled:opacity-50 shadow-[0_0_32px_rgba(34,197,94,0.35)]"
              >
                {busy ? "…" : "BEGIN TROPHY CEREMONY"}
              </button>
            </div>
          </div>
        )}

        {step === "working" && (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-5 py-12 text-center">
            <p className="text-lg font-bold">Engraving the hardware…</p>
            <p className="text-sm text-muted mt-2">Do not close this tab.</p>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-10 text-center space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Season Complete
            </p>
            <p className="text-xl sm:text-2xl font-black leading-snug">
              The hardware is engraved.
              <br />
              The Museum is updated.
              <br />
              The receipts are permanent.
            </p>
            {readiness?.status === "already-closed" && (
              <p className="text-xs text-muted">
                Closed {new Date(readiness.closedAt).toLocaleString()}
              </p>
            )}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full min-h-[56px] rounded-2xl bg-primary text-black text-base font-extrabold"
            >
              Done
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function AwardsCard({
  ready,
  compact,
}: {
  ready: Extract<SeasonCloseoutReadiness, { status: "ready" }>;
  compact?: boolean;
}) {
  const gap = compact ? "space-y-3" : "space-y-4";
  return (
    <div className={gap}>
      <AwardBlock
        label="League Champion"
        names={ready.leagueChampionNames}
        emoji="🏆"
      />
      <AwardBlock
        label="Toilet Bowl"
        names={ready.toiletBowlNames}
        emoji="🚽"
      />
      <AwardBlock
        label="Village Nerd / Witch / Wizard"
        names={
          ready.crystalBallWinnerNames.length
            ? ready.crystalBallWinnerNames
            : ["— nobody hit the crystal"]
        }
        emoji="🧠"
        muted={!ready.crystalBallWinnerNames.length}
      />
      {ready.otherAwards.map((a) => (
        <AwardBlock
          key={a.type + a.label}
          label={a.label}
          names={a.recipientNames}
          emoji="🛡️"
        />
      ))}
    </div>
  );
}

function AwardBlock({
  label,
  names,
  emoji,
  muted,
}: {
  label: string;
  names: string[];
  emoji: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        muted
          ? "border-border/60 bg-card/50"
          : "border-border bg-card"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-1">
        {emoji} {label}
      </p>
      {names.map((n) => (
        <p
          key={n}
          className={`text-base font-bold ${
            muted ? "text-muted font-medium" : "text-foreground"
          }`}
        >
          {n}
        </p>
      ))}
    </div>
  );
}
