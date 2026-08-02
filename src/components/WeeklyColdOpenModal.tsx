"use client";

/**
 * Weekly cold-open — Gazette Network newsroom package.
 * Static BREAKING NEWS GAZETTE: full article at once, zero caption animation.
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

export default function WeeklyColdOpenModal() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const [runId, setRunId] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const copy = getWeeklyColdOpenCopy();
  const room = getLeague()?.name || "War Room";

  const openBroadcast = useCallback((opts?: { preview?: boolean }) => {
    setPreview(!!opts?.preview);
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
        {/* —— BREAKING NEWS GAZETTE masthead (gold palette) —— */}
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

        {/* —— Static photo (no ken burns / no caption pop-ins) —— */}
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
              onEnded={() => {
                /* stay open — full article is already readable */
              }}
              onError={() => setVideoOk(false)}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={POSTER}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/15" />
              <div className="absolute inset-0 opacity-[0.12] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.45)_2px,rgba(0,0,0,0.45)_4px)]" />
              <div className="absolute inset-2 border border-amber-400/20 pointer-events-none rounded-sm" />
            </>
          )}

          {/* Static lower third — gold BREAKING NEWS only, no cycling words */}
          <div className="absolute bottom-0 inset-x-0">
            <div className="bg-amber-400 text-black px-3 py-1.5 flex items-center justify-center">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em]">
                Breaking news · Gazette
              </span>
            </div>
          </div>
        </div>

        {/* —— Full article — all copy visible immediately, zero animation —— */}
        <div className="px-4 py-3 space-y-3 text-sm text-muted leading-relaxed overflow-y-auto flex-1 min-h-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            From the Gazette newsroom · {copy.phonetic}
          </p>
          <h3
            className="text-base sm:text-lg font-black text-amber-50 leading-snug"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {copy.headline}
          </h3>
          <p className="text-foreground font-medium leading-relaxed">
            {copy.body}
          </p>
          <p className="text-amber-100/95 font-semibold border-l-2 border-amber-400/60 pl-2.5 leading-relaxed">
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
              {preview ? "Close preview" : copy.cta}
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
