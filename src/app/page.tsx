"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Link from "next/link";
import HotTakeTicker from "@/components/HotTakeTicker";
import CrownAndShame from "@/components/CrownAndShame";
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
        // getSession does not throw when logged out (getUser can show "Auth session missing!")
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          router.replace("/login");
          return;
        }
        const data = { user: sessionData.session.user };

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
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md text-center text-sm text-danger">{bootError}</div>
      </div>
    );
  }

  if (pickList) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
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
      <div className="min-h-screen flex items-center justify-center text-muted bg-background">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden crt-frame scan-sweep">
      {/* War room atmosphere layers */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 197, 94, 0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(120, 40, 40, 0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(20, 40, 30, 0.5), transparent 45%), #050805",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />
      {/* faint scanline */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.35) 3px)",
        }}
      />

      <Nav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 relative">
        <section className="mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary/80 mb-4 border border-primary/25 bg-primary/5 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Situation room live
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3 text-white drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            Welcome to the War Room
          </h1>
          <p className="text-muted max-w-xl text-base sm:text-lg leading-relaxed">
            Lights down. Spreads up. Confidence locked. This is where the week
            gets decided.
          </p>
          {leagueName && (
            <p className="text-sm mt-5 text-muted/90">
              <span className="text-foreground/90 font-medium">{leagueName}</span>
              {isCommish && leagueCode && (
                <>
                  <span className="mx-2 text-border">|</span>
                  <span className="font-mono text-primary tracking-[0.2em]">
                    {leagueCode}
                  </span>
                </>
              )}
            </p>
          )}
        </section>

        <section className="mb-6">
          <HotTakeTicker variant="warroom" />
        </section>

        <section className="mb-10">
          <CrownAndShame />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/picks"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              This week
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Make your picks
            </div>
            <p className="text-sm text-muted mt-2">
              ATS · confidence · Best Bet · prop
            </p>
          </Link>

          <Link
            href="/standings"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              Board
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Standings
            </div>
            <p className="text-sm text-muted mt-2">
              Divisions · cut line · season points
            </p>
          </Link>

          <Link
            href="/power-rankings"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              Pulse
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Power Rankings
            </div>
            <p className="text-sm text-muted mt-2">
              Who&apos;s actually playing the best right now
            </p>
          </Link>

          <Link
            href="/rules"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              Playbook
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Rules
            </div>
            <p className="text-sm text-muted mt-2">
              Spreads · confidence · Best Bet · prop · how to save
            </p>
          </Link>

          <Link
            href="/championship"
            className="group rounded-xl border border-primary/30 bg-black/40 backdrop-blur-sm p-6 hover:border-primary hover:bg-primary/10 transition shadow-[0_0_40px_rgba(34,197,94,0.08)]"
          >
            <div className="text-xs uppercase tracking-wider text-primary/70 mb-2">
              Postseason
            </div>
            <div className="text-lg font-semibold text-primary">
              Championship Bracket
            </div>
            <p className="text-sm text-muted mt-2">Top half. One path. No excuses.</p>
          </Link>

          <Link
            href="/toilet-bowl"
            className="group rounded-xl border border-purple-500/30 bg-black/40 backdrop-blur-sm p-6 hover:border-purple-400/60 hover:bg-purple-500/10 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-purple-300/70 mb-2">
              Bottom half
            </div>
            <div className="text-lg font-semibold text-purple-300">
              Toilet Bowl
            </div>
            <p className="text-sm text-muted mt-2">
              Shame bracket. Still matters.
            </p>
          </Link>

          {isCommish && (
            <Link
              href="/commissioner"
              className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition"
            >
              <div className="text-xs uppercase tracking-wider text-muted mb-2">
                Ops
              </div>
              <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                Commissioner tools
              </div>
              <p className="text-sm text-muted mt-2">
                Card · results · settings
              </p>
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
