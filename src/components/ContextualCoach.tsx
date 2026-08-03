"use client";

/**
 * One-time contextual coaching — small, non-blocking, milestone-based.
 * Replaces multi-step walkthrough / blur / focus-lock tutorials.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, getLeague } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  EVENT_COACHING,
  type CoachOffer,
  backfillCoachingFromWorld,
  markCoachDismissed,
  markCoachShown,
  onViewedResults,
  resolveCoachOffer,
  shouldSuppressCoaching,
  COACH_KEYS,
} from "@/lib/coaching";
import { loadCoachWorldSnapshot } from "@/lib/coaching/world";
import { prepareNavigation } from "@/lib/smooth";

export default function ContextualCoach() {
  const pathname = usePathname();
  const router = useRouter();
  const [offer, setOffer] = useState<CoachOffer | null>(null);
  const shownKeyRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isGuestMode()) {
      setOffer(null);
      return;
    }
    if (shouldSuppressCoaching(pathname)) {
      setOffer(null);
      return;
    }
    const session = getSession();
    const league = getLeague();
    if (!session?.playerId || !league?.id) {
      setOffer(null);
      return;
    }

    const snap = await loadCoachWorldSnapshot();
    if (!snap) {
      setOffer(null);
      return;
    }

    backfillCoachingFromWorld(snap, {
      userId: session.playerId,
      leagueId: league.id,
    });

    // Completing results when they land on standings with scores ready
    if (
      pathname?.includes("/standings") ||
      pathname?.includes("/board")
    ) {
      if (snap.scoredWeekCount > 0 && snap.hasLockedPicks) {
        onViewedResults(league.id);
      }
    }

    const next = resolveCoachOffer(snap, {
      userId: session.playerId,
      leagueId: league.id,
    });
    setOffer(next);
  }, [pathname]);

  useEffect(() => {
    if (isGuestMode()) return;
    if (!getSession()?.playerId) return;

    // Retire legacy multi-step journeys + walkthrough flags once
    try {
      void import("@/lib/onboarding/engine").then((m) => {
        const s = m.readOnboardingState();
        if (s.active) {
          m.skipJourney();
        }
        // Mark journeys complete so they never auto-restart
        m.markJourneyComplete("player");
        m.markJourneyComplete("commissioner");
      });
      void import("@/lib/player-tutorial").then((m) => {
        if (!m.getPlayerTutorialState().completed) {
          m.completePlayerTutorial();
        }
      });
    } catch {
      /* ok */
    }

    void refresh();
    const t = window.setTimeout(() => void refresh(), 1200);

    function onEvt() {
      void refresh();
    }
    window.addEventListener(EVENT_COACHING, onEvt);
    window.addEventListener("warroom-card-published", onEvt);
    window.addEventListener("warroom-invite-shared", onEvt);
    window.addEventListener("warroom-first-week-progress", onEvt);
    window.addEventListener("focus", onEvt);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENT_COACHING, onEvt);
      window.removeEventListener("warroom-card-published", onEvt);
      window.removeEventListener("warroom-invite-shared", onEvt);
      window.removeEventListener("warroom-first-week-progress", onEvt);
      window.removeEventListener("focus", onEvt);
    };
  }, [refresh]);

  // Mark shown when a new offer renders (not the same as completed)
  useEffect(() => {
    if (!offer) {
      shownKeyRef.current = null;
      return;
    }
    const id = `${offer.leagueId}:${offer.key}`;
    if (shownKeyRef.current === id) return;
    shownKeyRef.current = id;
    markCoachShown(offer.key, {
      userId: offer.userId,
      leagueId: offer.leagueId,
    });
  }, [offer]);

  if (!offer || shouldSuppressCoaching(pathname)) return null;

  // Don't cover the picks form mid-submit — strip sits above bottom nav only
  const onPicks = !!pathname?.includes("/picks");

  function dismiss() {
    markCoachDismissed(offer!.key, {
      userId: offer!.userId,
      leagueId: offer!.leagueId,
    });
    setOffer(null);
  }

  function goPrimary() {
    if (busyRef.current || !offer) return;
    busyRef.current = true;
    // Do NOT dismiss or complete on click — only navigation.
    // completed_at is set by real product hooks (publish, lock, invite…).
    const href = offer.href;
    try {
      prepareNavigation(href);
    } catch {
      /* ok */
    }
    router.push(href);
    window.setTimeout(() => {
      busyRef.current = false;
    }, 800);
  }

  return (
    <div
      className="fixed left-0 right-0 z-[52] px-3 pointer-events-none"
      style={{
        bottom: onPicks
          ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
          : "calc(4rem + env(safe-area-inset-bottom, 0px))",
      }}
      data-contextual-coach={offer.key}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-md mx-auto rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-sm shadow-xl p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-foreground leading-snug">
              {offer.title}
            </p>
            <p className="text-[13px] text-muted mt-0.5 leading-snug">
              {offer.body}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-muted hover:text-foreground text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goPrimary}
            className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation active:scale-[0.99]"
          >
            {offer.primaryLabel}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2.5 min-h-[44px] rounded-xl border border-border text-xs font-semibold text-muted hover:text-foreground"
          >
            {offer.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
