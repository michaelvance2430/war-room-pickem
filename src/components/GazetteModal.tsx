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

    async function tryShow(opts?: { force?: boolean }) {
      // First 10 minutes: paper waits until after first lock
      // Foundry testing (not quiet eyes) bypasses calm so you can see the paper
      try {
        const { isPreLockCalm } = await import("@/lib/first-week");
        const { getSession } = await import("@/lib/league");
        const { allowFoundryCeremonies } = await import("@/lib/foundry-preview");
        const calm = isPreLockCalm(getSession()?.playerId);
        if (calm && !opts?.force && !allowFoundryCeremonies()) {
          notifyGazetteDone();
          return;
        }
      } catch {
        /* ok */
      }

      try {
        const players = await loadLeaguePlayers();
        if (cancelled) return;
        const offer = await shouldOfferGazette(players);
        if (!offer.show) {
          if (!opts?.force) notifyGazetteDone();
          return;
        }
        setEdition(offer.edition);
        setLeagueId(offer.leagueId);
        setOpen(true);
      } catch {
        if (!opts?.force) notifyGazetteDone();
      }
    }

    // One delayed probe — was 3 timeouts + 1.5s interval hammering standings
    const t1 = setTimeout(() => void tryShow(), 2200);

    function onStorage(e: StorageEvent) {
      if (e.key?.includes("warroom-rules") || e.key?.includes("gazette")) {
        void tryShow();
      }
    }
    function onForce() {
      void tryShow({ force: true });
    }
    function onScored() {
      void tryShow({ force: true });
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("warroom-force-gazette-paper", onForce);
    window.addEventListener("warroom-week-scored", onScored);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("warroom-force-gazette-paper", onForce);
      window.removeEventListener("warroom-week-scored", onScored);
    };
  }, []);

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
