"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  loadMyPicks,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getSession } from "@/lib/league";
import { loadMyProfile } from "@/lib/profile";
import {
  formatCardLockDeadline,
  isCardLockDeadlinePassed,
  weekTitle,
} from "@/lib/dates";
import { loadCrystalBall } from "@/lib/crystal-ball";
import { hasEngagement } from "@/lib/engagement";

type Step = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  href?: string;
  hrefLabel?: string;
};

/**
 * Every player’s “Run this week” spine — not Commish-only.
 * Same energy as Commish checklist: clear jobs, flavor after.
 */
export default function PlayerWeekChecklist() {
  const [week, setWeek] = useState(1);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const session = getSession();
        if (!session?.playerId) {
          if (!cancelled) setSteps([]);
          return;
        }

        const w = await loadLeagueActiveWeek();
        const card = await loadWeekCard(w);
        const games = card?.games || [];
        const hasCard = games.length > 0;
        const frozen =
          hasCard && isCardLockDeadlinePassed(games, Date.now());
        const lockLabel = hasCard ? formatCardLockDeadline(games) : null;

        const mine = hasCard ? await loadMyPicks(w) : null;
        const locked = !!(
          mine?.lockedAt && Object.keys(mine.picks || {}).length
        );
        // Full card heuristic
        const fullLock =
          locked &&
          mine &&
          Object.keys(mine.picks).length >= (games.length || 5) &&
          !!mine.bestBetId &&
          !!mine.propChoice;

        const profile = await loadMyProfile();
        const hasPhoto = !!(profile?.avatarUrl);

        let crystalDone = false;
        let crystalTeam: string | null = null;
        let crystalLocked = false;
        let crystalLockLabel = "";
        let crystalOn = true;
        try {
          const league = (
            await import("@/lib/league")
          ).getLeague();
          crystalOn = league?.settings?.crystalBallEnabled !== false;
          if (crystalOn) {
            // Same source as Crystal Ball page (cloud + localStorage fallback)
            const cb = await loadCrystalBall();
            crystalTeam = cb.myTeam;
            crystalDone =
              !!cb.myTeam ||
              hasEngagement(session.playerId, "crystal_ball_picked");
            crystalLocked = cb.locked;
            crystalLockLabel = cb.lockLabel;
          }
        } catch {
          /* offline */
        }

        let scored: number[] = [];
        try {
          scored = await listScoredWeekNumbers();
        } catch {
          scored = [];
        }
        const anyScored = scored.length > 0;

        const next: Step[] = [
          {
            id: "photo",
            label: "1. Put a face on the franchise",
            detail: hasPhoto
              ? "Profile photo set — you’re not a grey circle"
              : "Upload a photo so people know who they’re roasting",
            done: hasPhoto,
            href: "/account",
            hrefLabel: "Account → photo",
          },
          ...(crystalOn
            ? [
                {
                  id: "crystal",
                  label: "2. Crystal Ball (national champ)",
                  detail: crystalDone
                    ? crystalLocked
                      ? `Locked in${crystalTeam ? `: ${crystalTeam}` : ""} — no more changes`
                      : `Pick is in${crystalTeam ? `: ${crystalTeam}` : ""} · green ✓ — you can still change until ${crystalLockLabel || "lock"}`
                    : `Do it early — free pride pick. Locks ${crystalLockLabel || "when Week 0 freezes"}.`,
                  done: crystalDone,
                  href: "/crystal-ball",
                  hrefLabel: crystalDone
                    ? crystalLocked
                      ? "View Crystal Ball"
                      : "Change pick (still open)"
                    : "Crystal Ball",
                } as Step,
              ]
            : []),
          {
            id: "card",
            label: crystalOn
              ? "3. Lock this week’s card"
              : "2. Lock this week’s card",
            detail: !hasCard
              ? `${weekTitle(w)} has no published games yet — wait on the commish`
              : fullLock
                ? frozen
                  ? `Locked for ${weekTitle(w)} · card frozen`
                  : `You’re locked for ${weekTitle(w)}${lockLabel ? ` · deadline was ${lockLabel}` : ""}`
                : frozen
                  ? "First kickoff hit and you never locked — 0 pts this week"
                  : `Pick all games + confidence 1–5 + Best Bet + prop before first kickoff${lockLabel ? ` (${lockLabel})` : ""}`,
            done: fullLock,
            href: "/picks",
            hrefLabel: hasCard ? "My Picks" : "My Picks (waiting)",
          },
          {
            id: "board",
            label: crystalOn
              ? "4. Check the board"
              : "3. Check the board",
            detail: anyScored
              ? "Standings are live — climb or cope"
              : "Preseason board is up — names & vibes only until week 1 scores",
            done: anyScored || locked || fullLock,
            href: "/standings",
            hrefLabel: "Standings",
          },
          {
            id: "noise",
            label: crystalOn
              ? "5. Make some noise"
              : "4. Make some noise",
            detail:
              "Locker Room for takes · Gazette after scores for crown & shame",
            done: false, // never “done” — optional habit
            href: "/locker-room",
            hrefLabel: "Locker Room",
          },
        ];

        // Mark noise done lightly if they've at least locked (engaged)
        if (fullLock || anyScored) {
          const noise = next.find((s) => s.id === "noise");
          if (noise) {
            // leave done false so it stays a nudge, or true if locked
            noise.done = false;
          }
        }

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
    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVis);
    // Refresh when returning from Crystal Ball / Picks
    window.addEventListener("focus", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-4 py-4 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-border/40 rounded mb-2" />
        <div className="h-3 w-full bg-border/20 rounded" />
      </div>
    );
  }

  if (!steps.length) return null;

  const doneCount = steps.filter((s) => s.done).length;
  // Noise is optional — count required steps for progress
  const required = steps.filter((s) => s.id !== "noise");
  const requiredDone = required.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done && s.id !== "noise") || steps.find((s) => !s.done);

  return (
    <section className="rounded-xl border border-primary/35 bg-card mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-card-hover transition"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Your week
          </p>
          <p className="text-sm font-semibold text-foreground">
            {weekTitle(week)} · {requiredDone}/{required.length} locked in
            {nextStep
              ? ` · Next: ${nextStep.label.replace(/^\d+\.\s*/, "")}`
              : " · Looking solid"}
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
                    : s.id === nextStep?.id
                      ? "border border-primary text-primary"
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
                  {s.id === "noise" && (
                    <span className="ml-1 text-[10px] text-muted font-normal">
                      (optional)
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {s.detail}
                </p>
                {s.href && (
                  <Link
                    href={s.href}
                    className={`inline-flex items-center mt-2 min-h-[44px] px-3 py-2 rounded-lg border text-sm font-bold active:opacity-90 ${
                      s.done
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-primary/40 bg-primary/10 text-primary"
                    }`}
                  >
                    {s.hrefLabel || "Go there"} →
                  </Link>
                )}
              </div>
            </li>
          ))}
          <p className="text-[10px] text-muted pt-1 px-1">
            This is for every player — same idea as the Commish checklist, but
            for locking and living in the room.
          </p>
        </ol>
      )}
    </section>
  );
}
