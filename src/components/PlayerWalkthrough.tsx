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
  coachCopyForStep,
  completePlayerTutorial,
  getPlayerTutorialState,
  isPlayerTutorialActive,
  needsPlayerTutorial,
  skipPlayerTutorial,
  startPlayerTutorial,
  type PlayerTutorialStep,
} from "@/lib/player-tutorial";
import { hasSeenRules } from "@/lib/rules";
import { loadCrystalBall } from "@/lib/crystal-ball";

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

    // After rules briefing, auto-start walk-the-dog if never completed
    function maybeStart() {
      if (isGuestMode()) return;
      if (!getSession()?.playerId) return;
      if (!hasSeenRules()) return;
      if (needsPlayerTutorial() && !isPlayerTutorialActive()) {
        startPlayerTutorial(getSession()?.playerId || undefined);
      }
      syncFromStorage();
    }

    maybeStart();
    const t1 = setTimeout(maybeStart, 600);
    const t2 = setTimeout(maybeStart, 2000);

    function onTut() {
      syncFromStorage();
    }
    function onStorage(e: StorageEvent) {
      if (e.key?.includes("warroom-rules") || e.key?.includes("player-tutorial")) {
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

  // Path + live data advance
  useEffect(() => {
    if (!isPlayerTutorialActive()) return;
    const s = getPlayerTutorialState().step;

    if (pathname?.startsWith("/crystal-ball")) {
      if (s === "open_crystal") advancePlayerTutorialTo("search_team");
      void loadCrystalBall().then((cb) => {
        if (cb.myTeam) {
          advancePlayerTutorialTo("open_picks");
        }
      });
    }

    if (pathname?.startsWith("/picks")) {
      if (
        s === "open_crystal" ||
        s === "search_team" ||
        s === "lock_crystal" ||
        s === "open_picks"
      ) {
        advancePlayerTutorialTo("fill_picks");
      }
    }

    syncFromStorage();
  }, [pathname]);

  // Poll crystal selection / pick lock while active on those pages
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const s = getPlayerTutorialState().step;
      if (pathname?.startsWith("/crystal-ball")) {
        void loadCrystalBall().then((cb) => {
          if (cb.myTeam && (s === "search_team" || s === "lock_crystal")) {
            advancePlayerTutorialTo("open_picks");
            syncFromStorage();
          }
        });
        // Selection without lock: listen via sessionStorage hint from crystal page
        try {
          if (
            sessionStorage.getItem("warroom-tut-cb-selected") === "1" &&
            s === "search_team"
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
          if (sessionStorage.getItem("warroom-tut-picks-filled") === "1") {
            if (s === "fill_picks") {
              advancePlayerTutorialTo("save_picks");
              syncFromStorage();
            }
          }
          if (sessionStorage.getItem("warroom-tut-picks-saved") === "1") {
            completePlayerTutorial();
            try {
              sessionStorage.removeItem("warroom-tut-picks-saved");
              sessionStorage.removeItem("warroom-tut-picks-filled");
              sessionStorage.removeItem("warroom-tut-cb-selected");
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

  function manualNext() {
    const order: PlayerTutorialStep[] = [
      "open_crystal",
      "search_team",
      "lock_crystal",
      "open_picks",
      "fill_picks",
      "save_picks",
      "done",
    ];
    const i = order.indexOf(step);
    const next = order[i + 1] || "done";
    if (next === "done") {
      completePlayerTutorial();
    } else {
      advancePlayerTutorialTo(next);
    }
    syncFromStorage();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[65] p-3 sm:p-4 pointer-events-none">
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
              syncFromStorage();
            }}
            className="text-[11px] text-muted hover:text-foreground shrink-0 px-1"
          >
            Skip
          </button>
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {copy.ctaHref && (
            <Link
              href={copy.ctaHref}
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
