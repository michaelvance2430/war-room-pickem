"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, getLeague } from "@/lib/league";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import RulesOnboardingModal from "@/components/RulesOnboardingModal";
import { loadMyProfile } from "@/lib/profile";

type NavLink = {
  href: string;
  label: string;
  className?: string;
  badge?: number;
};

export default function Nav() {
  const pathname = usePathname();
  const [isCommish, setIsCommish] = useState(false);
  const [name, setName] = useState("You");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [crystalBallOn, setCrystalBallOn] = useState(true);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setName(session?.playerName || "You");
    setLeagueName(league?.name || "");
    setCrystalBallOn(league?.settings?.crystalBallEnabled !== false);

    loadMyProfile().then((p) => {
      if (p) {
        setName(p.displayName);
        setAvatarUrl(p.avatarUrl);
      }
    });

    async function loadUnread() {
      if (!session?.playerId || !league?.id) return;
      try {
        const supabase = createClient();
        const { data: announcements } = await supabase
          .from("announcements")
          .select("id")
          .eq("league_id", league.id);

        if (!announcements || announcements.length === 0) {
          setUnreadCount(0);
          return;
        }

        const ids = announcements.map((a) => a.id);
        const { data: reads } = await supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("user_id", session.playerId)
          .in("announcement_id", ids);

        const readIds = new Set((reads || []).map((r) => r.announcement_id));
        const unread = ids.filter((id) => !readIds.has(id)).length;
        setUnreadCount(unread);
      } catch {
        setUnreadCount(0);
      }
    }

    loadUnread();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while menu is open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const links: NavLink[] = [
    { href: "/picks", label: "My Picks" },
    ...(crystalBallOn
      ? [{ href: "/crystal-ball", label: "Crystal Ball" }]
      : []),
    { href: "/standings", label: "Standings" },
    { href: "/power-rankings", label: "Power Rankings" },
    { href: "/announcements", label: "Announcements", badge: unreadCount },
    { href: "/stats", label: "Stats" },
    { href: "/players", label: "Players" },
    { href: "/rules", label: "Rules" },
    { href: "/championship", label: "Championship" },
    { href: "/toilet-bowl", label: "Toilet Bowl", className: "text-toilet hover:text-toilet" },
    ...(isCommish
      ? [{ href: "/commissioner", label: "Commissioner", className: "text-primary" }]
      : []),
    { href: "/account", label: "Account" },
  ];

  function linkActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
    if (count <= 0) return null;
    return (
      <span
        className={`min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold inline-flex items-center justify-center ${className}`}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  return (
    <>
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded bg-primary flex items-center justify-center font-bold text-black text-sm">
              WR
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold tracking-tight leading-tight truncate">
                War Room Pick&apos;Em
              </span>
              {leagueName && (
                <span className="text-[10px] text-muted leading-tight truncate">
                  {leagueName}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-foreground transition relative ${link.className || ""} ${
                  linkActive(link.href) ? "text-foreground" : ""
                }`}
              >
                {link.label}
                {link.badge != null && link.badge > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
                    {link.badge > 99 ? "99+" : link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Profile + hamburger (mobile) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              href="/account"
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
            >
              <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
              <span className="hidden sm:inline">
                {name}
                {isCommish && (
                  <span className="ml-1 text-xs text-primary">(Commish)</span>
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
                // X icon
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
                // Hamburger — 3 horizontal lines
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
              {!menuOpen && unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-black text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
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
              <ul className="py-2">
                {links.map((link) => {
                  const active = linkActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-base transition ${
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
      <RulesOnboardingModal />
    </>
  );
}
