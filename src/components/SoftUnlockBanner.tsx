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
import { isGuestMode } from "@/lib/guest-mode";

const KEY = "warroom-soft-unlock-seen-v1";

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
    if (isGuestMode()) return;
    function check() {
      const id = getSession()?.playerId;
      if (!id) return;
      if (!isCoreLoopUnlocked(id)) return;
      if (readSeen(id)) return;
      // Only celebrate a real first lock (not late join on already-scored season alone)
      if (!hasLockedPicksOnce(id)) return;
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
    setOpen(false);
  }

  return (
    <div
      className="mb-4 rounded-2xl border-2 border-primary/45 bg-primary/10 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
      role="status"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
          Room unlocked
        </p>
        <p className="text-sm text-foreground font-semibold leading-snug">
          You locked a card — more of the room just opened.
        </p>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          The Board is in the main nav now. Home will get louder (checklist,
          takes, crowns). The Gazette paper still pops when the host scores —
          that&apos;s the weekly appointment.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link
          href="/board"
          onClick={dismiss}
          className="px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold inline-flex items-center"
        >
          Open Board
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
