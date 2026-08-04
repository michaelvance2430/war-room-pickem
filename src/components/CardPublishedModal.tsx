"use client";

/**
 * After Commish publishes first card — one clear "you're live" moment on phone.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_CARD_PUBLISHED,
  takeJustPublished,
  type CardPublishedDetail,
} from "@/lib/first-session";
import { getLeague, getSession, isActuallyCommissioner } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { isAppCreator } from "@/lib/creator";
import { weekTitle } from "@/lib/dates";
import { setViewAsPlayer } from "@/lib/view-as-player";
import InviteFriends from "@/components/InviteFriends";

export default function CardPublishedModal() {
  const [detail, setDetail] = useState<CardPublishedDetail | null>(null);

  useEffect(() => {
    if (isGuestMode()) return;
    // Foundry jump previews + real hosts
    if (
      !isActuallyCommissioner() &&
      !isAppCreator(getSession()?.playerId)
    ) {
      return;
    }

    const pending = takeJustPublished();
    if (pending) {
      const t = setTimeout(() => setDetail(pending), 400);
      return () => clearTimeout(t);
    }

    function onPub(e: Event) {
      const ce = e as CustomEvent<CardPublishedDetail>;
      if (ce.detail?.weekNumber != null) setDetail(ce.detail);
    }
    window.addEventListener(EVENT_CARD_PUBLISHED, onPub);
    return () => window.removeEventListener(EVENT_CARD_PUBLISHED, onPub);
  }, []);

  if (!detail) return null;

  const label =
    detail.weekLabel || weekTitle(detail.weekNumber) || `Week ${detail.weekNumber}`;
  const league = getLeague();

  function dismiss() {
    setDetail(null);
  }

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-live-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-amber-400 to-primary" />
        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-2" aria-hidden>
              🟢
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              It worked
            </p>
            <h2 id="card-live-title" className="text-2xl font-black mt-1">
              {label} is LIVE
            </h2>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              Friends can lock picks now. Home is your resting place — or peek
              at what they see first.
            </p>
          </div>

          {league?.code && (
            <InviteFriends
              leagueName={league.name}
              code={league.code}
              leagueId={league.id}
              compact
            />
          )}

          <div className="flex flex-col gap-2">
            <Link
              href="/"
              onClick={dismiss}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-center flex items-center justify-center touch-manipulation"
            >
              Done → Home
            </Link>
            <button
              type="button"
              onClick={() => {
                setViewAsPlayer(true);
                dismiss();
                window.location.href = "/";
              }}
              className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-warning bg-warning/15 text-warning font-bold text-sm touch-manipulation"
            >
              See what players see
            </button>
            <Link
              href="/picks"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl border border-border text-muted text-sm font-medium text-center flex items-center justify-center touch-manipulation"
            >
              Open My Picks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
