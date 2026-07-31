"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  hasDismissedPicksTip,
  markPicksTipNeverAgain,
  PICKS_HOW_TO_STEPS,
} from "@/lib/picks-tip";

/**
 * Shows every time you open My Picks, unless they checked
 * “Never show me this again.”
 */
export default function PicksHowToModal() {
  const [open, setOpen] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);

  useEffect(() => {
    if (hasDismissedPicksTip()) return;
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
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

      <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            My Picks
          </div>
          <h2
            id="picks-howto-title"
            className="text-xl font-bold text-foreground"
          >
            How to lock your card
          </h2>
          <p className="text-xs text-muted mt-1">
            30-second cheat sheet. Full rules live under Rules anytime.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
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
              All picks must be locked before the first kickoff. After that the
              whole card freezes — no late locks, no edits. Miss it = 0 points.
              Fair is fair.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
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
                You can still read full rules under Rules in the menu.
              </span>
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl bg-primary text-black font-semibold text-sm"
            >
              Got it — let’s pick
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
