"use client";

/**
 * Shared empty state when zero weeks are officially scored.
 * Never invent achievement — celebrate anticipation instead.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ACHIEVEMENT_EMPTY_TAKES,
  achievementEmptyTakeAt,
} from "@/lib/season-scored";

type Props = {
  className?: string;
  /** Extra line under the take (surface-specific). */
  footnote?: string;
  showCtas?: boolean;
};

export default function SeasonNotStartedEmpty({
  className = "",
  footnote,
  showCtas = true,
}: Props) {
  const [idx, setIdx] = useState(0);
  const take = achievementEmptyTakeAt(idx);

  function next() {
    setIdx((i) => (i + 1) % ACHIEVEMENT_EMPTY_TAKES.length);
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <button
        type="button"
        onClick={next}
        className="w-full text-left rounded-2xl border-2 border-dashed border-primary/35 bg-card px-5 py-6 sm:px-6 sm:py-7 space-y-3 touch-manipulation active:scale-[0.99] transition"
        aria-label="Next empty-season take"
      >
        <p className="text-3xl sm:text-4xl leading-none" aria-hidden>
          {take.emoji}
        </p>
        <h2 className="text-xl sm:text-2xl font-black text-foreground leading-snug">
          {take.title}
        </h2>
        <p className="text-sm sm:text-base text-muted leading-relaxed">
          {take.body}
        </p>
        {footnote && (
          <p className="text-xs text-muted/90 leading-relaxed pt-1">{footnote}</p>
        )}
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/80 pt-1">
          Tap for another take · {idx + 1}/{ACHIEVEMENT_EMPTY_TAKES.length}
        </p>
      </button>

      {showCtas && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/picks"
            className="flex-1 min-h-[52px] rounded-xl bg-primary text-black text-sm font-extrabold inline-flex items-center justify-center touch-manipulation"
          >
            Go make your picks →
          </Link>
          <Link
            href="/"
            className="flex-1 min-h-[52px] rounded-xl border border-border text-foreground text-sm font-bold inline-flex items-center justify-center touch-manipulation hover:bg-card"
          >
            Return Home →
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={next}
        className="w-full min-h-[48px] rounded-xl border border-primary/30 text-primary text-sm font-bold touch-manipulation"
      >
        Hit me with another one
      </button>
    </div>
  );
}
