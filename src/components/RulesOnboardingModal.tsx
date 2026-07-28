"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RulesContent from "@/components/RulesContent";
import { getSession } from "@/lib/league";
import { hasSeenRules, markRulesSeen } from "@/lib/rules";

/**
 * First-login rules popup. Shows once per browser until dismissed.
 * Same content as the Rules page.
 */
export default function RulesOnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only for signed-in league members
    const session = getSession();
    if (!session?.playerId) return;
    if (hasSeenRules()) return;
    // Small delay so the page paints first
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    markRulesSeen();
    setOpen(false);
  }

  if (!open) return null;

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
      <div className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            How to play
          </div>
          <h2
            id="rules-onboarding-title"
            className="text-xl font-bold text-foreground"
          >
            Welcome to the War Room
          </h2>
          <p className="text-xs text-muted mt-1">
            Quick rules before you pick. You only see this once.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <RulesContent compact />
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-semibold text-sm"
          >
            Got it — let&apos;s play
          </button>
          <Link
            href="/rules"
            onClick={dismiss}
            className="flex-1 py-3 rounded-xl border border-border text-center text-sm text-muted hover:text-foreground font-medium"
          >
            Open full Rules
          </Link>
        </div>
      </div>
    </div>
  );
}
