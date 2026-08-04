"use client";

/**
 * Foundry-only: toggle player chrome on the live room.
 * Not a commissioner product feature — workshop perspective check.
 */

import { useCallback, useEffect, useState } from "react";
import { getSession, isActuallyCommissioner } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";
import {
  isViewAsPlayer,
  setViewAsPlayer,
} from "@/lib/view-as-player";

export default function FoundryPlayerView() {
  const [allowed, setAllowed] = useState(false);
  const [on, setOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const uid = getSession()?.playerId;
    setAllowed(isAppCreator(uid));
    setOn(isViewAsPlayer());
  }, []);

  useEffect(() => {
    refresh();
    function onEvt() {
      refresh();
    }
    window.addEventListener("warroom-view-as-player", onEvt);
    return () => window.removeEventListener("warroom-view-as-player", onEvt);
  }, [refresh]);

  if (!allowed) return null;

  function enter() {
    if (!isActuallyCommissioner() && !isAppCreator(getSession()?.playerId)) {
      setNote("Need a real commissioner seat (or creator eyes) in this room.");
      return;
    }
    setViewAsPlayer(true);
    setOn(true);
    setNote("Player chrome ON — open Home. Yellow Exit bar returns you.");
    window.location.href = "/";
  }

  function exit() {
    setViewAsPlayer(false);
    setOn(false);
    setNote("Player chrome OFF — full host UI restored.");
    window.location.href = "/founder#player-view";
  }

  return (
    <section
      id="player-view"
      className="rounded-2xl border-2 border-sky-400/40 bg-card p-4 space-y-3 scroll-mt-24"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
          Foundry · perspective
        </p>
        <h2 className="text-sm font-bold text-foreground mt-0.5">
          View as player (chrome only)
        </h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Workshop tool — never on Account, Home, or Host Dashboard. Hides
          Commish/Ops UI so you can verify the friend experience without
          logging out. Server powers stay yours.
        </p>
      </div>

      {on ? (
        <div className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs">
          <p className="font-bold text-sky-100">Player chrome is ON</p>
          <p className="text-muted mt-0.5">
            Yellow Exit in the nav (or below) restores host UI.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {!on ? (
          <button
            type="button"
            onClick={enter}
            className="w-full py-3 min-h-[48px] rounded-xl border border-sky-400/50 bg-sky-500/15 text-sm font-bold text-sky-100 hover:bg-sky-500/25"
          >
            Enter player chrome →
          </button>
        ) : (
          <button
            type="button"
            onClick={exit}
            className="w-full py-3 min-h-[48px] rounded-xl bg-sky-400 text-black text-sm font-extrabold"
          >
            Exit → host UI
          </button>
        )}
        <p className="text-[11px] text-muted leading-relaxed">
          Prefer full first-hour sims? Use{" "}
          <strong className="text-foreground">Wear their eyes</strong> above —
          local cards, no league damage.
        </p>
      </div>

      {note ? (
        <p className="text-xs text-sky-200/90 leading-relaxed">{note}</p>
      ) : null}
    </section>
  );
}
