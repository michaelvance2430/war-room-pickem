"use client";

/**
 * Commissioner banner: someone left — open the room to recruit replacements?
 */

import { useCallback, useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import {
  dismissOpenRoomNudge,
  loadOpenRoomNudge,
  type OpenRoomNudge,
} from "@/lib/open-room-nudge";
import { setLeagueOpenListing } from "@/lib/open-room";

export default function OpenRoomLeaveNudge() {
  const [nudge, setNudge] = useState<OpenRoomNudge | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = getSession();
    const league = getLeague();
    if (!session?.isCommissioner || !league?.id) {
      setNudge(null);
      return;
    }
    const n = await loadOpenRoomNudge(league.id);
    setNudge(n);
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (!nudge) return null;

  async function onOpenYes() {
    const league = getLeague();
    if (!league?.id) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await setLeagueOpenListing(league.id, true);
      if (!res.ok) {
        setStatus(res.error || "Could not open listing");
        setBusy(false);
        return;
      }
      await dismissOpenRoomNudge(league.id);
      setNudge(null);
      setStatus(null);
      // Keep league local flag in sync if present
      try {
        const raw = localStorage.getItem("warroom-league");
        if (raw) {
          const lg = JSON.parse(raw) as Record<string, unknown>;
          lg.isOpen = true;
          localStorage.setItem("warroom-league", JSON.stringify(lg));
        }
      } catch {
        /* ignore */
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  async function onNo() {
    if (!nudge) return;
    setBusy(true);
    await dismissOpenRoomNudge(nudge.leagueId);
    setNudge(null);
    setBusy(false);
  }

  return (
    <div
      className="mx-4 mt-3 sm:mx-auto sm:max-w-3xl rounded-xl border-2 border-primary/50 bg-primary/10 p-4 shadow-lg"
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-1">
        Seat opened
      </p>
      <h2 className="text-sm font-bold text-foreground mb-1">
        {nudge.leftName} left the room
      </h2>
      <p className="text-xs text-muted leading-relaxed mb-3">
        Want to set the league to{" "}
        <strong className="text-foreground">open</strong> so new players can
        find you? Late joiners start at{" "}
        <strong className="text-foreground">0 season points</strong> (no
        catch-up) but can still earn cheevos and trophies going forward — empty
        seats only, nobody loses standings.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onOpenYes()}
          className="flex-1 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Working…" : "Yes — open the room"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onNo()}
          className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
        >
          Not now
        </button>
      </div>
      {status && (
        <p className="text-xs text-danger mt-2 leading-relaxed">{status}</p>
      )}
    </div>
  );
}
