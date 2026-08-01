"use client";

/**
 * Post-login status popup: sarcastic welcome + “we’re building” notice.
 * Checkbox “don’t show me this again” → localStorage forever.
 * Without it, show once per browser session on login.
 */

import { useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import BrandMark from "@/components/BrandMark";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import { hasLockedPicksOnce, isPreLockCalm } from "@/lib/first-week";
import { claimSessionDrama } from "@/lib/session-drama";

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
}

export default function LoginWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isGuestMode()) return;

    function tryOpen() {
      const session = getSession();
      if (!session?.playerId) return;
      if (isDismissedForever()) return;
      if (wasShownThisSession()) return;
      // First 10 minutes: lame and easy — no shop splash until after first lock
      if (isPreLockCalm(session.playerId)) return;
      // Never stack on the player walkthrough
      if (needsPlayerTutorial() || isPlayerTutorialActive()) return;
      // Soft unlock owns the first-lock session — welcome next login
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
      // Opening week: ring ceremony owns the moment
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { isOpeningWeekLive } =
          require("@/components/RingCeremonyModal") as typeof import("@/components/RingCeremonyModal");
        if (isOpeningWeekLive()) return;
      } catch {
        /* ok */
      }
      if (!claimSessionDrama("welcome")) return;
      if (!hasLockedPicksOnce(session.playerId)) return;

      markShownThisSession();
      setOpen(true);
    }

    // Re-check after lock (first mount may have been pre-lock)
    tryOpen();
    const t = window.setTimeout(tryOpen, 1500);
    function onProgress() {
      tryOpen();
    }
    window.addEventListener("warroom-first-week-progress", onProgress);
    window.addEventListener("warroom-progressive-disclosure", onProgress);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("warroom-first-week-progress", onProgress);
      window.removeEventListener("warroom-progressive-disclosure", onProgress);
    };
  }, []);

  function dismiss() {
    if (dontShowAgain) {
      markDismissedForever();
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-welcome-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close welcome"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card shadow-[0_0_60px_rgba(34,197,94,0.12)] overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0 bg-primary/10">
          <div className="flex items-center gap-3 mb-2">
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

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3 text-sm text-muted leading-relaxed">
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
              <em>our</em> clock — it&apos;s messy). Check back when you can;
              new stuff will keep landing.
            </p>
            <p className="text-foreground text-sm leading-relaxed font-medium">
              One real job this week: open{" "}
              <span className="text-primary">My Picks</span>, fill the card,
              and lock before first kickoff.
            </p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            In the meantime, search around, mash some buttons, and see what you
            can discover… sorta like your first… well. Never mind. We believe
            in you. Mostly.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
            />
            <span className="text-xs text-muted group-hover:text-foreground leading-snug">
              Don&apos;t show me this again
              <span className="block text-[11px] text-muted/80 mt-0.5">
                (For those who already proved they can read. Once is enough.)
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm hover:opacity-90"
          >
            Cool — I&apos;m literate, let me in
          </button>
        </div>
      </div>
    </div>
  );
}
