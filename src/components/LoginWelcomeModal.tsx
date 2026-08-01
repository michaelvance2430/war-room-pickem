"use client";

/**
 * Post-login status popup: sarcastic welcome + “we’re building” notice.
 * Checkbox “don’t show me this again” → localStorage forever.
 * Without it, show once per browser session on login.
 */

import { useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";

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

    const t = window.setTimeout(() => {
      markShownThisSession();
      setOpen(true);
    }, 350);
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1.5">
            Official transmission
          </p>
          <h2
            id="login-welcome-title"
            className="text-xl font-extrabold text-foreground leading-snug"
          >
            Thanks for joining
          </h2>
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
              <em>our</em> clock — it&apos;s messy). Check back daily if you
              can; new stuff will keep landing.
            </p>
            <p className="text-foreground text-sm leading-relaxed font-medium">
              Things will be slow until{" "}
              <span className="text-primary">Sunday, Aug 23</span>. After that,
              we stop pretending this is a calm construction zone.
            </p>
          </div>
          <p className="text-xs text-muted">
            In the meantime: make picks, roast your friends, and try not to
            confuse the save button with the back button. We believe in you.
            Mostly.
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
