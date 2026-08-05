"use client";

import { useEffect } from "react";
import RulesContent from "@/components/RulesContent";
import Link from "next/link";
import { getSession } from "@/lib/league";
import { markEngagement } from "@/lib/engagement";

export default function RulesPage() {
  useEffect(() => {
    const id = getSession()?.playerId;
    if (id) markEngagement(id, "opened_rules");
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
            How we play
          </p>
          <h1 className="text-2xl font-black mb-2">Rules</h1>
          <p className="text-base text-foreground/90 leading-relaxed max-w-xl">
            Thursday. Friday. Saturday. Sunday. Monday. Football has declared war
            on the calendar.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 mb-6">
          <RulesContent />
        </div>

        {/* Home owns navigation — one exit, not a tour of the app */}
        <Link
          href="/"
          className="flex items-center justify-center w-full min-h-[48px] rounded-xl border border-border text-sm font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          Home
        </Link>
      </main>
    </div>
  );
}
