"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 700;
const INTRO_SESSION_KEY = "warroom-opening-played-this-session";

export default function SeasonOpening() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Decide before paint so a fresh visit opens on black, while internal
  // navigation never flashes/restarts the cinematic.
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Browsers reject autoplay with sound. Begin reliably, then let the first
  // tap satisfy the browser's audio permission and unmute in place.
  const [muted, setMuted] = useState(true);

  useLayoutEffect(() => {
    // Product rule: once per open app/browser session. Page changes, returning
    // Home, and publishing a commissioner card must not replay it. Closing the
    // tab/app clears sessionStorage, so the next genuine opening runs again.
    try {
      if (sessionStorage.getItem(INTRO_SESSION_KEY) === "1") return;
      sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    } catch {
      // If storage is unavailable, still allow this mount's opening.
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const video = videoRef.current;
    if (!video) return;

    const start = async () => {
      try {
        video.muted = true;
        await video.play();
      } catch {
        try {
          video.muted = true;
          await video.play();
        } catch {
          setVisible(false);
        }
      }
    };
    void start();

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      video.pause();
    };
  }, [visible]);

  function dismiss() {
    if (exiting) return;
    const video = videoRef.current;
    if (video) video.pause();
    setExiting(true);
    exitTimerRef.current = setTimeout(() => setVisible(false), EXIT_MS);
  }

  function finishOpening() {
    if (exiting) return;
    setExiting(true);
    exitTimerRef.current = setTimeout(() => setVisible(false), EXIT_MS);
  }

  function enableSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
    });
  }

  function softenEnding() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const remaining = video.duration - video.currentTime;
    if (remaining <= EXIT_MS / 1000 && !exiting) {
      finishOpening();
    }
  }

  if (!visible) return null;

  return createPortal(
    <section
      aria-label="War Room season opening"
      className={`fixed inset-0 z-[300] bg-black transition-opacity ease-out ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${EXIT_MS}ms` }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/media/war-room-opening-vertical.mp4"
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        onTimeUpdate={softenEnding}
        onEnded={finishOpening}
        onError={() => setVisible(false)}
      />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Skip the opening video this time"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 min-h-[46px] rounded-full border-2 border-white/70 bg-black/75 px-5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-md active:scale-[0.98]"
      >
        Skip intro →
      </button>

      <div className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex items-center justify-center px-4">
        {muted && (
          <button
            type="button"
            onClick={enableSound}
            className="absolute bottom-16 left-1/2 min-h-[52px] -translate-x-1/2 animate-pulse whitespace-nowrap rounded-full border border-primary/80 bg-black/80 px-6 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_0_30px_rgba(212,175,55,.45)] backdrop-blur-md"
          >
            Tap for sound
          </button>
        )}
      </div>
    </section>,
    document.body
  );
}
