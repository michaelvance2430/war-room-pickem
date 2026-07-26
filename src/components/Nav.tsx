"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession, getLeague } from "@/lib/league";

export default function Nav() {
  const [isCommish, setIsCommish] = useState(false);
  const [name, setName] = useState("You");
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setName(session?.playerName || "You");
    setLeagueName(league?.name || "");
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
