"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  hasDismissedPicksTip,
  markPicksTipNeverAgain,
  PICKS_HOW_TO_STEPS,
} from "@/lib/picks-tip";
import { isQuietPicksPath } from "@/lib/picks-progressive";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import {
  isPicksPreOpenOddsWindowOpen,
  hasSeenPicksPreOpenOddsNotice,
} from "@/lib/picks-preopen-odds";

/**
 * Picks cheat sheet — never on first-card quiet path or while the
 * walkthrough coach is running (coach + quiet banner are enough).
 * Also yields to the one-time pre–Week 0 / Week 1 odds notice.
 */
export default function PicksHowToModal() {
  const [open, setOpen] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);

  useEffect(() => {
    if (hasDismissedPicksTip()) return;
    // First lock path already has quiet intro on the page
    if (isQuietPicksPath()) return;
    if (needsPlayerTutorial() || isPlayerTutorialActive()) return;
    // Don't stack under the pre-open odds popup (that one is once-only first)
    if (
      isPicksPreOpenOddsWindowOpen() &&
      !hasSeenPicksPreOpenOddsNotice()
    ) {
      return;
    }
    const t = setTimeout(() => setOpen(true), 250);
    return () => clearTimeout(t);
  }, []);

  function close() {
    if (neverAgain) {
      markPicksTipNeverAgain();
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden px-3 pt-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picks-howto-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={close}
      />

      <div
        className="relative grid w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        style={{ height: "min(46rem, calc(100dvh - 1rem - env(safe-area-inset-bottom)))" }}
      >
        <div className="border-b border-border px-4 pb-2.5 pt-3 sm:px-5 sm:pb-3 sm:pt-5">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            My Picks
          </div>
          <h2
            id="picks-howto-title"
            className="text-xl font-bold text-foreground"
          >
            How not to mess this up
          </h2>
          <p className="text-xs text-muted mt-1">
            30 seconds. Read it once. Pretend you always knew.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 py-3 sm:space-y-3 sm:px-5 sm:py-4">
          {PICKS_HOW_TO_STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-border bg-background/80 px-3 py-2.5"
            >
              <div className="text-sm font-semibold text-foreground">
                {step.title}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}

          <div className="rounded-lg border-2 border-danger/50 bg-danger/10 px-3 py-2.5">
            <p className="text-xs font-bold text-danger leading-snug">
              Lock before first kickoff or the card freezes you out. No late
              saves. No “one more second.” Miss it = 0 pts and a milk carton in
              the Gazette. Fair is fair. Cruel is funnier.
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-2.5 border-t border-border px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:space-y-3 sm:px-5 sm:pt-4">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={neverAgain}
              onChange={(e) => setNeverAgain(e.target.checked)}
              className="mt-0.5 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">
              Never show me this again
              <span className="block text-xs text-muted font-normal mt-0.5">
                For people who already proved they can read. Rules still exist.
              </span>
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl bg-primary text-black font-semibold text-sm"
            >
              Cool — let me cook
            </button>
            <Link
              href="/rules"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl border border-border text-center text-sm text-muted hover:text-foreground"
            >
              Full rules
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
