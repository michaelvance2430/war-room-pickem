"use client";

/**
 * Season Opening — first official War Room Moment.
 *
 * ⭐⭐⭐⭐⭐ Emotional Budget — one of ~four max-spend Moments per season.
 * Optimize for **authentic spectacle** (stadium / broadcast Opening Day),
 * not software celebration or random particle spam.
 *
 * Beats: Anticipation → Celebration → Transition → Silence → Fade → Home.
 * "Practice is over. The season is here." must breathe.
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
import { playSeasonOpenCue } from "@/lib/moments/season-open-audio";

type Phase =
  | "anticipation"
  | "celebration"
  | "transition"
  | "silence"
  | "fade"
  | "done";

/**
 * ~7.5s total — peak budget earns the breath.
 * Silence after the Practice line is the power move.
 */
const PHASE_MS = {
  anticipation: 900,
  celebration: 2800,
  transition: 1800,
  silence: 1400,
  fade: 700,
} as const;

function flashPositions(count: number, seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const out: { left: string; top: string; delay: string; size: string }[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const left = 8 + (h % 84);
    h = (h * 1103515245 + 12345) >>> 0;
    const top = 10 + (h % 70);
    h = (h * 1103515245 + 12345) >>> 0;
    const delay = ((h % 40) / 10).toFixed(2);
    h = (h * 1103515245 + 12345) >>> 0;
    const size = 2 + (h % 5);
    out.push({
      left: `${left}%`,
      top: `${top}%`,
      delay: `${delay}s`,
      size: `${size}px`,
    });
  }
  return out;
}

export default function SeasonOpeningMoment() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<SeasonOpenShowPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("anticipation");
  const timers = useRef<number[]>([]);
  const finished = useRef(false);
  const payloadRef = useRef<SeasonOpenShowPayload | null>(null);
  const stopAudio = useRef<(() => void) | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const stopCue = useCallback(() => {
    try {
      stopAudio.current?.();
    } catch {
      /* ok */
    }
    stopAudio.current = null;
  }, []);

  const finish = useCallback(
    (skipped: boolean) => {
      if (finished.current) return;
      finished.current = true;
      clearTimers();
      stopCue();
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
    [clearTimers, stopCue]
  );

  const runPhases = useCallback(
    (show: SeasonOpenShowPayload) => {
      finished.current = false;
      payloadRef.current = show;
      setPayload(show);
      setPhase("anticipation");
      clearTimers();
      stopCue();

      // Sound on celebration — stadium cue, not a jingle
      const tAudio = window.setTimeout(() => {
        stopAudio.current = playSeasonOpenCue(show.sport);
      }, PHASE_MS.anticipation - 80);

      const t1 = window.setTimeout(() => {
        setPhase("celebration");
      }, PHASE_MS.anticipation);

      const t2 = window.setTimeout(() => {
        setPhase("transition");
      }, PHASE_MS.anticipation + PHASE_MS.celebration);

      const t3 = window.setTimeout(() => {
        setPhase("silence");
        stopCue();
      }, PHASE_MS.anticipation + PHASE_MS.celebration + PHASE_MS.transition);

      const t4 = window.setTimeout(() => {
        setPhase("fade");
      }, PHASE_MS.anticipation +
        PHASE_MS.celebration +
        PHASE_MS.transition +
        PHASE_MS.silence);

      const t5 = window.setTimeout(() => {
        finish(false);
      }, PHASE_MS.anticipation +
        PHASE_MS.celebration +
        PHASE_MS.transition +
        PHASE_MS.silence +
        PHASE_MS.fade);

      timers.current = [tAudio, t1, t2, t3, t4, t5];
    },
    [clearTimers, finish, stopCue]
  );

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

    const t = window.setTimeout(tryShow, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  useEffect(
    () => () => {
      clearTimers();
      stopCue();
    },
    [clearTimers, stopCue]
  );

  if (!payload || phase === "done") return null;

  const isNfl = payload.sport === "nfl";
  const accent = isNfl ? "text-[#f0a8ae]" : "text-primary";
  const flashes = flashPositions(
    isNfl ? 14 : 12,
    `${payload.sport}:${payload.speech.id}`
  );
  const showAtmosphere =
    phase === "celebration" ||
    phase === "transition" ||
    phase === "silence";
  const showLines = phase === "transition" || phase === "silence";
  const fading = phase === "fade";

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-5 sm:p-8 season-open-root ${
        fading ? "season-open-fade-out" : ""
      } ${isNfl ? "season-open-nfl" : "season-open-cfb"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-open-moment-title"
      data-moment="season_open"
      data-sport={payload.sport}
      data-phase={phase}
    >
      {/* Black house lights */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          phase === "anticipation"
            ? "bg-black opacity-100"
            : fading
              ? "bg-black/95 opacity-100"
              : "bg-black/88 opacity-100"
        }`}
      />

      {/* Stadium bowl wash — sport identity before words */}
      <div
        className={`pointer-events-none absolute inset-0 season-open-bowl transition-opacity duration-700 ${
          phase === "anticipation"
            ? "opacity-20"
            : showAtmosphere
              ? "opacity-100"
              : "opacity-40"
        }`}
      />

      {/* Smoke / haze layer */}
      {showAtmosphere && (
        <div className="pointer-events-none absolute inset-0 season-open-smoke" />
      )}

      {/* Stadium light beams */}
      {showAtmosphere && (
        <>
          <div className="pointer-events-none absolute inset-0 season-open-beam season-open-beam-l" />
          <div className="pointer-events-none absolute inset-0 season-open-beam season-open-beam-r" />
          <div className="pointer-events-none absolute inset-0 season-open-beam season-open-beam-c" />
        </>
      )}

      {/* Camera flashes — broadcast / crowd phones, not confetti */}
      {phase === "celebration" &&
        flashes.map((f, i) => (
          <span
            key={i}
            className="pointer-events-none absolute season-open-flash"
            style={{
              left: f.left,
              top: f.top,
              width: f.size,
              height: f.size,
              animationDelay: f.delay,
            }}
          />
        ))}

      {/* Field / broadcast bottom bar */}
      {showAtmosphere && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] season-open-field" />
      )}

      {/* Scan / broadcast grit */}
      {showAtmosphere && (
        <div className="pointer-events-none absolute inset-0 season-open-scan" />
      )}

      <div
        className={`relative z-10 w-full max-w-lg text-center transition-opacity duration-500 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      >
        {phase === "anticipation" && (
          <div className="space-y-4">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.42em] text-white/50 season-open-hold">
              {isNfl ? "Opening Weekend" : "Opening Saturday"}
            </p>
            <div className="mx-auto h-px w-16 bg-white/25 season-open-hold-line" />
          </div>
        )}

        {phase === "celebration" && (
          <div className="space-y-5 season-open-celebrate-in">
            <p
              className={`text-[11px] sm:text-xs font-bold uppercase tracking-[0.34em] ${accent}`}
            >
              {payload.speech.kicker}
            </p>
            <h1
              id="season-open-moment-title"
              className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.05] season-open-title"
            >
              {payload.leagueName}
            </h1>
            <p className="text-lg sm:text-2xl font-bold text-primary tracking-tight">
              {payload.seasonKey}
            </p>
            <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-md mx-auto">
              {payload.speech.line}
            </p>
          </div>
        )}

        {showLines && (
          <div
            className={`space-y-4 ${
              phase === "transition"
                ? "season-open-transition-in"
                : "season-open-silence-hold"
            }`}
          >
            <p
              id="season-open-moment-title"
              className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight"
            >
              {PRACTICE_OVER_LINES.primary}
            </p>
            <p className={`text-xl sm:text-3xl font-bold ${accent}`}>
              {PRACTICE_OVER_LINES.secondary}
            </p>
            {phase === "silence" && (
              <p className="pt-4 text-[10px] uppercase tracking-[0.28em] text-white/35">
                {isNfl ? "The room is live" : "The room is open"}
              </p>
            )}
          </div>
        )}

        {/* Skip stays quiet — never competes with the door opening */}
        {phase !== "fade" && (
          <button
            type="button"
            onClick={() => finish(true)}
            className="mt-12 text-[11px] font-semibold text-white/35 hover:text-white/60 min-h-[44px] px-3"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
