"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 78;
const MAX_PULL = 120;
/** Ignore tiny finger jitter so taps on links still fire. */
const ARM_PX = 18;

/**
 * Mobile pull-down at top of page → full reload.
 * Careful not to steal taps on checklist links / buttons.
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  const startY = useRef(0);
  const startX = useRef(0);
  const armed = useRef(false);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const refreshingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hint, setHint] = useState(false);

  const doRefresh = useCallback(() => {
    refreshingRef.current = true;
    setRefreshing(true);
    offsetRef.current = THRESHOLD;
    setOffset(THRESHOLD);
    window.location.reload();
  }, []);

  useEffect(() => {
    function setPull(n: number) {
      offsetRef.current = n;
      setOffset(n);
      setHint(n >= THRESHOLD * 0.55);
    }

    function reset() {
      armed.current = false;
      pulling.current = false;
      setPull(0);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      // Only candidate when truly at top
      if (window.scrollY > 1) return;
      const t = e.touches[0];
      if (!t) return;
      // Don't start a pull when the finger lands on a real control
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

      // Horizontal or upward = not a pull-to-refresh gesture
      if (!pulling.current) {
        if (dy < ARM_PX) return;
        if (dx > dy * 0.7) {
          // side swipe / scroll intention
          armed.current = false;
          return;
        }
        pulling.current = true;
      }

      if (dy <= 0) {
        setPull(0);
        return;
      }

      const damped = Math.min(MAX_PULL, (dy - ARM_PX) * 0.5);
      setPull(damped);
      // Only block native scroll once we've committed to a pull
      if (damped > 4 && e.cancelable) {
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!armed.current && !pulling.current) return;
      const shouldRefresh =
        pulling.current &&
        offsetRef.current >= THRESHOLD &&
        !refreshingRef.current;
      armed.current = false;
      pulling.current = false;
      if (shouldRefresh) {
        doRefresh();
      } else {
        setPull(0);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [doRefresh]);

  return (
    <>
      <div
        className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none transition-opacity"
        style={{
          top: Math.max(8, offset - 28),
          opacity: offset > 6 || refreshing ? 1 : 0,
        }}
        aria-hidden
      >
        <div
          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-lg backdrop-blur-md ${
            refreshing || offset >= THRESHOLD
              ? "border-primary/60 bg-primary text-black"
              : "border-border bg-card/90 text-muted"
          }`}
        >
          {refreshing
            ? "Refreshing…"
            : offset >= THRESHOLD
              ? "Release to refresh"
              : hint
                ? "Keep pulling…"
                : "Pull to refresh"}
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
