"use client";

/**
 * Foundry hub: mark current room as LAB or production.
 * Simulations refuse unmarked / production leagues (hard stop).
 */

import { useCallback, useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import {
  FOUNDRY_LAB_BLOCK_REASON,
  isExplicitLabLeague,
  isLeagueIdMarkedFoundryLab,
  markLeagueAsFoundryLab,
  unmarkLeagueAsFoundryLab,
} from "@/lib/foundry-isolation";
import { isFoundryQuarantined } from "@/lib/foundry-quarantine";

export default function FoundryLabIsolationPanel() {
  const [lab, setLab] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const lg = getLeague();
    setId(lg?.id || null);
    setName(lg?.name || null);
    setLab(isExplicitLabLeague(lg));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("warroom-foundry-lab-leagues", refresh);
    window.addEventListener("warroom-league", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("warroom-foundry-lab-leagues", refresh);
      window.removeEventListener("warroom-league", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const emergency = isFoundryQuarantined();
  const deviceMark = id ? isLeagueIdMarkedFoundryLab(id) : false;

  return (
    <div
      className={`rounded-2xl border-2 px-4 py-3 space-y-2 ${
        lab
          ? "border-amber-400/50 bg-amber-950/40"
          : "border-danger/50 bg-danger/10"
      }`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-[0.18em] ${
          lab ? "text-amber-300" : "text-danger"
        }`}
      >
        {lab ? "LAB · isolation armed" : "PRODUCTION · simulations blocked"}
      </p>
      <p className="text-xs text-foreground leading-relaxed">
        Foundry may only mutate rooms marked as LAB. Calendar “preseason”
        alone is not enough. Production leagues and real career engraving stay
        hard-blocked.
      </p>
      {emergency && (
        <p className="text-xs text-danger font-semibold leading-relaxed">
          Emergency quarantine env is ON — all Foundry mutations disabled
          regardless of LAB mark.
        </p>
      )}
      <p className="text-xs text-muted">
        Active room:{" "}
        <span className="text-foreground font-semibold">
          {name || "none"} {id ? `(${id.slice(0, 8)}…)` : ""}
        </span>
        {deviceMark ? " · device LAB mark" : ""}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={!id || lab}
          onClick={async () => {
            if (!id) return;
            const proof = window.prompt(
              `Mark “${name || "this room"}” as disposable LAB data?\n\nType LAB to allow simulations that write cards, picks, results, standings, bots, and Dispatch history.`
            );
            if (proof !== "LAB") {
              setNote("LAB mark cancelled. Type LAB exactly to arm simulations.");
              return;
            }
            const result = await markLeagueAsFoundryLab(id);
            if (!result.ok) {
              setNote(`LAB mark failed: ${result.error || "database rejected it"}`);
              return;
            }
            refresh();
            setNote(
              "Room marked LAB. Demo slate, randomize & score, bots, and drama prep may run here only."
            );
          }}
          className="min-h-[44px] px-3 rounded-xl bg-amber-400 text-black text-xs font-extrabold disabled:opacity-40 touch-manipulation"
        >
          Mark this room LAB
        </button>
        <button
          type="button"
          disabled={!id || !lab}
          onClick={async () => {
            if (!id) return;
            const result = await unmarkLeagueAsFoundryLab(id);
            if (!result.ok) {
              setNote(`Unmark failed: ${result.error || "database rejected it"}`);
              return;
            }
            refresh();
            setNote(
              "LAB mark removed. Simulations hard-blocked on this room."
            );
          }}
          className="min-h-[44px] px-3 rounded-xl border border-border text-xs font-bold text-muted disabled:opacity-40 touch-manipulation"
        >
          Unmark (production)
        </button>
      </div>
      {!lab && (
        <p className="text-[11px] text-danger/90 leading-relaxed">
          {FOUNDRY_LAB_BLOCK_REASON}
        </p>
      )}
      {note && (
        <p className="text-[11px] text-primary font-medium leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
}
