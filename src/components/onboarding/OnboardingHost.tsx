"use client";

/**
 * Immersive onboarding host.
 * Rule: illuminate War Room — never cover it or replace it with a course UI.
 * Coach = host beside you. App stays center stage.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  ONBOARDING_EVENT,
  acknowledgeSpeak,
  confirmStepComplete,
  evaluateSuccess,
  finishCelebration,
  getActiveStep,
  isOnboardingActive,
  readOnboardingState,
  secondarySkip,
  setPracticePicksHref,
  skipJourney,
  type OnboardingPersistedState,
  type OnboardingStep,
  type PointAtTarget,
} from "@/lib/onboarding";
import { maybeStartOnboarding } from "@/lib/onboarding/start";
import { prepareNavigation } from "@/lib/smooth";

/**
 * Slim coach strip only when global PracticeModeChrome is not already up.
 * Same Practice Mode identity (amber) — never a second sky “mode” language.
 */
function PracticeStrip() {
  const [chromeOwns, setChromeOwns] = useState(false);

  useEffect(() => {
    function sync() {
      try {
        // Dynamic import path avoided — mirror bored-practice keys cheaply
        const active =
          localStorage.getItem("warroom-bored-practice-active-v1") != null;
        const sp = new URLSearchParams(window.location.search);
        const url =
          sp.get("practice") === "1" || sp.get("week") === "99";
        setChromeOwns(active || url);
      } catch {
        setChromeOwns(false);
      }
    }
    sync();
    window.addEventListener("warroom-practice-mode", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("warroom-practice-mode", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  // Global PracticeModeChrome already shows identity + Return to Live League
  if (chromeOwns) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[56] pointer-events-none">
      <div
        className="mx-auto max-w-lg px-3 pt-[max(0.35rem,env(safe-area-inset-top))]"
      >
        <div className="pointer-events-none rounded-b-lg border border-t-0 border-amber-400/45 bg-amber-950/90 backdrop-blur-md px-3 py-1.5 flex items-center justify-between gap-2 shadow-lg">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
            Practice Mode
          </p>
          <p className="text-[10px] text-amber-100/80 truncate">
            Nothing here affects your real league · Follow the guide
          </p>
        </div>
      </div>
    </div>
  );
}

/** Point at bottom nav — player drives, coach only guides attention */
function NavPointer({
  target,
  startHere,
}: {
  target: PointAtTarget;
  startHere?: boolean;
}) {
  if (!target) return null;
  const labels: Record<string, string> = {
    home: "Home",
    picks: "My Picks",
    standings: "Standings",
    locker: "Locker",
    commissioner: "League",
  };
  const label = labels[target] || target;
  return (
    <div
      className="fixed inset-x-0 z-[54] flex justify-center pointer-events-none md:hidden"
      style={{
        bottom: "calc(3.25rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-hidden
    >
      <div className="flex flex-col items-center animate-bounce">
        <span className="text-[10px] font-extrabold text-black bg-primary border border-primary rounded-full px-2.5 py-1 shadow-lg mb-0.5">
          {startHere ? `Start here · ${label}` : `Tap ${label}`}
        </span>
        <span className="text-primary text-lg leading-none">↓</span>
      </div>
    </div>
  );
}

function primaryLabel(step: OnboardingStep, busy?: boolean): string {
  if (busy) return "…";
  const raw = step.action?.label || "Continue →";
  if (step.conversation.startHere && !/^start here/i.test(raw)) {
    return `Start here · ${raw}`;
  }
  return raw;
}

function CoachStrip({
  step,
  phase,
  onPrimary,
  onSecondary,
  onContinue,
  onSkipAll,
  onDismissCelebrate,
  primaryBusy,
}: {
  step: OnboardingStep;
  phase: OnboardingPersistedState["phase"];
  onPrimary: () => void;
  onSecondary?: () => void;
  onContinue: () => void;
  onSkipAll: () => void;
  onDismissCelebrate: () => void;
  primaryBusy?: boolean;
}) {
  const c = step.conversation;
  const isPeak = phase === "celebrate" && c.celebrate === "peak";
  const isMicro = phase === "celebrate" && c.celebrate === "micro";
  const isFullscreenSpeak =
    step.layout === "fullscreen" && phase === "speak";

  // Peak only — full attention, rare
  if (isPeak && c.celebrateCopy) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          aria-label="Continue"
          onClick={onDismissCelebrate}
        />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card p-5 sm:p-6 space-y-3 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {c.kicker || "Nice"}
          </p>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {c.celebrateCopy}
          </div>
          <button
            type="button"
            onClick={onDismissCelebrate}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm"
          >
            {c.nextHint ? `Nice · ${c.nextHint} →` : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // Micro recognition — slim, does not cover the app
  if (isMicro) {
    return (
      <div
        className="fixed left-0 right-0 z-[55] px-3 pointer-events-none"
        style={{
          bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="max-w-lg mx-auto pointer-events-auto rounded-xl border border-primary/50 bg-card/95 backdrop-blur-md px-3 py-2.5 shadow-xl">
          <p className="text-sm font-semibold text-foreground">
            {c.celebrateCopy || "✓ Nice."}
          </p>
          {(c.explainAfter || c.nextHint) && (
            <p className="text-[11px] text-muted mt-0.5">
              {c.explainAfter || c.nextHint}
            </p>
          )}
        </div>
      </div>
    );
  }

  // One-time welcome only — keep short so Home is visible behind
  if (isFullscreenSpeak) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Lighter scrim so War Room still peeks through */}
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card/98 p-5 space-y-3 shadow-2xl">
          {c.kicker && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {c.kicker}
            </p>
          )}
          <h2 className="text-xl font-black text-foreground leading-snug">
            {c.title}
          </h2>
          <p className="text-sm text-foreground/90 leading-relaxed">{c.speak}</p>
          {c.whyCare && (
            <p className="text-xs text-muted leading-relaxed">{c.whyCare}</p>
          )}
          <button
            type="button"
            disabled={primaryBusy}
            onClick={onPrimary}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm disabled:opacity-60"
          >
            {primaryLabel(step, primaryBusy)}
          </button>
          {step.secondaryAction && (
            <button
              type="button"
              onClick={onSecondary}
              className="w-full py-2 text-xs text-muted hover:text-foreground"
            >
              {step.secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={onSkipAll}
            className="w-full py-1.5 text-[10px] text-muted/70"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Sticky host coach — compact, app stays hero
  return (
    <div
      className="fixed left-0 right-0 z-[55] px-3 pointer-events-none"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-xl border border-primary/60 bg-card/95 backdrop-blur-md shadow-xl overflow-hidden mb-1">
        <div className="px-3 py-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {c.startHere && (
              <span className="inline-flex mb-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-black">
                Start here
              </span>
            )}
            {c.kicker && (
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary mb-0.5">
                {c.kicker}
              </p>
            )}
            <p className="text-sm font-bold text-foreground leading-snug">
              {c.title}
            </p>
            <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-3">
              {c.speak}
            </p>
            {phase === "awaiting" && c.nextHint && (
              <p className="text-[11px] text-primary font-semibold mt-1">
                → {c.nextHint}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSkipAll}
            className="text-[10px] text-muted shrink-0 px-1"
          >
            Skip
          </button>
        </div>
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {step.action && (
            <button
              type="button"
              disabled={primaryBusy}
              onClick={onPrimary}
              className="flex-1 min-w-[7rem] py-2 rounded-lg bg-primary text-black text-xs font-extrabold disabled:opacity-60"
            >
              {primaryLabel(step, primaryBusy)}
            </button>
          )}
          {phase === "awaiting" &&
            (step.successCondition.type === "manual" ||
              step.secondaryAction) && (
              <button
                type="button"
                onClick={onContinue}
                className="px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold"
              >
                {step.secondaryAction?.label?.includes("→")
                  ? step.secondaryAction.label
                  : "Continue →"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<OnboardingPersistedState | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    const s = readOnboardingState();
    setState(s);
    setStep(getActiveStep());
  }, []);

  useEffect(() => {
    if (isGuestMode()) return;
    if (!getSession()?.playerId) return;

    let cancelled = false;
    void (async () => {
      if (!isOnboardingActive()) {
        await maybeStartOnboarding();
      }
      if (!cancelled) sync();
    })();

    const t = window.setTimeout(() => {
      void maybeStartOnboarding().then(sync);
    }, 1400);

    function onOb() {
      sync();
    }
    function onCardPublished() {
      const s = readOnboardingState();
      if (s.active && s.phase === "awaiting") {
        const st = getActiveStep();
        if (
          st?.successCondition.type === "event" &&
          (st.successCondition.name === "warroom-card-published" ||
            !st.successCondition.name)
        ) {
          confirmStepComplete();
          sync();
        }
      }
    }
    function onInviteShared() {
      const s = readOnboardingState();
      if (s.active && s.phase === "awaiting") {
        evaluateSuccess(window.location.pathname);
        sync();
      }
    }
    window.addEventListener(ONBOARDING_EVENT, onOb);
    window.addEventListener("warroom-card-published", onCardPublished);
    window.addEventListener("warroom-invite-shared", onInviteShared);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener(ONBOARDING_EVENT, onOb);
      window.removeEventListener("warroom-card-published", onCardPublished);
      window.removeEventListener("warroom-invite-shared", onInviteShared);
    };
  }, [sync]);

  // Path / flags while awaiting
  useEffect(() => {
    if (!state?.active || state.phase !== "awaiting") return;
    evaluateSuccess(pathname);
    sync();
    const id = window.setInterval(() => {
      evaluateSuccess(pathname);
      sync();
    }, 700);
    return () => window.clearInterval(id);
  }, [pathname, state?.active, state?.phase, state?.stepId, sync]);

  // Micro celebration: show recognition, then advance (never stall with no next)
  useEffect(() => {
    if (state?.phase !== "celebrate") return;
    const st = getActiveStep();
    if (!st || st.conversation.celebrate !== "micro") return;
    const t = window.setTimeout(() => {
      finishCelebration();
      sync();
    }, 1600);
    return () => window.clearTimeout(t);
  }, [state?.phase, state?.stepId, sync]);

  async function resolveHref(step: OnboardingStep): Promise<string | null> {
    const a = step.action;
    if (!a) return null;
    if (a.href) return a.href;
    if (a.resolveHref === "home") return "/";
    if (a.resolveHref === "tutorialPicks") {
      // Prefer practice so Promise #2 holds — real app UI only
      try {
        const { isBoredPracticeWindowOpen } = await import(
          "@/lib/bored-practice"
        );
        if (isBoredPracticeWindowOpen()) {
          const { startBoredPracticeWeek } = await import(
            "@/lib/bored-practice-run"
          );
          const res = await startBoredPracticeWeek();
          if (res.ok && res.picksHref) {
            setPracticePicksHref(res.picksHref);
            return res.picksHref;
          }
        }
      } catch {
        /* fall through */
      }
      try {
        const { ensureTutorialPicksHref } = await import(
          "@/lib/player-tutorial"
        );
        const d = await ensureTutorialPicksHref();
        setPracticePicksHref(d.href);
        return d.href;
      } catch {
        return "/picks";
      }
    }
    if (a.resolveHref === "commissionerCard") {
      return "/commissioner?tab=card&first=1";
    }
    if (a.resolveHref === "commissionerResults") {
      return "/commissioner?tab=results";
    }
    return null;
  }

  async function onPrimary() {
    if (!step) return;
    setBusy(true);
    try {
      prepareNavigation("onboarding.primary");
      const href = await resolveHref(step);

      if (step.layout === "fullscreen" && readOnboardingState().phase === "speak") {
        if (href) {
          // Land inside the product once — never double-advance (always already leaves step)
          if (step.successCondition.type === "always") {
            confirmStepComplete();
          } else {
            acknowledgeSpeak();
          }
          try {
            router.push(href);
          } catch {
            window.location.href = href;
          }
        } else {
          confirmStepComplete();
        }
        sync();
        return;
      }

      if (href) {
        acknowledgeSpeak();
        try {
          router.push(href);
        } catch {
          window.location.href = href;
        }
        // If already on target path, force evaluate
        window.setTimeout(() => {
          evaluateSuccess(window.location.pathname);
          sync();
        }, 100);
        sync();
        return;
      }

      if (step.successCondition.type === "manual") {
        acknowledgeSpeak();
        sync();
        return;
      }

      confirmStepComplete();
      sync();
    } finally {
      setBusy(false);
    }
  }

  function onSecondary() {
    secondarySkip();
    sync();
  }

  function onContinue() {
    confirmStepComplete();
    sync();
  }

  function onSkipAll() {
    skipJourney();
    sync();
  }

  function onDismissCelebrate() {
    finishCelebration();
    sync();
  }

  if (isGuestMode()) return null;
  if (!state?.active || !step) return null;
  if (state.phase === "idle" || state.phase === "complete") return null;

  const showPracticeStrip =
    !!step.conversation.practiceBanner && state.phase !== "celebrate";
  const pointAt =
    state.phase === "speak" || state.phase === "awaiting"
      ? step.conversation.pointAt
      : null;

  return (
    <>
      {showPracticeStrip && <PracticeStrip />}
      {pointAt && state.phase === "awaiting" && (
        <NavPointer
          target={pointAt}
          startHere={!!step.conversation.startHere}
        />
      )}
      {pointAt &&
        state.phase === "speak" &&
        step.action?.resolveHref === "tutorialPicks" && (
          <NavPointer
            target={pointAt}
            startHere={!!step.conversation.startHere}
          />
        )}
      {pointAt &&
        state.phase === "speak" &&
        (step.action?.href === "/standings" ||
          step.action?.href === "/locker-room" ||
          step.action?.resolveHref === "commissionerCard") && (
          <NavPointer
            target={pointAt}
            startHere={!!step.conversation.startHere}
          />
        )}
      <CoachStrip
        step={step}
        phase={state.phase}
        onPrimary={() => void onPrimary()}
        onSecondary={onSecondary}
        onContinue={onContinue}
        onSkipAll={onSkipAll}
        onDismissCelebrate={onDismissCelebrate}
        primaryBusy={busy}
      />
    </>
  );
}

export function replayOnboardingJourney(id: "player" | "commissioner") {
  void import("@/lib/onboarding").then((m) => {
    m.resetJourney(id);
    m.startJourney(id, { userId: getSession()?.playerId, force: true });
  });
}
