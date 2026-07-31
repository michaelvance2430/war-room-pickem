"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 72;
const MAX_PULL = 120;

/**
 * Mobile pull-down at top of page → full reload (fresh data from phone).
 * Desktop: no-op (scroll behaves normally).
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  const startY = useRef(0);
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
    // Full reload so home/picks/locker all re-fetch clean
    window.location.reload();
  }, []);

  useEffect(() => {
    function setPull(n: number) {
      offsetRef.current = n;
      setOffset(n);
      setHint(n >= THRESHOLD * 0.55);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 2) return;
      const t = e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || refreshingRef.current) return;
      if (window.scrollY > 2) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.45);
      setPull(damped);
      if (damped > 8 && e.cancelable) {
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (offsetRef.current >= THRESHOLD && !refreshingRef.current) {
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
          opacity: offset > 8 || refreshing ? 1 : 0,
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
