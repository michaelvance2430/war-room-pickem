"use client";

import { useEffect, useRef, useState } from "react";

const EXIT_MS = 700;

export default function SeasonOpening() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Render the black opening layer on the very first paint. Waiting for an
  // effect here lets Home paint for one frame before the cinematic mounts.
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  // Browsers reject autoplay with sound. Begin reliably, then let the first
  // tap satisfy the browser's audio permission and unmute in place.
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    // Product rule: the opening runs on every fresh app/Home mount. Nothing is
    // remembered between visits; Skip Intro dismisses only this playback.
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

  return (
    <section
      aria-label="War Room season opening"
      className={`fixed inset-0 z-[100] bg-black transition-opacity ease-out ${
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
    </section>
  );
}
