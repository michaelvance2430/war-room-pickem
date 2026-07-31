"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getGuestState,
  isGuestMode,
  markGuestTutorialDone,
  needsGuestTutorial,
  setGuestRole,
  type GuestRole,
} from "@/lib/guest-mode";

type Phase = "welcome" | "role" | "tutorial" | "done";

/**
 * Guest Demo: welcome → role → short by-the-numbers tutorial.
 */
export default function GuestOnboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [role, setRole] = useState<GuestRole | null>(null);
  const [step, setStep] = useState(0);

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
      setPhase("tutorial");
      setStep(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, []);

  if (!open) return null;

  // Guest lands on Week 9 — Crystal Ball is already locked; no CB in demo tour
  const playerSteps = [
    {
      title: "1 · Open My Picks",
      body: "This demo is already through Week 9 (Crystal Ball is sealed). Open My Picks for the live card.",
      href: "/picks",
      cta: "Open My Picks →",
    },
    {
      title: "2 · Fill the card",
      body: "Pick every game, confidence 1–5 (each once), one Best Bet (2×), and the prop. Take your time.",
      href: "/picks",
      cta: "I’m on My Picks",
    },
    {
      title: "3 · Save before kickoff",
      body: "Hit Save Picks. After first kickoff the whole card freezes — no late locks. That’s the whole game.",
      href: "/picks",
      cta: "Got it — let’s play",
    },
  ];

  const commishSteps = [
    {
      title: "1 · Build the card",
      body: "Commish tools → Build Card. One tap: Publish demo week (or pull real odds and pick 5).",
      href: "/commissioner?tab=card&first=1",
      cta: "Open Build Card",
    },
    {
      title: "2 · Publish",
      body: "Publish / Update Card so the room can lock. Until you publish, My Picks stays empty and they think it’s broken.",
      href: "/commissioner?tab=card",
      cta: "Open Commish",
    },
    {
      title: "3 · Score the week",
      body: "After games: Enter Results → set winners + prop → Save Results & Score League. Standings wake up. Advanced tools unlock after your first real score.",
      href: "/commissioner?tab=results",
      cta: "Open Results",
    },
  ];

  const steps = role === "commissioner" ? commishSteps : playerSteps;
  const current = steps[step];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card shadow-2xl">
        {phase === "welcome" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Demo mode
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Welcome to the Demo War Room
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              This is a <strong className="text-foreground">simulated season
              already through Week 9</strong> — full set of bots, standings,
              fake locker energy, and gazette-ready drama. Nothing here is your
              real friend league.
            </p>
            <ul className="text-sm text-foreground/90 space-y-1.5 list-disc pl-5">
              <li>Weeks 0–8 scored · you land on Week 9</li>
              <li>Bots + mock board so the room looks alive</li>
              <li>Safe to click everything — reset anytime</li>
            </ul>
            <button
              type="button"
              onClick={() => setPhase("role")}
              className="w-full py-3 rounded-xl bg-primary text-black font-bold"
            >
              Continue →
            </button>
          </div>
        )}

        {phase === "role" && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              How do you want to tour?
            </p>
            <h2 className="text-xl font-bold">Pick a seat</h2>
            <p className="text-sm text-muted">
              You’ll get a short by-the-numbers tutorial for that role. You can
              switch later from Account.
            </p>
            <button
              type="button"
              onClick={() => {
                setGuestRole("player");
                setRole("player");
                setPhase("tutorial");
                setStep(0);
              }}
              className="w-full text-left rounded-xl border-2 border-border hover:border-primary/50 p-4 space-y-1 transition"
            >
              <p className="font-bold text-foreground">View as player</p>
              <p className="text-xs text-muted">
                Crystal Ball, weekly picks, Save before kickoff — the friend
                experience.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setGuestRole("commissioner");
                setRole("commissioner");
                setPhase("tutorial");
                setStep(0);
              }}
              className="w-full text-left rounded-xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/15 p-4 space-y-1 transition"
            >
              <p className="font-bold text-primary">View as commissioner</p>
              <p className="text-xs text-muted">
                Build a card, publish, score the week — how you run the room.
              </p>
            </button>
          </div>
        )}

        {phase === "tutorial" && current && role && (
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {role === "commissioner" ? "Commish tutorial" : "Player tutorial"}{" "}
              · {step + 1}/{steps.length}
            </p>
            <h2 className="text-xl font-bold">{current.title}</h2>
            <p className="text-sm text-muted leading-relaxed">{current.body}</p>
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= step ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (step < steps.length - 1) {
                    setStep((s) => s + 1);
                    return;
                  }
                  markGuestTutorialDone(role);
                  setOpen(false);
                  router.push(current.href);
                  router.refresh();
                }}
                className="w-full py-3 rounded-xl bg-primary text-black font-bold"
              >
                {step < steps.length - 1 ? "Next →" : current.cta}
              </button>
              {step < steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(current.href);
                  }}
                  className="w-full py-2.5 rounded-xl border border-border text-sm text-muted hover:text-foreground"
                >
                  {current.cta} (keep tutorial)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  markGuestTutorialDone(role);
                  setOpen(false);
                }}
                className="w-full py-2 text-xs text-muted hover:text-foreground"
              >
                Skip tutorial — explore free
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
