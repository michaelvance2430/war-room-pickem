"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_GAZETTE_DONE,
  findNewBadgeUnlocksForSession,
  markBadgesCelebrated,
} from "@/lib/badge-celebration";
import { hasSeenRules } from "@/lib/rules";
import { TIER_LABEL } from "@/lib/badges";
import type { BadgeStatus, BadgeTier } from "@/lib/types";
import { getSession } from "@/lib/league";

const TIER_HEX: Record<BadgeTier, string> = {
  legendary: "#eab308",
  epic: "#a855f7",
  rare: "#3b82f6",
  common: "#22c55e",
};

/**
 * After Gazette (or if no paper), celebrate newly earned badges.
 * First-ever run baselines silently so you don't get 12 toasts day one.
 */
export default function BadgeUnlockModal() {
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState<BadgeStatus[]>([]);
  const [checked, setChecked] = useState(false);

  const tryCelebrate = useCallback(async () => {
    if (checked) return;
    if (!hasSeenRules()) return;
    if (!getSession()?.playerId) return;

    const result = await findNewBadgeUnlocksForSession();
    if (!result || result.newBadges.length === 0) {
      setChecked(true);
      return;
    }

    // Sort flashiest first
    const order: BadgeTier[] = ["legendary", "epic", "rare", "common"];
    const sorted = [...result.newBadges].sort(
      (a, b) => order.indexOf(a.def.tier) - order.indexOf(b.def.tier)
    );
    setBadges(sorted);
    setOpen(true);
    setChecked(true);
  }, [checked]);

  // Gazette finished (shown or skipped) → celebrate
  useEffect(() => {
    function onGazetteDone() {
      void tryCelebrate();
    }
    window.addEventListener(EVENT_GAZETTE_DONE, onGazetteDone);
    return () => window.removeEventListener(EVENT_GAZETTE_DONE, onGazetteDone);
  }, [tryCelebrate]);

  // Fallback: if gazette never fires (disabled / no edition), still check after rules
  useEffect(() => {
    if (checked) return;
    const timers = [3000, 6000, 10000].map((ms) =>
      setTimeout(() => {
        if (!hasSeenRules()) return;
        void tryCelebrate();
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [checked, tryCelebrate]);

  function dismiss() {
    const session = getSession();
    if (session?.playerId && badges.length) {
      markBadgesCelebrated(
        session.playerId,
        badges.map((b) => b.def.id)
      );
    }
    setOpen(false);
  }

  if (!open || badges.length === 0) return null;

  const headline =
    badges.length === 1
      ? "Achievement unlocked!"
      : `${badges.length} achievements unlocked!`;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-2 border-primary/60 bg-card shadow-[0_0_40px_rgba(34,197,94,0.25)] overflow-hidden">
        {/* Confetti-ish top bar */}
        <div
          className="h-1.5 w-full"
          style={{
            background:
              "linear-gradient(to right, #22c55e, #3b82f6, #a855f7, #eab308)",
          }}
        />

        <div className="px-5 pt-5 pb-3 text-center border-b border-border">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold mb-2">
            🎉 War Room flex
          </p>
          <h2
            id="badge-unlock-title"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {headline}
          </h2>
          <p className="text-xs text-muted mt-1.5">
            Something hit while you were away. Look at you.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {badges.map((b) => {
            const hex = TIER_HEX[b.def.tier];
            return (
              <div
                key={b.def.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/80 px-3 py-3"
                style={{
                  boxShadow: `inset 0 0 0 1px ${hex}33`,
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 shrink-0 bg-card"
                  style={{
                    borderColor: hex,
                    boxShadow: `0 0 16px ${hex}66`,
                  }}
                >
                  {b.def.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">
                      {b.def.name}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: hex }}
                    >
                      {TIER_LABEL[b.def.tier]}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 leading-snug">
                    {b.def.description}
                  </p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: hex }}>
                    +{b.def.points} achievement pts
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm"
          >
            Hell yeah
          </button>
          <Link
            href={
              getSession()?.playerId
                ? `/profile/${getSession()!.playerId}`
                : "/standings"
            }
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl border border-border text-center text-sm font-medium text-muted hover:text-foreground"
          >
            View badge shelves
          </Link>
        </div>
      </div>
    </div>
  );
}
