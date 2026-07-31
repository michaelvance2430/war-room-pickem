"use client";

import Link from "next/link";

/**
 * Every sport, every league — sets beta expectations.
 * Bug hunting is part of the game, not an annoyance.
 * Capture path: Account → Feedback (same for CFB/NFL/…).
 */
export default function BetaLeagueBanner() {
  return (
    <div
      className="mb-4 sm:mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 sm:px-4 sm:py-3.5"
      role="status"
    >
      <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-amber-300 mb-1">
        🚧 Beta league
      </p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        If you find a bug, screenshot it and send it to the Commissioner. If
        you don&apos;t find a bug… you probably weren&apos;t trying hard enough.{" "}
        <span aria-hidden>😄</span>
      </p>
      <p className="text-[11px] text-muted mt-2 leading-relaxed">
        You&apos;re helping build War Room.{" "}
        <Link
          href="/account#feedback"
          className="text-amber-200/90 font-semibold underline-offset-2 hover:underline"
        >
          Report a bug / idea →
        </Link>
      </p>
    </div>
  );
}
