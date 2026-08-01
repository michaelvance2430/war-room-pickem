"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Link from "next/link";
import HotTakeTicker from "@/components/HotTakeTicker";
import SportPoolPollBanner from "@/components/SportPoolPollBanner";
import BetaLeagueBanner from "@/components/BetaLeagueBanner";
import IncidentBanner from "@/components/IncidentBanner";
import CrownAndShame from "@/components/CrownAndShame";
import HomeWeekHero from "@/components/HomeWeekHero";
import PlayerWeekChecklist from "@/components/PlayerWeekChecklist";
import CommishSetupBanner from "@/components/CommishSetupBanner";
import InviteFriends from "@/components/InviteFriends";
import HomeUnseenPulse from "@/components/HomeUnseenPulse";
import HomeGazetteSpotlight from "@/components/HomeGazetteSpotlight";
import HomeTileUnseen from "@/components/HomeTileUnseen";
import LockPicksRoast from "@/components/LockPicksRoast";
import {
  getSession,
  getLeague,
  isCommissioner,
  isActuallyCommissioner,
} from "@/lib/league";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  restoreSessionFromCloud,
  switchToLeague,
  LeagueMembership,
} from "@/lib/session-restore";
import { resolveHomeTagline } from "@/lib/home-tagline";
import { syncLeagueFromCloud } from "@/lib/league-sync";
import { resolveHomeChrome } from "@/lib/sports/home-chrome";
import HomeSportAtmosphere from "@/components/HomeSportAtmosphere";
import HomeSportHeader from "@/components/HomeSportHeader";
import LeagueMembershipCard from "@/components/LeagueMembershipCard";
import OpenRoomLeaveNudge from "@/components/OpenRoomLeaveNudge";
import MultiLeagueHomeHub from "@/components/MultiLeagueHomeHub";
import HomeRoomContext from "@/components/HomeRoomContext";
import HomeHostScoreStrip from "@/components/HomeHostScoreStrip";
import SoftUnlockBanner from "@/components/SoftUnlockBanner";
import SandboxSimBanner from "@/components/SandboxSimBanner";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [homeTagline, setHomeTagline] = useState(
    resolveHomeTagline({})
  );
  const [sportId, setSportId] = useState<string>("cfb");
  const [isCommish, setIsCommish] = useState(false);
  const [actuallyCommish, setActuallyCommish] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pickList, setPickList] = useState<LeagueMembership[] | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  /** Demote museum/lore/brackets until first lock or first scores */
  const [firstWeekChrome, setFirstWeekChrome] = useState(true);
  /** Gazette / News shelf ~week 3 */
  const [showGazetteShelf, setShowGazetteShelf] = useState(false);

  useEffect(() => {
    async function boot() {
      try {
        // Guest demo — local world, no Supabase account
        const { isGuestMode } = await import("@/lib/guest-mode");
        if (isGuestMode()) {
          const session = getSession();
          const league = getLeague();
          if (!session || !league) {
            router.replace("/login");
            return;
          }
          setLeagueCode(league.code);
          setLeagueName(league.name);
          setSportId(league.sportId || "cfb");
          setHomeTagline(
            resolveHomeTagline({
              homeTaglineId: league.settings?.homeTaglineId,
              homeTaglineCustom: league.settings?.homeTaglineCustom,
              sportId: league.sportId || "cfb",
            })
          );
          setIsCommish(isCommissioner());
          setActuallyCommish(isActuallyCommissioner());
          // Guest demo: show the full room (sandbox playground)
          setFirstWeekChrome(false);
          setShowGazetteShelf(true);
          setReady(true);
          return;
        }

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
        // Create pin: cloud default cfb must not repaint NFL as green
        let sport = fresh.sportId || league?.sportId || "cfb";
        try {
          const { forcedSportForLeague, applySportTheme, pinLeagueSport } =
            await import("@/lib/sports/sport-theme");
          const forced = forcedSportForLeague(fresh.id);
          if (forced) {
            sport = forced;
            if (fresh.sportId !== forced) {
              pinLeagueSport(fresh.id, forced);
            }
          }
          applySportTheme(sport);
        } catch {
          /* ignore */
        }
        setLeagueCode(fresh.code);
        setLeagueName(fresh.name);
        setSportId(sport);
        setHomeTagline(
          resolveHomeTagline({
            homeTaglineId: fresh.settings?.homeTaglineId,
            homeTaglineCustom: fresh.settings?.homeTaglineCustom,
            sportId: fresh.sportId || "cfb",
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
        // Sandbox: one-time nuke of sim career banks from dry-run seasons
        try {
          const { nukeAccumulatedSandboxCareersOnce } = await import(
            "@/lib/sandbox-wipe"
          );
          nukeAccumulatedSandboxCareersOnce();
        } catch {
          /* ignore */
        }
        try {
          const pd = await import("@/lib/progressive-disclosure");
          const snap = await pd.loadProgressiveSnapshot(getSession()?.playerId);
          setFirstWeekChrome(snap.firstWeekChrome);
          setShowGazetteShelf(snap.showGazetteShelf);
        } catch {
          setFirstWeekChrome(false);
          setShowGazetteShelf(true);
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
    function onFirstWeek() {
      void import("@/lib/progressive-disclosure").then(async (pd) => {
        const snap = await pd.loadProgressiveSnapshot(getSession()?.playerId);
        setFirstWeekChrome(snap.firstWeekChrome);
        setShowGazetteShelf(snap.showGazetteShelf);
      });
    }
    window.addEventListener("warroom-view-as-player", onPreview);
    window.addEventListener("warroom-first-week-progress", onFirstWeek);
    window.addEventListener("warroom-progressive-disclosure", onFirstWeek);
    return () => {
      window.removeEventListener("warroom-view-as-player", onPreview);
      window.removeEventListener("warroom-first-week-progress", onFirstWeek);
      window.removeEventListener("warroom-progressive-disclosure", onFirstWeek);
    };
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
    setSportId(league.sportId || "cfb");
    setHomeTagline(
      resolveHomeTagline({
        homeTaglineId: league.settings?.homeTaglineId,
        homeTaglineCustom: league.settings?.homeTaglineCustom,
        sportId: league.sportId || "cfb",
      })
    );
    setIsCommish(isCommissioner());
    setActuallyCommish(isActuallyCommissioner());
    try {
      const pd = await import("@/lib/progressive-disclosure");
      const snap = await pd.loadProgressiveSnapshot(getSession()?.playerId);
      setFirstWeekChrome(snap.firstWeekChrome);
      setShowGazetteShelf(snap.showGazetteShelf);
    } catch {
      setFirstWeekChrome(false);
    }
    setReady(true);
  }

  // CFB room skins read seasonThemeId from local league cache
  const homeChrome = resolveHomeChrome(sportId);

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
          <p className="text-sm text-muted mb-4 leading-relaxed">
            You belong to more than one. Sport, your seat, open vs private, and
            bots — pick the room you want.
          </p>
          <div className="space-y-2">
            {pickList.map((m) => (
              <LeagueMembershipCard
                key={m.leagueId}
                membership={m}
                userId={getSession()?.playerId}
                onSelect={() => void chooseLeague(m.leagueId)}
              />
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
    <div className="min-h-screen flex flex-col relative overflow-x-hidden crt-frame scan-sweep home-war-room">
      <HomeSportAtmosphere atmosphere={homeChrome.atmosphere} />

      <Nav />
      {/* Phone-first: less chrome padding, job-first stack (most users are on phones) */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-10 relative z-10">
        {/* Platform incident always wins; beta + open-room noise after first lock */}
        <IncidentBanner />
        {!firstWeekChrome && (
          <>
            <OpenRoomLeaveNudge />
            <BetaLeagueBanner />
          </>
        )}

        {/* ── Room name once, then slim switcher, then the job ── */}
        {!firstWeekChrome ? (
          <HomeSportHeader
            chrome={homeChrome}
            tagline={homeTagline}
            leagueName={leagueName}
            leagueCode={leagueCode}
            isCommish={isCommish}
            codeCopied={codeCopied}
            onCopyCode={async () => {
              if (!leagueCode) return;
              try {
                await navigator.clipboard.writeText(leagueCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          />
        ) : (
          <HomeRoomContext
            leagueName={leagueName}
            sportId={sportId}
            isCommish={isCommish}
            actuallyCommish={actuallyCommish}
            leagueCode={leagueCode}
          />
        )}

        {/* Switcher sits under the name — never above it, never repeats the title */}
        <MultiLeagueHomeHub
          onSwitched={() => {
            window.location.href = "/";
          }}
        />

        <SandboxSimBanner />

        <HomeWeekHero />

        {/* One-time: first lock opened the full room */}
        <SoftUnlockBanner />

        {/* Host score path only when not in quiet first hour (or always for ops after card) */}
        {!firstWeekChrome && <HomeHostScoreStrip />}
        {firstWeekChrome && isCommish && <HomeHostScoreStrip />}

        {firstWeekChrome && (
          <p className="text-xs text-muted mb-4 leading-relaxed max-w-xl -mt-1">
            {isCommish ? (
              <>
                Keep it boring:{" "}
                <strong className="text-foreground">
                  share invite → publish card → lock your picks
                </strong>
                . No trophies, papers, or fireworks until you lock once.
              </>
            ) : (
              <>
                Keep it boring:{" "}
                <strong className="text-foreground">
                  open My Picks and lock before kickoff
                </strong>
                . That&apos;s the whole first ten minutes. Everything flashy
                waits.
              </>
            )}
          </p>
        )}

        {/* Secondary room life — after first lock only (same order as before) */}
        {!firstWeekChrome && (
          <>
            <SportPoolPollBanner />
            <HomeGazetteSpotlight />
            <LockPicksRoast />
            <PlayerWeekChecklist />
            <HomeUnseenPulse />
            <section className="mb-6">
              <HotTakeTicker variant="warroom" />
            </section>
            <section className="mb-8 sm:mb-10">
              <CrownAndShame />
            </section>
          </>
        )}

        {/* First hour: only Locker (+ Host). Full tile grid after lock. */}
        {firstWeekChrome ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Link
              href="/locker-room"
              className="group rounded-xl border border-orange-400/30 bg-black/40 p-5 hover:border-orange-300/60 transition"
            >
              <div className="text-xs uppercase tracking-wider text-orange-300/70 mb-1">
                Talk shit
              </div>
              <div className="text-lg font-semibold text-orange-300">
                Locker Room
              </div>
            </Link>
            {isCommish && (
              <Link
                href="/commissioner?tab=card&first=1"
                className="group rounded-xl border border-primary/40 bg-primary/10 p-5 hover:border-primary transition"
              >
                <div className="text-xs uppercase tracking-wider text-primary mb-1">
                  Host
                </div>
                <div className="text-lg font-semibold text-white">
                  Publish card
                </div>
              </Link>
            )}
            <Link
              href="/rules"
              className="group rounded-xl border border-border/80 bg-black/40 p-5 hover:border-primary/40 transition sm:col-span-2"
            >
              <div className="text-xs uppercase tracking-wider text-muted mb-1">
                Optional
              </div>
              <div className="text-base font-semibold text-white">
                How to play
              </div>
              <p className="text-xs text-muted mt-1">
                Spreads · confidence · lock before kickoff
              </p>
            </Link>
          </section>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3 font-semibold">
              The rest of the room
            </p>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Link
                href="/board"
                className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
              >
                <div className="text-xs uppercase tracking-wider text-muted mb-2">
                  Who&apos;s winning
                </div>
                <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                  The Board
                </div>
                <p className="text-sm text-muted mt-2">
                  Season points · divisions · cut line
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
                  How to play
                </div>
                <p className="text-sm text-muted mt-2">
                  Spreads · confidence · Best Bet · bonus · lock
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
                href="/championship"
                className={
                  homeChrome.sportId === "soccer_wwc"
                    ? "group rounded-xl border bg-black/40 backdrop-blur-sm p-6 transition border-[#009C3B]/50 hover:border-[#FFDF00]/70 hover:bg-[#009C3B]/10 shadow-[0_0_40px_rgba(0,156,59,0.15)]"
                    : "group rounded-xl border bg-black/40 backdrop-blur-sm p-6 transition border-primary/30 hover:border-primary hover:bg-primary/10 shadow-[0_0_40px_rgba(34,197,94,0.08)]"
                }
              >
                <div
                  className={
                    homeChrome.sportId === "soccer_wwc"
                      ? "text-xs uppercase tracking-wider mb-2 text-[#FFDF00]/90"
                      : "text-xs uppercase tracking-wider mb-2 text-primary/70"
                  }
                >
                  Postseason
                </div>
                <div
                  className={
                    homeChrome.sportId === "soccer_wwc"
                      ? "text-lg font-semibold text-white"
                      : "text-lg font-semibold text-primary"
                  }
                >
                  {homeChrome.primaryPathLabel}
                </div>
                <p className="text-sm text-muted mt-2">
                  {homeChrome.primaryPathBlurb}
                </p>
              </Link>

              <Link
                href="/toilet-bowl"
                className="group rounded-xl border border-purple-500/30 bg-black/40 backdrop-blur-sm p-6 hover:border-purple-400/60 hover:bg-purple-500/10 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
              >
                <div className="text-xs uppercase tracking-wider text-purple-300/70 mb-2">
                  Bottom half
                </div>
                <div className="text-lg font-semibold text-purple-300">
                  {homeChrome.shamePathLabel}
                </div>
                <p className="text-sm text-muted mt-2">
                  {homeChrome.shamePathBlurb}
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

              {showGazetteShelf && (
                <Link
                  href="/gazette"
                  className="group rounded-xl border border-red-700/40 bg-black/40 backdrop-blur-sm p-6 hover:border-red-500/60 hover:bg-red-950/30 transition shadow-[0_0_40px_rgba(185,28,28,0.12)]"
                >
                  <div className="text-xs uppercase tracking-wider text-red-300/80 mb-2">
                    The paper
                  </div>
                  <div className="text-lg font-semibold text-red-200 group-hover:text-red-100 transition">
                    Gazette
                  </div>
                  <p className="text-sm text-muted mt-2">
                    Every week&apos;s headlines for the season
                  </p>
                </Link>
              )}

              {showGazetteShelf && (
                <Link
                  href="/announcements"
                  className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="text-xs uppercase tracking-wider text-muted mb-2 flex items-center justify-between gap-2">
                    <span>News</span>
                    <HomeTileUnseen kind="announcements" />
                  </div>
                  <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                    League notes
                  </div>
                  <p className="text-sm text-muted mt-2">
                    Host posts · milk cartons · room updates
                  </p>
                </Link>
              )}

              <Link
                href="/locker-room"
                className="group rounded-xl border border-orange-400/30 bg-black/40 backdrop-blur-sm p-6 hover:border-orange-300/60 hover:bg-orange-500/10 transition shadow-[0_0_40px_rgba(249,115,22,0.08)]"
              >
                <div className="text-xs uppercase tracking-wider text-orange-300/70 mb-2 flex items-center justify-between gap-2">
                  <span>Talk shit</span>
                  <HomeTileUnseen kind="locker" />
                </div>
                <div className="text-lg font-semibold text-orange-300">
                  Locker Room
                </div>
                <p className="text-sm text-muted mt-2">
                  Short takes · emojis · pure noise
                </p>
              </Link>

              {isCommish && (
                <Link
                  href="/commissioner"
                  className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition"
                >
                  <div className="text-xs uppercase tracking-wider text-muted mb-2">
                    Host
                  </div>
                  <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                    Run the Room
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
          </>
        )}

        {/* ── BOTTOM: recruiting / host invite (after the job + room) ── */}
        <CommishSetupBanner />
        {!firstWeekChrome && (
          <div className="mt-5 mb-2">
            <InviteFriends />
          </div>
        )}
      </main>
    </div>
  );
}
