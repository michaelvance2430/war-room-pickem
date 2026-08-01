"use client";

/**
 * When a commissioner lists an open room, nudge them to fill empty seats
 * with bots (simple yes/no on Run the Room). Does not auto-add.
 */

import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Deep link: Run the Room → Fill empty seats? */
export const COMMISH_BOTS_HREF = "/commissioner?tab=settings#commish-bots";

export default function OpenRoomBotsNudge({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-room-bots-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/40 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-amber-400 to-primary" />
        <div className="p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary text-center">
            Open room · host tip
          </p>
          <div className="text-center">
            <div className="text-4xl mb-2" aria-hidden>
              🤖
            </div>
            <h2
              id="open-room-bots-title"
              className="text-xl font-black text-foreground"
            >
              Round out your numbers with bots?
            </h2>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              Real people join first. Want a fuller room? In{" "}
              <strong className="text-foreground">Host</strong> settings: fill
              empty seats with bots. They take real standings seats until you
              remove them (pre-lock only). Once the season starts, bots stay
              (fairness). Never replaces humans.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={COMMISH_BOTS_HREF}
              onClick={onClose}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-center flex items-center justify-center touch-manipulation"
            >
              Yes — take me there
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 min-h-[48px] rounded-xl border border-border text-muted text-sm font-medium hover:text-foreground touch-manipulation"
            >
              Not now — humans only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
