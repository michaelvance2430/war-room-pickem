"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Link from "next/link";
import { getSession, getLeague } from "@/lib/league";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  restoreSessionFromCloud,
  switchToLeague,
  LeagueMembership,
} from "@/lib/session-restore";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [isCommish, setIsCommish] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pickList, setPickList] = useState<LeagueMembership[] | null>(null);

  useEffect(() => {
    async function boot() {
      try {
        if (!hasSupabaseConfig()) {
          setBootError("Supabase keys missing on this deployment.");
          return;
        }

        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setBootError(error.message);
          return;
        }
        if (!data.user) {
          router.replace("/login");
          return;
        }

        // Prefer existing local session if present
        let session = getSession();
        let league = getLeague();

        if (!session || !league) {
          const restored = await restoreSessionFromCloud();
          if (restored.status === "no_auth") {
            router.replace("/login");
            return;
          }
          if (restored.status === "no_leagues") {
            router.replace("/join");
            return;
          }
          if (restored.status === "pick_league") {
            setPickList(restored.memberships);
            return;
          }
          session = restored.session;
          league = restored.league;
        }

        setLeagueCode(league.code);
        setLeagueName(league.name);
        setIsCommish(!!session.isCommissioner);
        setReady(true);
      } catch (e: unknown) {
        setBootError(e instanceof Error ? e.message : "Failed to start");
      }
    }
    boot();
  }, [router]);

  async function chooseLeague(leagueId: string) {
    const ok = await switchToLeague(leagueId);
    if (!ok) {
      setBootError("Could not switch league");
      return;
    }
    const session = getSession();
    const league = getLeague();
    if (!session || !league) {
      setBootError("Session missing after switch");
      return;
    }
    setPickList(null);
    setLeagueCode(league.code);
    setLeagueName(league.name);
    setIsCommish(!!session.isCommissioner);
    setReady(true);
  }

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center text-sm text-danger">{bootError}</div>
      </div>
    );
  }

  if (pickList) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold mb-2">Choose a league</h1>
          <p className="text-sm text-muted mb-4">
            You belong to more than one. Pick which War Room to open.
          </p>
          <div className="space-y-2">
            {pickList.map((m) => (
              <button
                key={m.leagueId}
                onClick={() => chooseLeague(m.leagueId)}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary transition"
              >
                <div className="font-medium">{m.leagueName}</div>
                <div className="text-xs text-muted">
                  Code {m.code}
                  {m.role === "commissioner" ? " · Commissioner" : ""}
                </div>
              </button>
            ))}
          </div>
          <Link
            href="/join"
            className="block text-center text-sm text-muted mt-4 hover:text-foreground"
          >
            Create or join another league
          </Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <section className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Welcome to the War Room
          </h1>
          <p className="text-muted max-w-xl">
            Pick against the spread. Stack confidence. Hit the Best Bet.
          </p>
          {leagueName && (
            <p className="text-sm mt-3 text-muted">
              League: <span className="text-foreground font-medium">{leagueName}</span>
              {isCommish && leagueCode && (
                <>
                  {" · "}
                  <span className="font-mono text-primary tracking-widest">{leagueCode}</span>
                </>
              )}
            </p>
          )}
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/championship"
            className="rounded-xl border border-border bg-card p-6 block"
          >
            <span className="text-primary font-semibold">Championship Bracket</span>
          </Link>
          <Link
            href="/toilet-bowl"
            className="rounded-xl border border-toilet/40 bg-card p-6 block"
          >
            <span className="text-toilet font-semibold">Toilet Bowl</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
