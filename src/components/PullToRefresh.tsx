"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 78;
const MAX_PULL = 120;
/** Ignore tiny finger jitter so taps on links still fire. */
const ARM_PX = 18;
/** Must hold past threshold this long before refresh starts. */
const HOLD_MS = 500;

/**
 * Mobile: pull down at top of page, then hold ~0.5s → full reload.
 * Release early cancels. Doesn't arm on link/button taps.
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  const startY = useRef(0);
  const startX = useRef(0);
  const armed = useRef(false);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const refreshingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartedAt = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    holdStartedAt.current = null;
    setHolding(false);
    setHoldProgress(0);
  }, []);

  const doRefresh = useCallback(() => {
    clearHold();
    refreshingRef.current = true;
    setRefreshing(true);
    offsetRef.current = THRESHOLD;
    setOffset(THRESHOLD);
    window.location.reload();
  }, [clearHold]);

  const startHold = useCallback(() => {
    if (holdTimer.current || refreshingRef.current) return;
    holdStartedAt.current = Date.now();
    setHolding(true);
    setHoldProgress(0);

    progressTimer.current = setInterval(() => {
      if (!holdStartedAt.current) return;
      const p = Math.min(1, (Date.now() - holdStartedAt.current) / HOLD_MS);
      setHoldProgress(p);
    }, 40);

    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      if (offsetRef.current >= THRESHOLD && !refreshingRef.current) {
        doRefresh();
      } else {
        setHolding(false);
        setHoldProgress(0);
      }
    }, HOLD_MS);
  }, [doRefresh]);

  useEffect(() => {
    function setPull(n: number) {
      offsetRef.current = n;
      setOffset(n);
    }

    function reset() {
      armed.current = false;
      pulling.current = false;
      clearHold();
      setPull(0);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 1) return;
      const t = e.touches[0];
      if (!t) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          "a, button, input, textarea, select, label, [role='button'], [role='link'], [data-no-ptr]"
        )
      ) {
        return;
      }
      startY.current = t.clientY;
      startX.current = t.clientX;
      armed.current = true;
      pulling.current = false;
      clearHold();
    }

    function onTouchMove(e: TouchEvent) {
      if (!armed.current || refreshingRef.current) return;
      if (window.scrollY > 1) {
        reset();
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = Math.abs(t.clientX - startX.current);

      if (!pulling.current) {
        if (dy < ARM_PX) return;
        if (dx > dy * 0.7) {
          armed.current = false;
          clearHold();
          return;
        }
        pulling.current = true;
      }

      if (dy <= 0) {
        setPull(0);
        clearHold();
        return;
      }

      const damped = Math.min(MAX_PULL, (dy - ARM_PX) * 0.5);
      setPull(damped);

      if (damped >= THRESHOLD) {
        // Past threshold — start hold clock (once)
        if (!holdTimer.current && !holdStartedAt.current) {
          startHold();
        }
      } else {
        // Dropped below threshold — cancel hold
        clearHold();
      }

      if (damped > 4 && e.cancelable) {
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!armed.current && !pulling.current) return;
      // Release before 0.5s = cancel (never refresh on release alone)
      armed.current = false;
      pulling.current = false;
      if (!refreshingRef.current) {
        clearHold();
        setPull(0);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      clearHold();
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [clearHold, startHold]);

  let label = "Pull to refresh";
  if (refreshing) {
    label = "Refreshing…";
  } else if (holding) {
    label = "Hold to refresh…";
  } else if (offset >= THRESHOLD) {
    label = "Hold to refresh…";
  } else if (offset > 20) {
    label = "Keep pulling…";
  }

  const show = offset > 6 || refreshing || holding;

  return (
    <>
      <div
        className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none transition-opacity"
        style={{
          top: Math.max(8, offset - 28),
          opacity: show ? 1 : 0,
        }}
        aria-hidden
      >
        <div
          className={`relative overflow-hidden rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-lg backdrop-blur-md ${
            refreshing || holding
              ? "border-primary/60 bg-primary text-black"
              : offset >= THRESHOLD
                ? "border-primary/50 bg-primary/20 text-primary"
                : "border-border bg-card/90 text-muted"
          }`}
        >
          {holding && !refreshing && (
            <span
              className="absolute inset-0 bg-black/15 origin-left"
              style={{ transform: `scaleX(${holdProgress})` }}
            />
          )}
          <span className="relative z-10">{label}</span>
        </div>
      </div>
      <div
        style={{
          transform: offset > 0 ? `translateY(${offset * 0.35}px)` : undefined,
          transition: pulling.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </>
  );
}
