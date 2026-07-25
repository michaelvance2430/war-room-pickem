"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Link from "next/link";
import { getSession, getLeague } from "@/lib/league";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [leagueCode, setLeagueCode] = useState<string | null>(null);
  const [isCommish, setIsCommish] = useState(false);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    if (!session || !league) {
      router.replace("/join");
      return;
    }
    setLeagueCode(league.code);
    setIsCommish(!!session.isCommissioner);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <section className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Welcome to the War Room
          </h1>
          <p className="text-muted max-w-xl">
            Pick against the spread. Stack confidence. Hit the Best Bet.
            Survive your division… or get flushed into the Toilet Bowl.
          </p>
          {isCommish && leagueCode && (
            <p className="text-sm mt-3">
              <span className="text-muted">League code: </span>
              <span className="font-mono font-bold text-primary tracking-widest">
                {leagueCode}
              </span>
              <span className="text-muted text-xs ml-2">Share with friends</span>
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatusCard label="Current Week" value="Week 1" sub="Picks lock Saturday" accent="primary" />
          <StatusCard label="Your Division" value="North" sub="See Players" accent="primary" />
          <StatusCard label="Your Rank" value="—" sub="Season not started" accent="muted" />
          <StatusCard label="Power Rank" value="—" sub="Form ranking" accent="muted" />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Link
            href="/championship"
            className="rounded-xl border border-border bg-card p-6 hover:bg-card-hover transition block"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary font-semibold">Championship Bracket</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Top 50%
              </span>
            </div>
            <p className="text-sm text-muted mb-4">
              Division winners locked as seeds 1–4. Survive the cut and fight for the title.
            </p>
            <div className="text-xs text-muted">Single elimination • Same weekly card</div>
          </Link>

          <Link
            href="/toilet-bowl"
            className="rounded-xl border border-toilet/40 bg-card p-6 relative overflow-hidden hover:bg-card-hover transition block"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-toilet/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="flex items-center gap-2 mb-3 relative">
              <span className="text-toilet font-semibold">Toilet Bowl</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-toilet/10 text-toilet">
                Bottom 50%
              </span>
            </div>
            <p className="text-sm text-muted mb-4 relative">
              Worst record gets the easiest path. Full chaotic energy.
            </p>
            <div className="text-xs text-muted relative">Single elimination • Flush or be flushed</div>
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">How the War Room Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Step num="1" title="Weekly Card" desc="5 ATS games + confidence 1-5 + Best Bet + one prop" />
            <Step num="2" title="Divisions" desc="Four equal groups. Rank inside your division matters." />
            <Step num="3" title="The Cut" desc="Bottom 50% of each division gets sent to the Toilet Bowl." />
            <Step num="4" title="Brackets" desc="Heads-up single elim. Higher score advances every week." />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        War Room Pick&apos;Em • Fun. Shit-talking. Camaraderie.
      </footer>
    </div>
  );
}

function StatusCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "primary" | "muted" | "toilet";
}) {
  const accentClass =
    accent === "primary"
      ? "text-primary"
      : accent === "toilet"
        ? "text-toilet"
        : "text-muted";

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:bg-card-hover transition">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
          {num}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-muted text-xs leading-relaxed pl-7">{desc}</p>
    </div>
  );
}
