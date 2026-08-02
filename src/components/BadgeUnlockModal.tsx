"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_GAZETTE_DONE,
  findNewBadgeUnlocksForSession,
  markBadgesCelebrated,
} from "@/lib/badge-celebration";
import { isStackableBadge, TIER_LABEL } from "@/lib/badges";
import { stackCelebrationKey } from "@/lib/badge-stacks";
import type { BadgeStatus, BadgeTier } from "@/lib/types";
import { getSession } from "@/lib/league";
import CavalryScoutTrophy from "@/components/CavalryScoutTrophy";

const TIER_HEX: Record<BadgeTier, string> = {
  legendary: "#eab308",
  epic: "#a855f7",
  rare: "#3b82f6",
  common: "#22c55e",
};

/**
 * After Gazette (or if no paper), celebrate badges one at a time.
 * Queue: dismiss → next badge until empty.
 */
export default function BadgeUnlockModal() {
  const [queue, setQueue] = useState<BadgeStatus[]>([]);
  const [checked, setChecked] = useState(false);

  const current = queue[0] ?? null;
  const remaining = Math.max(0, queue.length - 1);

  const tryCelebrate = useCallback(async (opts?: { force?: boolean }) => {
    if (checked && !opts?.force) return;
    if (!getSession()?.playerId) return;

    // After first lock only for calm first 10 minutes; season-alive still ok later
    // Foundry testing (not quiet eyes) can celebrate so you can see cheevo UX
    // Pending lore (Cavalry Scout) always allowed to pop on login
    try {
      const {
        canShowBadgeCelebrations,
        isPreLockCalm,
        syncFirstWeekFromCloud,
      } = await import("@/lib/first-week");
      const { allowFoundryCeremonies } = await import("@/lib/foundry-preview");
      const { readPendingBadgeCelebration } = await import(
        "@/lib/badge-celebration"
      );
      await syncFirstWeekFromCloud(getSession()?.playerId);
      const pid = getSession()?.playerId || "";
      const pendingLore = readPendingBadgeCelebration(pid);
      const foundry = allowFoundryCeremonies() || !!opts?.force;
      if (pendingLore.length === 0) {
        if (isPreLockCalm(pid) && !foundry) return;
        if (!canShowBadgeCelebrations(pid) && !foundry) {
          // Stay unchecked so we re-try after they lock
          return;
        }
      }
    } catch {
      /* proceed best-effort */
    }

    const result = await findNewBadgeUnlocksForSession();
    if (!result || result.newBadges.length === 0) {
      setChecked(true);
      return;
    }

    setQueue(result.newBadges);
    setChecked(true);
  }, [checked]);

  useEffect(() => {
    function onGazetteDone() {
      void tryCelebrate({ force: true });
    }
    function onFirstWeek() {
      void tryCelebrate();
    }
    function onForce(e: Event) {
      const ce = e as CustomEvent<{ badges?: BadgeStatus[] }>;
      const badges = ce.detail?.badges;
      if (!badges?.length) return;
      setQueue((q) => {
        const ids = new Set(q.map((b) => b.def.id));
        const next = badges.filter((b) => !ids.has(b.def.id));
        return next.length ? [...q, ...next] : q;
      });
      setChecked(true);
    }
    function onForceCheck() {
      setChecked(false);
      void tryCelebrate({ force: true });
    }
    window.addEventListener(EVENT_GAZETTE_DONE, onGazetteDone);
    window.addEventListener("warroom-first-week-progress", onFirstWeek);
    window.addEventListener("warroom-badge-force-celebrate", onForce);
    window.addEventListener("warroom-force-badge-check", onForceCheck);
    return () => {
      window.removeEventListener(EVENT_GAZETTE_DONE, onGazetteDone);
      window.removeEventListener("warroom-first-week-progress", onFirstWeek);
      window.removeEventListener("warroom-badge-force-celebrate", onForce);
      window.removeEventListener("warroom-force-badge-check", onForceCheck);
    };
  }, [tryCelebrate]);

  // Fallback if gazette never fires (only after core loop unlock)
  // Lore grants (Cavalry Scout) also retry early so login popup isn't missed.
  useEffect(() => {
    if (checked) return;
    // Was 4 probes (1.2–10s) — too chatty on every app open
    const timers = [2500, 8000].map((ms) =>
      setTimeout(() => {
        void (async () => {
          try {
            const { readPendingBadgeCelebration } = await import(
              "@/lib/badge-celebration"
            );
            const { getSession } = await import("@/lib/league");
            const pid = getSession()?.playerId;
            const pending = pid ? readPendingBadgeCelebration(pid) : [];
            if (pending.length > 0) {
              void tryCelebrate({ force: true });
              return;
            }
            const { hasSeenRules } = await import("@/lib/rules");
            const { allowFoundryCeremonies } = await import(
              "@/lib/foundry-preview"
            );
            if (!hasSeenRules() && !allowFoundryCeremonies()) return;
          } catch {
            /* ok */
          }
          void tryCelebrate();
        })();
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [checked, tryCelebrate]);

  function advance() {
    const session = getSession();
    if (session?.playerId && current) {
      const id = current.def.id;
      if (isStackableBadge(id) && current.earnCount) {
        markBadgesCelebrated(session.playerId, [
          id,
          stackCelebrationKey(id, current.earnCount),
        ]);
      } else {
        markBadgesCelebrated(session.playerId, [id]);
      }
    }
    setQueue((q) => q.slice(1));
  }

  if (!current) return null;

  const hex = TIER_HEX[current.def.tier];

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
        onClick={advance}
      />

      <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-2 border-primary/60 bg-card shadow-[0_0_40px_rgba(34,197,94,0.25)] overflow-hidden">
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
            Achievement unlocked!
          </h2>
          {remaining > 0 && (
            <p className="text-[11px] text-muted mt-1.5">
              {remaining} more after this
            </p>
          )}
        </div>

        <div className="px-5 py-6 flex flex-col items-center text-center">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl border-2 bg-background mb-4"
            style={{
              borderColor: hex,
              boxShadow: `0 0 28px ${hex}88`,
            }}
          >
            {current.def.id === "worlds_greatest_cavalry_scout" ? (
              <CavalryScoutTrophy size={72} />
            ) : (
              current.def.icon
            )}
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
            <span className="text-xl font-black text-foreground">
              {current.def.name}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{ color: hex, borderColor: `${hex}66` }}
            >
              {TIER_LABEL[current.def.tier]}
            </span>
          </div>
          <p className="text-sm text-muted leading-snug max-w-sm">
            {current.def.description}
          </p>
          <p
            className="text-sm font-bold mt-3"
            style={{ color: hex }}
          >
            {current.def.careerOnly || current.def.creatorOnly
              ? `+${current.def.points} career pts · career only`
              : `+${current.def.points} achievement pts`}
            {current.def.stackable && current.earnCount
              ? ` · lifetime ×${current.earnCount}`
              : ""}
          </p>
          {(current.earnedSeasonYear != null ||
            current.earnedWeek != null) && (
            <p className="text-xs text-muted mt-2 font-medium">
              {current.earnedSeasonYear != null && current.earnedWeek != null
                ? `${current.earnedSeasonYear} · Week ${current.earnedWeek}`
                : current.earnedSeasonYear != null
                  ? `${current.earnedSeasonYear}`
                  : `Week ${current.earnedWeek}`}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={advance}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm"
          >
            {remaining > 0 ? "Hell yeah — next" : "Hell yeah"}
          </button>
          <Link
            href={
              getSession()?.playerId
                ? `/profile/${getSession()!.playerId}`
                : "/standings"
            }
            onClick={advance}
            className="flex-1 py-3 rounded-xl border border-border text-center text-sm font-medium text-muted hover:text-foreground"
          >
            View badge shelves
          </Link>
        </div>
      </div>
    </div>
  );
}
