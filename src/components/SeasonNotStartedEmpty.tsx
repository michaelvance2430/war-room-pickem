"use client";

/**
 * Empty state when zero weeks are officially scored.
 * Quiet truth only — no carousel, no CTA pile.
 * War Room never invents standings, crowns, or shame.
 */

import Link from "next/link";

type Props = {
  className?: string;
  /** Extra line under the body (surface-specific). */
  footnote?: string;
  /**
   * Optional single next action. Standings usually omits this —
   * nav already owns destinations.
   */
  ctaHref?: string;
  ctaLabel?: string;
};

export default function SeasonNotStartedEmpty({
  className = "",
  footnote,
  ctaHref,
  ctaLabel,
}: Props) {
  return (
    <div
      className={`rounded-xl border border-border bg-card px-4 py-5 sm:px-5 sm:py-6 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
        Season not scored yet
      </p>
      <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
        No standings yet.
      </h2>
      <p className="text-sm text-muted mt-2 leading-relaxed max-w-xl">
        The board wakes up after the first week is scored. Until then nobody has
        points, crowns, or shame — and War Room won&apos;t invent them.
      </p>
      {footnote ? (
        <p className="text-xs text-muted/90 mt-2 leading-relaxed max-w-xl">
          {footnote}
        </p>
      ) : null}
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="inline-flex mt-4 min-h-[44px] items-center justify-center px-4 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
