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
import GazetteModal from "@/components/GazetteModal";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import SeasonCountdownTicker from "@/components/SeasonCountdownTicker";
import SeasonOpenWelcome from "@/components/SeasonOpenWelcome";
import GuestDemoChrome from "@/components/GuestDemoChrome";
import GuestOnboarding from "@/components/GuestOnboarding";
import PlayerWalkthrough from "@/components/PlayerWalkthrough";
import RingCeremonyModal from "@/components/RingCeremonyModal";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [crystalBallOn, setCrystalBallOn] = useState(true);
  const [playerPreview, setPlayerPreview] = useState(false);

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
    const session = getSession();
    const league = getLeague();
    refreshRoles();
    setName(session?.playerName || "You");
    setPlayerId(session?.playerId || null);
    setLeagueName(league?.name || "");
    setCrystalBallOn(league?.settings?.crystalBallEnabled !== false);

    void refreshStaffSessionFlags().then(() => {
      refreshRoles();
    });

    function onPreview() {
      refreshRoles();
    }
    window.addEventListener("warroom-view-as-player", onPreview);
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
        const [ann, lock] = await Promise.all([
          countUnreadAnnouncements(),
          countUnseenLockerPosts(),
        ]);
        setUnreadCount(ann);
        setLockerUnseen(lock);
      } catch {
        setUnreadCount(0);
        setLockerUnseen(0);
      }
    }

    void loadUnread();
    function onVis() {
      if (document.visibilityState === "visible") void loadUnread();
    }
    function onLockerSeen() {
      // Instant clear — walking into locker marks seen without extra taps
      setLockerUnseen(0);
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
    return () => {
      window.removeEventListener("warroom-view-as-player", onPreview);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
    // On locker route: badge off immediately (mark runs on the page too)
    if (pathname === "/locker-room" || pathname.startsWith("/locker-room/")) {
      setLockerUnseen(0);
    } else {
      // Leaving locker / navigating elsewhere — refresh counts
      void countUnseenLockerPosts().then(setLockerUnseen).catch(() => {});
      void countUnreadAnnouncements().then(setUnreadCount).catch(() => {});
    }
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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

  // Primary: home first, then weekly habit loop
  const primaryLinks: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/picks", label: "My Picks" },
    { href: "/standings", label: "Standings" },
    { href: "/locker-room", label: "Locker", badge: lockerUnseen },
    { href: "/gazette", label: "Gazette" },
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

  // More: flavor + depth (still all there)
  const moreLinks: NavLink[] = [
    ...(crystalBallOn
      ? [{ href: "/crystal-ball", label: "Crystal Ball" }]
      : []),
    { href: "/stats", label: "Stats" },
    { href: "/announcements", label: "News", badge: unreadCount },
    { href: "/players", label: "Players" },
    { href: "/rules", label: "Rules" },
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
      href: "/museum",
      label: "Museum",
      className: "text-amber-300 hover:text-amber-200",
    },
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

  function NavItem({ link }: { link: NavLink }) {
    const isHome = link.href === "/";
    const active = linkActive(link.href);
    return (
      <Link
        href={link.href}
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
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 min-w-0 max-w-[10rem] sm:max-w-[12rem] rounded-md hover:opacity-90 transition"
            title="Back to Home"
            aria-label="Home"
          >
            <div className="w-8 h-8 shrink-0 rounded bg-primary flex items-center justify-center font-bold text-black text-sm">
              WR
            </div>
            <div className="flex flex-col min-w-0">
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
              <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
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
              className="md:hidden relative p-2 -mr-1 rounded-md text-muted hover:text-foreground hover:bg-card-hover transition"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
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

        {menuOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 top-14 z-40 bg-black/60"
              aria-hidden
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="mobile-nav-menu"
              className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-border bg-card shadow-xl max-h-[calc(100dvh-3.5rem)] overflow-y-auto"
            >
              {playerPreview && (
                <div className="px-4 pt-3 pb-2">
                  <button
                    type="button"
                    onClick={exitPlayerView}
                    className="w-full py-3 rounded-xl bg-warning text-black text-sm font-extrabold uppercase tracking-wide"
                  >
                    Exit → Home (Commish)
                  </button>
                </div>
              )}
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted font-semibold">
                Main
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
                        className={`flex items-center justify-between gap-3 px-4 py-3 transition ${
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
                More of the room
              </p>
              <ul className="py-1 pb-2">
                {moreLinks.map((link) => {
                  const active = linkActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition ${
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
      </header>
      {playerPreview && (
        <div className="sticky top-14 z-[45] border-b-2 border-warning bg-warning text-black">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-bold">
              PLAYER VIEW — Exit returns you to Home as Commish.
            </p>
            <button
              type="button"
              onClick={exitPlayerView}
              className="shrink-0 px-4 py-2 rounded-lg bg-black text-warning text-xs sm:text-sm font-extrabold uppercase tracking-wide hover:bg-black/90"
            >
              Exit → Home
            </button>
          </div>
        </div>
      )}
      {/* Floating exit — always visible while scrolling any page */}
      {playerPreview && (
        <button
          type="button"
          onClick={exitPlayerView}
          className="fixed bottom-5 right-4 z-[60] px-4 py-3 rounded-full bg-warning text-black text-xs sm:text-sm font-extrabold uppercase tracking-wide shadow-[0_4px_24px_rgba(0,0,0,0.45)] border-2 border-black/20 hover:scale-[1.03] active:scale-[0.98] transition"
        >
          Exit → Home
        </button>
      )}
      {/* Guest demo: sticky DEMO bar + welcome / role / tutorial */}
      <GuestDemoChrome />
      <GuestOnboarding />
      {/* Real account: Crystal Ball + picks walk-the-dog coach */}
      <PlayerWalkthrough />
      {/* Until Aug 23 00:01 ET: countdown. After: ticker gone; one-time welcome splash */}
      {!isGuestMode() && <SeasonCountdownTicker />}
      {!isGuestMode() && <SeasonOpenWelcome />}
      {!isGuestMode() && <RingCeremonyModal />}
      {!isGuestMode() && <RulesOnboardingModal />}
      <GazetteModal />
      <BadgeUnlockModal />
    </>
  );
}
