"use client";

/**
 * Profile easter egg tracker — shows how many they've found, not the catalog size.
 * Display: "3 / xx" so nobody knows how many secrets exist.
 */

import { useEffect, useState } from "react";
import {
  EVENT_EASTER_EGG,
  EVENT_PASSPORT_STAMP,
  getEasterEggProgress,
} from "@/lib/easter-eggs";

type Props = {
  playerId: string;
  isSelf?: boolean;
};

export default function EasterEggTracker({ playerId, isSelf }: Props) {
  const [found, setFound] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    function refresh() {
      const p = getEasterEggProgress(playerId);
      setFound(p.found);
      setUnlocked(p.unlocked);
    }
    refresh();
    function onEvt() {
      refresh();
    }
    window.addEventListener(EVENT_EASTER_EGG, onEvt);
    window.addEventListener(EVENT_PASSPORT_STAMP, onEvt);
    return () => {
      window.removeEventListener(EVENT_EASTER_EGG, onEvt);
      window.removeEventListener(EVENT_PASSPORT_STAMP, onEvt);
    };
  }, [playerId]);

  // Hide until first find (self or viewer) — no empty "0 / xx" spoiler
  if (!unlocked || found < 1) return null;

  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-0.5">
            Curious finds
          </p>
          <p className="text-sm text-muted leading-relaxed">
            {isSelf
              ? "Secrets you’ve stumbled into. No map. No checklist."
              : "Secrets they’ve stumbled into. No map."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Found
          </p>
          <p className="text-2xl font-black tabular-nums text-foreground">
            {found}
            <span className="text-base font-bold text-muted"> / xx</span>
          </p>
        </div>
      </div>
    </section>
  );
}
