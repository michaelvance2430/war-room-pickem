"use client";

/**
 * Badge Achievement Reveal — restored under SAFE NAV baseline.
 *
 * Lifecycle contract (must never stick the app):
 * - Locks body only while open
 * - Releases lock on: advance, Escape, route change, unmount, force-dismiss
 * - No portal/inert/aria-hidden on app root
 * - Full-screen layer unmounts when queue empty (not opacity:0)
 * - Document listeners always cleaned up
 *
 * Other Moments remain off via MomentHost SAFE NAV. This modal is intentionally
 * allowed while SAFE NAV is on — do not re-suppress it with isSafeNavMode().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { lockBodyScroll, unlockBodyScroll, forceUnlockAllChrome } from "@/lib/smooth";
import { EVENT_FORCE_DISMISS_OVERLAYS } from "@/lib/safe-nav";

const TIER_HEX: Record<BadgeTier, string> = {
  legendary: "#eab308",
  epic: "#a855f7",
  rare: "#3b82f6",
  common: "#22c55e",
};

export default function BadgeUnlockModal() {
  const pathname = usePathname();
  const [queue, setQueue] = useState<BadgeStatus[]>([]);
  const [checked, setChecked] = useState(false);
  const bodyLockedRef = useRef(false);
  const openRef = useRef(false);

  const current = queue[0] ?? null;
  const remaining = Math.max(0, queue.length - 1);

  const releaseBody = useCallback(() => {
    if (!bodyLockedRef.current) return;
    bodyLockedRef.current = false;
    try {
      unlockBodyScroll();
    } catch {
      try {
        forceUnlockAllChrome();
      } catch {
        /* ok */
      }
    }
  }, []);

  const acquireBody = useCallback(() => {
    if (bodyLockedRef.current) return;
    bodyLockedRef.current = true;
    try {
      lockBodyScroll();
    } catch {
      /* ok */
    }
  }, []);

  /** Close without marking celebrated (refresh / route away mid-open). */
  const hardClose = useCallback(() => {
    openRef.current = false;
    setQueue([]);
    releaseBody();
  }, [releaseBody]);

  /** User acknowledged current badge → celebrate → next or close. */
  const advance = useCallback(() => {
    const session = getSession();
    const cur = queue[0];
    if (session?.playerId && cur) {
      try {
        const id = cur.def.id;
        if (isStackableBadge(id) && cur.earnCount) {
          markBadgesCelebrated(session.playerId, [
            id,
            stackCelebrationKey(id, cur.earnCount),
          ]);
        } else {
          markBadgesCelebrated(session.playerId, [id]);
        }
      } catch {
        /* still close */
      }
    }
    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) {
        openRef.current = false;
        // release after state update path
        queueMicrotask(() => releaseBody());
      }
      return next;
    });
  }, [queue, releaseBody]);

  // Sync body lock to open state
  useEffect(() => {
    if (current) {
      openRef.current = true;
      acquireBody();
    } else {
      openRef.current = false;
      releaseBody();
    }
  }, [current, acquireBody, releaseBody]);

  // Guaranteed cleanup on unmount
  useEffect(() => {
    return () => {
      openRef.current = false;
      if (bodyLockedRef.current) {
        bodyLockedRef.current = false;
        try {
          unlockBodyScroll();
        } catch {
          try {
            forceUnlockAllChrome();
          } catch {
            /* ok */
          }
        }
      }
    };
  }, []);

  // Route change while open → hard close + unlock (do not leave ghost layer)
  useEffect(() => {
    if (!openRef.current && !current) return;
    // pathname changed after open — close cleanly without double-celebrate
    // Only hard-close when we already had something open on a prior path
    // (skip first mount)
  }, [pathname]);

  const pathOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (current) {
      if (pathOpenRef.current == null) {
        pathOpenRef.current = pathname;
      } else if (pathOpenRef.current !== pathname) {
        hardClose();
        pathOpenRef.current = null;
      }
    } else {
      pathOpenRef.current = null;
    }
  }, [pathname, current, hardClose]);

  // Escape + emergency force-dismiss (SAFE NAV recovery) — always release
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!openRef.current && !queue.length) return;
      e.preventDefault();
      e.stopPropagation();
      advance();
    }
    function onForceDismiss() {
      hardClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT_FORCE_DISMISS_OVERLAYS, onForceDismiss);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT_FORCE_DISMISS_OVERLAYS, onForceDismiss);
    };
  }, [advance, hardClose, queue.length]);

  const tryCelebrate = useCallback(async (opts?: { force?: boolean }) => {
    if (checked && !opts?.force) return;
    if (!getSession()?.playerId) return;

    // Stable surface: avoid fighting auth / bare routes
    try {
      const path = window.location.pathname || "";
      if (
        path.startsWith("/login") ||
        path.startsWith("/join") ||
        path.startsWith("/auth")
      ) {
        return;
      }
    } catch {
      /* ok */
    }

    // After first lock only for calm first 10 minutes; season-alive still ok later
    // Foundry testing (not quiet eyes) can celebrate so you can see cheevo UX
    // Pending lore (Cavalry Scout / House Dragon queue) always allowed to pop
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

    try {
      const result = await findNewBadgeUnlocksForSession();
      if (!result || result.newBadges.length === 0) {
        setChecked(true);
        return;
      }
      setQueue(result.newBadges);
      setChecked(true);
    } catch {
      setChecked(true);
      releaseBody();
    }
  }, [checked, releaseBody]);

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

  // Fallback probes if gazette never fires (pending lore + normal unlocks)
  useEffect(() => {
    if (checked) return;
    const timers = [2500, 8000].map((ms) =>
      setTimeout(() => {
        void (async () => {
          try {
            const { readPendingBadgeCelebration } = await import(
              "@/lib/badge-celebration"
            );
            const { getSession: gs } = await import("@/lib/league");
            const pid = gs()?.playerId;
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

  if (!current) return null;

  const hex = TIER_HEX[current.def.tier];
  const isHouseDragon = current.def.id === "house_dragon_legendary";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
      data-badge-unlock-modal="1"
      data-fullscreen-overlay="badge-unlock"
    >
      {/* Backdrop — only this layer + card; unmounts with parent when queue empty */}
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close achievement"
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
            {isHouseDragon
              ? "🐉 LEGENDARY ACHIEVEMENT UNLOCKED"
              : "🎉 War Room flex"}
          </p>
          <h2
            id="badge-unlock-title"
            className="text-2xl font-black text-foreground tracking-tight"
          >
            {isHouseDragon ? "HOUSE DRAGON" : "Achievement unlocked!"}
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
          {!isHouseDragon && (
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
          )}
          {isHouseDragon && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border mb-2"
              style={{ color: hex, borderColor: `${hex}66` }}
            >
              {TIER_LABEL[current.def.tier]}
            </span>
          )}
          <p className="text-sm text-muted leading-snug max-w-sm">
            {current.def.description}
          </p>
          {!isHouseDragon && (
            <p className="text-sm font-bold mt-3" style={{ color: hex }}>
              {current.def.careerOnly || current.def.creatorOnly
                ? `+${current.def.points} career pts · career only`
                : `+${current.def.points} achievement pts`}
              {current.def.stackable && current.earnCount
                ? ` · lifetime ×${current.earnCount}`
                : ""}
            </p>
          )}
          {(current.earnedSeasonYear != null || current.earnedWeek != null) && (
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
            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm touch-manipulation"
          >
            {isHouseDragon
              ? "Long may House Dragon reign."
              : remaining > 0
                ? "Hell yeah — next"
                : "Hell yeah"}
          </button>
          {!isHouseDragon && (
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
          )}
        </div>
      </div>
    </div>
  );
}
