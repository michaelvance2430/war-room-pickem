"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getSession,
  getLeague,
  isStaff,
  isOps,
  isCommissioner,
  isActuallyCommissioner,
} from "@/lib/league";
import Avatar from "@/components/Avatar";
import RulesOnboardingModal from "@/components/RulesOnboardingModal";
import LoginWelcomeModal from "@/components/LoginWelcomeModal";
import GazetteModal from "@/components/GazetteModal";
import GazetteShelfReveal from "@/components/GazetteShelfReveal";
import StoryDoorModal from "@/components/StoryDoorModal";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import SeasonCountdownTicker from "@/components/SeasonCountdownTicker";
import SeasonOpenWelcome from "@/components/SeasonOpenWelcome";
import GuestDemoChrome from "@/components/GuestDemoChrome";
import GuestOnboarding from "@/components/GuestOnboarding";
import PlayerWalkthrough from "@/components/PlayerWalkthrough";
import RingCeremonyModal from "@/components/RingCeremonyModal";
import SeasonFinaleModal from "@/components/SeasonFinaleModal";
import CardPublishedModal from "@/components/CardPublishedModal";
import BoredPracticeDoneModal from "@/components/BoredPracticeDoneModal";
import WeeklyColdOpenModal from "@/components/WeeklyColdOpenModal";
import BirthdayGazetteModal from "@/components/BirthdayGazetteModal";
import PlatformAnniversaryModal from "@/components/PlatformAnniversaryModal";
import JoinBadgeHydrator from "@/components/JoinBadgeHydrator";
import EquippedTitleHydrator from "@/components/EquippedTitleHydrator";
import ProfileBorderHydrator from "@/components/ProfileBorderHydrator";
import EasterEggHost from "@/components/EasterEggHost";
import EggFlexNewspaper from "@/components/EggFlexNewspaper";
import MascotSighting from "@/components/MascotSighting";
import LeagueBuildLockReminder from "@/components/LeagueBuildLockReminder";
import CrewRevealModal from "@/components/CrewRevealModal";
import { touchLastSeen } from "@/lib/last-seen";
import { loadMyProfile } from "@/lib/profile";
import { isGuestMode } from "@/lib/guest-mode";
import { refreshStaffSessionFlags } from "@/lib/cloud";
import {
  isViewAsPlayer,
  setViewAsPlayer,
} from "@/lib/view-as-player";
import {
  countUnreadAnnouncements,
  countUnseenLockerPosts,
  EVENT_LOCKER_SEEN,
} from "@/lib/room-unseen";
import { sanitizeLegacyLegendsOnBoot } from "@/lib/legacy-badge-grants";
import { nukeAccumulatedSandboxCareersOnce } from "@/lib/sandbox-wipe";
import BrandMark from "@/components/BrandMark";
import { normalizeSportId } from "@/lib/sports/registry";
import { SPORT_THEME_EVENT } from "@/lib/sports/sport-theme";
import {
  EVENT_PROGRESSIVE,
  loadProgressiveSnapshot,
} from "@/lib/progressive-disclosure";

type NavLink = {
  href: string;
  label: string;
  className?: string;
  badge?: number;
};

/**
 * Slim primary nav = what you need every week.
 * Everything else lives under More (flavor intact, less overwhelm).
 */
export default function Nav() {
  const pathname = usePathname();
  const [isCommish, setIsCommish] = useState(false);
  const [ops, setOps] = useState(false);
  const [staff, setStaff] = useState(false);
  const [name, setName] = useState("You");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [lockerUnseen, setLockerUnseen] = useState(0);
  const [gazetteUnseen, setGazetteUnseen] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [crystalBallOn, setCrystalBallOn] = useState(true);
  const [sportIsWwc, setSportIsWwc] = useState(false);
  const [sportIsNfl, setSportIsNfl] = useState(false);
  const [playerPreview, setPlayerPreview] = useState(false);
  /** Progressive disclosure — Gazette shelf after ~week 3 */
  const [showGazetteNav, setShowGazetteNav] = useState(true);
  const [showNewsNav, setShowNewsNav] = useState(true);
  const [earlyNav, setEarlyNav] = useState(false);
  const [sandboxOn, setSandboxOn] = useState(false);
  const [eyesLabel, setEyesLabel] = useState("");

  function refreshRoles() {
    setIsCommish(isCommissioner());
    setOps(isOps());
    setStaff(isStaff());
    setPlayerPreview(isViewAsPlayer() && isActuallyCommissioner());
  }

  function exitPlayerView() {
    setViewAsPlayer(false);
    refreshRoles();
    setMenuOpen(false);
    setMoreOpen(false);
    // Leave current page → Home as commissioner (invite code, hero, tiles)
    window.location.href = "/";
  }

  useEffect(() => {
    function syncProgressive() {
      if (isGuestMode()) {
        setShowGazetteNav(true);
        setShowNewsNav(true);
        setEarlyNav(false);
        setSandboxOn(false);
        setEyesLabel("");
        return;
      }
      void loadProgressiveSnapshot().then((snap) => {
        setShowGazetteNav(snap.showGazetteShelf);
        setShowNewsNav(snap.showNewsShelf);
        setEarlyNav(snap.firstWeekChrome);
        void import("@/lib/creator-eyes").then((m) => {
          const mode = m.getCreatorEyesMode();
          setEyesLabel(mode === "off" ? "" : m.creatorEyesLabel(mode));
          // Eyes banner wins over generic sandbox strip
          setSandboxOn(mode === "off" && !!snap.sandbox);
        });
      });
    }
    syncProgressive();
    window.addEventListener(EVENT_PROGRESSIVE, syncProgressive);
    window.addEventListener("warroom-first-week-progress", syncProgressive);
    window.addEventListener("warroom-creator-sandbox", syncProgressive);
    window.addEventListener("warroom-creator-eyes", syncProgressive);
    return () => {
      window.removeEventListener(EVENT_PROGRESSIVE, syncProgressive);
      window.removeEventListener("warroom-first-week-progress", syncProgressive);
      window.removeEventListener("warroom-creator-sandbox", syncProgressive);
      window.removeEventListener("warroom-creator-eyes", syncProgressive);
    };
  }, [pathname]);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    refreshRoles();
    setName(session?.playerName || "You");
    setPlayerId(session?.playerId || null);
    setLeagueName(league?.name || "");
    const sid = normalizeSportId(league?.sportId);
    setSportIsWwc(sid === "soccer_wwc");
    setSportIsNfl(sid === "nfl");
    setCrystalBallOn(league?.settings?.crystalBallEnabled !== false);

    void refreshStaffSessionFlags().then(() => {
      refreshRoles();
    });

    function onPreview() {
      refreshRoles();
    }
    function onSportTheme() {
      const sid = normalizeSportId(getLeague()?.sportId);
      setSportIsWwc(sid === "soccer_wwc");
      setSportIsNfl(sid === "nfl");
    }
    window.addEventListener("warroom-view-as-player", onPreview);
    window.addEventListener(SPORT_THEME_EVENT, onSportTheme);
    // cleanup below after unread load setup

    loadMyProfile().then((p) => {
      if (p) {
        setName(p.displayName);
        setAvatarUrl(p.avatarUrl);
        // Hard-scrub mistaken Legend (e.g. Visconti) even if they only open Commish
        sanitizeLegacyLegendsOnBoot({
          playerId: p.id || session?.playerId,
          playerName: p.displayName || session?.playerName,
        });
      } else if (session?.playerId) {
        sanitizeLegacyLegendsOnBoot({
          playerId: session.playerId,
          playerName: session.playerName,
        });
      }
    });

    function onProfileUpdated(e: Event) {
      const detail = (e as CustomEvent<{ displayName?: string }>).detail;
      if (detail?.displayName) setName(detail.displayName);
      else {
        void loadMyProfile().then((p) => {
          if (p) {
            setName(p.displayName);
            setAvatarUrl(p.avatarUrl);
          }
        });
      }
    }
    window.addEventListener("warroom-profile-updated", onProfileUpdated);
    // Immediate pass from session (before profile returns)
    if (session?.playerId) {
      sanitizeLegacyLegendsOnBoot({
        playerId: session.playerId,
        playerName: session.playerName,
      });
    }
    // One-time scrub of sim career points for everyone banked on this browser
    try {
      nukeAccumulatedSandboxCareersOnce(
        session?.playerId ? [session.playerId] : undefined
      );
    } catch {
      /* ignore */
    }

    async function loadUnread() {
      if (!session?.playerId || !league?.id) return;
      try {
        const [ann, lock, gaz] = await Promise.all([
          countUnreadAnnouncements(),
          countUnseenLockerPosts(),
          import("@/lib/gazette").then((m) => m.getGazetteUnreadState()),
        ]);
        setUnreadCount(ann);
        setLockerUnseen(lock);
        setGazetteUnseen(gaz.unread ? 1 : 0);
      } catch {
        setUnreadCount(0);
        setLockerUnseen(0);
        setGazetteUnseen(0);
      }
    }

    void loadUnread();
    // Presence: last logged in / last open (throttled write)
    if (!isGuestMode()) {
      void touchLastSeen();
    }
    function onVis() {
      if (document.visibilityState === "visible") {
        void loadUnread();
        if (!isGuestMode()) void touchLastSeen();
      }
    }
    function onGazetteSeen() {
      setGazetteUnseen(0);
    }
    window.addEventListener("warroom-gazette-seen", onGazetteSeen);
    function onLockerSeen() {
      // Instant clear — walking into locker marks seen without extra taps
      setLockerUnseen(0);
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
    return () => {
      window.removeEventListener("warroom-view-as-player", onPreview);
      window.removeEventListener(SPORT_THEME_EVENT, onSportTheme);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
      window.removeEventListener("warroom-gazette-seen", onGazetteSeen);
      window.removeEventListener("warroom-profile-updated", onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    // Hard switch: close sheets + never leave body scroll locked
    setMenuOpen(false);
    setMoreOpen(false);
    try {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    } catch {
      /* ignore */
    }
    // On locker route: badge off immediately (mark runs on the page too)
    if (pathname === "/locker-room" || pathname.startsWith("/locker-room/")) {
      setLockerUnseen(0);
      return;
    }
    if (pathname === "/gazette" || pathname.startsWith("/gazette/")) {
      setGazetteUnseen(0);
      return;
    }
    // Throttle badge refreshes — every route used to fire 3 network calls
    // and made tab switches feel laggy on phone.
    const now = Date.now();
    const last = (window as unknown as { __wrNavUnreadAt?: number })
      .__wrNavUnreadAt;
    if (last != null && now - last < 8_000) return;
    (window as unknown as { __wrNavUnreadAt?: number }).__wrNavUnreadAt = now;
    void countUnseenLockerPosts().then(setLockerUnseen).catch(() => {});
    void countUnreadAnnouncements().then(setUnreadCount).catch(() => {});
    void import("@/lib/gazette")
      .then((m) => m.getGazetteUnreadState())
      .then((g) => setGazetteUnseen(g.unread ? 1 : 0))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      try {
        document.body.style.overflow = "";
      } catch {
        /* ignore */
      }
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMoreOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, moreOpen]);

  // Phone row (locked in): Home · Picks · Standings · Locker · More
  // Desktop primary: same core; Board/Gazette/Host expand after first lock.
  const primaryLinks: NavLink[] = earlyNav
    ? [
        { href: "/", label: "Home" },
        { href: "/picks", label: "Picks" },
        { href: "/standings", label: "Standings" },
        { href: "/locker-room", label: "Locker", badge: lockerUnseen },
        ...(ops
          ? [
              {
                href: "/commissioner",
                label: isCommish ? "Commish" : "Ops",
                className: "text-primary",
              } as NavLink,
            ]
          : []),
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/picks", label: "Picks" },
        { href: "/standings", label: "Standings" },
        { href: "/locker-room", label: "Locker", badge: lockerUnseen },
        { href: "/board", label: "The Board" },
        ...(showGazetteNav
          ? [
              {
                href: "/gazette",
                label: "Gazette",
                badge: gazetteUnseen,
              } as NavLink,
            ]
          : []),
        ...(ops
          ? [
              {
                href: "/commissioner",
                label: isCommish ? "Commish" : "Ops",
                className: "text-primary",
              } as NavLink,
            ]
          : []),
      ];

  // More: first hour = rules + account only (Board waits until first lock).
  const moreLinks: NavLink[] = earlyNav
    ? [
        { href: "/rules", label: "How to play" },
        {
          href: "/crew",
          label: "Crew",
          className: "text-amber-300/80 hover:text-amber-200",
        },
        { href: "/account", label: "Account" },
      ]
    : [
        ...(crystalBallOn
          ? [{ href: "/crystal-ball", label: "Crystal Ball" }]
          : []),
        { href: "/stats", label: "Stats" },
        ...(showNewsNav
          ? [
              {
                href: "/announcements",
                label: "News",
                badge: unreadCount,
              } as NavLink,
            ]
          : []),
        { href: "/players", label: "Players" },
        { href: "/championship", label: "Champ" },
        {
          href: "/toilet-bowl",
          label: "Toilet",
          className: "text-toilet hover:text-toilet",
        },
        {
          href: "/trophy-room",
          label: "Trophies",
          className: "text-amber-300 hover:text-amber-200",
        },
        {
          href: "/crew",
          label: "Crew",
          className: "text-amber-300 hover:text-amber-200",
        },
        {
          href: "/museum",
          label: "Museum",
          className: "text-amber-300 hover:text-amber-200",
        },
        { href: "/rules", label: "How to play" },
        ...(staff
          ? [
              {
                href: "/moderation",
                label: "Mod",
                className: "text-amber-300 hover:text-amber-200",
              } as NavLink,
            ]
          : []),
        { href: "/account", label: "Account" },
      ];

  const allMobileLinks = [...primaryLinks, ...moreLinks];

  const moreActive = moreLinks.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );
  const moreBadge = moreLinks.reduce((n, l) => n + (l.badge || 0), 0);

  function linkActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function UnreadBadge({
    count,
    className = "",
  }: {
    count: number;
    className?: string;
  }) {
    if (count <= 0) return null;
    return (
      <span
        className={`min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold inline-flex items-center justify-center ${className}`}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  function closeChrome() {
    setMenuOpen(false);
    setMoreOpen(false);
    try {
      document.body.style.overflow = "";
    } catch {
      /* ignore */
    }
  }

  function NavItem({ link }: { link: NavLink }) {
    const isHome = link.href === "/";
    const active = linkActive(link.href);
    return (
      <Link
        href={link.href}
        onClick={closeChrome}
        className={`transition relative whitespace-nowrap shrink-0 ${
          isHome
            ? `text-[15px] sm:text-base font-extrabold tracking-tight ${
                active
                  ? "text-primary"
                  : "text-primary/90 hover:text-primary"
              }`
            : `hover:text-foreground ${link.className || ""} ${
                active ? "text-foreground font-medium" : ""
              }`
        }`}
      >
        {link.label}
        {link.badge != null && link.badge > 0 && (
          <span className="absolute -top-2 -right-2.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-primary text-black text-[9px] font-bold flex items-center justify-center">
            {link.badge > 99 ? "99+" : link.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {eyesLabel ? (
        <div className="bg-sky-400 text-black text-[11px] font-bold text-center py-1.5 px-3 sticky top-0 z-[60]">
          {eyesLabel} · PREVIEW (local card · not real standings) ·{" "}
          <Link href="/picks" className="underline">
            picks
          </Link>
          {" · "}
          <Link href="/founder" className="underline">
            founder
          </Link>
          {" · "}
          <button
            type="button"
            className="underline font-extrabold"
            onClick={() => {
              void import("@/lib/creator-eyes").then((m) => {
                m.setCreatorEyesMode("off");
                setEyesLabel("");
                // Land on Foundry eyes desk so you can switch previews quickly
                window.location.href = "/founder#eyes";
              });
            }}
          >
            exit → Foundry
          </button>
        </div>
      ) : sandboxOn ? (
        <div className="bg-amber-500 text-black text-[11px] font-bold text-center py-1.5 px-3 sticky top-0 z-[60]">
          CREATOR TEST MODE — progressive knobs active ·{" "}
          <Link href="/founder/test-mode" className="underline">
            open lab
          </Link>
        </div>
      ) : null}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 min-w-0 max-w-[11rem] sm:max-w-[14rem] rounded-md hover:opacity-90 transition"
            title="Back to Home"
            aria-label="Home"
          >
            <BrandMark size={36} className="shrink-0" variant="force" />
            <div className="flex flex-col min-w-0 justify-center">
              {sportIsWwc ? (
                <>
                  <span className="font-bold text-sm text-foreground tracking-tight leading-tight truncate">
                    {pathname === "/" ? "War Room" : "← Home"}
                  </span>
                  <span className="text-[10px] font-semibold text-white/90 leading-tight truncate">
                    Women&apos;s World Cup
                  </span>
                  <span
                    className="text-[10px] font-bold leading-tight truncate"
                    style={{ color: "#FFDF00" }}
                  >
                    Brazil 2027
                  </span>
                </>
              ) : sportIsNfl ? (
                <>
                  <span className="font-bold text-sm text-foreground tracking-tight leading-tight truncate">
                    {pathname === "/" ? "War Room" : "← Home"}
                  </span>
                  <span className="text-[10px] font-semibold text-white/90 leading-tight truncate">
                    Pro Football
                  </span>
                  <span
                    className="text-[10px] font-bold leading-tight truncate"
                    style={{ color: "#C5CCD3" }}
                  >
                    Sunday
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`tracking-tight leading-tight truncate ${
                      pathname === "/"
                        ? "font-bold text-sm text-foreground"
                        : "font-extrabold text-[15px] sm:text-base text-primary"
                    }`}
                  >
                    {pathname === "/" ? "War Room" : "← Home"}
                  </span>
                  {leagueName && (
                    <span className="text-[10px] text-muted leading-tight truncate hidden sm:block">
                      {leagueName}
                    </span>
                  )}
                </>
              )}
            </div>
          </Link>

          {/* Desktop: primary + More */}
          <nav className="hidden md:flex flex-1 items-center justify-end gap-x-3 text-[13px] text-muted min-w-0">
            {playerPreview && (
              <button
                type="button"
                onClick={exitPlayerView}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-warning text-black text-xs font-extrabold uppercase tracking-wide hover:opacity-90 shadow-[0_0_12px_rgba(234,179,8,0.35)]"
              >
                Exit player view
              </button>
            )}
            {primaryLinks.map((link) => (
              <NavItem key={link.href} link={link} />
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={`hover:text-foreground transition whitespace-nowrap ${
                  moreActive || moreOpen ? "text-foreground font-medium" : ""
                }`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                More
                {moreBadge > 0 && (
                  <span className="ml-1 inline-flex min-w-[16px] h-[16px] px-0.5 rounded-full bg-primary text-black text-[9px] font-bold items-center justify-center align-middle">
                    {moreBadge > 99 ? "99+" : moreBadge}
                  </span>
                )}
                <span className="ml-0.5 text-[10px] opacity-70">▾</span>
              </button>
              {moreOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close more menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-card shadow-xl py-1">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-card-hover transition ${
                          linkActive(link.href)
                            ? "text-foreground font-medium"
                            : "text-muted"
                        } ${link.className || ""}`}
                      >
                        <span>{link.label}</span>
                        {link.badge != null && link.badge > 0 && (
                          <UnreadBadge count={link.badge} />
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto md:ml-2">
            {playerPreview && (
              <button
                type="button"
                onClick={exitPlayerView}
                className="md:hidden shrink-0 px-2.5 py-1.5 rounded-lg bg-warning text-black text-[11px] font-extrabold uppercase tracking-wide"
              >
                Exit
              </button>
            )}
            <Link
              href={playerId ? `/profile/${playerId}` : "/account"}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
              title="Your profile & badges"
            >
              <Avatar
                name={name}
                avatarUrl={avatarUrl}
                size="sm"
                userId={playerId}
              />
              <span className="hidden sm:inline">
                {name}
                {playerPreview && (
                  <span className="ml-1 text-xs text-warning">(Player view)</span>
                )}
                {isCommish && !playerPreview && (
                  <span className="ml-1 text-xs text-primary">(Commish)</span>
                )}
                {!isCommish && ops && (
                  <span className="ml-1 text-xs text-primary">(Deputy)</span>
                )}
              </span>
            </Link>

            <button
              type="button"
              className="md:hidden relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-card-hover transition touch-manipulation"
              aria-label={menuOpen ? "Close menu" : "More menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
              {!menuOpen && unreadCount + lockerUnseen > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-black text-[9px] font-bold flex items-center justify-center">
                  {unreadCount + lockerUnseen > 99
                    ? "99+"
                    : unreadCount + lockerUnseen}
                </span>
              )}
            </button>
          </div>
        </div>

      </header>

      {/* Phone: More sheet from the bottom (thumb zone) */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[55] bg-black/65 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav-menu"
            className="md:hidden fixed left-0 right-0 bottom-0 z-[60] rounded-t-2xl border-t border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.5)] max-h-[min(78dvh,640px)] overflow-y-auto overscroll-contain pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="sticky top-0 bg-card/95 backdrop-blur pt-2 pb-1 border-b border-border z-10">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between px-4 pb-2">
                <p className="text-sm font-bold">More of the room</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="text-xs font-semibold text-muted hover:text-foreground min-h-[40px] px-2"
                >
                  Close
                </button>
              </div>
            </div>
            {playerPreview && (
              <div className="px-4 pt-3 pb-2">
                <button
                  type="button"
                  onClick={exitPlayerView}
                  className="w-full py-3.5 rounded-xl bg-warning text-black text-sm font-extrabold uppercase tracking-wide min-h-[48px]"
                >
                  Exit → Home (Commish)
                </button>
              </div>
            )}
            <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted font-semibold">
              Weekly
            </p>
            <ul className="pb-1">
              {primaryLinks.map((link) => {
                const active = linkActive(link.href);
                const isHome = link.href === "/";
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between gap-3 px-4 min-h-[48px] transition touch-manipulation ${
                        isHome
                          ? `text-lg font-extrabold ${
                              active
                                ? "bg-primary/15 text-primary"
                                : "text-primary hover:bg-primary/10"
                            }`
                          : `text-base ${
                              active
                                ? "bg-card-hover text-foreground"
                                : "text-muted hover:bg-card-hover hover:text-foreground"
                            } ${link.className || ""}`
                      }`}
                    >
                      <span className={isHome ? "font-extrabold" : "font-medium"}>
                        {link.label}
                      </span>
                      {link.badge != null && link.badge > 0 && (
                        <UnreadBadge count={link.badge} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted font-semibold border-t border-border">
              Everything else
            </p>
            <ul className="py-1 pb-3">
              {moreLinks.map((link) => {
                const active = linkActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between gap-3 px-4 min-h-[48px] text-base transition touch-manipulation ${
                        active
                          ? "bg-card-hover text-foreground"
                          : "text-muted hover:bg-card-hover hover:text-foreground"
                      } ${link.className || ""}`}
                    >
                      <span className="font-medium">{link.label}</span>
                      {link.badge != null && link.badge > 0 && (
                        <UnreadBadge count={link.badge} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      {/* Phone thumb nav — always: Home · Picks · Standings · Locker · More */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary"
      >
        <ul className="grid h-[3.75rem] grid-cols-5">
          {(
            [
              { href: "/", label: "Home", icon: "⌂" },
              { href: "/picks", label: "Picks", icon: "✓" },
              { href: "/standings", label: "Standings", icon: "#" },
              { href: "/locker-room", label: "Locker", icon: "💬" },
            ] as const
          ).map((tab) => {
            const active = linkActive(tab.href);
            const badge =
              tab.href === "/locker-room"
                ? lockerUnseen
                : primaryLinks.find((p) => p.href === tab.href)?.badge || 0;
            return (
              <li key={tab.href} className="min-w-0">
                <Link
                  href={tab.href}
                  onClick={closeChrome}
                  className={`relative flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-semibold touch-manipulation transition ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <span
                    className={`text-lg leading-none ${active ? "scale-110" : ""}`}
                    aria-hidden
                  >
                    {tab.icon}
                  </span>
                  <span className="truncate max-w-full px-0.5">{tab.label}</span>
                  {badge > 0 && (
                    <span className="absolute top-1.5 right-[18%] min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-black text-[8px] font-bold flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`relative flex flex-col items-center justify-center h-full w-full gap-0.5 text-[10px] font-semibold touch-manipulation transition ${
                menuOpen || moreActive ? "text-primary" : "text-muted"
              }`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
            >
              <span className="text-lg leading-none" aria-hidden>
                ☰
              </span>
              <span>More</span>
              {moreBadge > 0 && !menuOpen && (
                <span className="absolute top-1.5 right-[18%] min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-black text-[8px] font-bold flex items-center justify-center">
                  {moreBadge > 9 ? "9+" : moreBadge}
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>

      {playerPreview && (
        <div className="sticky top-14 z-[45] border-b-2 border-warning bg-warning text-black">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-bold">
              PLAYER VIEW — Exit returns you to Home as Commish.
            </p>
            <button
              type="button"
              onClick={exitPlayerView}
              className="shrink-0 px-4 py-2 rounded-lg bg-black text-warning text-xs sm:text-sm font-extrabold uppercase tracking-wide hover:bg-black/90 min-h-[44px]"
            >
              Exit → Home
            </button>
          </div>
        </div>
      )}
      {/* Floating exit — above phone tab bar */}
      {playerPreview && (
        <button
          type="button"
          onClick={exitPlayerView}
          className="fixed right-4 z-[60] px-4 py-3 rounded-full bg-warning text-black text-xs sm:text-sm font-extrabold uppercase tracking-wide shadow-[0_4px_24px_rgba(0,0,0,0.45)] border-2 border-black/20 hover:scale-[1.03] active:scale-[0.98] transition bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-5"
        >
          Exit → Home
        </button>
      )}
      {/* Guest demo: sticky DEMO bar + welcome / role / tutorial */}
      <GuestDemoChrome />
      <GuestOnboarding />
      {/* Day before open: last chance to edit League Build */}
      {!isGuestMode() && <LeagueBuildLockReminder />}
      {/* After first finale: one-time Crew story reveal (not Gazette) */}
      {!isGuestMode() && <CrewRevealModal />}
      {/* Real account: Crystal Ball + picks walk-the-dog coach */}
      <PlayerWalkthrough />
      {/* Until Aug 23 00:01 ET: countdown. After: ticker gone; one-time welcome splash */}
      {!isGuestMode() && <SeasonCountdownTicker />}
      {!isGuestMode() && <SeasonOpenWelcome />}
      {!isGuestMode() && <RingCeremonyModal />}
      {/* End-of-season: who won champ / toilet / nerd — once per player when engraved */}
      {!isGuestMode() && <SeasonFinaleModal />}
      {/* After host publishes a card — celebrate + share + player view */}
      {!isGuestMode() && <CardPublishedModal />}
      {!isGuestMode() && <BoredPracticeDoneModal />}
      {!isGuestMode() && <JoinBadgeHydrator />}
      {!isGuestMode() && <EquippedTitleHydrator />}
      {!isGuestMode() && <ProfileBorderHydrator />}
      {!isGuestMode() && <WeeklyColdOpenModal />}
      {/* One Year Older · 1st of month · locked birthdays → roast paper for the room */}
      {!isGuestMode() && <BirthdayGazetteModal />}
      {/* War Room Anniversary · July 25 founding day · every league */}
      {!isGuestMode() && <PlatformAnniversaryModal />}
      {!isGuestMode() && <LoginWelcomeModal />}
      {!isGuestMode() && <RulesOnboardingModal />}
      <GazetteModal />
      <GazetteShelfReveal />
      <StoryDoorModal />
      <BadgeUnlockModal />
      {/* Easter eggs — discoverable, zero points, never a secret menu */}
      {!isGuestMode() && <EasterEggHost />}
      {!isGuestMode() && <EggFlexNewspaper />}
      {!isGuestMode() && <MascotSighting />}
    </>
  );
}
