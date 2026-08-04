"use client";

/**
 * One-time after first lock / season alive: soft welcome to the full room.
 * Prevents the cold dump from first-hour chrome to every tile at once.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_FIRST_WEEK_PROGRESS,
  isCoreLoopUnlocked,
  hasLockedPicksOnce,
} from "@/lib/first-week";
import { getSession } from "@/lib/league";
import { claimSessionDrama, clearSessionDrama } from "@/lib/session-drama";

const KEY = "warroom-soft-unlock-seen-v1";
/** Same browser session after lock: don't re-show SoftUnlock on next page */
const SESSION_SHOWN = "warroom-soft-unlock-session-v1";

function readSeen(playerId: string): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const m = JSON.parse(raw) as Record<string, boolean>;
    return !!m[playerId];
  } catch {
    return false;
  }
}

function markSeen(playerId: string) {
  try {
    const raw = localStorage.getItem(KEY);
    const m = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
    m[playerId] = true;
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export default function SoftUnlockBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function check() {
      const id = getSession()?.playerId;
      if (!id) return;
      if (!isCoreLoopUnlocked(id)) return;
      if (readSeen(id)) return;
      // Only celebrate a real first lock (not late join on already-scored season alone)
      if (!hasLockedPicksOnce(id)) return;
      try {
        if (sessionStorage.getItem(SESSION_SHOWN) === "1") return;
      } catch {
        /* ok */
      }
      // Claim banner slot so full-screen welcome doesn't stack same session
      claimSessionDrama("soft_unlock");
      try {
        sessionStorage.setItem(SESSION_SHOWN, "1");
      } catch {
        /* ok */
      }
      setOpen(true);
    }
    check();
    window.addEventListener(EVENT_FIRST_WEEK_PROGRESS, check);
    window.addEventListener("warroom-progressive-disclosure", check);
    return () => {
      window.removeEventListener(EVENT_FIRST_WEEK_PROGRESS, check);
      window.removeEventListener("warroom-progressive-disclosure", check);
    };
  }, []);

  if (!open) return null;

  function dismiss() {
    const id = getSession()?.playerId;
    if (id) markSeen(id);
    clearSessionDrama("soft_unlock");
    // Don't also fire LoginWelcome in the same session as SoftUnlock
    try {
      sessionStorage.setItem("warroom-no-welcome-this-session", "1");
    } catch {
      /* ok */
    }
    setOpen(false);
  }

  return (
    <div
      className="mb-4 rounded-2xl border-2 border-primary/45 bg-primary/10 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
      role="status"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
          Look at you · room unlocked
        </p>
        <p className="text-sm text-foreground font-semibold leading-snug">
          You locked a card. Congrats — we&apos;re legally allowed to show you
          more buttons now.
        </p>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          The Board just appeared in the nav. Home gets louder (takes, crowns,
          chaos). Gazette still drops when the commish scores — that&apos;s the
          Sunday/Monday paper the room actually waits for.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link
          href="/board"
          onClick={dismiss}
          className="px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold inline-flex items-center"
        >
          Peek the Board
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground"
        >
          I&apos;m cool · dismiss
        </button>
      </div>
    </div>
  );
}
