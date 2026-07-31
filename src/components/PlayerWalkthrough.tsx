"use client";

/**
 * Sticky coach for real-account first login.
 * Walks Crystal Ball → My Picks → Save. Guest uses GuestOnboarding instead.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  advancePlayerTutorialTo,
  clearTutorialHold,
  coachCopyForStep,
  completePlayerTutorial,
  getPlayerTutorialState,
  goBackPlayerTutorial,
  isPlayerTutorialActive,
  isTutorialHeldOn,
  needsPlayerTutorial,
  playerTutorialStepIndex,
  skipPlayerTutorial,
  startPlayerTutorial,
  type PlayerTutorialStep,
} from "@/lib/player-tutorial";
import { hasSeenRules } from "@/lib/rules";
import { loadCrystalBall } from "@/lib/crystal-ball";
import { leagueHasLiveCard } from "@/lib/first-session";

const ORDER: PlayerTutorialStep[] = [
  "open_crystal",
  "search_team",
  "lock_crystal",
  "open_picks",
  "fill_picks",
  "save_picks",
  "done",
];

export default function PlayerWalkthrough() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<PlayerTutorialStep>("open_crystal");

  function syncFromStorage() {
    if (isGuestMode()) {
      setActive(false);
      return;
    }
    const s = getPlayerTutorialState();
    setActive(s.active && !s.completed && s.step !== "done");
    setStep(s.step);
  }

  useEffect(() => {
    if (isGuestMode()) return;
    const session = getSession();
    if (!session?.playerId) return;

    async function maybeStart() {
      if (isGuestMode()) return;
      if (!getSession()?.playerId) return;
      if (!hasSeenRules()) return;
      // KISS: no Crystal Ball walkthrough until there's a live card to pick
      if (!(await leagueHasLiveCard())) {
        syncFromStorage();
        return;
      }
      if (needsPlayerTutorial() && !isPlayerTutorialActive()) {
        // Start at picks if crystal already done / keep simple path
        startPlayerTutorial(getSession()?.playerId || undefined);
      }
      syncFromStorage();
    }

    void maybeStart();
    const t1 = setTimeout(() => void maybeStart(), 600);
    const t2 = setTimeout(() => void maybeStart(), 2500);

    function onTut() {
      syncFromStorage();
    }
    function onStorage(e: StorageEvent) {
      if (
        e.key?.includes("warroom-rules") ||
        e.key?.includes("player-tutorial")
      ) {
        maybeStart();
      }
    }
    window.addEventListener("warroom-player-tutorial", onTut);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("warroom-player-tutorial", onTut);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Gentle path hints — respect hold after Back
  useEffect(() => {
    if (!isPlayerTutorialActive()) return;
    const s = getPlayerTutorialState().step;
    if (isTutorialHeldOn(s)) {
      syncFromStorage();
      return;
    }

    if (pathname?.startsWith("/crystal-ball")) {
      // Only auto-enter search when they first open CB from step 1
      if (s === "open_crystal") {
        advancePlayerTutorialTo("search_team");
      }
      void loadCrystalBall().then((cb) => {
        if (cb.myTeam && !isTutorialHeldOn("open_picks")) {
          const cur = getPlayerTutorialState().step;
          if (
            cur === "search_team" ||
            cur === "lock_crystal" ||
            cur === "open_crystal"
          ) {
            advancePlayerTutorialTo("open_picks");
          }
        }
      });
    }

    syncFromStorage();
  }, [pathname]);

  // Poll completion signals while active
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const s = getPlayerTutorialState().step;
      if (isTutorialHeldOn(s)) return;

      if (pathname?.startsWith("/crystal-ball")) {
        void loadCrystalBall().then((cb) => {
          if (cb.myTeam) {
            const cur = getPlayerTutorialState().step;
            if (cur === "search_team" || cur === "lock_crystal") {
              advancePlayerTutorialTo("open_picks");
              syncFromStorage();
            }
          }
        });
        try {
          if (
            sessionStorage.getItem("warroom-tut-cb-selected") === "1" &&
            s === "search_team" &&
            !isTutorialHeldOn("search_team")
          ) {
            advancePlayerTutorialTo("lock_crystal");
            syncFromStorage();
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
            advancePlayerTutorialTo("save_picks");
            syncFromStorage();
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
            syncFromStorage();
          }
        } catch {
          /* ignore */
        }
      }
    }, 800);
    return () => clearInterval(id);
  }, [active, pathname]);

  if (!active || isGuestMode()) return null;

  const copy = coachCopyForStep(step);
  const stepIdx = playerTutorialStepIndex(step);
  const canGoBack = stepIdx > 0;

  function manualNext() {
    clearTutorialHold();
    const i = ORDER.indexOf(step);
    const next = ORDER[i + 1] || "done";
    if (next === "done") {
      completePlayerTutorial();
    } else {
      advancePlayerTutorialTo(next);
    }
    syncFromStorage();
  }

  function goBack() {
    const prev = goBackPlayerTutorial();
    if (prev) {
      // Clear completion hints that would re-skip the step they returned to
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
      syncFromStorage();
      const href = coachCopyForStep(prev).ctaHref;
      if (href) router.push(href);
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[45] p-3 sm:p-4 pointer-events-none"
      style={{
        // Sit above content but below bottom tabs (z-50) so tabs always hard-switch
        paddingBottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px) + 0.5rem)",
      }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl border-2 border-primary bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-0.5">
              Walk the dog
            </p>
            <p className="text-sm font-bold text-foreground leading-snug">
              {copy.title}
            </p>
            <p className="text-xs text-muted mt-1 leading-relaxed">{copy.body}</p>
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
          {copy.ctaHref && (
            <Link
              href={copy.ctaHref}
              onClick={() => {
                // User intentionally continuing — release hold
                clearTutorialHold();
                if (step === "open_crystal") {
                  advancePlayerTutorialTo("search_team");
                }
                if (step === "open_picks") {
                  advancePlayerTutorialTo("fill_picks");
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
                advancePlayerTutorialTo("open_picks");
                syncFromStorage();
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
