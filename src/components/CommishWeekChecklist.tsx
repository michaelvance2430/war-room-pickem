"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  loadLeagueRoster,
  loadPickSubmissionStatus,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getLeague } from "@/lib/league";
import { weekTitle } from "@/lib/dates";

type ActionTab = "settings" | "card" | "picks" | "results";

type Step = {
  id: string;
  label: string;
  detail: string;
  why: string;
  done: boolean;
  actionTab?: ActionTab;
};

const TAB_HREF: Record<ActionTab, string> = {
  settings: "/commissioner?tab=settings",
  card: "/commissioner?tab=card",
  picks: "/commissioner?tab=picks",
  results: "/commissioner?tab=results",
};

/**
 * Commissioner day-one / every-week path.
 * Turns the ops firehose into 5 clear jobs without removing advanced tools.
 */
export default function CommishWeekChecklist({
  onGoTab,
}: {
  onGoTab?: (tab: ActionTab) => void;
}) {
  const [week, setWeek] = useState(1);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const w = await loadLeagueActiveWeek();
        const card = await loadWeekCard(w);
        const hasCard = !!(card?.games?.length);
        const roster = (await loadLeagueRoster()).filter((m) => !m.isBot);
        const humans = roster.length;
        const league = getLeague();
        const hasCode = !!league?.code;

        let completeLocks = 0;
        let expected = humans;
        if (hasCard) {
          const status = await loadPickSubmissionStatus(
            w,
            card!.games!.length || 5
          );
          if (status.ok) {
            completeLocks = status.rows.filter((r) => r.complete).length;
            expected = status.rows.length || humans;
          }
        }

        let scored: number[] = [];
        try {
          scored = await listScoredWeekNumbers();
        } catch {
          scored = [];
        }
        const thisWeekScored = scored.includes(w);

        const next: Step[] = [
          {
            id: "invite",
            label: "1. Invite the room",
            detail: hasCode
              ? `Share code ${league?.code} · ${humans} human${humans === 1 ? "" : "s"} joined`
              : "Copy your league code from Settings and text the crew",
            why: "No code = empty room.",
            done: humans >= 2,
            actionTab: "settings",
          },
          {
            id: "card",
            label: "2. Build & publish the card",
            detail: hasCard
              ? `${weekTitle(w)} is live (${card!.games!.length} games)`
              : `First time? Use the First card wizard (demo slate → publish)`,
            why: "No card = friends can’t pick.",
            done: hasCard,
            actionTab: "card",
          },
          {
            id: "locks",
            label: "3. Get locks in",
            detail: hasCard
              ? `${completeLocks}/${expected || humans} fully locked · milk carton the rest`
              : "Publish a card first — then chase locks on Who’s in",
            why: "No locks = empty scores and salty group chat.",
            done:
              hasCard &&
              completeLocks > 0 &&
              completeLocks >= Math.max(1, expected - 1),
            actionTab: "picks",
          },
          {
            id: "score",
            label: "4. Enter results & score",
            detail: thisWeekScored
              ? `${weekTitle(w)} is scored`
              : hasCard
                ? "After games finish: sync scores or enter results, then Score League"
                : "Need a published card before you can score",
            why: "No score = standings look broken.",
            done: thisWeekScored,
            actionTab: "results",
          },
          {
            id: "vibe",
            label: "5. Let the room cook",
            detail:
              "Gazette, Locker, standings drama — the app does the theater after you score",
            why: "This is why they stay.",
            done: thisWeekScored || completeLocks > 0,
          },
        ];

        if (!cancelled) {
          setWeek(w);
          setSteps(next);
        }
      } catch {
        if (!cancelled) setSteps([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-border/40 rounded mb-2" />
        <div className="h-3 w-full bg-border/20 rounded" />
      </div>
    );
  }

  if (!steps.length) return null;

  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-primary/10 transition"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Run this week
          </p>
          <p className="text-sm font-semibold text-foreground">
            {weekTitle(week)} · {doneCount}/{steps.length} done
            {nextStep
              ? ` · Next: ${nextStep.label.replace(/^\d+\.\s*/, "")}`
              : " · Looking good"}
          </p>
        </div>
        <span className="text-xs text-muted shrink-0">
          {collapsed ? "Show" : "Hide"}
        </span>
      </button>

      {!collapsed && (
        <ol className="px-4 pb-4 space-y-2">
          {steps.map((s) => (
            <li
              key={s.id}
              className={`rounded-lg border px-3 py-2.5 flex gap-3 items-start ${
                s.done
                  ? "border-primary/30 bg-primary/10"
                  : "border-border bg-background/60"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  s.done
                    ? "bg-primary text-black"
                    : "border border-muted text-muted"
                }`}
                aria-hidden
              >
                {s.done ? "✓" : s.id === nextStep?.id ? "→" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    s.done ? "text-primary" : "text-foreground"
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {s.detail}
                </p>
                <p className="text-[10px] text-primary/80 mt-0.5">Why: {s.why}</p>
                {!s.done && s.actionTab && (
                  <Link
                    href={TAB_HREF[s.actionTab]}
                    onClick={(e) => {
                      // Same-page tab switch when parent provided a handler
                      if (onGoTab) {
                        e.preventDefault();
                        onGoTab(s.actionTab!);
                        // Keep URL in sync so back/refresh land on the right tab
                        try {
                          window.history.replaceState(
                            null,
                            "",
                            TAB_HREF[s.actionTab!]
                          );
                        } catch {
                          /* ignore */
                        }
                        // Scroll tab content into view (mobile)
                        requestAnimationFrame(() => {
                          document
                            .getElementById("commish-tab-panel")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        });
                      }
                    }}
                    className="inline-flex items-center mt-2 min-h-[44px] px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-sm font-bold text-primary active:bg-primary/20"
                  >
                    Go there →
                  </Link>
                )}
              </div>
            </li>
          ))}
          <p className="text-[10px] text-muted pt-1 px-1">
            Advanced tools (bots, odds credits, reset, pass commissioner) stay
            under Settings → Advanced until your first scored week.
          </p>
        </ol>
      )}
    </section>
  );
}
