"use client";

/**
 * One-time Deployment Credit explanation after a late join.
 * Never shows the awarded point number.
 */

import { useEffect, useState } from "react";
import { getSession, getLeague } from "@/lib/league";
import {
  dismissFairEntryNotice,
  peekFairEntryNotice,
} from "@/lib/fair-entry";

export default function FairEntryNotice() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    try {
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId || !league?.id) return;
      const n = peekFairEntryNotice(league.id, session.playerId);
      if (!n) return;
      setTitle(n.title);
      setBody(n.body);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!open) return null;

  function close() {
    try {
      const session = getSession();
      const league = getLeague();
      if (session?.playerId && league?.id) {
        dismissFairEntryNotice(league.id, session.playerId);
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fair-entry-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={close}
      />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-sky-400 to-amber-400" />
        <div className="px-5 pt-5 pb-3 text-center border-b border-border">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-2">
            Late-join standings
          </p>
          <h2
            id="fair-entry-title"
            className="text-xl font-black text-foreground tracking-tight"
          >
            {title}
          </h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-muted leading-relaxed text-center">
            {body}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={close}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-sm touch-manipulation"
          >
            Got it — let&apos;s play
          </button>
        </div>
      </div>
    </div>
  );
}
