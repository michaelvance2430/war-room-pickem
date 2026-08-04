"use client";

/**
 * Foundry-only hop bar toggle.
 * Never mounted on the customer Host Dashboard.
 * Constitution: customers should never know Foundry exists.
 */

import { useEffect, useState } from "react";
import { getLeague, getSession, isOps } from "@/lib/league";
import { isSandboxMode } from "@/lib/season-mode";
import { isAppCreator } from "@/lib/creator";
import {
  EVENT_SANDBOX_HOST_HOP,
  isSandboxHostHopActive,
  setSandboxHostHopActive,
} from "@/lib/sandbox-host-hop";
import { getSeasonOpenLabel } from "@/lib/season-countdown";

export default function SandboxHopOptIn() {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);
  const [label, setLabel] = useState("doors open");

  useEffect(() => {
    function refresh() {
            const uid = getSession()?.playerId;
      // Hard creator gate — never for normal hosts
      if (!uid || !isAppCreator(uid) || !isOps() || !isSandboxMode()) {
        setShow(false);
        return;
      }
      const lid = getLeague()?.id || getSession()?.leagueId;
      if (!lid) {
        setShow(false);
        return;
      }
      setShow(true);
      setOn(isSandboxHostHopActive(lid));
      try {
        setLabel(getSeasonOpenLabel(getLeague()?.sportId));
      } catch {
        setLabel("doors open");
      }
    }
    refresh();
    window.addEventListener(EVENT_SANDBOX_HOST_HOP, refresh);
    window.addEventListener("warroom-league-switched", refresh);
    return () => {
      window.removeEventListener(EVENT_SANDBOX_HOST_HOP, refresh);
      window.removeEventListener("warroom-league-switched", refresh);
    };
  }, []);

  if (!show) return null;

  const lid = getLeague()?.id || getSession()?.leagueId;

  return (
    <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
        Foundry · creator only
      </p>
      <p className="text-sm font-bold text-foreground">Route hop bar</p>
      <p className="text-xs text-muted leading-relaxed">
        Sticky Home · Picks · Board · Gazette · League jumps until {label}.{" "}
        <strong className="text-foreground">Off by default</strong> — customers
        never see this control or the bar.
      </p>
      <button
        type="button"
        onClick={() => {
          const next = !on;
          setSandboxHostHopActive(next, lid);
          setOn(next);
        }}
        className={`w-full min-h-[48px] rounded-xl text-sm font-extrabold touch-manipulation border ${
          on
            ? "bg-amber-400 text-black border-amber-300"
            : "bg-black/30 text-amber-100 border-amber-400/40 hover:border-amber-400/70"
        }`}
      >
        {on ? "Hop bar ON · tap to turn off" : "Turn hop bar on for this room"}
      </button>
      {on && (
        <p className="text-[10px] text-amber-200/75 leading-snug">
          Use <strong>Close bar</strong> / <strong>Wipe board</strong> on the
          hop bar to exit. Switching leagues always clears it.
        </p>
      )}
    </div>
  );
}
