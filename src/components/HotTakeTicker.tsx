"use client";

import { useEffect, useState } from "react";
import { loadLeaguePlayers } from "@/lib/cloud";
import { buildHotTakes } from "@/lib/fun-board";

type Props = {
  /** Dark war-room strip (home) vs standard card strip */
  variant?: "warroom" | "default";
  className?: string;
};

export default function HotTakeTicker({
  variant = "default",
  className = "",
}: Props) {
  const [takes, setTakes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadLeaguePlayers()
      .then((players) => {
        if (!cancelled) setTakes(buildHotTakes(players));
      })
      .catch(() => {
        if (!cancelled) {
          setTakes([
            "Hot take wire temporarily offline. Blame the goats, not the code.",
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      aria-label="Hot takes ticker"
    >
      <div className="flex items-stretch">
        <div
          className={`shrink-0 px-3 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-1.5 border-r ${
            war
              ? "bg-primary text-black border-primary/40"
              : "bg-primary/15 text-primary border-border"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Hot takes
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
