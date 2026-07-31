"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import { hasSeenRules, markRulesSeen } from "@/lib/rules";

/**
 * First-login: 4 bullets + lock callout. Full Rules page stays for depth.
 * Strength = clarity. Full playbook still one tap away.
 */
export default function RulesOnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session?.playerId) return;
    if (hasSeenRules()) return;
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    markRulesSeen();
    setOpen(false);
    // Real accounts: only start coach when a card is live (nothing to walk otherwise)
    try {
      if (typeof window !== "undefined") {
        const guest = localStorage.getItem("warroom-guest-mode-v1");
        const isGuest = guest && JSON.parse(guest)?.active;
        if (!isGuest) {
          void (async () => {
            const { leagueHasLiveCard } = await import("@/lib/first-session");
            if (!(await leagueHasLiveCard())) return;
            const m = await import("@/lib/player-tutorial");
            if (m.needsPlayerTutorial()) {
              // First week: picks path only — Crystal Ball is optional
              m.startPicksOnlyTutorial(getSession()?.playerId || undefined);
            }
          })();
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const bullets = [
    {
      t: "My Picks",
      d: "Five games vs the spread, confidence 1–5 (each once), one Best Bet (2×), one prop.",
    },
    {
      t: "Lock rule",
      d: "ALL picks must be locked before the first kickoff on the card. Then the whole card freezes.",
    },
    {
      t: "Standings",
      d: "Season points rank you. That’s the board that matters every week.",
    },
    {
      t: "The room",
      d: "Sunday/Monday Gazette is the weekly paper. Badges, titles, and lore light up as you play — not on day one.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-onboarding-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close rules"
        onClick={dismiss}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            60-second briefing
          </div>
          <h2
            id="rules-onboarding-title"
            className="text-xl font-bold text-foreground"
          >
            Welcome to the War Room
          </h2>
          <p className="text-xs text-muted mt-1">
            The only stuff that matters. Then go do this week&apos;s job.
            Full rules anytime under More.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          <div className="rounded-lg border-2 border-primary/70 bg-primary/15 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-primary mb-1">
              Do this every week
            </p>
            <p className="text-sm font-bold text-foreground leading-snug">
              Home → Make my picks → Save before first kickoff. Miss it = 0 for
              the week.
            </p>
          </div>

          {bullets.map((b) => (
            <div
              key={b.t}
              className="rounded-lg border border-border bg-background/50 px-3 py-2.5"
            >
              <p className="text-sm font-semibold text-foreground">{b.t}</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{b.d}</p>
            </div>
          ))}

          {(() => {
            const lg = getLeague();
            if (
              lg?.sportId === "nfl" ||
              lg?.settings?.crystalBallEnabled === false
            ) {
              return (
                <p className="text-[11px] text-muted leading-relaxed px-0.5">
                  That&apos;s the whole weekly job. Gazette and standings wake up
                  after the host scores — not day one homework.
                </p>
              );
            }
            return (
              <p className="text-[11px] text-muted leading-relaxed px-0.5">
                Optional later: Crystal Ball (national champ flex, 0 standings
                pts) lives under More when you’re ready — not required for week
                one.
              </p>
            );
          })()}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-semibold text-sm"
          >
            Got it — take me in
          </button>
          <Link
            href="/picks"
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl border border-border text-center text-sm font-medium hover:bg-card-hover"
          >
            My Picks
          </Link>
        </div>
        <p className="px-5 pb-4 text-center text-[11px] text-muted">
          <Link href="/rules" onClick={dismiss} className="hover:text-foreground underline-offset-2 hover:underline">
            Full rules playbook
          </Link>
        </p>
      </div>
    </div>
  );
}
