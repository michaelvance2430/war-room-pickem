"use client";

/**
 * One-time: first visit to My Picks before Week 0 (CFB) / Week 1 (NFL) opens.
 * Not the tutorial — just a clear “picks now, odds may move” heads-up.
 */

import { useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  getPicksPreOpenWeekLabel,
  markPicksPreOpenOddsNoticeSeen,
  shouldShowPicksPreOpenOddsNotice,
} from "@/lib/picks-preopen-odds";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import BrandMark from "@/components/BrandMark";

export default function PicksPreOpenOddsModal() {
  const [open, setOpen] = useState(false);
  const [weekLabel, setWeekLabel] = useState("Week 0");

  useEffect(() => {
    if (isGuestMode()) return;

    // Practice dry-run is not the live picks page
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("practice") === "1" || sp.get("week") === "99") return;
    } catch {
      /* ok */
    }

    function tryOpen() {
      // Not the tutorial ending — only after walkthrough is done / not needed
      if (needsPlayerTutorial() || isPlayerTutorialActive()) return;

      const sid = getLeague()?.sportId;
      if (!shouldShowPicksPreOpenOddsNotice(sid)) return;

      setWeekLabel(getPicksPreOpenWeekLabel(sid));
      setOpen(true);
    }

    // Slight delay so the page paints first (feels like “you opened Picks”)
    const t = window.setTimeout(tryOpen, 350);
    // If tutorial was running on this visit, re-check when it finishes
    function onTut() {
      window.setTimeout(tryOpen, 400);
    }
    window.addEventListener("warroom-player-tutorial", onTut);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("warroom-player-tutorial", onTut);
    };
  }, []);

  function dismiss() {
    markPicksPreOpenOddsNoticeSeen();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picks-preopen-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        aria-label="Close"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border bg-primary/10 flex items-center gap-3">
          <BrandMark size={48} variant="force" className="rounded-lg" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Before {weekLabel}
            </p>
            <h2
              id="picks-preopen-title"
              className="text-lg font-extrabold text-foreground leading-snug"
            >
              Picks now — odds may move
            </h2>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-muted leading-relaxed">
          <p className="text-foreground text-base font-medium leading-relaxed">
            You can make and save your picks now.
          </p>
          <p className="text-foreground leading-relaxed">
            But the{" "}
            <strong className="text-primary">odds might change</strong> when{" "}
            <strong className="text-foreground">{weekLabel}</strong>{" "}
            <span className="uppercase tracking-wide font-extrabold text-foreground">
              officially opens
            </span>
            .
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Early cards are real. Lines can still shift before the official open
            — don&apos;t be shocked if a spread moves after you lock.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold text-sm"
          >
            Got it — show me the card
          </button>
        </div>
      </div>
    </div>
  );
}
