"use client";

/**
 * Home spotlight for the weekly paper ritual.
 * - Unread: big red "paper is out" — the appointment people look forward to
 * - Waiting on scores (card frozen): tease Sunday/Monday drop
 * - Otherwise: quiet link to archive
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_GAZETTE_SEEN,
  gazetteAnticipationCopy,
  getGazetteUnreadState,
  ritualEditionName,
} from "@/lib/gazette";
import {
  loadWeekCard,
  loadLeagueActiveWeek,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { isCardLockDeadlinePassed } from "@/lib/dates";
import { getLeague } from "@/lib/league";

type Mode =
  | { kind: "unread"; ritualName: string; weekLabel: string | null }
  | { kind: "waiting"; ritualHint: string; title: string; body: string }
  | { kind: "quiet" }
  | { kind: "loading" };

export default function HomeGazetteSpotlight() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  useEffect(() => {
        let cancelled = false;

    async function load() {
      try {
        const unread = await getGazetteUnreadState();
        if (cancelled) return;
        if (unread.unread && unread.ritualName) {
          setMode({
            kind: "unread",
            ritualName: unread.ritualName,
            weekLabel: unread.weekLabel,
          });
          return;
        }

        // Tease while card is frozen and this week isn't scored yet
        const week = await loadLeagueActiveWeek();
        const [card, scored] = await Promise.all([
          loadWeekCard(week),
          listScoredWeekNumbers(),
        ]);
        if (cancelled) return;
        const games = card?.games || [];
        const frozen =
          games.length > 0 && isCardLockDeadlinePassed(games, Date.now());
        const thisWeekScored = scored.includes(week);
        if (frozen && !thisWeekScored) {
          const tease = gazetteAnticipationCopy();
          setMode({
            kind: "waiting",
            ritualHint: tease.ritualHint,
            title: tease.title,
            body: tease.body,
          });
          return;
        }

        setMode({ kind: "quiet" });
      } catch {
        if (!cancelled) setMode({ kind: "quiet" });
      }
    }

    void load();
    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    function onSeen() {
      void load();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_GAZETTE_SEEN, onSeen);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_GAZETTE_SEEN, onSeen);
    };
  }, []);

  if (mode.kind === "loading" || mode.kind === "quiet") return null;

  if (mode.kind === "unread") {
    const wwc = getLeague()?.sportId === "soccer_wwc";
    if (wwc) {
      return (
        <section className="mb-5 rounded-2xl border-2 border-[#FFDF00]/50 bg-gradient-to-br from-[#002776]/90 via-black/80 to-[#009C3B]/40 overflow-hidden shadow-[0_0_40px_rgba(0,156,59,0.25)]">
          <div
            className="px-4 py-1.5 flex items-center justify-between gap-2 text-white"
            style={{
              background:
                "linear-gradient(90deg, #009C3B 0%, #002776 50%, #009C3B 100%)",
            }}
          >
            <span
              className="text-[12px] font-black uppercase tracking-[0.28em]"
              style={{ color: "#FFDF00" }}
            >
              EXTRA!
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide">
              World Cup paper is out
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
              style={{ color: "#FFDF00" }}
            >
              WORLD CUP EDITION
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {mode.ritualName}
              {mode.weekLabel ? (
                <span className="text-white/70 font-bold text-base sm:text-lg">
                  {" "}
                  · {mode.weekLabel}
                </span>
              ) : null}
            </h2>
            <p className="text-sm text-stone-200 mt-2 leading-relaxed">
              Survivors. Collapses. Chaos in the group. ESPN energy, War Room
              sass — Brazil 2027 on the masthead.
            </p>
            <Link
              href="/gazette"
              className="mt-4 flex items-center justify-center w-full py-3.5 min-h-[52px] rounded-xl text-base font-extrabold touch-manipulation active:scale-[0.99] shadow-lg text-white"
              style={{ backgroundColor: "#009C3B" }}
            >
              Read WORLD CUP EDITION →
            </Link>
          </div>
        </section>
      );
    }
    return (
      <section className="mb-5 rounded-2xl border-2 border-red-600/70 bg-gradient-to-br from-red-950/80 via-black/70 to-stone-900 overflow-hidden shadow-[0_0_40px_rgba(185,28,28,0.25)]">
        <div className="bg-red-700 text-[#f4f0e6] px-4 py-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.22em]">
            Extra · Extra
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide">
            Paper is out
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300/90 mb-1">
            The weekly appointment
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {mode.ritualName}
            {mode.weekLabel ? (
              <span className="text-white/70 font-bold text-base sm:text-lg">
                {" "}
                · {mode.weekLabel}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-stone-300 mt-2 leading-relaxed">
            Crowns, shame, movers, fake news, milk cartons — the whole roast is
            filed. This is what the room opens for on Sunday and Monday.
          </p>
          <Link
            href="/gazette"
            className="mt-4 flex items-center justify-center w-full py-3.5 min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-base font-extrabold touch-manipulation active:scale-[0.99] shadow-lg"
          >
            Read the paper →
          </Link>
        </div>
      </section>
    );
  }

  // waiting
  return (
    <section className="mb-5 rounded-2xl border border-stone-500/40 bg-stone-950/60 px-4 py-4">
      <div className="flex items-start gap-3">
        <div
          className="text-3xl shrink-0"
          aria-hidden
        >
          📰
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/90">
            Coming soon · {mode.ritualHint || ritualEditionName()}
          </p>
          <h2 className="text-base font-bold text-foreground mt-0.5">
            {mode.title}
          </h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">{mode.body}</p>
          <Link
            href="/gazette"
            className="inline-flex mt-2 text-xs font-semibold text-primary min-h-[40px] items-center"
          >
            Past editions →
          </Link>
        </div>
      </div>
    </section>
  );
}
