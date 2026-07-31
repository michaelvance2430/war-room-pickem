"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const THRESHOLD = 72;
const MAX_PULL = 120;
/** Ignore tiny finger jitter so taps on links still fire. */
const ARM_PX = 16;
/** Hold past threshold this long, then release to refresh. */
const HOLD_MS = 500;

type Phase = "idle" | "pulling" | "holding" | "ready" | "refreshing";

/**
 * Mobile pull-to-refresh:
 * 1) Pull down from top
 * 2) Popup: Hold + countdown
 * 3) When countdown hits 0 → "Release to refresh"
 * 4) Release → reload (early release cancels)
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const startY = useRef(0);
  const startX = useRef(0);
  const armed = useRef(false);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartedAt = useRef<number | null>(null);

  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(HOLD_MS / 1000);

  // Hard page switch: never leave the shell translated mid-nav
  useEffect(() => {
    armed.current = false;
    pulling.current = false;
    offsetRef.current = 0;
    setOffset(0);
    setSecondsLeft(HOLD_MS / 1000);
    if (phaseRef.current !== "refreshing") {
      phaseRef.current = "idle";
      setPhase("idle");
    }
  }, [pathname]);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const clearHoldTimers = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    holdStartedAt.current = null;
  }, []);

  const cancelGesture = useCallback(() => {
    armed.current = false;
    pulling.current = false;
    clearHoldTimers();
    offsetRef.current = 0;
    setOffset(0);
    setSecondsLeft(HOLD_MS / 1000);
    if (phaseRef.current !== "refreshing") {
      setPhaseBoth("idle");
    }
  }, [clearHoldTimers, setPhaseBoth]);

  const doRefresh = useCallback(() => {
    clearHoldTimers();
    setPhaseBoth("refreshing");
    window.location.reload();
  }, [clearHoldTimers, setPhaseBoth]);

  const startHoldCountdown = useCallback(() => {
    if (holdTimer.current || phaseRef.current === "refreshing") return;
    holdStartedAt.current = Date.now();
    setPhaseBoth("holding");
    setSecondsLeft(HOLD_MS / 1000);

    tickTimer.current = setInterval(() => {
      if (!holdStartedAt.current) return;
      const elapsed = Date.now() - holdStartedAt.current;
      const left = Math.max(0, (HOLD_MS - elapsed) / 1000);
      setSecondsLeft(left);
    }, 30);

    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
      // Still past threshold? → ready for release
      if (offsetRef.current >= THRESHOLD && phaseRef.current === "holding") {
        setSecondsLeft(0);
        setPhaseBoth("ready");
      }
    }, HOLD_MS);
  }, [setPhaseBoth]);

  useEffect(() => {
    function setPull(n: number) {
      offsetRef.current = n;
      setOffset(n);
    }

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === "refreshing") return;
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
      clearHoldTimers();
      setSecondsLeft(HOLD_MS / 1000);
      setPhaseBoth("idle");
    }

    function onTouchMove(e: TouchEvent) {
      if (!armed.current || phaseRef.current === "refreshing") return;
      if (window.scrollY > 1) {
        cancelGesture();
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
          return;
        }
        pulling.current = true;
        setPhaseBoth("pulling");
      }

      if (dy <= 0) {
        setPull(0);
        clearHoldTimers();
        setPhaseBoth("pulling");
        return;
      }

      const damped = Math.min(MAX_PULL, (dy - ARM_PX) * 0.5);
      setPull(damped);

      if (damped >= THRESHOLD) {
        if (
          phaseRef.current === "pulling" ||
          phaseRef.current === "idle"
        ) {
          startHoldCountdown();
        }
        // If already ready and still holding, stay ready
      } else {
        // Dropped below threshold — cancel countdown / ready
        if (
          phaseRef.current === "holding" ||
          phaseRef.current === "ready"
        ) {
          clearHoldTimers();
          setSecondsLeft(HOLD_MS / 1000);
          setPhaseBoth("pulling");
        }
      }

      if (damped > 4 && e.cancelable) {
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      if (!armed.current && !pulling.current) return;
      const wasReady = phaseRef.current === "ready";
      armed.current = false;
      pulling.current = false;

      if (wasReady) {
        // Countdown finished and they released → refresh
        doRefresh();
        return;
      }

      // Released early during hold/pull → cancel
      if (phaseRef.current !== "refreshing") {
        cancelGesture();
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      clearHoldTimers();
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    cancelGesture,
    clearHoldTimers,
    doRefresh,
    setPhaseBoth,
    startHoldCountdown,
  ]);

  const showPopup =
    phase === "holding" || phase === "ready" || phase === "refreshing";
  const showPill = (phase === "pulling" && offset > 12) || showPopup;

  const displaySec = Math.max(0, secondsLeft).toFixed(1);
  const holdProgress =
    phase === "holding"
      ? Math.min(1, 1 - secondsLeft / (HOLD_MS / 1000))
      : phase === "ready" || phase === "refreshing"
        ? 1
        : 0;

  return (
    <>
      {/* Light top pill while pulling before threshold popup */}
      {showPill && !showPopup && (
        <div
          className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none"
          style={{ top: Math.max(10, offset * 0.35) }}
          aria-hidden
        >
          <div className="rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-bold text-muted shadow-lg backdrop-blur-md">
            Keep pulling…
          </div>
        </div>
      )}

      {/* Full popup once past threshold */}
      {showPopup && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh] px-4 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div
            className={`w-full max-w-xs rounded-2xl border-2 px-5 py-5 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-md text-center ${
              phase === "ready" || phase === "refreshing"
                ? "border-primary bg-primary text-black"
                : "border-primary/50 bg-card/95 text-foreground"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">
              Refresh
            </p>

            {phase === "holding" && (
              <>
                <p className="text-xl font-extrabold mb-1">Hold…</p>
                <p className="text-4xl font-black tabular-nums tracking-tight mb-2">
                  {displaySec}
                  <span className="text-lg font-bold opacity-70">s</span>
                </p>
                <p className="text-xs opacity-80 mb-3">
                  Keep holding — then release to refresh
                </p>
                <div className="h-2 rounded-full bg-black/15 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-75"
                    style={{ width: `${holdProgress * 100}%` }}
                  />
                </div>
              </>
            )}

            {phase === "ready" && (
              <>
                <p className="text-2xl font-extrabold mb-1">Release</p>
                <p className="text-sm font-semibold opacity-90">
                  to refresh the app
                </p>
                <p className="text-[11px] mt-2 opacity-70">
                  Let go now · lift finger early cancels
                </p>
              </>
            )}

            {phase === "refreshing" && (
              <>
                <p className="text-xl font-extrabold mb-1">Refreshing…</p>
                <p className="text-sm opacity-80">Hang tight</p>
              </>
            )}
          </div>
        </div>
      )}

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
