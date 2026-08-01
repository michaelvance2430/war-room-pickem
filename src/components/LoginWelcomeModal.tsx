"use client";

/**
 * Post-login status popup: sarcastic welcome + “we’re building” notice.
 * Checkbox “don’t show me this again” → localStorage forever.
 * Without it, show once per browser session on login.
 */

import { useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { hasSeenRules } from "@/lib/rules";
import BrandMark from "@/components/BrandMark";

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
    const session = getSession();
    if (!session?.playerId) return;
    if (isDismissedForever()) return;
    if (wasShownThisSession()) return;
    // First session: Rules briefing wins. Welcome only after they've seen rules
    // (or on a later login) so we never stack two full-screen modals.
    if (!hasSeenRules()) return;

    const t = window.setTimeout(() => {
      markShownThisSession();
      setOpen(true);
    }, 600);
    return () => window.clearTimeout(t);
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
            You&apos;re in. Welcome to the room — lock a card, talk in the
            locker, and let the standings do the roasting.
          </p>
          <p>
            We ship improvements constantly (messy on purpose). Check back
            when you can; new stuff keeps landing.
          </p>
          <div className="rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              One job this week
            </p>
            <p className="text-foreground text-sm leading-relaxed font-medium">
              Open <span className="text-primary">My Picks</span>, fill the
              card, and lock before first kickoff. Everything else opens after
              that.
            </p>
          </div>
          <p className="text-xs text-muted">
            Humor stays. Homework later. You already passed the hard part —
            getting in.
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
