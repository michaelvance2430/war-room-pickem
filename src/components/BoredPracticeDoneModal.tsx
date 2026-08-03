"use client";

/**
 * End of Practice Mode week — recap + goal CTAs (not app-route labels).
 * Guest → convert. Member → this week / real picks.
 */

import { useEffect, useMemo, useState } from "react";
import {
  EVENT_BORED_PRACTICE_DONE,
  clearBoredPracticeDoneModal,
  isBoredPracticeWindowOpen,
  peekBoredPracticeDoneModal,
  type BoredPracticeRecap,
} from "@/lib/bored-practice";
import { startBoredPracticeWeek } from "@/lib/bored-practice-run";
import { isGuestMode } from "@/lib/guest-mode";
import BrandMark from "@/components/BrandMark";
import GuestJoinCtas from "@/components/GuestJoinCtas";

const GUEST_ROASTS = [
  "Practice is over. Turns out beating imaginary opponents doesn't impress anyone.",
  "Nice warmup. Now quit hiding behind fake football.",
  "You looked pretty good against nobody. Let's see what happens when your buddies start chirping.",
  "Robots don't trash-talk. Your group chat will.",
  "That was the dress rehearsal. The season is the show.",
];

const MEMBER_ROASTS = [
  "Practice is over. Your real card is waiting — and so is the room.",
  "Nice warmup. Live week is where dignity goes to die (or shine).",
  "Bots don't care. Your friends will.",
];

export default function BoredPracticeDoneModal() {
  const [open, setOpen] = useState(false);
  const [recap, setRecap] = useState<BoredPracticeRecap | null>(null);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    // Practice done is valid for guests and members (guest tour may practice)
    if (!isGuestMode() && !isBoredPracticeWindowOpen()) return;

    function tryShow() {
      const pending = peekBoredPracticeDoneModal();
      if (!pending) return;
      setGuest(isGuestMode());
      setRecap(pending);
      setOpen(true);
    }

    tryShow();
    window.addEventListener(EVENT_BORED_PRACTICE_DONE, tryShow);
    const t1 = window.setTimeout(tryShow, 200);
    const t2 = window.setTimeout(tryShow, 800);
    return () => {
      window.removeEventListener(EVENT_BORED_PRACTICE_DONE, tryShow);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const roast = useMemo(() => {
    const bank = guest ? GUEST_ROASTS : MEMBER_ROASTS;
    const i =
      recap?.runId != null
        ? Math.abs(recap.runId) % bank.length
        : Math.floor(Math.random() * bank.length);
    return bank[i]!;
  }, [guest, recap?.runId]);

  if (!open || !recap) return null;

  function leavePractice(href: string) {
    clearBoredPracticeDoneModal();
    setOpen(false);
    void import("@/lib/bored-practice").then((m) => {
      m.exitBoredPracticeToLive();
      window.location.assign(href);
    });
  }

  function dismiss() {
    leavePractice("/");
  }

  async function doItAgain() {
    setBusy(true);
    try {
      clearBoredPracticeDoneModal();
      const res = await startBoredPracticeWeek();
      setOpen(false);
      if (res.goToPicks && res.picksHref) {
        window.location.assign(res.picksHref);
      } else if (res.goToPicks) {
        window.location.assign("/picks?week=99&practice=1&fresh=1");
      }
    } catch {
      setOpen(false);
    }
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bored-done-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        aria-label="Close"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border bg-primary/10 flex items-center gap-3">
          <BrandMark size={48} variant="force" className="rounded-lg" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Practice Mode · done
            </p>
            <h2
              id="bored-done-title"
              className="text-lg font-extrabold text-foreground leading-snug"
            >
              {guest ? "Warmup complete." : "Loop complete."}
            </h2>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm text-muted leading-relaxed">
          <div className="rounded-xl border border-border bg-black/40 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-2">
              Practice score · doesn&apos;t count
            </p>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-black text-foreground tabular-nums">
                  {recap.totalPoints}
                  <span className="text-sm font-semibold text-muted ml-1">
                    pts
                  </span>
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {recap.correctCount}/{recap.games} correct · practice only
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  #{recap.botRank}
                  <span className="text-muted text-sm font-medium">
                    {" "}
                    of {recap.botField}
                  </span>
                </p>
                <p className="text-[11px] text-muted">vs practice bots</p>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground leading-relaxed">
            {roast}
          </p>

          {!guest && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                How a real week feels
              </p>
              <ul className="text-xs text-foreground/90 space-y-1.5">
                <li>
                  <strong className="text-primary">This week</strong> — new
                  card, lock before kickoff, or eat zero.
                </li>
                <li>
                  <strong className="text-primary">Home</strong> — the room
                  wakes up when scores post.
                </li>
                <li>
                  <strong className="text-primary">Locker</strong> — trash talk
                  with real names. That&apos;s the point.
                </li>
              </ul>
            </div>
          )}

          {guest && (
            <p className="text-xs text-muted leading-relaxed">
              Guests observe. Members belong. Practice never counts as a real
              season — your friends do.
            </p>
          )}

          {!guest && (
            <p className="text-[11px] text-muted">
              Practice Mode only. Live card and real standings: untouched.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
          {guest ? (
            <>
              <GuestJoinCtas layout="stack" primary="create" />
              <button
                type="button"
                disabled={busy}
                onClick={() => void doItAgain()}
                className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/50 text-amber-100 font-bold text-sm disabled:opacity-50"
              >
                {busy ? "Cooking another practice week…" : "Practice again"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-2.5 text-sm font-semibold text-muted hover:text-foreground"
              >
                Keep exploring
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => leavePractice("/")}
                className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm"
              >
                Go to This Week →
              </button>
              <button
                type="button"
                onClick={() => leavePractice("/picks")}
                className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 text-primary font-bold text-sm"
              >
                Return to My Picks
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doItAgain()}
                className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/50 text-amber-100 font-bold text-sm disabled:opacity-50"
              >
                {busy ? "Cooking another practice week…" : "Practice again"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-2.5 text-sm font-semibold text-muted hover:text-foreground"
              >
                Keep exploring
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
