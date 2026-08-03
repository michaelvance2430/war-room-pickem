"use client";

/**
 * Season Opening — first official War Room Moment.
 *
 * Do not optimize for visual spectacle. Optimize for emotional memory.
 * If removing an effect makes the ceremony feel more authentic, remove it.
 *
 * Four beats: Anticipation → Celebration → Transition → Arrival.
 * ≤ ~5s. Skip allowed. Lands on Home. No tutorial. No CTA stack.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  beginSeasonOpenShow,
  completeSeasonOpenShow,
  evaluateSeasonOpenEligibility,
  EVENT_SEASON_OPEN_PREVIEW,
  PRACTICE_OVER_LINES,
  type SeasonOpenShowPayload,
} from "@/lib/moments/season-open";
import { seasonOpenMomentIdForSport } from "@/lib/moments/registry";

type Phase = "anticipation" | "celebration" | "transition" | "done";

const PHASE_MS = {
  anticipation: 700,
  celebration: 2400,
  transition: 1600,
} as const;

export default function SeasonOpeningMoment() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<SeasonOpenShowPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("anticipation");
  const timers = useRef<number[]>([]);
  const finished = useRef(false);
  const payloadRef = useRef<SeasonOpenShowPayload | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const finish = useCallback(
    (skipped: boolean) => {
      if (finished.current) return;
      finished.current = true;
      clearTimers();
      const p = payloadRef.current;
      if (p) {
        completeSeasonOpenShow({
          preview: p.preview,
          momentId: seasonOpenMomentIdForSport(p.sport),
          sport: p.sport,
          speechId: p.speech.id,
          skipped,
        });
      }
      payloadRef.current = null;
      setPhase("done");
      setPayload(null);
    },
    [clearTimers]
  );

  const runPhases = useCallback(
    (show: SeasonOpenShowPayload) => {
      finished.current = false;
      payloadRef.current = show;
      setPayload(show);
      setPhase("anticipation");
      clearTimers();

      const t1 = window.setTimeout(() => {
        setPhase("celebration");
      }, PHASE_MS.anticipation);

      const t2 = window.setTimeout(() => {
        setPhase("transition");
      }, PHASE_MS.anticipation + PHASE_MS.celebration);

      const t3 = window.setTimeout(() => {
        finish(false);
      }, PHASE_MS.anticipation + PHASE_MS.celebration + PHASE_MS.transition);

      timers.current = [t1, t2, t3];
    },
    [clearTimers, finish]
  );

  // Production path — Home only, once per user·league·sport·season
  useEffect(() => {
    if (pathname !== "/" && pathname !== "") return;

    let cancelled = false;
    const tryShow = () => {
      if (cancelled || payloadRef.current) return;
      const elig = evaluateSeasonOpenEligibility({ pathname: "/" });
      if (!elig.ok) return;
      const show = beginSeasonOpenShow({ preview: false });
      if (show && !cancelled) runPhases(show);
    };

    // Let Home paint first — arrival feels natural, not a hijack
    const t = window.setTimeout(tryShow, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per home mount / session tick
  }, [pathname]);

  // Foundry preview — no claim burn
  useEffect(() => {
    function onPreview() {
      const show = beginSeasonOpenShow({ preview: true });
      if (show) {
        clearTimers();
        finished.current = false;
        runPhases(show);
      }
    }
    window.addEventListener(EVENT_SEASON_OPEN_PREVIEW, onPreview);
    return () => {
      window.removeEventListener(EVENT_SEASON_OPEN_PREVIEW, onPreview);
    };
  }, [clearTimers, runPhases]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!payload || phase === "done") return null;

  const isNfl = payload.sport === "nfl";
  const glow = isNfl
    ? "rgba(193,18,31,0.32)"
    : "rgba(34,197,94,0.28)";
  const accent = isNfl ? "text-[#f0a8ae]" : "text-primary";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-open-moment-title"
      data-moment="season_open"
      data-sport={payload.sport}
      data-phase={phase}
    >
      {/* Dim — anticipation / hold */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          phase === "anticipation" ? "bg-black/95" : "bg-black/90"
        }`}
      />

      {/* Sport-identifiable wash — recognizable before words */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: phase === "anticipation" ? 0.15 : 0.55,
          background: isNfl
            ? `radial-gradient(ellipse 75% 55% at 50% 42%, ${glow}, transparent 62%),
               linear-gradient(180deg, rgba(20,8,10,0.4) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)`
            : `radial-gradient(ellipse 75% 55% at 50% 42%, ${glow}, transparent 62%),
               linear-gradient(180deg, rgba(6,20,12,0.35) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)`,
        }}
      />

      {/* Soft field grain — not particle confetti */}
      {phase !== "anticipation" && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 3px)",
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-lg text-center">
        {phase === "anticipation" && (
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-muted animate-pulse">
            {isNfl ? "Hold for kickoff" : "Hold for Saturday"}
          </p>
        )}

        {phase === "celebration" && (
          <div className="space-y-5 transition-opacity duration-500">
            <p
              className={`text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] ${accent}`}
            >
              {payload.speech.kicker}
            </p>
            <h1
              id="season-open-moment-title"
              className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.08]"
              style={{
                filter: isNfl
                  ? "drop-shadow(0 0 28px rgba(193,18,31,0.35))"
                  : "drop-shadow(0 0 28px rgba(34,197,94,0.3))",
              }}
            >
              {payload.leagueName}
            </h1>
            <p className="text-lg sm:text-2xl font-bold text-primary tracking-tight">
              {payload.seasonKey}
            </p>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-md mx-auto">
              {payload.speech.line}
            </p>
          </div>
        )}

        {phase === "transition" && (
          <div className="space-y-3 transition-opacity duration-500">
            <p
              id="season-open-moment-title"
              className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
            >
              {PRACTICE_OVER_LINES.primary}
            </p>
            <p className={`text-xl sm:text-2xl font-bold ${accent}`}>
              {PRACTICE_OVER_LINES.secondary}
            </p>
          </div>
        )}

        {/* Single quiet skip — no CTA stack */}
        <button
          type="button"
          onClick={() => finish(true)}
          className="mt-10 text-xs font-semibold text-muted/70 hover:text-muted min-h-[44px] px-3"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
