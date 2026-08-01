"use client";

/**
 * After a bored-practice week is scored — thank you, re-do anytime until Week 0.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EVENT_BORED_PRACTICE_DONE,
  isBoredPracticeWindowOpen,
  markBoredPracticeStarted,
  takeBoredPracticeDoneModal,
} from "@/lib/bored-practice";
import { getLeague, isOps } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  clearWeekScoreInCloud,
  publishWeekCard,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
} from "@/lib/cloud";
import { generateDemoSlate } from "@/lib/demo-slate";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import { isPreseasonCommishToolsAllowed } from "@/lib/season-mode";
import BrandMark from "@/components/BrandMark";

export default function BoredPracticeDoneModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weekNumber, setWeekNumber] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isGuestMode()) return;
    if (!isBoredPracticeWindowOpen()) return;

    function tryShow() {
      const pending = takeBoredPracticeDoneModal();
      if (!pending) return;
      setWeekNumber(pending.weekNumber);
      setOpen(true);
    }

    tryShow();
    function onDone() {
      tryShow();
    }
    window.addEventListener(EVENT_BORED_PRACTICE_DONE, onDone);
    return () => window.removeEventListener(EVENT_BORED_PRACTICE_DONE, onDone);
  }, []);

  if (!open) return null;

  function dismiss() {
    setOpen(false);
  }

  async function doItAgain() {
    setBusy(true);
    try {
      const league = getLeague();
      const sid = league?.sportId === "nfl" ? "nfl" : "cfb";
      const week = weekNumber;

      if (isOps() && isPreseasonCommishToolsAllowed()) {
        await clearWeekScoreInCloud(week).catch(() => undefined);
        const games = generateDemoSlate(week, 5, sid);
        const prop = propFromPreset(rotatingPropPreset(week, sid), week);
        const pub = await publishWeekCard({
          weekNumber: week,
          games,
          prop,
        });
        if (pub.ok) {
          await seedBotPicksForWeekInCloud(week).catch(() => undefined);
        }
        markBoredPracticeStarted(week);
        await setLeagueActiveWeek(week).catch(() => undefined);
        setOpen(false);
        router.push(`/picks?week=${week}&practice=1`);
        router.refresh();
        setBusy(false);
        return;
      }

      // Player: clear local flag and send them to picks (host may re-score)
      markBoredPracticeStarted(week);
      setOpen(false);
      router.push(`/picks?week=${week}&practice=1`);
    } catch {
      /* still close */
      setOpen(false);
    }
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bored-done-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border bg-primary/10 flex items-center gap-3">
          <BrandMark size={48} variant="force" className="rounded-lg" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Practice complete
            </p>
            <h2
              id="bored-done-title"
              className="text-lg font-extrabold text-foreground leading-snug"
            >
              Thanks for playing
            </h2>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-muted leading-relaxed">
          <p className="text-foreground">
            Nice. You locked a fake week and the room did its thing.
          </p>
          <p>
            You can do this{" "}
            <strong className="text-foreground">as many times as you want</strong>{" "}
            until you feel comfortable — or until Week 0 kickoff, when this
            practice button disappears for good.
          </p>
          <p className="text-xs">
            Dry-run only. Not the real season. Mash buttons. Discover stuff.
            Mostly we believe in you.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void doItAgain()}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            {busy ? "Resetting…" : "Do it again"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground"
          >
            I&apos;m good for now
          </button>
        </div>
      </div>
    </div>
  );
}
