"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  dismissGuestTutorialForever,
  exitGuestDemo,
  getGuestState,
  isGuestMode,
  markGuestTutorialDone,
  needsGuestTutorial,
  setGuestRole,
  type GuestRole,
} from "@/lib/guest-mode";

type Phase = "welcome" | "role" | "coach" | "done";

/**
 * Guest Mode: welcome → seat → one coach beat → gone forever.
 * Rule: Teach once. Then disappear. Never make them fight the coach.
 */
export default function GuestOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [role, setRole] = useState<GuestRole | null>(null);

  useEffect(() => {
    if (!isGuestMode()) {
      setOpen(false);
      return;
    }
    const s = getGuestState();
    if (!s.welcomeDone || !s.role) {
      setPhase(s.welcomeDone ? "role" : "welcome");
      setOpen(true);
      return;
    }
    setRole(s.role);
    if (needsGuestTutorial(s.role)) {
      setPhase("coach");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, []);

  // Navigating away while coach is up = they already got the idea. Never chase them.
  useEffect(() => {
    if (!open || phase !== "coach" || !role) return;
    if (!pathname) return;
    // Already on the destination they care about → dismiss forever
    if (role === "player" && (pathname === "/picks" || pathname.startsWith("/picks/"))) {
      markGuestTutorialDone(role);
      setOpen(false);
      return;
    }
    if (
      role === "commissioner" &&
      (pathname.startsWith("/commissioner") || pathname.startsWith("/league-build"))
    ) {
      markGuestTutorialDone(role);
      setOpen(false);
    }
  }, [pathname, open, phase, role]);

  function finishCoach(href?: string) {
    if (role) markGuestTutorialDone(role);
    else dismissGuestTutorialForever();
    setOpen(false);
    if (href) {
      router.push(href);
    }
  }

  function skipForever() {
    dismissGuestTutorialForever();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          // Backdrop: never trap — welcome/role stay intentional; coach dismisses
          if (phase === "coach") skipForever();
        }}
      />

      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-2xl">
        {phase === "welcome" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              👋 Welcome to War Room
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              You&apos;re checking out as a guest
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Look around. Make some practice picks. See what football season
              feels like here.
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              The social side—Locker, rivalries, crews, titles, and everything
              that makes your league{" "}
              <em className="text-foreground not-italic font-semibold">yours</em>
              —unlocks when you join or create a real league.
            </p>
            <p className="text-xs text-muted leading-relaxed rounded-lg border border-border bg-background/50 px-3 py-2">
              You&apos;re in a <strong className="text-foreground">tour room
              (Week 9 vibe)</strong> with bots so it feels alive. Nothing here
              is your friend group yet — that&apos;s the point of joining.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPhase("role")}
                className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold"
              >
                Look around →
              </button>
              <button
                type="button"
                onClick={() => {
                  exitGuestDemo();
                  window.location.assign("/login?mode=join");
                }}
                className="w-full py-2.5 min-h-[44px] rounded-xl border border-primary/40 text-primary text-sm font-bold"
              >
                Join a League →
              </button>
              <button
                type="button"
                onClick={() => {
                  exitGuestDemo();
                  window.location.assign("/login?mode=signup");
                }}
                className="w-full py-2 text-xs text-muted hover:text-foreground"
              >
                Create My League →
              </button>
            </div>
          </div>
        )}

        {phase === "role" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              How do you want to tour?
            </p>
            <h2 className="text-xl font-bold">Pick a seat</h2>
            <p className="text-sm text-muted">
              One quick tip, then you&apos;re free. You can switch later from
              Account.
            </p>
            <button
              type="button"
              onClick={() => {
                setGuestRole("player");
                setRole("player");
                setPhase("coach");
              }}
              className="w-full text-left rounded-xl border-2 border-border hover:border-primary/50 p-4 space-y-1 transition"
            >
              <p className="font-bold text-foreground">View as player</p>
              <p className="text-xs text-muted">
                Weekly picks, confidence, Best Bet — the friend experience.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setGuestRole("commissioner");
                setRole("commissioner");
                setPhase("coach");
              }}
              className="w-full text-left rounded-xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/15 p-4 space-y-1 transition"
            >
              <p className="font-bold text-primary">View as commissioner</p>
              <p className="text-xs text-muted">
                Build a card, publish, score — how you run the room.
              </p>
            </button>
          </div>
        )}

        {phase === "coach" && role === "player" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              One thing · then free
            </p>
            <h2 className="text-xl font-bold">Make your picks</h2>
            <p className="text-sm text-muted leading-relaxed">
              This tour is already on Week 9. Open My Picks, take every side,
              confidence 1–5 (each once), one Best Bet, the prop — then Save
              before kickoff. That&apos;s the whole game.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => finishCoach("/picks")}
                className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold"
              >
                Open My Picks →
              </button>
              <button
                type="button"
                onClick={skipForever}
                className="w-full py-2 text-xs text-muted hover:text-foreground"
              >
                Explore free — I&apos;ve got it
              </button>
            </div>
          </div>
        )}

        {phase === "coach" && role === "commissioner" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              One thing · then free
            </p>
            <h2 className="text-xl font-bold">Run the room</h2>
            <p className="text-sm text-muted leading-relaxed">
              Hosts do three jobs: build the card, publish it so friends can
              lock, score after the games. Look around the tour room, then join
              for real when you&apos;re ready to host your people.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => finishCoach("/")}
                className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold"
              >
                Show me Home →
              </button>
              <button
                type="button"
                onClick={skipForever}
                className="w-full py-2 text-xs text-muted hover:text-foreground"
              >
                Explore free — I&apos;ve got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
