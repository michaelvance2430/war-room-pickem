"use client";

import { useEffect, useState } from "react";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getLeague } from "@/lib/league";
import {
  buildHotTakes,
  hotTakeTickerLabel,
  resolveVoiceSport,
} from "@/lib/fun-board";

type Props = {
  /** Dark war-room strip (home) vs standard card strip */
  variant?: "warroom" | "default";
  className?: string;
  /** Optional explicit sport — otherwise uses league sportId */
  sportId?: string | null;
};

export default function HotTakeTicker({
  variant = "default",
  className = "",
  sportId: sportIdProp,
}: Props) {
  const [takes, setTakes] = useState<string[]>([]);
  const [label, setLabel] = useState("Hot takes");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Prefer live league sport so dual-sport rooms don't get the wrong wire
        let sport = sportIdProp ?? getLeague()?.sportId ?? null;
        try {
          const { syncLeagueFromCloud } = await import("@/lib/league-sync");
          const fresh = await syncLeagueFromCloud();
          if (fresh?.sportId && sportIdProp == null) sport = fresh.sportId;
        } catch {
          /* offline / guest — local league is fine */
        }

        const voice = resolveVoiceSport(sport);
        const players = await loadLeaguePlayers();
        if (cancelled) return;
        setLabel(hotTakeTickerLabel(voice));
        setTakes(buildHotTakes(players, voice));
      } catch {
        if (!cancelled) {
          const voice = resolveVoiceSport(sportIdProp ?? getLeague()?.sportId);
          setLabel(hotTakeTickerLabel(voice));
          setTakes(
            voice === "nfl"
              ? [
                  "Primetime wire temporarily offline. Blame the refs, not the code.",
                ]
              : [
                  "Campus wire temporarily offline. Blame the goats, not the code.",
                ]
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sportIdProp]);

  if (!takes.length) return null;

  // Duplicate for seamless loop
  const loop = [...takes, ...takes];
  const war = variant === "warroom";

  return (
    <div
      className={`relative overflow-hidden border ${
        war
          ? "border-primary/25 bg-black/50 backdrop-blur-sm"
          : "border-border bg-card"
      } rounded-xl ${className}`}
      role="region"
      aria-label={`${label} ticker`}
    >
      <div className="flex items-stretch">
        <div
          className={`shrink-0 px-3 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] flex items-center gap-1.5 border-r ${
            war
              ? "bg-primary text-black border-primary/40"
              : "bg-primary/15 text-primary border-border"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {label}
        </div>
        <div className="relative flex-1 overflow-hidden py-2 min-w-0">
          <div className="hot-take-track flex w-max gap-0 whitespace-nowrap">
            {loop.map((t, i) => (
              <span
                key={`${i}-${t.slice(0, 24)}`}
                className={`inline-flex items-center text-xs sm:text-sm px-4 ${
                  war ? "text-foreground/90" : "text-muted"
                }`}
              >
                <span className="text-primary mr-2">◆</span>
                {t}
              </span>
            ))}
          </div>
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-8 ${
              war
                ? "bg-gradient-to-r from-black/80 to-transparent"
                : "bg-gradient-to-r from-card to-transparent"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-8 ${
              war
                ? "bg-gradient-to-l from-black/80 to-transparent"
                : "bg-gradient-to-l from-card to-transparent"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
