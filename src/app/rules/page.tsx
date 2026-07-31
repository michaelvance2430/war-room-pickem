"use client";

import { useEffect } from "react";
import Nav from "@/components/Nav";
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
      <Nav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Rules</h1>
          <p className="text-sm text-muted">
            How War Room Pick&apos;Em works — same guide as the first-login
            popup.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 mb-6">
          <RulesContent />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/picks"
            className="flex-1 text-center py-3 rounded-xl bg-primary text-black font-semibold text-sm"
          >
            Go to My Picks
          </Link>
          <Link
            href="/"
            className="flex-1 text-center py-3 rounded-xl border border-border text-sm text-muted hover:text-foreground font-medium"
          >
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
