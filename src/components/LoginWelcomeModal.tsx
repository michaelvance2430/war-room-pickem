"use client";

/**
 * Post-login status popup: sarcastic welcome + “we’re building” notice.
 * Any dismiss = forever (was easy to get stuck if session cleared / overlay stole taps).
 */

import { useEffect, useRef, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import BrandMark from "@/components/BrandMark";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import { hasLockedPicksOnce, isPreLockCalm } from "@/lib/first-week";
import {
  claimSessionDrama,
  clearSessionDrama,
} from "@/lib/session-drama";
import { firstSeasonWeek, weekWindowMs } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/smooth";

/** Days until the sport’s first official pick’em week (CFB Week 0 / NFL Week 1). */
function getOfficialOpenTease(): {
  open: boolean;
  days: number;
  weekLabel: string;
} {
  const sid = getLeague()?.sportId;
  const first = firstSeasonWeek(sid);
  const weekLabel = weekTitle(first, sid);
  const win = weekWindowMs(first, sid === "nfl" ? "nfl" : "cfb");
  if (!win) return { open: true, days: 0, weekLabel };
  const left = win.startMs - Date.now();
  if (left <= 0) return { open: true, days: 0, weekLabel };
  const days = Math.max(1, Math.ceil(left / 86_400_000));
  return { open: false, days, weekLabel };
}

const FOREVER_KEY = "warroom-login-welcome-v1-dismissed";
const SESSION_KEY = "warroom-login-welcome-v1-session";

function canUseStorage() {
  return typeof window !== "undefined";
}

function isDismissedForever(): boolean {
  if (!canUseStorage()) return true;
  try {
    return localStorage.getItem(FOREVER_KEY) === "1";
  } catch {
    return false;
  }
}

function wasShownThisSession(): boolean {
  if (!canUseStorage()) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function markDismissedForever() {
  try {
    localStorage.setItem(FOREVER_KEY, "1");
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function LoginWelcomeModal() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const dismissedRef = useRef(false);
  const [openTease, setOpenTease] = useState(() => ({
    open: true,
    days: 0,
    weekLabel: "Week 0",
  }));

  function dismiss() {
    if (dismissedRef.current && !openRef.current) return;
    dismissedRef.current = true;
    openRef.current = false;
    // Always forever — one sarcastic welcome is enough; stop re-trapping people
    markDismissedForever();
    clearSessionDrama("welcome");
    setOpen(false);
    unlockBodyScroll();
  }

  useEffect(() => {
    if (isGuestMode()) return;

    async function tryOpen() {
      if (dismissedRef.current || openRef.current) return;
      if (isDismissedForever()) return;

      const session = getSession();
      if (!session?.playerId) return;
      if (wasShownThisSession()) return;
      // First 10 minutes: lame and easy — no shop splash until after first lock
      if (isPreLockCalm(session.playerId)) return;
      if (needsPlayerTutorial() || isPlayerTutorialActive()) return;
      try {
        const { isOnboardingActive } = await import("@/lib/onboarding");
        if (isOnboardingActive()) return;
      } catch {
        /* ok */
      }
      try {
        if (sessionStorage.getItem("warroom-no-welcome-this-session") === "1") {
          return;
        }
        if (sessionStorage.getItem("warroom-soft-unlock-session-v1") === "1") {
          return;
        }
      } catch {
        /* ok */
      }
      try {
        const { isOpeningWeekLive } = await import(
          "@/components/RingCeremonyModal"
        );
        if (isOpeningWeekLive()) return;
      } catch {
        /* ok */
      }
      if (!claimSessionDrama("welcome")) return;
      if (!hasLockedPicksOnce(session.playerId)) return;

      markShownThisSession();
      setOpenTease(getOfficialOpenTease());
      openRef.current = true;
      setOpen(true);
      lockBodyScroll();
    }

    tryOpen();
    const t = window.setTimeout(tryOpen, 1500);
    // Fail-safe: never trap scroll for long — 12s then forever-dismiss
    const failSafe = window.setTimeout(() => {
      if (openRef.current) dismiss();
    }, 12_000);

    function onProgress() {
      tryOpen();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        dismiss();
      }
    }
    window.addEventListener("warroom-first-week-progress", onProgress);
    window.addEventListener("warroom-progressive-disclosure", onProgress);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(failSafe);
      window.removeEventListener("warroom-first-week-progress", onProgress);
      window.removeEventListener("warroom-progressive-disclosure", onProgress);
      window.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-welcome-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close welcome"
        onClick={dismiss}
      />
      <div
        className="relative z-10 w-full sm:max-w-md max-h-[min(90vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card shadow-[0_0_60px_rgba(34,197,94,0.12)] overflow-hidden pointer-events-auto"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0 bg-primary/10 relative">
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 z-20 min-w-[44px] min-h-[44px] rounded-lg text-muted hover:text-foreground hover:bg-card-hover text-lg font-bold touch-manipulation"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 mb-2 pr-10">
            <BrandMark size={56} variant="force" className="rounded-lg" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Official transmission
              </p>
              <h2
                id="login-welcome-title"
                className="text-xl font-extrabold text-foreground leading-snug"
              >
                Thanks for joining
              </h2>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3 text-sm text-muted leading-relaxed overscroll-contain">
          <p className="text-foreground">
            Honestly? We&apos;re a little surprised you figured out how to get
            in. Like… genuinely. There was a betting pool.
          </p>
          <p>
            I guess the rumors are true —{" "}
            <span className="text-primary font-semibold">you CAN read</span>.
            Bold of you. Rare talent these days. Don&apos;t let it go to your
            head.
          </p>
          <div className="rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              Heads up from the shop
            </p>
            <p className="text-foreground text-sm leading-relaxed">
              Improvements are being made around the clock (well, around{" "}
              <em>our</em> clock — it&apos;s messy). New stuff will keep
              landing.
            </p>
            <p className="text-foreground text-sm leading-relaxed font-medium">
              {openTease.open ? (
                <>
                  <span className="text-primary">{openTease.weekLabel}</span>{" "}
                  is live. When a real card drops, lock it like you mean it —
                  until then, poke around and see what you can break.
                </>
              ) : (
                <>
                  Clock says we&apos;ve got{" "}
                  <span className="text-primary tabular-nums">
                    {openTease.days}{" "}
                    {openTease.days === 1 ? "day" : "days"}
                  </span>{" "}
                  until{" "}
                  <span className="text-primary">{openTease.weekLabel}</span>{" "}
                  <span className="uppercase tracking-wide font-extrabold text-foreground">
                    officially opens
                  </span>
                  . That is not an invitation to behave. Poke around. See what
                  you can break.
                </>
              )}
            </p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Mash buttons. Break stuff (gently). Sorta like your first… well.
            Never mind. We believe in you. Mostly.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2 bg-card">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold text-sm hover:opacity-90 active:scale-[0.99] touch-manipulation"
          >
            Cool — I&apos;m literate, let me in
          </button>
          <p className="text-[11px] text-center text-muted">
            Won&apos;t show again. Esc or ✕ also works.
          </p>
        </div>
      </div>
    </div>
  );
}
