"use client";

import Link from "next/link";
import { buildChampionshipBanner } from "@/lib/player-history";
import type { LeagueTrophy } from "@/lib/trophies";

type Props = {
  trophies: LeagueTrophy[];
  leagueName?: string;
};

export default function ChampionshipBanner({ trophies, leagueName }: Props) {
  const rows = buildChampionshipBanner(trophies);

  return (
    <section className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-card to-card p-5 mb-8 overflow-hidden relative">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 12px, #fbbf24 12px, #fbbf24 13px)",
        }}
      />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
          Championship banner
        </p>
        <h2 className="text-xl font-black text-foreground mt-1">
          {leagueName ? `${leagueName} · ` : ""}Champions forever
        </h2>
        <p className="text-xs text-muted mt-1 mb-4 max-w-lg leading-relaxed">
          Every title hangs on the wall. Season reset does not take these down.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted border border-dashed border-border rounded-xl px-4 py-6 text-center">
            No championships engraved yet. First plaque starts the banner.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={`${r.year}-${r.name}`}
                className="flex items-center gap-3 rounded-lg border border-amber-400/25 bg-background/70 px-3 py-2.5"
              >
                <span className="text-lg" aria-hidden>
                  🏆
                </span>
                <span className="font-mono text-sm font-bold text-amber-300 w-12 shrink-0">
                  {r.year}
                </span>
                {r.userId ? (
                  <Link
                    href={`/profile/${r.userId}`}
                    className="font-semibold text-foreground hover:text-primary truncate"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground truncate">
                    {r.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
