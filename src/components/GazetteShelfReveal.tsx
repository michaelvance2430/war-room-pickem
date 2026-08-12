"use client";

/**
 * Week ~3: point people to where every week's paper lives.
 * The paper still pops when scored from day one — this only unlocks the shelf/nav.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EVENT_PROGRESSIVE,
  loadProgressiveSnapshot,
  markGazetteShelfRevealSeen,
} from "@/lib/progressive-disclosure";
import { EVENT_FORCE_GAZETTE_SHELF_REVEAL } from "@/lib/creator-sandbox";

export default function GazetteShelfReveal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const snap = await loadProgressiveSnapshot();
        if (cancelled) return;
        setOpen(snap.offerGazetteReveal);
      } catch {
        if (!cancelled) setOpen(false);
      }
    }

    void check();
    function onProg() {
      void check();
    }
    function onForce() {
      setOpen(true);
    }
    window.addEventListener(EVENT_PROGRESSIVE, onProg);
    window.addEventListener("warroom-first-week-progress", onProg);
    window.addEventListener(EVENT_FORCE_GAZETTE_SHELF_REVEAL, onForce);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_PROGRESSIVE, onProg);
      window.removeEventListener("warroom-first-week-progress", onProg);
      window.removeEventListener(EVENT_FORCE_GAZETTE_SHELF_REVEAL, onForce);
    };
  }, [pathname]);

  if (!open) return null;

  function dismiss() {
    markGazetteShelfRevealSeen();
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gazette-shelf-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-red-700/50 bg-card shadow-[0_0_60px_rgba(185,28,28,0.25)] overflow-hidden">
        <div className="bg-red-950/80 border-b border-red-800/50 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300/90">
            Unlocked · the paper
          </p>
          <h2
            id="gazette-shelf-title"
            className="text-lg font-extrabold text-white mt-0.5"
          >
            The Dispatch is now on the stand
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Every week when games die, the{" "}
            <strong className="text-foreground">The Dispatch</strong> drops —
            crown, shame, movers, the whole roast.
          </p>
          <p>
            Starting now you can find{" "}
            <strong className="text-foreground">
              every week&apos;s paper for the season
            </strong>{" "}
            under <strong className="text-foreground">The Dispatch</strong> in the
            nav (and on Home). Old headlines stay put.
          </p>
          <p className="text-xs text-muted">
            Same game. One more door. Competition and the Locker still run the
            room.
          </p>
        </div>
        <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
          <Link
            href="/dispatch"
            onClick={dismiss}
            className="flex-1 text-center py-3 min-h-[48px] rounded-xl bg-red-700 text-white font-bold text-sm hover:bg-red-600"
          >
            Open the paper shelf →
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-background"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
