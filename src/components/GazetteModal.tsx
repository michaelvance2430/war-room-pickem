"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLeaguePlayers } from "@/lib/cloud";
import {
  GAZETTE_ENABLED,
  markGazetteSeen,
  shouldOfferGazette,
  type GazetteEdition,
} from "@/lib/gazette";
import { hasSeenRules } from "@/lib/rules";

/**
 * One-shot "newspaper cover" after a week is scored.
 * Trial feature — disable via GAZETTE_ENABLED or remove this component.
 */
export default function GazetteModal() {
  const [edition, setEdition] = useState<GazetteEdition | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GAZETTE_ENABLED) return;

    let cancelled = false;

    async function tryShow() {
      // Wait for rules modal to be done (or never needed)
      if (!hasSeenRules()) {
        // Re-check after rules might be dismissed
        return;
      }

      try {
        const players = await loadLeaguePlayers();
        if (cancelled) return;
        const offer = shouldOfferGazette(players);
        if (!offer.show) return;
        setEdition(offer.edition);
        setLeagueId(offer.leagueId);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }

    // Delay so rules paints first if needed; also re-try so post-rules works
    const t1 = setTimeout(() => void tryShow(), 700);
    const t2 = setTimeout(() => void tryShow(), 2500);
    const t3 = setTimeout(() => void tryShow(), 5000);

    // When rules marked seen in another tab/component, try again
    function onStorage(e: StorageEvent) {
      if (e.key?.includes("warroom-rules") || e.key?.includes("gazette")) {
        void tryShow();
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Poll briefly until rules seen (same session dismiss)
  useEffect(() => {
    if (!GAZETTE_ENABLED || open) return;
    const id = setInterval(() => {
      if (!hasSeenRules()) return;
      void (async () => {
        try {
          const players = await loadLeaguePlayers();
          const offer = shouldOfferGazette(players);
          if (offer.show) {
            setEdition(offer.edition);
            setLeagueId(offer.leagueId);
            setOpen(true);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 1500);
    const stop = setTimeout(() => clearInterval(id), 20000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [open]);

  function dismiss() {
    if (edition && leagueId) {
      markGazetteSeen(leagueId, edition.weekIndex);
    }
    setOpen(false);
  }

  if (!open || !edition) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gazette-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close gazette"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-sm border-2 border-stone-600 bg-[#f4f0e6] text-stone-900 shadow-2xl">
        {/* Masthead */}
        <div className="border-b-4 border-double border-stone-900 px-5 pt-5 pb-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.35em] text-stone-600 mb-1">
            Extra · Extra
          </p>
          <h2
            id="gazette-title"
            className="font-serif text-2xl sm:text-3xl font-black tracking-tight text-stone-950"
          >
            {edition.masthead}
          </h2>
          <p className="text-[11px] uppercase tracking-widest text-stone-600 mt-2 border-t border-b border-stone-400 py-1">
            {edition.volumeLabel}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* A1 Crown (or top deadlock) */}
          <article>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800 mb-1">
              {edition.crown.kind === "tie"
                ? "★ Deadlock · Who pulls ahead?"
                : "★ Top of the fold"}
            </p>
            <h3 className="font-serif text-xl sm:text-2xl font-black leading-tight text-stone-950">
              {edition.crown.headline}
            </h3>
            <p className="text-sm text-stone-700 mt-2 leading-snug">
              {edition.crown.deck}
            </p>
            <p className="text-xs text-stone-500 mt-2 font-medium">
              {edition.crown.names.join(" · ")} · {edition.crown.pts} pts
              {edition.crown.kind === "tie" ? " each" : ""} · {edition.weekLabel}
            </p>
          </article>

          {edition.shame && (
            <article className="border-t border-stone-400 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-900 mb-1">
                {edition.shame.kind === "tie"
                  ? "🚽 Basement traffic jam"
                  : "🚽 Also in this edition"}
              </p>
              <h3 className="font-serif text-lg font-bold leading-snug text-stone-900">
                {edition.shame.headline}
              </h3>
              <p className="text-sm text-stone-700 mt-1.5 leading-snug">
                {edition.shame.deck}
              </p>
              <p className="text-xs text-stone-500 mt-2 font-medium">
                {edition.shame.names.join(" · ")} · {edition.shame.pts} pts
                {edition.shame.kind === "tie" ? " each" : ""}
              </p>
            </article>
          )}

          <p className="text-[10px] text-stone-500 text-center italic pt-1">
            You only see this once per scored week. Rules live under Rules anytime.
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-lg bg-stone-900 text-[#f4f0e6] text-sm font-semibold hover:bg-stone-800"
          >
            Got it
          </button>
          <Link
            href="/standings"
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-lg border-2 border-stone-900 text-stone-900 text-sm font-semibold text-center hover:bg-stone-200"
          >
            See standings
          </Link>
        </div>
      </div>
    </div>
  );
}
