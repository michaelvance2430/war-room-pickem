"use client";

/**
 * End of a bored practice week — recap + “here’s how next week feels” + re-do.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { hasLockedPicksOnce } from "@/lib/first-week";
import { getSession } from "@/lib/league";

export default function BoredPracticeDoneModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recap, setRecap] = useState<BoredPracticeRecap | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isGuestMode()) return;
    if (!isBoredPracticeWindowOpen()) return;

    function tryShow() {
      const pending = peekBoredPracticeDoneModal();
      if (!pending) return;
      setRecap(pending);
      setOpen(true);
    }

    tryShow();
    window.addEventListener(EVENT_BORED_PRACTICE_DONE, tryShow);
    // Picks may fire the event before this mounts / after navigation
    const t1 = window.setTimeout(tryShow, 200);
    const t2 = window.setTimeout(tryShow, 800);
    return () => {
      window.removeEventListener(EVENT_BORED_PRACTICE_DONE, tryShow);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!open || !recap) return null;

  function dismiss() {
    clearBoredPracticeDoneModal();
    setOpen(false);
    router.push("/");
  }

  function softClose() {
    clearBoredPracticeDoneModal();
    setOpen(false);
  }

  async function doItAgain() {
    setBusy(true);
    try {
      clearBoredPracticeDoneModal();
      const res = await startBoredPracticeWeek();
      setOpen(false);
      if (res.goToPicks) {
        router.push("/picks?week=99&practice=1");
        router.refresh();
      }
    } catch {
      setOpen(false);
    }
    setBusy(false);
  }

  const unlocked = hasLockedPicksOnce(getSession()?.playerId);

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
              Practice week complete
            </p>
            <h2
              id="bored-done-title"
              className="text-lg font-extrabold text-foreground leading-snug"
            >
              Week finished. Here&apos;s the room.
            </h2>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm text-muted leading-relaxed">
          {/* Mini scoreboard — how scoring feels */}
          <div className="rounded-xl border border-border bg-black/40 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-2">
              Final · practice only
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
                  {recap.correctCount}/{recap.games} correct · fake bots only
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

          {/* Sample Gazette — how Monday paper feels */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                Sample Gazette
              </p>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/70">
                Fake edition
              </span>
            </div>
            <p className="text-sm font-black text-foreground leading-snug uppercase tracking-tight">
              {recap.gazetteHeadline || "PRACTICE PAPER DROPS"}
            </p>
            <p className="text-xs text-foreground/85 leading-relaxed">
              {recap.gazetteDeck ||
                "After a real week, the host scores and this paper hits Home."}
            </p>
            <p className="text-[11px] text-muted border-t border-amber-500/20 pt-2">
              Real Gazette = crown, shame, swings, milk-carton no-locks. Same
              energy, louder, with your room&apos;s names.
            </p>
          </div>

          {/* Board tease */}
          <div className="rounded-xl border border-border bg-black/30 px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              The Board after scores
            </p>
            <p className="text-xs text-foreground/90 leading-relaxed">
              {recap.boardTease ||
                "Standings update when results post. You just unlocked the Board path."}
            </p>
          </div>

          {/* Here's how next week / the room feels */}
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              How the start of a real week feels
            </p>
            <ul className="text-xs text-foreground/90 space-y-1.5">
              <li>
                <strong className="text-primary">My Picks</strong> — new card
                drops; you lock before first kickoff (like you just did).
              </li>
              <li>
                <strong className="text-primary">Home</strong> — countdown,
                who&apos;s in, then after games the paper.
              </li>
              <li>
                <strong className="text-primary">Gazette</strong> — Sunday/Monday
                drop when the host scores. Front page energy.
              </li>
              <li>
                <strong className="text-primary">The Board</strong> — season
                standings + week swings
                {unlocked
                  ? " (unlocked)."
                  : " — unlocked after this practice lock."}
              </li>
              <li>
                <strong className="text-primary">Locker</strong> — trash talk
                while you wait on cards and scores.
              </li>
            </ul>
          </div>

          <p className="text-[11px] text-muted">
            Private dry-run only. Did not touch the live season card, real
            standings, or anyone else&apos;s picks. Re-do anytime until Week 0
            kickoff — then practice disappears for good.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void doItAgain()}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            {busy ? "New fake week…" : "Do it again"}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/board"
              onClick={softClose}
              className="py-3 min-h-[44px] rounded-xl border border-border text-center text-[11px] font-bold text-foreground hover:border-primary/50 flex items-center justify-center"
            >
              Board
            </Link>
            <Link
              href="/gazette"
              onClick={softClose}
              className="py-3 min-h-[44px] rounded-xl border border-amber-500/40 text-center text-[11px] font-bold text-amber-100 hover:border-amber-400/60 flex items-center justify-center"
            >
              Gazette
            </Link>
            <Link
              href="/locker-room"
              onClick={softClose}
              className="py-3 min-h-[44px] rounded-xl border border-border text-center text-[11px] font-bold text-foreground hover:border-primary/50 flex items-center justify-center"
            >
              Locker
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2.5 text-sm font-semibold text-muted hover:text-foreground"
          >
            I&apos;m good · Home
          </button>
        </div>
      </div>
    </div>
  );
}
