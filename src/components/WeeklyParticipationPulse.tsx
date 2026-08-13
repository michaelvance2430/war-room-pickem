"use client";

import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/types";
import {
  countLockedPicksForWeek,
  loadPickSubmissionStatus,
  type PickSubmissionStatus,
} from "@/lib/cloud";
import { firstKickoffOnCardMs, formatCardLockDeadline } from "@/lib/dates";
import { getLeague, isOps } from "@/lib/league";

type Props = {
  weekNumber: number;
  games: Game[];
};

export default function WeeklyParticipationPulse({ weekNumber, games }: Props) {
  const [pulse, setPulse] = useState<{ locked: number; expected: number } | null>(null);
  const [rows, setRows] = useState<PickSubmissionStatus[] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const ops = isOps();
  const lockPassed = firstKickoffOnCardMs(games) <= Date.now();

  useEffect(() => {
    let cancelled = false;
    void countLockedPicksForWeek(weekNumber).then((next) => {
      if (!cancelled) setPulse(next);
    });
    if (ops) {
      void loadPickSubmissionStatus(weekNumber, games.length).then((result) => {
        if (!cancelled) setRows(result.ok ? result.rows : null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [games.length, ops, weekNumber]);

  const incomplete = useMemo(
    () => (rows || []).filter((row) => !row.complete),
    [rows]
  );

  async function remindHoldouts() {
    if (!incomplete.length) return;
    const leagueName = getLeague()?.name || "our War Room";
    const names = incomplete.map((row) => row.name).join(", ");
    const deadline = formatCardLockDeadline(games);
    const url = `${window.location.origin}/picks`;
    const text = `${names} — your Week ${weekNumber} card in ${leagueName} still needs to be locked${deadline ? ` by ${deadline}` : " before first kickoff"}. ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${leagueName} pick reminder`, text });
        setShareNote("Reminder ready to send.");
      } else {
        await navigator.clipboard.writeText(text);
        setShareNote("Reminder copied.");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        setShareNote("Could not open sharing. Try again.");
      }
    }
  }

  if (!pulse || pulse.expected <= 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-border bg-card/80 px-3.5 py-3" aria-label="League pick participation">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            League pulse
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {pulse.locked} of {pulse.expected} locked
          </p>
        </div>
        <span className={`text-[10px] font-extrabold uppercase tracking-wide rounded-full border px-2 py-1 ${
          pulse.locked >= pulse.expected
            ? "border-primary/40 bg-primary/10 text-primary"
            : lockPassed
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-border text-muted"
        }`}>
          {pulse.locked >= pulse.expected ? "All in" : lockPassed ? "Closed" : "Open"}
        </span>
      </div>

      {ops && rows && incomplete.length > 0 && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-2 text-left min-h-[40px]"
            aria-expanded={detailsOpen}
          >
            <span className="text-xs font-bold text-warning">
              {incomplete.length} still need to lock
            </span>
            <span className="text-muted" aria-hidden>{detailsOpen ? "▾" : "▸"}</span>
          </button>
          {detailsOpen && (
            <div className="pt-2 space-y-2">
              <ul className="space-y-1.5">
                {incomplete.map((row) => (
                  <li key={row.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-foreground truncate">{row.name}</span>
                    <span className="text-muted shrink-0">
                      {!row.submitted
                        ? "Not started"
                        : row.gamePickCount < games.length
                          ? `${row.gamePickCount}/${games.length} games`
                          : !row.hasBestBet
                            ? "Needs Best Bet"
                            : !row.hasProp
                              ? "Needs prop"
                              : "Not locked"}
                    </span>
                  </li>
                ))}
              </ul>
              {!lockPassed && (
                <button
                  type="button"
                  onClick={() => void remindHoldouts()}
                  className="w-full min-h-[44px] rounded-xl bg-primary text-black text-xs font-extrabold"
                >
                  Send pick reminder
                </button>
              )}
              {shareNote && <p className="text-[11px] text-muted">{shareNote}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
