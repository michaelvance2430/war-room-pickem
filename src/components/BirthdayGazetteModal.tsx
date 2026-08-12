"use client";

/**
 * “One Year Older” — monthly birthday Gazette.
 * Opens for the room on the 1st (ET) when anyone has a locked bday that month.
 */

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import {
  BIRTHDAY_GAZETTE_RITUAL,
  EVENT_FORCE_BIRTHDAY_GAZETTE,
  markBirthdayGazetteSeen,
  shouldOfferBirthdayGazette,
  type BirthdayGazetteEdition,
} from "@/lib/birthday-gazette";
import BrandMark from "@/components/BrandMark";

export default function BirthdayGazetteModal() {
  const [edition, setEdition] = useState<BirthdayGazetteEdition | null>(null);
  const [open, setOpen] = useState(false);

  const tryShow = useCallback(async (force = false) => {
    if (!getSession()?.playerId) return;
    try {
      // Don’t stack on first-lock calm unless force (Foundry)
      if (!force) {
        const { isPreLockCalm } = await import("@/lib/first-week");
        if (isPreLockCalm(getSession()?.playerId)) return;
      }
      const offer = await shouldOfferBirthdayGazette({ force });
      if (!offer.show) return;
      setEdition(offer.edition);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => void tryShow(false), 1100);
    const t2 = window.setTimeout(() => void tryShow(false), 4000);
    function onForce() {
      void tryShow(true);
    }
    function onFocus() {
      void tryShow(false);
    }
    window.addEventListener(EVENT_FORCE_BIRTHDAY_GAZETTE, onForce);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener(EVENT_FORCE_BIRTHDAY_GAZETTE, onForce);
      window.removeEventListener("focus", onFocus);
    };
  }, [tryShow]);

  function dismiss() {
    if (edition) {
      markBirthdayGazetteSeen(
        edition.leagueId,
        edition.year,
        edition.month
      );
    }
    setOpen(false);
    setEdition(null);
  }

  if (!open || !edition) return null;

  const selfId = getSession()?.playerId;
  const youInList = edition.honorees.some((h) => h.userId === selfId);

  return (
    <div
      className="fixed inset-0 z-[112] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/88 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-labelledby="bday-gazette-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close birthday gazette"
        onClick={dismiss}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-sm border-4 border-stone-800 shadow-2xl bg-[#f4f0e6] text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-stone-900 text-[#f4f0e6] px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.28em]">
            {edition.ritualName || BIRTHDAY_GAZETTE_RITUAL}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            Monthly · Zero points
          </span>
        </div>

        <div className="px-5 pt-5 pb-3 text-center border-b-4 border-double border-stone-900">
          <div className="flex justify-center mb-2">
            <BrandMark size={40} variant="force" className="rounded-md" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-800 mb-1">
            The War Room Dispatch · {edition.ritualName || BIRTHDAY_GAZETTE_RITUAL}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-stone-600 mb-2">
            {edition.monthLabel} {edition.year} · {edition.leagueName}
          </p>
          <h2
            id="bday-gazette-title"
            className="font-serif text-2xl sm:text-3xl font-black tracking-tight leading-tight text-stone-950"
          >
            {edition.headline}
          </h2>
          <p className="text-[13px] italic text-stone-700 mt-2 leading-relaxed">
            {edition.deck}
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="rounded border-2 border-stone-800 bg-white/80 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-500 mb-2">
              This month&apos;s aged inventory
            </p>
            <ul className="space-y-1.5">
              {edition.honorees.map((h) => (
                <li
                  key={h.userId}
                  className="flex items-baseline justify-between gap-2 border-b border-stone-300/80 last:border-0 pb-1 last:pb-0"
                >
                  <span className="font-bold text-stone-950 text-sm">
                    {h.name}
                    {h.userId === selfId ? (
                      <span className="ml-1.5 text-[10px] font-black uppercase text-red-800">
                        (that&apos;s you)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-mono text-stone-600 shrink-0">
                    {edition.monthLabel.slice(0, 3)} {h.day}
                  </span>
                </li>
              ))}
            </ul>
            {youInList && (
              <p className="text-[11px] text-red-900 font-semibold mt-3 leading-snug">
                Yes, the whole room sees your name. You locked the date. Own it.
              </p>
            )}
          </div>

          <p className="text-sm text-stone-800 leading-relaxed">{edition.body}</p>

          <div className="rounded border-2 border-dashed border-stone-700 bg-amber-100/50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-900 mb-1">
              Official spanking order
            </p>
            <p className="text-sm font-semibold text-stone-900 leading-snug">
              {edition.spankLine}
            </p>
          </div>

          <blockquote className="border-l-4 border-stone-900 pl-3 py-1">
            <p className="font-serif text-base italic text-stone-900 leading-snug">
              {edition.pullQuote}
            </p>
          </blockquote>

          <div className="rounded bg-stone-200/80 border border-stone-400 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-0.5">
              Classified
            </p>
            <p className="text-xs text-stone-800 leading-relaxed">
              {edition.classified}
            </p>
          </div>

          <p className="text-[11px] text-stone-600 text-center leading-relaxed">
            {edition.foot}
          </p>

          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-[52px] rounded-sm bg-stone-900 text-[#f4f0e6] font-bold text-sm uppercase tracking-wide"
          >
            Close paper · back to losing
          </button>
        </div>
      </div>
    </div>
  );
}
