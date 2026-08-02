"use client";

/**
 * Weekly cold-open “broadcast” — first login each week starting Aug 16 2026.
 * Plays once per player/league/week. Foundry can force-preview anytime.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EVENT_FORCE_WEEKLY_COLD_OPEN,
  getWeeklyColdOpenCopy,
  markWeeklyColdOpenSeen,
  shouldShowWeeklyColdOpen,
  WEEKLY_COLD_OPEN_VIDEO_SRC,
} from "@/lib/weekly-cold-open";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import { claimSessionDrama, clearSessionDrama } from "@/lib/session-drama";
import BrandMark from "@/components/BrandMark";

const POSTER = "/videos/kahmann-cold-open-poster.jpg";

/** Beat timeline for the faux broadcast (ms from start). */
const BEATS: { at: number; line: string }[] = [
  {
    at: 0,
    line: "WRN Investigative Desk — live",
  },
  {
    at: 1200,
    line: "Is Kahmann a time traveler…",
  },
  {
    at: 3200,
    line: "…or just a no-good cheat!?!!?",
  },
  {
    at: 5200,
    line: "(Kahmann — pronounced COMMON)",
  },
  {
    at: 7200,
    line: "Kalshi odds: Andy & Definitely — NOT winning it again.",
  },
];

const RUN_MS = 10_500;

export default function WeeklyColdOpenModal() {
  const [open, setOpen] = useState(false);
  /** Foundry preview — does not count as “seen this week” */
  const [preview, setPreview] = useState(false);
  const [beat, setBeat] = useState(0);
  const [progress, setProgress] = useState(0);
  const [videoOk, setVideoOk] = useState(false);
  const [runId, setRunId] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const copy = getWeeklyColdOpenCopy();

  const openBroadcast = useCallback((opts?: { preview?: boolean }) => {
    setPreview(!!opts?.preview);
    setBeat(0);
    setProgress(0);
    setVideoOk(false);
    setRunId((n) => n + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onForce(e: Event) {
      const ce = e as CustomEvent<{ preview?: boolean }>;
      const isPreview = ce.detail?.preview !== false;
      // Foundry preview: always open (even guest/demo edge cases for creator)
      if (!isPreview) {
        if (!claimSessionDrama("weekly_cold_open")) return;
      } else {
        clearSessionDrama("weekly_cold_open");
      }
      openBroadcast({ preview: isPreview });
    }

    // Force listener always on — Foundry “watch” must work for formatting checks
    window.addEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);

    if (isGuestMode()) {
      return () => {
        window.removeEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);
      };
    }

    function tryOpen() {
      const session = getSession();
      if (!session?.playerId) return;
      if (!shouldShowWeeklyColdOpen()) return;
      if (needsPlayerTutorial() || isPlayerTutorialActive()) return;
      try {
        if (sessionStorage.getItem("warroom-no-welcome-this-session") === "1") {
          return;
        }
      } catch {
        /* ok */
      }
      if (!claimSessionDrama("weekly_cold_open")) return;
      openBroadcast({ preview: false });
    }

    const t = window.setTimeout(tryOpen, 900);
    window.addEventListener("warroom-first-week-progress", tryOpen);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("warroom-first-week-progress", tryOpen);
      window.removeEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);
    };
  }, [openBroadcast]);

  // Progress + beat clock while open
  useEffect(() => {
    if (!open) return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - t0;
      setProgress(Math.min(1, elapsed / RUN_MS));
      let bi = 0;
      for (let i = 0; i < BEATS.length; i++) {
        if (elapsed >= BEATS[i].at) bi = i;
      }
      setBeat(bi);
      if (elapsed >= RUN_MS) {
        window.clearInterval(id);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [open, runId]);

  // Probe MP4 — if missing, stay on poster package
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(WEEKLY_COLD_OPEN_VIDEO_SRC, { method: "HEAD" })
      .then((r) => {
        if (!cancelled && r.ok) setVideoOk(true);
      })
      .catch(() => {
        if (!cancelled) setVideoOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, runId]);

  useEffect(() => {
    if (!open || !videoOk) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => setVideoOk(false));
  }, [open, videoOk, runId]);

  function dismiss() {
    // Only burn the once-per-week flag for real (non-Foundry) shows
    if (!preview) {
      markWeeklyColdOpenSeen();
    }
    clearSessionDrama("weekly_cold_open");
    setOpen(false);
    setPreview(false);
  }

  if (!open) return null;

  const caption = BEATS[beat]?.line || copy.headline;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-open-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/92 backdrop-blur-sm"
        aria-label="Close broadcast"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-lg max-h-[94vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-amber-400/40 bg-black shadow-[0_0_60px_rgba(251,191,36,0.15)] flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-amber-400/25 bg-amber-500/10 flex items-center gap-3 shrink-0">
          <BrandMark size={40} variant="force" className="rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              {copy.stamp}
              {preview ? " · Foundry preview" : ""}
            </p>
            <p
              id="cold-open-title"
              className="text-sm font-extrabold text-foreground leading-snug"
            >
              Weekly cold open
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 animate-pulse">
            ● LIVE
          </span>
        </div>

        <div className="relative aspect-video bg-black overflow-hidden shrink-0">
          {videoOk ? (
            <video
              key={runId}
              ref={videoRef}
              src={WEEKLY_COLD_OPEN_VIDEO_SRC}
              poster={POSTER}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              onEnded={dismiss}
              onError={() => setVideoOk(false)}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={POSTER}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: `scale(${1.05 + progress * 0.08})`,
                  transition: "transform 0.2s linear",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.4)_2px,rgba(0,0,0,0.4)_4px)]" />
            </>
          )}

          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
            <div className="rounded-lg border border-amber-400/35 bg-black/80 backdrop-blur-sm px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-1">
                Breaking · {copy.phonetic}
              </p>
              <p className="text-sm sm:text-base font-bold text-white leading-snug min-h-[2.5rem]">
                {caption}
              </p>
            </div>
          </div>

          <div className="absolute top-0 inset-x-0 h-1 bg-white/10">
            <div
              className="h-full bg-amber-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="px-4 py-3 space-y-2 text-sm text-muted leading-relaxed overflow-y-auto">
          <p className="text-foreground font-medium">{copy.body}</p>
          <p className="text-amber-100/90 font-semibold">{copy.kalshi}</p>
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm"
          >
            {progress >= 1
              ? preview
                ? "Close preview"
                : copy.cta
              : preview
                ? "Close preview"
                : "Skip broadcast"}
          </button>
          <p className="text-[10px] text-muted text-center">
            {preview
              ? "Foundry preview · does not count as this week’s login play"
              : "Once this week · first login only"}
          </p>
        </div>
      </div>
    </div>
  );
}
