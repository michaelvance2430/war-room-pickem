"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession, getLeague } from "@/lib/league";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const [isCommish, setIsCommish] = useState(false);
  const [name, setName] = useState("You");
  const [leagueName, setLeagueName] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setName(session?.playerName || "You");
    setLeagueName(league?.name || "");

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

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center font-bold text-black text-sm">
            WR
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight leading-tight">
              War Room Pick&apos;Em
            </span>
            {leagueName && (
              <span className="text-[10px] text-muted leading-tight">{leagueName}</span>
            )}
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-4 text-sm text-muted">
          <Link href="/picks" className="hover:text-foreground transition">
            My Picks
          </Link>
          <Link href="/standings" className="hover:text-foreground transition">
            Standings
          </Link>
          <Link href="/power-rankings" className="hover:text-foreground transition">
            Power Rankings
          </Link>
          <Link href="/announcements" className="hover:text-foreground transition relative">
            Announcements
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link href="/stats" className="hover:text-foreground transition">
            Stats
          </Link>
          <Link href="/players" className="hover:text-foreground transition">
            Players
          </Link>
          <Link href="/championship" className="hover:text-foreground transition">
            Championship
          </Link>
          <Link href="/toilet-bowl" className="hover:text-toilet transition">
            Toilet Bowl
          </Link>
          {isCommish && (
            <Link
              href="/commissioner"
              className="hover:text-foreground transition text-primary"
            >
              Commissioner
            </Link>
          )}
          <Link href="/account" className="hover:text-foreground transition">
            Account
          </Link>
        </nav>

        <Link href="/account" className="text-sm text-muted hover:text-foreground">
          {name}
          {isCommish && (
            <span className="ml-1 text-xs text-primary">(Commish)</span>
          )}
        </Link>
      </div>
    </header>
  );
}
