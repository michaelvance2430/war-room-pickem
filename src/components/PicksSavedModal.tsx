"use client";

/** Picks success — one truthful state, one visible next action. */

import Link from "next/link";

export type PicksSavedModalDetail = {
  weekLabel: string;
  /** e.g. "Thu, Sep 4 · 7:00 PM EDT" or null */
  lockDeadlineLabel: string | null;
  /** True if this was an edit of an already-locked slip */
  isUpdate: boolean;
  firstFinal?: "earned" | "forfeit" | null;
  firstFinalPointsRemoved?: number;
  /**
   * Required next job only (e.g. Crystal Ball).
   * If null → single Done button (close or Home).
   */
  nextAction?: { href: string; label: string } | null;
};

type Props = {
  detail: PicksSavedModalDetail | null;
  onClose: () => void;
};

export default function PicksSavedModal({ detail, onClose }: Props) {
  if (!detail) return null;

  const {
    weekLabel,
    lockDeadlineLabel,
    isUpdate,
    firstFinal,
    nextAction,
  } = detail;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center px-0 pt-3 pb-[var(--mobile-chrome-bottom)] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picks-saved-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[calc(100dvh-var(--mobile-chrome-bottom)-0.75rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-2 border-primary/55 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-400 to-primary" />
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="text-center">
            <div
              className="mx-auto mb-2.5 w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center"
              aria-hidden
            >
              <span className="text-2xl font-black text-primary">✓</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {isUpdate ? "Changes saved" : "Card submitted"}
            </p>
            <h2
              id="picks-saved-title"
              className="text-2xl sm:text-3xl font-black mt-1.5 text-white leading-tight"
            >
              {isUpdate ? "Your card is updated" : "Your card is in"}
            </h2>
            <p className="text-sm text-muted mt-3 leading-relaxed max-w-sm mx-auto">
              {weekLabel} is saved—not frozen. You can change it until first kickoff
              {lockDeadlineLabel ? (
                <>
                  {" "}
                  (
                  <strong className="text-foreground font-semibold">
                    {lockDeadlineLabel}
                  </strong>
                  )
                </>
              ) : null}
              . After that, it locks automatically.
            </p>
          </div>

          {firstFinal === "earned" && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
              <p className="font-bold text-amber-200 text-xs uppercase tracking-wide mb-1">
                First &amp; Final
              </p>
              <p className="text-foreground/90 text-[13px]">
                First lock this week. Keep this slip clean until kickoff for the
                bonus.
              </p>
            </div>
          )}
          {firstFinal === "forfeit" && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed">
              <p className="font-bold text-danger text-xs uppercase tracking-wide mb-1">
                First &amp; Final voided
              </p>
              <p className="text-foreground/90 text-[13px]">
                You changed a First &amp; Final slip
                {detail.firstFinalPointsRemoved
                  ? ` (−${detail.firstFinalPointsRemoved} pts)`
                  : ""}
                . Current picks are still saved.
              </p>
            </div>
          )}

        </div>
        <div className="shrink-0 border-t border-border bg-card/95 p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
          {nextAction ? (
            <div className="flex flex-col gap-1.5">
              <Link
                href={nextAction.href}
                onClick={onClose}
                className="w-full min-h-[52px] rounded-xl bg-primary text-black text-base font-extrabold flex items-center justify-center touch-manipulation"
              >
                {nextAction.label}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-muted hover:text-foreground touch-manipulation"
              >
                Review saved card
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[52px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
            >
              Review saved card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
