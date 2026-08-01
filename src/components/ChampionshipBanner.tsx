"use client";

import Link from "next/link";
import { buildChampionshipBanner } from "@/lib/player-history";
import type { LeagueTrophy } from "@/lib/trophies";
import SportChampionshipTrophy from "@/components/SportChampionshipTrophy";

type Props = {
  trophies: LeagueTrophy[];
  leagueName?: string;
  sportId?: string | null;
};

export default function ChampionshipBanner({
  trophies,
  leagueName,
  sportId,
}: Props) {
  const rows = buildChampionshipBanner(trophies);
  const isNfl = sportId === "nfl";
  const isWwc = sportId === "soccer_wwc";

  return (
    <section
      className={`rounded-2xl border p-5 mb-8 overflow-hidden relative ${
        isNfl
          ? "border-red-500/35 bg-gradient-to-br from-red-950/40 via-card to-[#0B1426]"
          : isWwc
            ? "border-yellow-400/40 bg-gradient-to-br from-emerald-900/30 via-card to-[#002776]/40"
            : "border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-card to-card"
      }`}
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: isNfl
            ? "repeating-linear-gradient(-12deg, transparent, transparent 12px, #C1121F 12px, #C1121F 13px)"
            : isWwc
              ? "repeating-linear-gradient(-12deg, transparent, transparent 12px, #FFDF00 12px, #FFDF00 13px)"
              : "repeating-linear-gradient(-12deg, transparent, transparent 12px, #fbbf24 12px, #fbbf24 13px)",
        }}
      />
      <div className="relative">
        <div className="flex items-start gap-4 mb-4">
          <div className="shrink-0 hidden sm:block">
            <SportChampionshipTrophy
              sport={sportId}
              size={72}
              animate={rows.length > 0}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                isNfl
                  ? "text-red-300"
                  : isWwc
                    ? "text-yellow-300"
                    : "text-amber-300"
              }`}
            >
              Championship banner
            </p>
            <h2 className="text-xl font-black text-foreground mt-1">
              {leagueName ? `${leagueName} · ` : ""}
              {isNfl
                ? "Champions of the room"
                : isWwc
                  ? "Cup champions"
                  : "Champions forever"}
            </h2>
            <p className="text-xs text-muted mt-1 max-w-lg leading-relaxed">
              Every title hangs on the wall. Season reset does not take these
              down. This is the hardware — not a participation sticker.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted border border-dashed border-border rounded-xl px-4 py-6 text-center">
            No championships engraved yet. First plaque starts the banner.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={`${r.year}-${r.name}`}
                className={`flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2.5 ${
                  isNfl
                    ? "border-red-400/25"
                    : isWwc
                      ? "border-yellow-400/25"
                      : "border-amber-400/25"
                }`}
              >
                <span className="shrink-0 w-9 h-9 flex items-center justify-center">
                  <SportChampionshipTrophy
                    sport={sportId}
                    size={36}
                    animate={false}
                  />
                </span>
                <span
                  className={`font-mono text-sm font-bold w-12 shrink-0 ${
                    isNfl
                      ? "text-red-300"
                      : isWwc
                        ? "text-yellow-300"
                        : "text-amber-300"
                  }`}
                >
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
