"use client";

/**
 * Day before opening week: one-time commish popup —
 * “Last chance — league rules lock tomorrow.”
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, isActuallyCommissioner } from "@/lib/league";
import {
  dismissLeagueBuildLockReminder,
  openingWeekLockLabel,
  shouldShowLeagueBuildLockReminder,
} from "@/lib/league-build";

export default function LeagueBuildLockReminder() {
  const [open, setOpen] = useState(false);
  const [lockLabel, setLockLabel] = useState("");

  useEffect(() => {
    if (!isActuallyCommissioner()) return;
    const league = getLeague();
    if (!league?.id) return;
    if (
      shouldShowLeagueBuildLockReminder(league.id, league.sportId)
    ) {
      setLockLabel(openingWeekLockLabel(league.sportId));
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  function dismiss() {
    const league = getLeague();
    if (league?.id) dismissLeagueBuildLockReminder(league.id);
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-build-lock-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-warning/50 bg-card p-5 shadow-2xl space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">
          League rules · last chance
        </p>
        <h2
          id="league-build-lock-title"
          className="text-lg font-bold text-foreground"
        >
          Want to change anything before it locks?
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Opening week hits tomorrow (
          <strong className="text-foreground">{lockLabel}</strong>
          ). Pride pick, Toilet Bowl split, and who can join freeze then. You
          can still publish the card and score after.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href="/league-build?review=1"
            onClick={dismiss}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black text-center text-sm font-extrabold"
          >
            Review setup →
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground"
          >
            Looks good
          </button>
        </div>
      </div>
    </div>
  );
}
