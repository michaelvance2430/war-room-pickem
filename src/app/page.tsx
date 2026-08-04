"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import IncidentBanner from "@/components/IncidentBanner";
import HomeWeekHero from "@/components/HomeWeekHero";
import HomeCommishMissionButton from "@/components/HomeCommishMissionButton";
import CommishSetupBanner from "@/components/CommishSetupBanner";
import HomeTileUnseen from "@/components/HomeTileUnseen";
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
import HomeRoomContext from "@/components/HomeRoomContext";
import SandboxSimBanner from "@/components/SandboxSimBanner";
import {
  wantsFullRoom,
  hasSeenGazetteShelfReveal,
} from "@/lib/progressive-disclosure";
import { isFirstWeekChrome } from "@/lib/first-week";
import FairEntryNotice from "@/components/FairEntryNotice";

const HomeGazetteSpotlight = dynamic(
  () => import("@/components/HomeGazetteSpotlight"),
  { ssr: false }
);
const InviteFriends = dynamic(() => import("@/components/InviteFriends"), {
  ssr: false,
});

/** Sync read of local session → paint Home shell without "Loading…" */
function readLocalHomeShell(): {
  leagueCode: string;
  leagueName: string;
  sportId: string;
  homeTagline: string;
  isCommish: boolean;
  actuallyCommish: boolean;
  firstWeekChrome: boolean;
  showGazetteShelf: boolean;
} | null {
  try {
    const session = getSession();
    const league = getLeague();
    if (!session || !league) return null;
    const id = session.playerId;
    const full = wantsFullRoom(id);
    const early = !full && isFirstWeekChrome(id);
    return {
      leagueCode: league.code,
      leagueName: league.name,
      sportId: league.sportId || "cfb",
      homeTagline: resolveHomeTagline({
        homeTaglineId: league.settings?.homeTaglineId,
        homeTaglineCustom: league.settings?.homeTaglineCustom,
        sportId: league.sportId || "cfb",
      }),
      isCommish: isCommissioner(),
      actuallyCommish: isActuallyCommissioner(),
      firstWeekChrome: early,
      showGazetteShelf: full || hasSeenGazetteShelfReveal(id) || !early,
    };
  } catch {
    return null;
  }
}

/**
 * HYDRATION: never read localStorage/session during useState init.
 * Server has no window → null; client with session → shell. That mismatch was
 * React #418 (server "Opening Home…" vs client full room).
 * Local shell is applied in useLayoutEffect below (before paint).
 */
export default function Home() {
  const router = useRouter();
  /** Deterministic first paint — same on server and client hydrate */
  const [ready, setReady] = useState(false);
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [homeTagline, setHomeTagline] = useState(() => resolveHomeTagline({}));
  const [sportId, setSportId] = useState("cfb");
  const [isCommish, setIsCommish] = useState(false);
  const [actuallyCommish, setActuallyCommish] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pickList, setPickList] = useState<LeagueMembership[] | null>(null);

  /** Demote museum/lore/brackets until first lock or first scores */
  const [firstWeekChrome, setFirstWeekChrome] = useState(true);
  /** Gazette / News shelf ~week 3 */
  const [showGazetteShelf, setShowGazetteShelf] = useState(false);
  /** Flavor widgets after hero paints — avoid cloud fan-out on tab return */
  const [showSecondary, setShowSecondary] = useState(false);
  /**
   * null = still checking. Drives first-hour player copy so we never say
   * "open My Picks and lock" when the commish hasn't published yet.
   */
  const [liveCard, setLiveCard] = useState<boolean | null>(null);

  // Soft: is there a card to pick? (new-player waiting room)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const { leagueHasLiveCard } = await import("@/lib/first-session");
        const has = await leagueHasLiveCard();
        if (!cancelled) setLiveCard(has);
      } catch {
        if (!cancelled) setLiveCard(null);
      }
    })();
    function onPublished() {
      setLiveCard(true);
    }
    window.addEventListener("warroom-card-published", onPublished);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-card-published", onPublished);
    };
  }, [ready]);

  // After hydrate: paint from local session before browser paint (no #418).
  // Soft nav re-mounts also re-run this — restores shell without stuck Loading.
  // Sacred rule: Home always opens.
  useLayoutEffect(() => {
    try {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    } catch {
      /* ok */
    }
    const shell = readLocalHomeShell();
    if (!shell) return;
    setLeagueCode(shell.leagueCode);
    setLeagueName(shell.leagueName);
    setSportId(shell.sportId);
    setHomeTagline(shell.homeTagline);
    setIsCommish(shell.isCommish);
    setActuallyCommish(shell.actuallyCommish);
    setFirstWeekChrome(shell.firstWeekChrome);
    setShowGazetteShelf(shell.showGazetteShelf);
    setReady(true);
    setBootError(null);
    try {
      const { applySportTheme } =
        require("@/lib/sports/sport-theme") as typeof import("@/lib/sports/sport-theme");
      applySportTheme(shell.sportId);
    } catch {
      /* ok */
    }
  }, []);

  // Secondary home chrome LATE — Commish already burned main thread; don't
  // mount MultiLeague + Crown + checklist in the same tick as Home paint.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setShowSecondary(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(arm, { timeout: 2_500 });
    } else {
      t = setTimeout(arm, 1_800);
    }
    return () => {
      cancelled = true;
      if (idleId != null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (t) clearTimeout(t);
    };
  }, [ready]);

  useEffect(() => {
    let cancelled = false;
    // Never leave Home on "Opening Home…" forever — fail open, not hang
    const bootWatch = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const shell = readLocalHomeShell();
        if (shell) {
          setLeagueCode(shell.leagueCode);
          setLeagueName(shell.leagueName);
          setSportId(shell.sportId);
          setHomeTagline(shell.homeTagline);
          setIsCommish(shell.isCommish);
          setActuallyCommish(shell.actuallyCommish);
          setFirstWeekChrome(shell.firstWeekChrome);
          setShowGazetteShelf(shell.showGazetteShelf);
          setReady(true);
          setBootError(null);
          return;
        }
      } catch {
        /* fall through */
      }
      // Still no local shell — recoverable path, not infinite spinner
      setBootError(
        "Couldn’t open your room yet. Sign in or refresh — Home never stays stuck."
      );
      setReady(false);
    }, 2_500);

    async function boot() {
      try {
        if (!hasSupabaseConfig()) {
          setBootError("Supabase keys missing on this deployment.");
          return;
        }

        // Already painted from localStorage (typical Picks → Home) — only soft refresh
        const hadLocal = !!(getSession() && getLeague());

        if (hadLocal) {
          // Background only — do not clear ready / flash Loading
          void (async () => {
            try {
              const league = getLeague();
              if (!league) return;
              try {
                const { ensureCrewForLeague } = await import("@/lib/crew");
                const session = getSession();
                if (session) {
                  ensureCrewForLeague({
                    leagueId: league.id,
                    leagueName: league.name || "War Room",
                    sportId: league.sportId || "cfb",
                    createdBy: session.playerId,
                    foundedAt: league.createdAt,
                  });
                }
              } catch {
                /* ignore */
              }
              // Auth check without getUser() hang
              const supabase = createClient();
              const { data: sessionData } = await supabase.auth.getSession();
              if (!sessionData.session?.user) {
                router.replace("/login");
                return;
              }
              // Soft league settings refresh (cached-friendly)
              const fresh = (await syncLeagueFromCloud()) || getLeague();
              if (!fresh) return;
              let sport = fresh.sportId || "cfb";
              try {
                const {
                  forcedSportForLeague,
                  applySportTheme,
                  pinLeagueSport,
                } = await import("@/lib/sports/sport-theme");
                const forced = forcedSportForLeague(fresh.id);
                if (forced) {
                  sport = forced;
                  if (fresh.sportId !== forced) pinLeagueSport(fresh.id, forced);
                }
                applySportTheme(sport);
              } catch {
                /* ignore */
              }
              if (cancelled) return;
              setLeagueCode(fresh.code);
              setLeagueName(fresh.name);
              setSportId(sport);
              setHomeTagline(
                resolveHomeTagline({
                  homeTaglineId: fresh.settings?.homeTaglineId,
                  homeTaglineCustom: fresh.settings?.homeTaglineCustom,
                  sportId: sport,
                })
              );
              setIsCommish(isCommissioner());
              setActuallyCommish(isActuallyCommissioner());
              try {
                const pd = await import("@/lib/progressive-disclosure");
                const snap = await pd.loadProgressiveSnapshot(
                  getSession()?.playerId
                );
                if (cancelled) return;
                setFirstWeekChrome(snap.firstWeekChrome);
                setShowGazetteShelf(snap.showGazetteShelf);
              } catch {
                /* keep local flags */
              }
            } catch {
              /* keep painted shell */
            }
          })();
          return;
        }

        // Cold boot — no local session
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          router.replace("/login");
          return;
        }

        let session = getSession();
        let league = getLeague();

        if (!session || !league) {
          const restored = await restoreSessionFromCloud();
          if (cancelled) return;
          if (restored.status === "no_auth") {
            router.replace("/login");
            return;
          }
          if (restored.status === "network_error") {
            setBootError(
              "Couldn’t load your room (slow connection). Tap Try again — don’t create a new league."
            );
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

        const fresh = (await syncLeagueFromCloud()) || league;
        if (cancelled) return;
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
            sportId: sport,
          })
        );
        setIsCommish(isCommissioner());
        setActuallyCommish(isActuallyCommissioner());
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
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : "Failed to start");
        }
      } finally {
        window.clearTimeout(bootWatch);
      }
    }
    void boot();
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
      cancelled = true;
      window.clearTimeout(bootWatch);
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

  // CFB atmosphere is automatic (holiday → season phase) — never a stored pick
  const homeChrome = resolveHomeChrome(sportId);

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-sm text-danger leading-relaxed">{bootError}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                setBootError(null);
                try {
                  window.location.assign("/");
                } catch {
                  window.location.href = "/";
                }
              }}
              className="min-h-[48px] px-5 rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation"
            >
              Try again
            </button>
            <Link
              href="/login"
              className="min-h-[48px] px-5 rounded-xl border border-border text-sm font-semibold flex items-center justify-center touch-manipulation"
            >
              Sign in
            </Link>
          </div>
        </div>
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
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
          <p className="text-sm text-muted">Opening Home…</p>
          <p className="text-xs text-muted max-w-sm text-center leading-relaxed">
            One moment while we open your room.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  window.location.assign("/");
                } catch {
                  window.location.href = "/";
                }
              }}
              className="min-h-[44px] px-4 rounded-xl bg-primary text-black text-sm font-bold"
            >
              Refresh
            </button>
            <Link
              href="/login"
              className="min-h-[44px] px-4 rounded-xl border border-border text-sm font-semibold flex items-center"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden crt-frame scan-sweep home-war-room">
      <HomeSportAtmosphere atmosphere={homeChrome.atmosphere} />

      {/* Phone-first: less chrome padding, job-first stack (most users are on phones) */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-10 relative z-10">
        {/* Platform incident always wins */}
        <IncidentBanner />

        {/* ── Room name once, then job (hero) first — switcher/flavor after ── */}
        {/*
          Share League: every authenticated member with a code — not ops/commish-only.
          firstWeekChrome uses HomeRoomContext (Share for all members).
        */}
        {(() => {
          const canShareLeague =
            !!getSession()?.playerId && !!leagueCode?.trim();
          return !firstWeekChrome ? (
            <HomeSportHeader
              chrome={homeChrome}
              tagline={homeTagline}
              leagueName={leagueName}
              leagueCode={leagueCode}
              canShare={canShareLeague}
              sportId={sportId}
            />
          ) : (
            <HomeRoomContext
              leagueName={leagueName}
              sportId={sportId}
              isCommish={isCommish}
              actuallyCommish={actuallyCommish}
              leagueCode={leagueCode}
              canShare={canShareLeague}
            />
          );
        })()}

        <SandboxSimBanner />

        {/* Primary job — always paint first on return from Picks */}
        <HomeWeekHero />

        {/* Commissioner: one mission above player destinations — never for pure players */}
        <HomeCommishMissionButton />

        {/* Host first-hour spine */}
        <CommishSetupBanner />

        {/* Mid-season join — Fair Entry explanation (no point math) */}
        <FairEntryNotice />

        {firstWeekChrome && (
          <p className="text-xs text-muted mb-4 leading-relaxed max-w-xl -mt-1">
            {isCommish ? (
              <>
                You&apos;re the host — follow{" "}
                <strong className="text-foreground">Start here</strong> one
                step at a time. No trophies or papers until someone locks.
                Yes, including you.
              </>
            ) : liveCard === false ? (
              <>
                First ten minutes:{" "}
                <strong className="text-foreground">
                  you&apos;re seated — waiting on the card
                </strong>
                . Your commish hasn&apos;t published yet. Hang in the Locker;
                when a card drops, open My Picks and lock before kickoff. That
                becomes the whole movie.
              </>
            ) : (
              <>
                First ten minutes:{" "}
                <strong className="text-foreground">
                  open My Picks and lock before kickoff
                </strong>
                . That&apos;s the whole movie. Everything flashy waits until you
                prove you can press one button.
              </>
            )}
          </p>
        )}
        {/* Real moments only — paper when it is real. No manufactured busywork. */}
        {showSecondary && !firstWeekChrome && <HomeGazetteSpotlight />}


        {/* First hour: job depends on whether a card exists. */}
        {firstWeekChrome ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {!isCommish && liveCard === false ? (
              <>
                <Link
                  href="/locker-room"
                  className="group rounded-xl border-2 border-primary/50 bg-primary/10 p-5 hover:border-primary transition sm:col-span-2"
                >
                  <div className="text-xs uppercase tracking-wider text-primary mb-1">
                    Do this for now
                  </div>
                  <div className="text-lg font-semibold text-white">
                    Locker Room
                  </div>
                  <p className="text-xs text-muted mt-1">
                    No card yet — your commish hasn&apos;t published. Hang here.
                    When a card drops, My Picks becomes the job.
                  </p>
                </Link>
                <Link
                  href="/picks"
                  className="group rounded-xl border border-border/80 bg-black/40 p-5 hover:border-primary/40 transition"
                >
                  <div className="text-xs uppercase tracking-wider text-muted mb-1">
                    Later
                  </div>
                  <div className="text-base font-semibold text-white">
                    My Picks
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Check if a card went live
                  </p>
                </Link>
                <Link
                  href="/rules"
                  className="group rounded-xl border border-border/80 bg-black/40 p-5 hover:border-primary/40 transition"
                >
                  <div className="text-xs uppercase tracking-wider text-muted mb-1">
                    Optional
                  </div>
                  <div className="text-base font-semibold text-white">
                    How to play
                  </div>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/picks"
                  className="group rounded-xl border-2 border-primary/50 bg-primary/10 p-5 hover:border-primary transition sm:col-span-2"
                >
                  <div className="text-xs uppercase tracking-wider text-primary mb-1">
                    Do this
                  </div>
                  <div className="text-lg font-semibold text-white">
                    My Picks
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {liveCard === false && isCommish
                      ? "No card live yet — publish first (tile below), then lock your own picks."
                      : "Lock the card before kickoff. That is the weekly job."}
                  </p>
                </Link>
                <Link
                  href="/locker-room"
                  className="group rounded-xl border border-orange-400/30 bg-black/40 p-5 hover:border-orange-300/60 transition"
                >
                  <div className="text-xs uppercase tracking-wider text-orange-300/70 mb-1">
                    While you wait
                  </div>
                  <div className="text-lg font-semibold text-orange-300">
                    Locker Room
                  </div>
                </Link>
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
              </>
            )}
          </section>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-3 font-semibold">
              The rest of the room
            </p>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Link
                href="/standings"
                className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
              >
      <div className="text-xs uppercase tracking-wider text-muted mb-2">
                  Who&apos;s winning
                </div>
      <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                  Standings
                </div>
      <p className="text-sm text-muted mt-2">
                  Season points · divisions · cut line · last in
                </p>
      </Link>

              <Link
                href="/board"
                className="group rounded-xl border border-border/80 bg-black/40 backdrop-blur-sm p-6 hover:border-primary/50 hover:bg-primary/5 transition shadow-[0_0_40px_rgba(0,0,0,0.35)]"
              >
      <div className="text-xs uppercase tracking-wider text-muted mb-2">
                  Card reveal
                </div>
      <div className="text-lg font-semibold text-white group-hover:text-primary transition">
                  The Board
                </div>
      <p className="text-sm text-muted mt-2">
                  Everyone&apos;s picks · game by game after kickoff
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
                    Commish posts · milk cartons · room updates
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

        {/* ── BOTTOM: recruiting (after the job + room) ── */}
        {showSecondary && !firstWeekChrome && (
          <div className="mt-5 mb-2">
      <InviteFriends />
          </div>
        )}
      </main>
      </div>
  );
}
