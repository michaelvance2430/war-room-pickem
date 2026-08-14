"use client";

import { useEffect, useRef, useState } from "react";

export default function WeaponStrikeVideo({
  src,
  onComplete,
}: {
  src: string;
  onComplete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsLaunch, setNeedsLaunch] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onComplete();
    }
    window.addEventListener("keydown", onKeyDown);

    const video = videoRef.current;
    if (video) {
      void video.play().catch(() => setNeedsLaunch(true));
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [onComplete, src]);

  function launch() {
    const video = videoRef.current;
    if (!video) return;
    setNeedsLaunch(false);
    void video.play().catch(() => setNeedsLaunch(true));
  }

  return (
    <section
      className="fixed inset-0 z-[110] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Tactical nuclear strike"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={src}
        autoPlay
        playsInline
        preload="auto"
        onEnded={onComplete}
        onError={onComplete}
      />

      {needsLaunch && (
        <button
          type="button"
          onClick={launch}
          className="absolute inset-0 flex items-center justify-center bg-black/55 text-center"
        >
          <span className="rounded-full border-2 border-red-400 bg-black/80 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-red-100 shadow-[0_0_50px_rgba(239,68,68,.55)]">
            Tap to execute strike
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onComplete}
        className="absolute right-3 top-[max(.75rem,env(safe-area-inset-top))] min-h-[44px] rounded-full border border-white/35 bg-black/55 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white backdrop-blur-md"
      >
        Skip strike
      </button>
    </section>
  );
}
