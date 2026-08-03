"use client";

/**
 * Sticky coach for real-account first login.
 * Default: My Picks only (Crystal Ball optional via Account full re-run).
 * Guest uses GuestOnboarding instead.
 *
 * Perf: no network in the poll loop — local peek + sessionStorage only.
 * Step changes update React state immediately so frames don't "freeze."
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  advancePlayerTutorialTo,
  clearTutorialHold,
  coachCopyForStep,
  completePlayerTutorial,
  ensureTutorialPicksHref,
  getPlayerTutorialState,
  goBackPlayerTutorial,
  isPlayerTutorialActive,
  isTutorialHeldOn,
  needsPlayerTutorial,
  padawanOutroLines,
  playerTutorialStepIndex,
  skipPlayerTutorial,
  startPicksOnlyTutorial,
  type PlayerTutorialStep,
} from "@/lib/player-tutorial";
import { markRulesSeen } from "@/lib/rules";
import { peekLocalCrystalBall } from "@/lib/crystal-ball";
import { hardNavPrepare } from "@/components/RouteHardSwitch";
import { getLeague } from "@/lib/league";

const FULL_ORDER: PlayerTutorialStep[] = [
  "open_crystal",
  "search_team",
  "lock_crystal",
  "open_picks",
  "fill_picks",
  "save_picks",
  "done",
];

const PICKS_ORDER: PlayerTutorialStep[] = [
  "open_picks",
  "fill_picks",
  "save_picks",
  "done",
];

function readActiveStep(): {
  active: boolean;
  step: PlayerTutorialStep;
} {
  if (isGuestMode()) return { active: false, step: "open_picks" };
  const s = getPlayerTutorialState();
  return {
    active: s.active && !s.completed && s.step !== "done",
    step: s.step,
  };
}

export default function PlayerWalkthrough() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<PlayerTutorialStep>("open_picks");
  const [picksHref, setPicksHref] = useState("/picks");
  const [padawanOutro, setPadawanOutro] = useState(false);
  const [legacyAllowed, setLegacyAllowed] = useState(false);
  const startingRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  // New onboarding engine owns first session — legacy coach only for Account re-run
  useEffect(() => {
    try {
      const { isOnboardingActive, needsJourney, hasCompletedJourney } =
        require("@/lib/onboarding") as typeof import("@/lib/onboarding");
      if (isOnboardingActive()) {
        setLegacyAllowed(false);
        return;
      }
      // If player never finished NEW journey, don't auto-start legacy
      if (needsJourney("player") && !hasCompletedJourney("player")) {
        setLegacyAllowed(false);
        return;
      }
      setLegacyAllowed(true);
    } catch {
      setLegacyAllowed(true);
    }
  }, [pathname, active]);

  /** Immediate paint from localStorage — no await. */
  const syncFromStorage = useCallback(() => {
    const { active: a, step: st } = readActiveStep();
    setActive(a);
    setStep(st);
  }, []);

  /** Advance + paint this frame (avoids frozen coach until poll). */
  const advanceAndPaint = useCallback(
    (next: PlayerTutorialStep) => {
      advancePlayerTutorialTo(next);
      const { active: a, step: st } = readActiveStep();
      setActive(a);
      setStep(st);
    },
    []
  );

  useEffect(() => {
    if (isGuestMode()) return;
    const session = getSession();
    if (!session?.playerId) return;

    async function maybeStart() {
      if (startingRef.current) return;
      if (isGuestMode()) return;
      if (!getSession()?.playerId) return;

      // New onboarding engine — do not auto-start legacy coach
      try {
        const ob = await import("@/lib/onboarding");
        if (ob.isOnboardingActive()) {
          syncFromStorage();
          return;
        }
        if (ob.needsJourney("player") && !ob.hasCompletedJourney("player")) {
          syncFromStorage();
          return;
        }
      } catch {
        /* fall through to legacy */
      }

      // Already mid-walk — just paint, no cloud
      if (isPlayerTutorialActive()) {
        syncFromStorage();
        return;
      }
      if (!needsPlayerTutorial()) {
        syncFromStorage();
        return;
      }

      // Only Account re-run starts legacy (completed new journey but re-ran old)
      if (!legacyAllowed) {
        syncFromStorage();
        return;
      }

      startingRef.current = true;
      try {
        // Always coach — trial sandbox if no live card so they can practice
        const dest = await ensureTutorialPicksHref();
        setPicksHref(dest.href);
        if (needsPlayerTutorial() && !isPlayerTutorialActive()) {
          markRulesSeen();
          startPicksOnlyTutorial(getSession()?.playerId || undefined);
        }
        syncFromStorage();
      } finally {
        startingRef.current = false;
      }
    }

    void maybeStart();
    // One delayed retry if session/card was still hydrating — not three cloud storms
    const t1 = setTimeout(() => void maybeStart(), 1200);

    function onTut() {
      // Event already wrote storage — paint + apply cheap completion hints
      try {
        const s = getPlayerTutorialState().step;
        if (
          sessionStorage.getItem("warroom-tut-cb-selected") === "1" &&
          (s === "search_team" || s === "open_crystal") &&
          !isTutorialHeldOn("search_team")
        ) {
          advanceAndPaint("lock_crystal");
          // If they already locked (local team), jump to picks coach
          const cb = peekLocalCrystalBall();
          if (cb.myTeam && !isTutorialHeldOn("open_picks")) {
            advanceAndPaint("open_picks");
          }
          return;
        }
        if (
          sessionStorage.getItem("warroom-tut-picks-filled") === "1" &&
          s === "fill_picks" &&
          !isTutorialHeldOn("fill_picks")
        ) {
          advanceAndPaint("save_picks");
          return;
        }
        if (sessionStorage.getItem("warroom-tut-picks-saved") === "1") {
          completePlayerTutorial();
          clearTutorialHold();
          sessionStorage.removeItem("warroom-tut-picks-saved");
          sessionStorage.removeItem("warroom-tut-picks-filled");
          sessionStorage.removeItem("warroom-tut-cb-selected");
        }
      } catch {
        /* ignore */
      }
      syncFromStorage();
    }
    function onStorage(e: StorageEvent) {
      if (
        e.key?.includes("warroom-rules") ||
        e.key?.includes("player-tutorial")
      ) {
        void maybeStart();
      }
    }
    function onCardPublished() {
      void maybeStart();
    }
    window.addEventListener("warroom-player-tutorial", onTut);
    window.addEventListener("storage", onStorage);
    window.addEventListener("warroom-card-published", onCardPublished);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("warroom-player-tutorial", onTut);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("warroom-card-published", onCardPublished);
    };
  }, [syncFromStorage, advanceAndPaint, legacyAllowed]);

  // Path change: cheap local advances only (no network)
  useEffect(() => {
    if (!isPlayerTutorialActive()) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname ?? null;

    const s = getPlayerTutorialState().step;
    if (isTutorialHeldOn(s)) {
      syncFromStorage();
      return;
    }

    if (pathname?.startsWith("/crystal-ball")) {
      if (s === "open_crystal") {
        advanceAndPaint("search_team");
      }
      // Local only — never block the frame on Supabase
      try {
        const cb = peekLocalCrystalBall();
        if (cb.myTeam && !isTutorialHeldOn("open_picks")) {
          const cur = getPlayerTutorialState().step;
          if (
            cur === "search_team" ||
            cur === "lock_crystal" ||
            cur === "open_crystal"
          ) {
            advanceAndPaint("open_picks");
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (pathname?.startsWith("/picks")) {
      const cur = getPlayerTutorialState().step;
      if (cur === "open_picks" && !isTutorialHeldOn("fill_picks")) {
        advanceAndPaint("fill_picks");
      }
    }

    syncFromStorage();
  }, [pathname, syncFromStorage, advanceAndPaint]);

  // Poll completion signals — sessionStorage + local peek only (no cloud)
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const s = getPlayerTutorialState().step;
      if (isTutorialHeldOn(s)) return;

      if (pathname?.startsWith("/crystal-ball")) {
        try {
          const cb = peekLocalCrystalBall();
          if (cb.myTeam) {
            const cur = getPlayerTutorialState().step;
            if (cur === "search_team" || cur === "lock_crystal") {
              advanceAndPaint("open_picks");
              return;
            }
          }
        } catch {
          /* ignore */
        }
        try {
          if (
            sessionStorage.getItem("warroom-tut-cb-selected") === "1" &&
            s === "search_team" &&
            !isTutorialHeldOn("search_team")
          ) {
            advanceAndPaint("lock_crystal");
            return;
          }
        } catch {
          /* ignore */
        }
      }
      if (pathname?.startsWith("/picks")) {
        try {
          if (
            sessionStorage.getItem("warroom-tut-picks-filled") === "1" &&
            s === "fill_picks" &&
            !isTutorialHeldOn("fill_picks")
          ) {
            advanceAndPaint("save_picks");
            return;
          }
          if (sessionStorage.getItem("warroom-tut-picks-saved") === "1") {
            completePlayerTutorial();
            try {
              sessionStorage.removeItem("warroom-tut-picks-saved");
              sessionStorage.removeItem("warroom-tut-picks-filled");
              sessionStorage.removeItem("warroom-tut-cb-selected");
              clearTutorialHold();
            } catch {
              /* ignore */
            }
            setPadawanOutro(true);
            syncFromStorage();
          }
        } catch {
          /* ignore */
        }
      }
    }, 1200);
    return () => clearInterval(id);
  }, [active, pathname, advanceAndPaint, syncFromStorage]);

  if (isGuestMode()) return null;
  if (!legacyAllowed && !padawanOutro && !active) return null;

  if (padawanOutro) {
    const lines = padawanOutroLines(getLeague()?.sportId);
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="padawan-outro-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          aria-label="Close"
          onClick={() => setPadawanOutro(false)}
        />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-[0_0_60px_rgba(34,197,94,0.15)] p-5 sm:p-6 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Training complete
          </p>
          <h2
            id="padawan-outro-title"
            className="text-xl font-black text-foreground leading-snug"
          >
            {lines.title}
          </h2>
          <p className="text-sm text-muted leading-relaxed">{lines.body}</p>
          {!lines.open && lines.days > 0 && (
            <p className="text-center text-3xl font-black tabular-nums text-primary">
              {lines.days}
              <span className="text-base font-bold text-muted ml-1">
                {lines.days === 1 ? "day" : "days"}
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setPadawanOutro(false)}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-sm"
          >
            {lines.open ? "Go win the week" : "I will be patient"}
          </button>
        </div>
      </div>
    );
  }

  if (!active) return null;

  const copy = coachCopyForStep(step);
  const stepIdx = playerTutorialStepIndex(step);
  const canGoBack = stepIdx > 0;
  const resolvedCtaHref =
    copy.ctaHref === "/picks" || copy.ctaHref?.startsWith("/picks")
      ? picksHref
      : copy.ctaHref;

  function manualNext() {
    clearTutorialHold();
    const mode = getPlayerTutorialState().mode ?? "picks";
    const order = mode === "full" ? FULL_ORDER : PICKS_ORDER;
    const i = order.indexOf(step);
    const next = order[i + 1] || "done";
    if (next === "done") {
      completePlayerTutorial();
      setPadawanOutro(true);
      syncFromStorage();
    } else {
      advanceAndPaint(next);
    }
  }

  function goBack() {
    const prev = goBackPlayerTutorial();
    if (prev) {
      try {
        if (prev === "search_team" || prev === "open_crystal") {
          sessionStorage.removeItem("warroom-tut-cb-selected");
        }
        if (prev === "fill_picks" || prev === "open_picks") {
          sessionStorage.removeItem("warroom-tut-picks-filled");
          sessionStorage.removeItem("warroom-tut-picks-saved");
        }
      } catch {
        /* ignore */
      }
      setStep(prev);
      setActive(true);
      const href = coachCopyForStep(prev).ctaHref;
      if (href) {
        hardNavPrepare();
        router.push(href);
      }
    }
  }

  return (
    <div
      className="fixed left-0 right-0 z-[55] px-3 sm:px-4 pointer-events-none md:bottom-4"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl border-2 border-primary bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.45)] overflow-hidden mb-2 sm:mb-0">
        <div className="px-3 pt-2.5 pb-1.5 sm:px-4 sm:pt-3 sm:pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-0.5">
              Walk the dog
            </p>
            <p className="text-sm font-bold text-foreground leading-snug">
              {copy.title}
            </p>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
              {copy.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              skipPlayerTutorial();
              clearTutorialHold();
              syncFromStorage();
            }}
            className="text-[11px] text-muted hover:text-foreground shrink-0 px-1"
          >
            Skip
          </button>
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-card-hover"
            >
              ← Back
            </button>
          )}
          {resolvedCtaHref && (
            <Link
              href={resolvedCtaHref}
              prefetch
              onClick={(e) => {
                hardNavPrepare();
                clearTutorialHold();
                if (step === "open_crystal") {
                  advanceAndPaint("search_team");
                }
                if (step === "open_picks") {
                  advanceAndPaint("fill_picks");
                  // Always resolve live vs trial sandbox so empty room still has a card
                  e.preventDefault();
                  void ensureTutorialPicksHref().then((d) => {
                    setPicksHref(d.href);
                    try {
                      router.push(d.href);
                    } catch {
                      window.location.href = d.href;
                    }
                  });
                }
              }}
              className="flex-1 min-w-[8rem] text-center py-2.5 rounded-xl bg-primary text-black text-sm font-bold"
            >
              {copy.ctaLabel}
            </Link>
          )}
          {copy.allowManualNext && (
            <button
              type="button"
              onClick={manualNext}
              className="px-4 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-semibold"
            >
              Done → next
            </button>
          )}
          {step === "lock_crystal" && (
            <button
              type="button"
              onClick={() => {
                clearTutorialHold();
                advanceAndPaint("open_picks");
                hardNavPrepare();
                router.push("/picks");
              }}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted"
            >
              Skip Crystal Ball →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
