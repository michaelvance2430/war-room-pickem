"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Link from "next/link";
import HotTakeTicker from "@/components/HotTakeTicker";
import CrownAndShame from "@/components/CrownAndShame";
import HomeWeekHero from "@/components/HomeWeekHero";
import PlayerWeekChecklist from "@/components/PlayerWeekChecklist";
import CommishSetupBanner from "@/components/CommishSetupBanner";
import HomeUnseenPulse from "@/components/HomeUnseenPulse";
import HomeTileUnseen from "@/components/HomeTileUnseen";
import LockPicksRoast from "@/components/LockPicksRoast";
import {
  getSession,
  getLeague,
  isCommissioner,
  isActuallyCommissioner,
} from "@/lib/league";
import { setViewAsPlayer } from "@/lib/view-as-player";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  restoreSessionFromCloud,
  switchToLeague,
  LeagueMembership,
} from "@/lib/session-restore";
import { resolveHomeTagline } from "@/lib/home-tagline";
import { syncLeagueFromCloud } from "@/lib/league-sync";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [homeTagline, setHomeTagline] = useState(
    resolveHomeTagline({})
  );
  const [isCommish, setIsCommish] = useState(false);
  const [actuallyCommish, setActuallyCommish] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pickList, setPickList] = useState<LeagueMembership[] | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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

        // Refresh settings (tagline) from cloud when possible
        const fresh = (await syncLeagueFromCloud()) || league;
        setLeagueCode(fresh.code);
        setLeagueName(fresh.name);
        setHomeTagline(
          resolveHomeTagline({
            homeTaglineId: fresh.settings?.homeTaglineId,
            homeTaglineCustom: fresh.settings?.homeTaglineCustom,
          })
        );
        setIsCommish(isCommissioner());
        setActuallyCommish(isActuallyCommissioner());
        // Hard-scrub mistaken War Room Legend (Visconti etc.) for this browser
        try {
          const { sanitizeLegacyLegendsOnBoot } = await import(
            "@/lib/legacy-badge-grants"
          );
          const sess = getSession();
          sanitizeLegacyLegendsOnBoot({
            playerId: sess?.playerId,
            playerName: sess?.playerName,
          });
        } catch {
          /* ignore */
        }
        // Sandbox: strip already-banked sim cheevos so fake weeks don't stick
        try {
          const { scrubSandboxProgressOnThisDevice } = await import(
            "@/lib/sandbox-wipe"
          );
          scrubSandboxProgressOnThisDevice();
        } catch {
          /* ignore */
        }
        setReady(true);
      } catch (e: unknown) {
        setBootError(e instanceof Error ? e.message : "Failed to start");
      }
    }
    boot();
    function onPreview() {
      setIsCommish(isCommissioner());
      setActuallyCommish(isActuallyCommissioner());
    }
    window.addEventListener("warroom-view-as-player", onPreview);
    return () => window.removeEventListener("warroom-view-as-player", onPreview);
  }, [router]);

  async function chooseLeague(leagueId: string) {
    const ok = await switchToLeague(leagueId);
    if (!ok) {
      setBootError("Could not switch league");
      return;
    }
    const session = getSession();
    let league = getLeague();
    if (!session || !league) {
      setBootError("Session missing after switch");
      return;
    }
    league = (await syncLeagueFromCloud()) || league;
    setPickList(null);
    setLeagueCode(league.code);
    setLeagueName(league.name);
    setHomeTagline(
      resolveHomeTagline({
        homeTaglineId: league.settings?.homeTaglineId,
        homeTaglineCustom: league.settings?.homeTaglineCustom,
      })
    );
    setIsCommish(isCommissioner());
    setActuallyCommish(isActuallyCommissioner());
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
    <div className="min-h-screen flex flex-col relative overflow-hidden crt-frame scan-sweep home-war-room">
      {/* War room atmosphere layers (always stay — season themes overlay on top via SeasonThemeApplier) */}
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 197, 94, 0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(120, 40, 40, 0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(20, 40, 30, 0.5), transparent 45%), #050805",
        }}
      />
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />
      {/* faint scanline */}
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.35) 3px)",
        }}
      />

      <Nav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 relative z-10">
        <section className="mb-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3 text-white drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            Welcome to the War Room
          </h1>
          <p className="text-muted max-w-xl text-base sm:text-lg leading-relaxed">
            {homeTagline}
          </p>
          {leagueName && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted/90">
              <span className="text-foreground/90 font-medium">{leagueName}</span>
              {isCommish && leagueCode && (
                <>
                  <span className="text-border">|</span>
                  <span className="font-mono text-primary tracking-[0.2em] text-base font-bold">
                    {leagueCode}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(leagueCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="text-xs px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                  >
                    {codeCopied ? "Copied!" : "Copy invite code"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {actuallyCommish && isCommish && (
          <div className="mb-6 rounded-xl border-2 border-warning/50 bg-warning/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-foreground">
              <span className="font-bold text-warning">Commish tip:</span> Want
              to see what your players see?
            </p>
            <button
              type="button"
              onClick={() => {
                setViewAsPlayer(true);
                setIsCommish(false);
                window.location.href = "/";
              }}
              className="shrink-0 px-4 py-2 rounded-lg bg-warning text-black text-sm font-bold"
            >
              Enter player view →
            </button>
          </div>
        )}

        {/* First-time Commish season setup */}
        <CommishSetupBanner />

        {/* Didn't lock? Sarcastic adulting reminder */}
        <LockPicksRoast />

        {/* One job: pick / wait / score path — strengths stay below */}
        <HomeWeekHero />

        {/* Unseen News + Locker — tap the number to open */}
        <HomeUnseenPulse />

        {/* Every member — not just Commish */}
        <PlayerWeekChecklist />

        <section className="mb-6">
          <HotTakeTicker variant="warroom" />
        </section>

        <section className="mb-10">
          <CrownAndShame />
        </section>

        <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3 font-semibold">
          The rest of the room
        </p>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            href="/stats"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              Pulse
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Stats
            </div>
            <p className="text-sm text-muted mt-2">
              Power rankings · season table · league lore
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

          <Link
            href="/trophy-room"
            className="group rounded-xl border border-amber-400/30 bg-black/40 backdrop-blur-sm p-6 hover:border-amber-300/60 hover:bg-amber-400/10 transition shadow-[0_0_40px_rgba(251,191,36,0.08)]"
          >
            <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-2">
              Legacy
            </div>
            <div className="text-lg font-semibold text-amber-300">
              Trophy Room
            </div>
            <p className="text-sm text-muted mt-2">
              Champs · Toilet · Village Nerd — year after year
            </p>
          </Link>

          <Link
            href="/announcements"
            className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2 flex items-center justify-between gap-2">
              <span>News</span>
              <HomeTileUnseen kind="announcements" />
            </div>
            <div className="text-lg font-semibold text-white group-hover:text-primary transition">
              Announcements
            </div>
            <p className="text-sm text-muted mt-2">
              Commish posts · milk cartons · league notes
            </p>
          </Link>

          <Link
            href="/locker-room"
            className="group rounded-xl border border-orange-400/30 bg-black/40 backdrop-blur-sm p-6 hover:border-orange-300/60 hover:bg-orange-500/10 transition shadow-[0_0_40px_rgba(249,115,22,0.08)]"
          >
            <div className="text-xs uppercase tracking-wider text-orange-300/70 mb-2 flex items-center justify-between gap-2">
              <span>Noise</span>
              <HomeTileUnseen kind="locker" />
            </div>
            <div className="text-lg font-semibold text-orange-300">
              Locker Room
            </div>
            <p className="text-sm text-muted mt-2">
              Short takes · emojis · pure shit talk
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

          <Link
            href="/account"
            className="group rounded-xl border border-sky-400/35 bg-sky-500/10 backdrop-blur-sm p-6 hover:border-sky-300/60 hover:bg-sky-500/15 transition shadow-[0_0_40px_rgba(56,189,248,0.08)] sm:col-span-2 lg:col-span-3"
          >
            <div className="text-xs uppercase tracking-wider text-sky-300/80 mb-2">
              You
            </div>
            <div className="text-lg font-semibold text-sky-200 group-hover:text-sky-100 transition">
              Account
            </div>
            <p className="text-sm text-muted mt-2">
              Photo · leagues · player view · feedback for Mike
            </p>
          </Link>
        </section>
      </main>
    </div>
  );
}
