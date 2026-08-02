"use client";

/**
 * Weekly cold-open — Gazette Network newsroom package.
 * Same station as The War Room Gazette paper (masthead + tagline).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  EVENT_FORCE_WEEKLY_COLD_OPEN,
  GAZETTE_STATION,
  getWeeklyColdOpenCopy,
  markWeeklyColdOpenSeen,
  shouldShowWeeklyColdOpen,
  WEEKLY_COLD_OPEN_VIDEO_SRC,
} from "@/lib/weekly-cold-open";
import { getSession, getLeague } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import { claimSessionDrama, clearSessionDrama } from "@/lib/session-drama";
import BrandMark from "@/components/BrandMark";

const POSTER = "/videos/kahmann-cold-open-poster.jpg";

const BEATS: { at: number; line: string; kicker?: string }[] = [
  {
    at: 0,
    kicker: "GAZETTE NETWORK",
    line: "Live from the newsroom — same desk that prints your paper",
  },
  {
    at: 1800,
    kicker: "INVESTIGATIVE",
    line: "Is Kahmann a time traveler…",
  },
  {
    at: 3800,
    kicker: "BREAKING",
    line: "…or just a no-good cheat!?!!?",
  },
  {
    at: 5600,
    kicker: "PRONUNCIATION DESK",
    line: "Kahmann — pronounced COMMON",
  },
  {
    at: 7600,
    kicker: "MARKETS · KALSHI",
    line: "Andy & Definitely — NOT winning it again.",
  },
];

const RUN_MS = 11_000;

export default function WeeklyColdOpenModal() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [beat, setBeat] = useState(0);
  const [progress, setProgress] = useState(0);
  const [videoOk, setVideoOk] = useState(false);
  const [runId, setRunId] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const copy = getWeeklyColdOpenCopy();
  const room = getLeague()?.name || "War Room";

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
      if (!isPreview) {
        if (!claimSessionDrama("weekly_cold_open")) return;
      } else {
        clearSessionDrama("weekly_cold_open");
      }
      openBroadcast({ preview: isPreview });
    }

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
      if (elapsed >= RUN_MS) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [open, runId]);

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
    if (!preview) markWeeklyColdOpenSeen();
    clearSessionDrama("weekly_cold_open");
    setOpen(false);
    setPreview(false);
  }

  if (!open) return null;

  const caption = BEATS[beat]?.line || copy.headline;
  const kicker = BEATS[beat]?.kicker || "BREAKING";
  const clock = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-open-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/93 backdrop-blur-sm"
        aria-label="Close broadcast"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-lg max-h-[96vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border-2 border-amber-400/50 bg-[#0a0a0a] shadow-[0_0_80px_rgba(251,191,36,0.18)] flex flex-col">
        {/* —— BREAKING NEWS GAZETTE masthead (gold palette, no ticker) —— */}
        <div className="shrink-0 border-b-2 border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-amber-950/40 to-black">
          <div className="bg-amber-400 text-black px-3 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em]">
              ● Breaking news
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              Gazette
              {preview ? " · preview" : ""}
            </span>
            <span className="text-[10px] font-mono tabular-nums font-semibold">
              {clock}
            </span>
          </div>
          <div className="px-3 pt-3 pb-2.5 flex items-center gap-2.5">
            <BrandMark size={40} variant="force" className="rounded shrink-0" />
            <div className="min-w-0 flex-1 text-center">
              <h2
                id="cold-open-title"
                className="text-xl sm:text-2xl font-black tracking-tight text-amber-100 leading-none uppercase"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {GAZETTE_STATION.masthead}
              </h2>
              <p className="text-[10px] text-amber-200/75 italic mt-1">
                {GAZETTE_STATION.tagline}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-black text-amber-300 tracking-widest">
                {GAZETTE_STATION.callSign}
              </p>
              <p className="text-[8px] uppercase text-amber-400/90 font-bold">
                LIVE
              </p>
            </div>
          </div>
          <p className="text-[9px] text-amber-200/50 text-center pb-2 tracking-wide uppercase">
            {room} · {GAZETTE_STATION.desk}
          </p>
        </div>

        {/* —— Newsroom stage —— */}
        <div className="relative aspect-[16/10] sm:aspect-video bg-black overflow-hidden shrink-0 border-b border-amber-400/20">
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
                  transform: `scale(${1.04 + progress * 0.07})`,
                  transition: "transform 0.2s linear",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
              {/* Scanlines */}
              <div className="absolute inset-0 opacity-[0.14] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.45)_2px,rgba(0,0,0,0.45)_4px)]" />
              {/* Desk frame corners */}
              <div className="absolute inset-2 border border-amber-400/20 pointer-events-none rounded-sm" />
            </>
          )}

          {/* Progress — gold only, no word crawl */}
          <div className="absolute top-0 inset-x-0 h-1 bg-black/40">
            <div
              className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Lower third — BREAKING NEWS GAZETTE (static, gold) */}
          <div className="absolute bottom-0 inset-x-0">
            <div className="bg-amber-400 text-black px-3 py-1.5 flex items-center justify-center gap-2">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em]">
                Breaking news · Gazette
              </span>
            </div>
            <div className="bg-gradient-to-t from-black via-black/95 to-black/85 border-t border-amber-400/40 px-3 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300 mb-1">
                {kicker} · {copy.phonetic}
              </p>
              <p className="text-sm sm:text-base font-bold text-white leading-snug min-h-[2.5rem]">
                {caption}
              </p>
            </div>
          </div>
        </div>

        {/* —— Copy / credits —— */}
        <div className="px-4 py-3 space-y-2 text-sm text-muted leading-relaxed overflow-y-auto flex-1 min-h-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            From the Gazette newsroom
          </p>
          <p className="text-foreground font-medium">{copy.body}</p>
          <p className="text-amber-100/90 font-semibold border-l-2 border-amber-400/50 pl-2.5">
            {copy.kalshi}
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            This is the{" "}
            <strong className="text-foreground">TV arm</strong> of the paper you
            already know — when the host scores a week, the full{" "}
            <Link
              href="/gazette"
              onClick={dismiss}
              className="text-amber-300 font-semibold underline"
            >
              Gazette
            </Link>{" "}
            drops with crowns, shame, and the works.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-amber-400/20 shrink-0 flex flex-col gap-2 bg-black/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/gazette"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/45 text-amber-100 font-bold text-sm flex items-center justify-center hover:bg-amber-500/10"
            >
              {copy.ctaGazette}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm"
            >
              {progress >= 1
                ? preview
                  ? "Close preview"
                  : copy.cta
                : preview
                  ? "Close preview"
                  : "Skip broadcast"}
            </button>
          </div>
          <p className="text-[10px] text-muted text-center">
            {preview
              ? "Foundry preview · does not count as this week’s login play"
              : "Once this week · first login only · Gazette Network"}
          </p>
        </div>
      </div>

    </div>
  );
}
