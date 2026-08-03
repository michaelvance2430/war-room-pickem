"use client";

/**
 * War Room onboarding host — conversation engine UI.
 * System speaks → user acts → celebrate → next.
 * Does NOT implement Through Their Eyes (QA tool stays separate).
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
} from "@/lib/onboarding";
import { maybeStartOnboarding } from "@/lib/onboarding/start";
import { prepareNavigation } from "@/lib/smooth";

function PracticeBanner() {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-200">
        Practice mode · Training league · Not live
      </p>
      <p className="text-[11px] text-amber-100/80 mt-0.5">
        No real picks · Can&apos;t break your league
      </p>
    </div>
  );
}

function ConversationCard({
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
  const isFullscreen = step.layout === "fullscreen" || isPeak;

  if (isPeak && c.celebrateCopy) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          aria-label="Close"
          onClick={onDismissCelebrate}
        />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-[0_0_60px_rgba(34,197,94,0.12)] p-5 sm:p-6 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {c.kicker || "Nice"}
          </p>
          <div className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-line">
            {c.celebrateCopy}
          </div>
          {c.explainAfter && (
            <p className="text-xs text-muted leading-relaxed">{c.explainAfter}</p>
          )}
          <button
            type="button"
            onClick={onDismissCelebrate}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-sm"
          >
            {c.nextHint ? `Continue · ${c.nextHint}` : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  if (isFullscreen && phase === "speak") {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 bg-black/88 backdrop-blur-sm" />
        <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/45 bg-card shadow-2xl p-5 sm:p-6 space-y-4">
          {c.practiceBanner && <PracticeBanner />}
          {c.kicker && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {c.kicker}
            </p>
          )}
          <h2 className="text-xl sm:text-2xl font-black text-foreground leading-snug">
            {c.title}
          </h2>
          <p className="text-sm text-foreground/90 leading-relaxed">{c.speak}</p>
          {c.whyCare && (
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {c.whyCare}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={primaryBusy}
              onClick={onPrimary}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-sm disabled:opacity-60"
            >
              {primaryBusy ? "Opening…" : step.action?.label || "Continue →"}
            </button>
            {step.secondaryAction && (
              <button
                type="button"
                onClick={onSecondary}
                className="w-full py-2.5 text-xs text-muted hover:text-foreground"
              >
                {step.secondaryAction.label}
              </button>
            )}
            <button
              type="button"
              onClick={onSkipAll}
              className="w-full py-2 text-[11px] text-muted/80 hover:text-muted"
            >
              Skip onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sticky coach
  return (
    <div
      className="fixed left-0 right-0 z-[55] px-3 sm:px-4 pointer-events-none md:bottom-4"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl border-2 border-primary bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.45)] overflow-hidden mb-2 sm:mb-0">
        {c.practiceBanner && (
          <div className="px-3 pt-2.5">
            <PracticeBanner />
          </div>
        )}
        <div className="px-3 pt-2.5 pb-1.5 sm:px-4 sm:pt-3 sm:pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {c.kicker && (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-0.5">
                {c.kicker}
              </p>
            )}
            <p className="text-sm font-bold text-foreground leading-snug">
              {c.title}
            </p>
            <p className="text-[11px] sm:text-xs text-muted mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
              {c.speak}
            </p>
            {c.whyCare && (
              <p className="text-[11px] text-foreground/80 mt-1 leading-snug">
                {c.whyCare}
              </p>
            )}
            {phase === "awaiting" && c.nextHint && (
              <p className="text-[11px] text-primary font-semibold mt-1.5">
                → {c.nextHint}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSkipAll}
            className="text-[11px] text-muted hover:text-foreground shrink-0 px-1"
          >
            Skip
          </button>
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {step.action && (
            <button
              type="button"
              disabled={primaryBusy}
              onClick={onPrimary}
              className="flex-1 min-w-[8rem] text-center py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-60"
            >
              {primaryBusy ? "…" : step.action.label}
            </button>
          )}
          {phase === "awaiting" &&
            (step.successCondition.type === "manual" ||
              step.secondaryAction) && (
              <button
                type="button"
                onClick={onContinue}
                className="px-4 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-semibold"
              >
                {step.secondaryAction?.label || "Continue →"}
              </button>
            )}
          {phase === "speak" && step.secondaryAction && !step.action && (
            <button
              type="button"
              onClick={onSecondary}
              className="px-4 py-2.5 rounded-xl border border-border text-sm"
            >
              {step.secondaryAction.label}
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
        if (st?.successCondition.type === "event") {
          confirmStepComplete();
          sync();
        }
      }
    }
    window.addEventListener(ONBOARDING_EVENT, onOb);
    window.addEventListener("warroom-card-published", onCardPublished);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener(ONBOARDING_EVENT, onOb);
      window.removeEventListener("warroom-card-published", onCardPublished);
    };
  }, [sync]);

  // Path / session flag evaluation
  useEffect(() => {
    if (!state?.active || state.phase !== "awaiting") return;
    evaluateSuccess(pathname);
    sync();
    const id = window.setInterval(() => {
      evaluateSuccess(pathname);
      sync();
    }, 900);
    return () => window.clearInterval(id);
  }, [pathname, state?.active, state?.phase, state?.stepId, sync]);

  async function resolveHref(step: OnboardingStep): Promise<string | null> {
    const a = step.action;
    if (!a) return null;
    if (a.href) return a.href;
    if (a.resolveHref === "tutorialPicks") {
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
      const advances = step.action?.advancesOnClick !== false;

      if (step.layout === "fullscreen" && phaseIsSpeak()) {
        // Fullscreen: primary = accept speak + maybe nav
        if (href) {
          acknowledgeSpeak();
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
        // Pathname success will advance when they land
        if (
          step.successCondition.type === "always" ||
          (step.successCondition.type === "manual" && advances)
        ) {
          /* wait */
        }
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

  function phaseIsSpeak() {
    return readOnboardingState().phase === "speak";
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

  return (
    <ConversationCard
      step={step}
      phase={state.phase}
      onPrimary={() => void onPrimary()}
      onSecondary={onSecondary}
      onContinue={onContinue}
      onSkipAll={onSkipAll}
      onDismissCelebrate={onDismissCelebrate}
      primaryBusy={busy}
    />
  );
}

/** Account: replay a journey */
export function replayOnboardingJourney(
  id: "player" | "commissioner"
) {
  void import("@/lib/onboarding").then((m) => {
    m.resetJourney(id);
    m.startJourney(id, { userId: getSession()?.playerId, force: true });
  });
}
