"use client";

import { useEffect, useState } from "react";
import { loadLeaguePlayers } from "@/lib/cloud";
import {
  GAZETTE_ENABLED,
  markGazetteSeen,
  shouldOfferGazette,
  type GazetteEdition,
} from "@/lib/gazette";
import { notifyGazetteDone } from "@/lib/badge-celebration";
import { hasSeenRules } from "@/lib/rules";
import GazettePaper from "@/components/GazettePaper";

/**
 * One-shot "newspaper cover" after a week is scored.
 * Big, shareable, phone-first — then badge unlocks can fire.
 */
export default function GazetteModal() {
  const [edition, setEdition] = useState<GazetteEdition | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GAZETTE_ENABLED) return;

    let cancelled = false;

    async function tryShow() {
      if (!hasSeenRules()) return;

      try {
        const players = await loadLeaguePlayers();
        if (cancelled) return;
        const offer = await shouldOfferGazette(players);
        if (!offer.show) {
          notifyGazetteDone();
          return;
        }
        setEdition(offer.edition);
        setLeagueId(offer.leagueId);
        setOpen(true);
      } catch {
        notifyGazetteDone();
      }
    }

    const t1 = setTimeout(() => void tryShow(), 700);
    const t2 = setTimeout(() => void tryShow(), 2500);
    const t3 = setTimeout(() => void tryShow(), 5000);

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

  useEffect(() => {
    if (!GAZETTE_ENABLED || open) return;
    const id = setInterval(() => {
      if (!hasSeenRules()) return;
      void (async () => {
        try {
          const players = await loadLeaguePlayers();
          const offer = await shouldOfferGazette(players);
          if (offer.show) {
            setEdition(offer.edition);
            setLeagueId(offer.leagueId);
            setOpen(true);
          } else {
            notifyGazetteDone();
          }
        } catch {
          notifyGazetteDone();
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
    notifyGazetteDone();
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
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        aria-label="Close gazette"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-lg max-h-[94vh] overflow-y-auto overscroll-contain">
        <span id="gazette-title" className="sr-only">
          {edition.masthead}
        </span>
        <GazettePaper
          edition={edition}
          variant="modal"
          onDismiss={dismiss}
        />
      </div>
    </div>
  );
}
