"use client";

/**
 * War Room Pick’Em anniversary — July 25 (founding day 2026-07-25).
 * Room-wide paper once per league · year.
 */

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import {
  EVENT_FORCE_PLATFORM_ANNIVERSARY,
  markPlatformAnniversarySeen,
  PLATFORM_ANNIV_RITUAL,
  shouldOfferPlatformAnniversary,
  WAR_ROOM_FOUNDED_LABEL,
  type PlatformAnniversaryEdition,
} from "@/lib/platform-anniversary";
import BrandMark from "@/components/BrandMark";

export default function PlatformAnniversaryModal() {
  const [edition, setEdition] = useState<PlatformAnniversaryEdition | null>(
    null
  );
  const [open, setOpen] = useState(false);

  const tryShow = useCallback(async (force = false) => {
    if (!getSession()?.playerId) return;
    try {
      if (!force) {
        const { isPreLockCalm } = await import("@/lib/first-week");
        if (isPreLockCalm(getSession()?.playerId)) return;
      }
      const offer = await shouldOfferPlatformAnniversary({ force });
      if (!offer.show) return;
      setEdition(offer.edition);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => void tryShow(false), 1400);
    const t2 = window.setTimeout(() => void tryShow(false), 4500);
    function onForce() {
      void tryShow(true);
    }
    function onFocus() {
      void tryShow(false);
    }
    window.addEventListener(EVENT_FORCE_PLATFORM_ANNIVERSARY, onForce);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener(EVENT_FORCE_PLATFORM_ANNIVERSARY, onForce);
      window.removeEventListener("focus", onFocus);
    };
  }, [tryShow]);

  function dismiss() {
    if (edition) {
      markPlatformAnniversarySeen(edition.leagueId, edition.year);
    }
    setOpen(false);
    setEdition(null);
  }

  if (!open || !edition) return null;

  return (
    <div
      className="fixed inset-0 z-[113] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/88 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-labelledby="platform-anniv-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close anniversary paper"
        onClick={dismiss}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-sm border-4 border-amber-700/80 shadow-2xl bg-[#f4f0e6] text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-stone-900 text-amber-100 px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.28em]">
            {edition.ritualName || PLATFORM_ANNIV_RITUAL}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            {edition.yearsAlive}yr · Zero points
          </span>
        </div>

        <div className="px-5 pt-5 pb-3 text-center border-b-4 border-double border-stone-900">
          <div className="flex justify-center mb-2">
            <BrandMark size={48} variant="force" className="rounded-md" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800 mb-1">
            The War Room Dispatch · {PLATFORM_ANNIV_RITUAL}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-stone-600 mb-2">
            Founded {WAR_ROOM_FOUNDED_LABEL} · {edition.leagueName}
          </p>
          <h2
            id="platform-anniv-title"
            className="font-serif text-2xl sm:text-3xl font-black tracking-tight leading-tight text-stone-950"
          >
            {edition.headline}
          </h2>
          <p className="text-[13px] italic text-stone-700 mt-2 leading-relaxed">
            {edition.deck}
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="rounded border-2 border-amber-800/40 bg-amber-50/90 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-amber-900/80">
              Years in the wild
            </p>
            <p className="font-serif text-5xl font-black text-stone-950 tabular-nums mt-1">
              {edition.yearsAlive}
            </p>
            <p className="text-xs text-stone-600 mt-1">
              Full lap{edition.yearsAlive === 1 ? "" : "s"} since day one
            </p>
          </div>

          <p className="text-sm text-stone-800 leading-relaxed">{edition.body}</p>

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

          <p className="text-center text-sm font-bold text-amber-950">
            {edition.toastLine}
          </p>

          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-[52px] rounded-sm bg-stone-900 text-amber-50 font-bold text-sm uppercase tracking-wide"
          >
            Close paper · another year of this
          </button>
        </div>
      </div>
    </div>
  );
}
