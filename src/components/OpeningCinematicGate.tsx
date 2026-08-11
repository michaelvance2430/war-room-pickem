"use client";

import { useEffect, useState } from "react";
import OpeningCinematicPreview from "@/components/OpeningCinematicPreview";
import { isOpeningCinematicEnabled } from "@/lib/opening-cinematic";
import { EVENT_FORCE_DISMISS_OVERLAYS } from "@/lib/safe-nav";

const SHOWN_KEY = "warroom-opening-cinematic-shown-v1";

export default function OpeningCinematicGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!isOpeningCinematicEnabled() || sessionStorage.getItem(SHOWN_KEY) === "1") return;
      sessionStorage.setItem(SHOWN_KEY, "1");
      setOpen(true);
    } catch {
      /* the app must open even when storage is unavailable */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT_FORCE_DISMISS_OVERLAYS, close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT_FORCE_DISMISS_OVERLAYS, close);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      data-opening-cinematic
      className="fixed inset-0 z-[95] pointer-events-none bg-black"
      aria-label="War Room opening cinematic"
    >
      <OpeningCinematicPreview onDone={() => setOpen(false)} />
    </div>
  );
}

