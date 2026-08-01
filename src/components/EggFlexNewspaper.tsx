"use client";

/**
 * Ready Player One energy — egg milestone flex (7 / 10 / full clear).
 * Drops as a big newspaper for everyone in the finder's leagues.
 * No how-to spoilers — name, league, date, count only.
 */

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  loadUnseenEggFlexes,
  markEggFlexSeen,
  type EggMilestoneFlex,
} from "@/lib/egg-cloud";

function formatFlexDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function milestoneHeadline(f: EggMilestoneFlex): string {
  if (f.milestone >= f.total) {
    return `${f.finderName.toUpperCase()} CLEARED THE BOARD`;
  }
  if (f.milestone >= 10) {
    return `${f.finderName.toUpperCase()} HITS DOUBLE DIGITS`;
  }
  return `${f.finderName.toUpperCase()} IS ON THE HUNT`;
}

function milestoneDeck(f: EggMilestoneFlex): string {
  if (f.milestone >= f.total) {
    return `Every quiet mark. Full clear. The room saw it.`;
  }
  if (f.milestone >= 10) {
    return `Ten secrets found. The map is still blank. The flex is not.`;
  }
  return `Seven discoveries deep. No spoilers. Just the count.`;
}

export default function EggFlexNewspaper() {
  const [queue, setQueue] = useState<EggMilestoneFlex[]>([]);
  const current = queue[0] ?? null;

  const pull = useCallback(async () => {
    if (isGuestMode()) return;
    if (!getSession()?.playerId) return;
    // Platform-wide — every account, every sport, every league
    const unseen = await loadUnseenEggFlexes();
    if (!unseen.length) return;
    setQueue((q) => {
      const ids = new Set(q.map((x) => x.id));
      const next = unseen.filter((u) => !ids.has(u.id));
      return next.length ? [...q, ...next] : q;
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void pull(), 1200);
    function onCheck() {
      void pull();
    }
    function onFocus() {
      void pull();
    }
    window.addEventListener("warroom-egg-flex-check", onCheck);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(t);
      window.removeEventListener("warroom-egg-flex-check", onCheck);
      window.removeEventListener("focus", onFocus);
    };
  }, [pull]);

  function dismiss() {
    if (current) markEggFlexSeen(current.id);
    setQueue((q) => q.slice(1));
  }

  if (!current) return null;

  const isYou = getSession()?.playerId === current.finderUserId;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/88 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-labelledby="egg-flex-title"
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-sm border-4 border-stone-800 shadow-2xl bg-[#f4f0e6] text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Masthead strip */}
        <div className="bg-stone-900 text-[#f4f0e6] px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.28em]">
            Extra · Extra
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            World Edition · All rooms
          </span>
        </div>

        <div className="px-5 pt-5 pb-2 text-center border-b-4 border-double border-stone-900">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-800 mb-1">
            Breaking · Account-wide · Every sport
          </p>
          <p className="text-[11px] uppercase tracking-widest text-stone-600 mb-2">
            {formatFlexDate(current.createdAt)}
          </p>
          <h2
            id="egg-flex-title"
            className="font-serif text-2xl sm:text-3xl font-black tracking-tight leading-tight text-stone-950"
          >
            {milestoneHeadline(current)}
          </h2>
          <p className="text-[13px] italic text-stone-700 mt-2 leading-relaxed">
            {milestoneDeck(current)}
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="rounded border-2 border-stone-800 bg-white/70 px-4 py-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-500">
              The discoverer
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-1 text-stone-950">
              {current.finderName}
              {isYou ? (
                <span className="block text-xs font-bold text-red-800 mt-1 uppercase tracking-wide">
                  That&apos;s you
                </span>
              ) : null}
            </p>
            <p className="text-sm font-semibold text-stone-700 mt-2">
              War Room Pick&apos;Em · all leagues · all sports
            </p>
            <p className="text-[11px] text-stone-500 mt-1 font-mono">
              {formatFlexDate(current.createdAt)}
            </p>
          </div>

          <div className="text-center py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-1">
              Secrets found
            </p>
            <p className="font-serif text-5xl font-black text-stone-950 tabular-nums">
              {current.found}
              <span className="text-2xl text-stone-500 font-bold">
                {" "}
                / {current.total}
              </span>
            </p>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed max-w-sm mx-auto">
              No map. No checklist. No points on the board. Just a name in the
              paper — and a room that now knows they dig deeper.
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-[52px] rounded-sm bg-stone-900 text-[#f4f0e6] font-bold text-sm uppercase tracking-wide"
          >
            {queue.length > 1 ? "Next edition" : "Close paper"}
          </button>
        </div>
      </div>
    </div>
  );
}
