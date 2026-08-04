"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getSession,
  getLeague,
  isStaff,
  isOps,
  isCommissioner,
  isActuallyCommissioner,
} from "@/lib/league";
import Avatar from "@/components/Avatar";
import DeferredChromeGate from "@/components/DeferredChromeGate";
import GuestDemoChrome from "@/components/GuestDemoChrome";
import GuestOnboarding from "@/components/GuestOnboarding";
import { touchLastSeen } from "@/lib/last-seen";
import { loadMyProfile } from "@/lib/profile";
import { isGuestMode } from "@/lib/guest-mode";
import {
  isViewAsPlayer,
  setViewAsPlayer,
} from "@/lib/view-as-player";
import {
  countUnreadAnnouncements,
  countUnseenLockerPosts,
  EVENT_LOCKER_SEEN,
  EVENT_ANNOUNCEMENTS_SEEN,
} from "@/lib/room-unseen";
import BrandMark from "@/components/BrandMark";
import { normalizeSportId } from "@/lib/sports/registry";
import { SPORT_THEME_EVENT } from "@/lib/sports/sport-theme";
import {
  EVENT_PROGRESSIVE,
  loadProgressiveSnapshot,
} from "@/lib/progressive-disclosure";
import { prepareNavigation, PRIMARY_ROUTES } from "@/lib/smooth";
import {
  wrMount,
  wrEffect,
  wrLog,
  isoEnabled,
  wrProfileRoute,
} from "@/lib/runtime-iso";



/** Production: never arm deferred chrome (no mount, no import of wave tree). */
const PRODUCTION_DEFERRED_SAFE = process.env.NODE_ENV === "production";

type NavLink = {
  href: string;
  label: string;
  className?: string;
  badge?: number;
};

/**
 * Bottom nav / desktop primary = play the game.
 * Hamburger / More = manage yourself (account, help) — never a second nav bar.
 */
export default function Nav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/profile")) {
    wrProfileRoute("Nav.render", pathname);
  }
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
  /** Phone More sheet scroll body — always open at top, never mid-list */
  const moreSheetScrollRef = useRef<HTMLDivElement>(null);
  const [sportIsWwc, setSportIsWwc] = useState(false);
  const [sportIsNfl, setSportIsNfl] = useState(false);
  const [playerPreview, setPlayerPreview] = useState(false);
  /** Progressive disclosure — Gazette shelf after ~week 3 */
  const [showGazetteNav, setShowGazetteNav] = useState(true);
  const [showNewsNav, setShowNewsNav] = useState(true);
  const [earlyNav, setEarlyNav] = useState(false);
  const [eyesLabel, setEyesLabel] = useState("");
  /** Heavy chrome (modals/hydrators) after first paint */
  const [deferredReady, setDeferredReady] = useState(false);
  /**
   * Isolation flags — DEFAULTS only on first render (SSR + hydrate match).
   * localStorage warroom-iso applied after mount.
   */
  const [allowDeferred, setAllowDeferred] = useState(true);
  const [allowProgressive, setAllowProgressive] = useState(true);

  useEffect(() => {
    setAllowDeferred(isoEnabled("deferred"));
    setAllowProgressive(isoEnabled("navProgressive"));
    // P0 recovery: kill orphan body locks / stuck modal chrome so the app is clickable
    try {
      void import("@/lib/smooth").then((m) => {
        m.forceUnlockAllChrome();
      });
    } catch {
      /* ok */
    }
    return wrMount("Nav");
  }, []);

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

  // Deferred chrome once — Nav is layout-persistent so this no longer re-runs
  // on every tab (that remount storm made every screen stick).
  // PRODUCTION SAFE MODE: never arm — DeferredChromeGate stays null / no import.
  useEffect(() => {
    if (PRODUCTION_DEFERRED_SAFE) {
      wrLog("[WR-DEFERRED]", "production safe mode — disabled (Nav arm skipped)");
      return;
    }
    if (!allowDeferred) {
      wrLog("[WR-DEFERRED]", "Nav deferred chrome disabled by iso");
      return;
    }
    if (deferredReady) return;
    wrEffect("Nav.armDeferred");
    let cancelled = false;
    const arm = () => {
      if (!cancelled) {
        wrLog("[WR-DEFERRED]", "deferredReady=true");
        setDeferredReady(true);
      }
    };
    // Prefer a longer idle timeout so first route paint wins
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    // Longer idle so first route (Home/Picks/Commish) wins the main thread
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(arm, { timeout: 2_800 });
    } else {
      timeoutId = setTimeout(arm, 2_000);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [deferredReady, allowDeferred]);

  // Progressive chrome — ONCE on mount + events. NOT on every pathname change
  // (that re-fired syncFirstWeek + active week + scored weeks on every tab).
  useEffect(() => {
    if (!allowProgressive) {
      wrLog("[WR-NAV]", "progressive/unseen disabled by iso");
      return;
    }
    wrEffect("Nav.progressive");
    function syncProgressive() {
      if (isGuestMode()) {
        setShowGazetteNav(true);
        setShowNewsNav(true);
        setEarlyNav(false);
        setEyesLabel("");
        return;
      }
      void loadProgressiveSnapshot().then((snap) => {
        setShowGazetteNav(snap.showGazetteShelf);
        setShowNewsNav(snap.showNewsShelf);
        setEarlyNav(snap.firstWeekChrome);
        void import("@/lib/creator-eyes").then((m) => {
          const mode = m.getCreatorEyesMode();
          // Creator backstage only — customers never see Foundry/eyes banners
          void import("@/lib/creator").then(({ isAppCreator }) => {
            const uid = getSession()?.playerId;
            if (!isAppCreator(uid)) {
              setEyesLabel("");
              return;
            }
            setEyesLabel(mode === "off" ? "" : m.creatorEyesLabel(mode));
          });
        });
      });
    }
    // Retire leftover Creator Test Mode knobs (no standalone lab / banner)
    void import("@/lib/creator-sandbox").then((sb) => {
      sb.clearOrphanedCreatorTestMode();
    });
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
  }, [allowProgressive]);

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
    // Staff flags + profile after paint — session local is enough for first frame
    const staffTimer = window.setTimeout(() => {
      void import("@/lib/cloud")
        .then((m) => m.refreshStaffSessionFlags())
        .then(() => {
          refreshRoles();
        });
    }, 1200);

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

    const profileTimer = window.setTimeout(() => {
      loadMyProfile().then((p) => {
        if (p) {
          setName(p.displayName);
          setAvatarUrl(p.avatarUrl);
          void import("@/lib/legacy-badge-grants").then((m) => {
            m.sanitizeLegacyLegendsOnBoot({
              playerId: p.id || session?.playerId,
              playerName: p.displayName || session?.playerName,
            });
          });
        } else if (session?.playerId) {
          void import("@/lib/legacy-badge-grants").then((m) => {
            m.sanitizeLegacyLegendsOnBoot({
              playerId: session.playerId,
              playerName: session.playerName,
            });
          });
        }
      });
    }, 900);

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
    // One-time scrub of sim career points — deferred so first paint wins
    window.setTimeout(() => {
      void import("@/lib/sandbox-wipe")
        .then((m) => {
          m.nukeAccumulatedSandboxCareersOnce(
            session?.playerId ? [session.playerId] : undefined
          );
        })
        .catch(() => {});
    }, 2500);

    async function loadUnread() {
      if (!session?.playerId || !league?.id) return;
      try {
        // Defer gazette archive (heavy) slightly so ann/locker badge paint first
        const [ann, lock] = await Promise.all([
          countUnreadAnnouncements(),
          countUnseenLockerPosts(),
        ]);
        setUnreadCount(ann);
        setLockerUnseen(lock);
        void import("@/lib/gazette")
          .then((m) => m.getGazetteUnreadState())
          .then((gaz) => setGazetteUnseen(gaz.unread ? 1 : 0))
          .catch(() => setGazetteUnseen(0));
      } catch {
        setUnreadCount(0);
        setLockerUnseen(0);
        setGazetteUnseen(0);
      }
    }

    // Let first paint win — badge network after first second
    const unreadTimer = window.setTimeout(() => void loadUnread(), 1200);
    // Presence: last logged in / last open (throttled write)
    if (!isGuestMode()) {
      window.setTimeout(() => void touchLastSeen(), 2000);
    }
    // Heartbeat while app tab is visible — keeps "Online now" honest (~90s throttle)
    const presenceBeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!isGuestMode()) void touchLastSeen();
    }, 90_000);
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
    function onAnnouncementsSeen() {
      setUnreadCount(0);
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
    window.addEventListener(EVENT_ANNOUNCEMENTS_SEEN, onAnnouncementsSeen);
    return () => {
      window.clearTimeout(unreadTimer);
      window.clearTimeout(staffTimer);
      window.clearTimeout(profileTimer);
      window.clearInterval(presenceBeat);
      window.removeEventListener("warroom-view-as-player", onPreview);
      window.removeEventListener(SPORT_THEME_EVENT, onSportTheme);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
      window.removeEventListener(EVENT_ANNOUNCEMENTS_SEEN, onAnnouncementsSeen);
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
    // News = announcements — clear badge immediately on visit (page also marks reads)
    if (
      pathname === "/announcements" ||
      pathname.startsWith("/announcements/")
    ) {
      setUnreadCount(0);
      return;
    }
    // Do NOT re-fetch badges on every route — caches cover 30s; visibility
    // change still refreshes. Route-hop network storms were a main lag source.
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      prepareNavigation("Nav.menuOpen=false-effect");
      return;
    }
    try {
      const { acquireBodyLock } =
        require("@/lib/smooth") as typeof import("@/lib/smooth");
      const release = acquireBodyLock("nav-more-sheet");
      return () => {
        release();
      };
    } catch {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  // More sheet must open scrolled to top (iOS often jumps to mid-list / focused control)
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const el = moreSheetScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const id = window.requestAnimationFrame(() => {
      el.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(id);
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

  // Desktop primary only: play the game. Board/Gazette open after first lock.
  // Phone bottom tabs are separate (Home · Picks · Standings · Locker · You).
  // Never mirror primary destinations in the hamburger.
  const primaryLinks: NavLink[] = earlyNav
    ? [
        { href: "/", label: "Home" },
        { href: "/picks", label: "Picks" },
        { href: "/standings", label: "Standings" },
        { href: "/locker-room", label: "Locker", badge: lockerUnseen },
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
      ];

  /**
   * Account menu (hamburger / desktop You) — manage yourself, not the game.
   * Game destinations live on bottom nav, desktop primary, or Home tiles.
   */
  const myProfileHref = playerId ? `/profile/${playerId}` : null;
  const accountLinks: NavLink[] = [
    { href: "/account", label: "Account" },
    ...(myProfileHref
      ? [
          {
            href: myProfileHref,
            label: "Profile",
            className: "text-primary",
          } as NavLink,
        ]
      : []),
    ...(showNewsNav
      ? [
          {
            href: "/announcements",
            label: "Notifications",
            badge: unreadCount,
          } as NavLink,
        ]
      : []),
    { href: "/rules", label: "Help / Rules" },
    { href: "/account#feedback", label: "Feedback / Report Issue" },
    { href: "/account#about", label: "About War Room" },
    ...(ops
      ? [
          {
            href: "/commissioner",
            label: "Manage League",
            className: "text-primary",
          } as NavLink,
        ]
      : []),
    ...(staff
      ? [
          {
            href: "/moderation",
            label: "Mod",
            className: "text-amber-300 hover:text-amber-200",
          } as NavLink,
        ]
      : []),
  ];

  const moreActive = accountLinks.some((l) => {
    const path = l.href.split("#")[0] || l.href;
    if (path === "/account") {
      return pathname === "/account" || pathname.startsWith("/account/");
    }
    return pathname === path || pathname.startsWith(path + "/");
  });
  const moreBadge = accountLinks.reduce((n, l) => n + (l.badge || 0), 0);

  async function onMenuSignOut() {
    closeChrome();
    try {
      const { signOutFully } = await import("@/lib/session-restore");
      await signOutFully();
    } catch {
      /* still leave */
    }
    window.location.href = "/login";
  }

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
    prepareNavigation("Nav.closeChrome");
  }

  /** Open/close More sheet; always reset list scroll to top (phone iOS mid-sheet jump). */
  function toggleMoreSheet() {
    setMenuOpen((open) => {
      const next = !open;
      if (next) {
        window.requestAnimationFrame(() => {
          try {
            (document.activeElement as HTMLElement | null)?.blur?.();
          } catch {
            /* ok */
          }
          if (moreSheetScrollRef.current) {
            moreSheetScrollRef.current.scrollTop = 0;
          }
        });
      }
      return next;
    });
  }

  /** Prefetch primary desks; leave deep/rare routes cold */
  function shouldPrefetch(href: string) {
    const path = href.split("?")[0] || href;
    return (PRIMARY_ROUTES as readonly string[]).includes(path);
  }

  function NavItem({ link }: { link: NavLink }) {
    const isHome = link.href === "/";
    const active = linkActive(link.href);
    return (
      <Link
        href={link.href}
        prefetch={shouldPrefetch(link.href)}
        onClick={() => {
          closeChrome();
        }}
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
      ) : null}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 min-w-0">
          <Link
            href="/"
            prefetch
            onClick={() => closeChrome()}
            className="flex items-center gap-2 shrink-0 min-w-0 max-w-[11rem] sm:max-w-[14rem] rounded-md hover:opacity-90 transition"
            title="Back to Home"
            aria-label="Home"
          >
            <BrandMark size={36} className="shrink-0" variant="force" />
            {/* Shared brand hierarchy every sport: product name · sport chip · room */}
            <div className="flex flex-col min-w-0 justify-center">
              <span
                className={`tracking-tight leading-tight truncate ${
                  pathname === "/"
                    ? "font-bold text-sm text-foreground"
                    : "font-extrabold text-[15px] sm:text-base text-primary"
                }`}
              >
                {pathname === "/" ? "War Room" : "← Home"}
              </span>
              <span
                className={`text-[10px] font-semibold leading-tight truncate ${
                  sportIsWwc
                    ? "text-yellow-200/90"
                    : sportIsNfl
                      ? "text-white/80"
                      : "text-muted"
                }`}
              >
                {sportIsWwc
                  ? "WWC · Brazil 2027"
                  : sportIsNfl
                    ? "NFL"
                    : leagueName
                      ? leagueName
                      : "CFB"}
              </span>
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
                You
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
                    aria-label="Close account menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl py-1">
                    {accountLinks.map((link) => {
                      const path = link.href.split("#")[0] || link.href;
                      const isAccount = path === "/account" && !link.href.includes("#");
                      const active =
                        path === "/account"
                          ? pathname === "/account" ||
                            pathname.startsWith("/account/")
                          : linkActive(path);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          prefetch={false}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-card-hover transition ${
                            isAccount
                              ? "text-sky-200 font-semibold border-b border-border mb-0.5"
                              : active
                                ? "text-foreground font-medium"
                                : "text-muted"
                          } ${!isAccount ? link.className || "" : ""}`}
                        >
                          <span>{isAccount ? "⚙ Account" : link.label}</span>
                          {link.badge != null && link.badge > 0 && (
                            <UnreadBadge count={link.badge} />
                          )}
                        </Link>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => void onMenuSignOut()}
                      className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 border-t border-border mt-0.5"
                    >
                      Sign out
                    </button>
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
              href="/account"
              prefetch={false}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
              title="Account — photo, name, leagues, settings"
              aria-label="Account"
              onClick={closeChrome}
            >
              <Avatar
                name={name}
                avatarUrl={avatarUrl}
                size="sm"
                userId={playerId}
              />
              <span className="hidden sm:inline">
                {name || "Account"}
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
              aria-label={menuOpen ? "Close account menu" : "Account menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              onClick={() => toggleMoreSheet()}
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
              {!menuOpen && moreBadge > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-black text-[9px] font-bold flex items-center justify-center">
                  {moreBadge > 99 ? "99+" : moreBadge}
                </span>
              )}
            </button>
          </div>
        </div>

      </header>

      {/* Phone: account sheet — manage yourself, not play the game */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[55] bg-black/65 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav-menu"
            className="md:hidden fixed left-0 right-0 bottom-0 z-[60] flex flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.5)] max-h-[min(78dvh,640px)] pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]"
            aria-label="Account and settings"
          >
            <div className="shrink-0 bg-card pt-2 pb-1 border-b border-border">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between px-4 pb-2">
                <p className="text-sm font-bold">Account & settings</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="text-xs font-semibold text-muted hover:text-foreground min-h-[40px] px-2"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              ref={moreSheetScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
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
                Manage yourself
              </p>
              <ul className="py-1 pb-2">
                {accountLinks.map((link) => {
                  const path = link.href.split("#")[0] || link.href;
                  const isAccount =
                    path === "/account" && !link.href.includes("#");
                  const active =
                    path === "/account"
                      ? pathname === "/account" ||
                        pathname.startsWith("/account/")
                      : linkActive(path);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        onClick={() => closeChrome()}
                        className={`flex items-center justify-between gap-3 px-4 min-h-[48px] text-base transition touch-manipulation ${
                          isAccount
                            ? active
                              ? "bg-sky-500/15 text-sky-200 font-semibold"
                              : "text-sky-200/90 hover:bg-sky-500/10 font-semibold"
                            : active
                              ? "bg-card-hover text-foreground"
                              : "text-muted hover:bg-card-hover hover:text-foreground"
                        } ${!isAccount ? link.className || "" : ""}`}
                      >
                        <span
                          className={
                            isAccount ? "font-semibold" : "font-medium"
                          }
                        >
                          {isAccount ? "⚙ Account" : link.label}
                        </span>
                        {link.badge != null && link.badge > 0 && (
                          <UnreadBadge count={link.badge} />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="px-4 pt-1 pb-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => void onMenuSignOut()}
                  className="w-full min-h-[48px] rounded-xl border border-danger/50 text-danger text-sm font-semibold hover:bg-danger/10 touch-manipulation"
                >
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        </>
      )}

      {/* Phone thumb nav: play the game · You = account menu only */}
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
                  prefetch={shouldPrefetch(tab.href)}
                  onClick={() => closeChrome()}
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
              onClick={() => toggleMoreSheet()}
              className={`relative flex flex-col items-center justify-center h-full w-full gap-0.5 text-[10px] font-semibold touch-manipulation transition ${
                menuOpen || moreActive ? "text-primary" : "text-muted"
              }`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label="Account menu"
            >
              <span className="text-lg leading-none" aria-hidden>
                ☰
              </span>
              <span>You</span>
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
      {/* Contextual coaching DISABLED (P0) — was intercepting clicks; rebuild safely later */}
      {/* Roster + optional modals — staged late so tabs stay live after login */}
      {/*
        EMERGENCY: always mount the gate.
        Production → null + one log, never imports RoomDeferredChrome.
        Development → only loads RoomDeferredChrome after idle arm + iso allow.
      */}
      {PRODUCTION_DEFERRED_SAFE ? (
        <DeferredChromeGate />
      ) : (
        allowDeferred && deferredReady && <DeferredChromeGate />
      )}
    </>
  );
}
