"use client";

/**
 * After a successful Save / Lock it in — loud confirmation:
 * YES you’re good. You can still edit until first kickoff.
 */

import Link from "next/link";

export type PicksSavedModalDetail = {
  weekLabel: string;
  /** e.g. "Thu, Sep 4 · 7:00 PM EDT" or null */
  lockDeadlineLabel: string | null;
  /** True if this was an edit of an already-locked slip */
  isUpdate: boolean;
  firstFinal?: "earned" | "forfeit" | null;
  firstFinalPointsRemoved?: number;
};

type Props = {
  detail: PicksSavedModalDetail | null;
  onClose: () => void;
};

export default function PicksSavedModal({ detail, onClose }: Props) {
  if (!detail) return null;

  const { weekLabel, lockDeadlineLabel, isUpdate, firstFinal } = detail;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/55 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-400 to-primary" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-center">
            <div
              className="mx-auto mb-3 w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center"
              aria-hidden
            >
              <span className="text-3xl font-black text-primary">✓</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {isUpdate ? "Picks updated" : "Picks saved"}
            </p>
            <h2
              id="picks-saved-title"
              className="text-2xl sm:text-3xl font-black mt-1.5 text-white leading-tight"
            >
              Yes — you&apos;re good for {weekLabel}
            </h2>
            <p className="text-sm text-muted mt-3 leading-relaxed max-w-sm mx-auto">
              Your card is locked in the cloud. You&apos;re set for this week.
              {lockDeadlineLabel ? (
                <>
                  {" "}
                  You can still change anything until{" "}
                  <strong className="text-foreground">
                    first kickoff ({lockDeadlineLabel})
                  </strong>
                  .
                </>
              ) : (
                <>
                  {" "}
                  You can still make changes until the{" "}
                  <strong className="text-foreground">
                    first kickoff on the card
                  </strong>
                  .
                </>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-relaxed">
            <p className="font-bold text-primary text-xs uppercase tracking-wide mb-1">
              What happens next
            </p>
            <ul className="space-y-1.5 text-foreground/90 text-[13px]">
              <li>· Re-open My Picks anytime before kickoff to edit.</li>
              <li>· After first kickoff, the whole card freezes — no more edits.</li>
              <li>· Sit back, talk trash in the Locker, wait for the paper.</li>
            </ul>
          </div>

          {firstFinal === "earned" && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
              <p className="font-bold text-amber-200 text-xs uppercase tracking-wide mb-1">
                First &amp; Final
              </p>
              <p className="text-foreground/90 text-[13px]">
                You&apos;re first to lock this week. Keep this slip clean until
                kickoff for the bonus — change anything and the bonus voids.
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
                  ? ` (−${detail.firstFinalPointsRemoved} season & career pts)`
                  : ""}
                . Your current picks are still saved.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[52px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
            >
              Got it — I&apos;m good
            </button>
            <Link
              href="/locker-room"
              onClick={onClose}
              className="w-full min-h-[48px] rounded-xl border border-border text-sm font-bold flex items-center justify-center touch-manipulation text-foreground hover:bg-card-hover"
            >
              Open Locker Room
            </Link>
            <Link
              href="/"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl text-sm font-semibold flex items-center justify-center text-muted hover:text-foreground touch-manipulation"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
