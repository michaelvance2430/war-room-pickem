"use client";

/**
 * Quiet conversion close after guest has explored (tutorial done).
 * No fireworks — relationships are the product.
 */

import { useEffect, useState } from "react";
import {
  getGuestState,
  isGuestMode,
  needsGuestTutorial,
} from "@/lib/guest-mode";
import GuestJoinCtas from "@/components/GuestJoinCtas";

const DISMISS_KEY = "warroom-guest-conversion-dismissed-v1";

export default function GuestConversionClose() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isGuestMode()) {
      setShow(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setShow(false);
        return;
      }
    } catch {
      /* ok */
    }
    const s = getGuestState();
    if (!s.role || needsGuestTutorial(s.role)) {
      setShow(false);
      return;
    }
    // Soft delay so it doesn't compete with first paint / tutorial close
    const t = window.setTimeout(() => setShow(true), 12_000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ok */
    }
    setShow(false);
  }

  return (
    <section className="mb-6 rounded-2xl border-2 border-primary/35 bg-primary/5 px-4 py-5 sm:px-5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        Ready when you are
      </p>
      <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
        You&apos;ve seen the app.
      </h2>
      <p className="text-sm text-muted leading-relaxed">
        The best part isn&apos;t the app.{" "}
        <strong className="text-foreground">It&apos;s your people.</strong>
      </p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        Ready to start your own War Room?
      </p>
      <GuestJoinCtas layout="row" primary="create" />
      <button
        type="button"
        onClick={dismiss}
        className="w-full text-center text-[11px] text-muted hover:text-foreground py-1"
      >
        Keep exploring as guest
      </button>
    </section>
  );
}
