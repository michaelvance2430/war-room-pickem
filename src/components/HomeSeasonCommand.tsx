"use client";

import { useEffect, useState } from "react";
import { loadLeagueActiveWeek, loadLeaguePlayers, loadMyPicks } from "@/lib/cloud";
import { getLeague, getSession } from "@/lib/league";
import { cutLockWeek, seasonMaxWeek } from "@/lib/season-calendar";
import { resolveHomeSeasonCommand, type HomeSeasonCommand as Command } from "@/lib/home-season-command";

const TONE: Record<Command["tone"], string> = {
  green: "border-emerald-400/45 bg-emerald-500/[0.08] text-emerald-200",
  amber: "border-amber-400/45 bg-amber-500/[0.08] text-amber-200",
  red: "border-red-500/55 bg-red-950/35 text-red-200",
  gold: "border-yellow-300/50 bg-yellow-500/[0.09] text-yellow-100",
};

export default function HomeSeasonCommand() {
  const [command, setCommand] = useState<Command | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadLeagueActiveWeek(), loadLeaguePlayers("HomeSeasonCommand")]).then(async ([week, players]) => {
      if (cancelled) return;
      const league = getLeague();
      const sportId = league?.sportId || "cfb";
      let frozenField: "championship" | "toilet" | "eliminated" | null = null;
      if (week > cutLockWeek(sportId)) {
        try {
          const { loadFrozenPostseasonSnapshot } = await import(
            "@/lib/postseason/cloud"
          );
          const snapshot = await loadFrozenPostseasonSnapshot();
          frozenField =
            snapshot?.participants.find(
              (participant) => participant.userId === getSession()?.playerId
            )?.field || null;
        } catch {
          frozenField = null;
        }
      }
      const next = resolveHomeSeasonCommand({
        week,
        cutWeek: cutLockWeek(sportId),
        finalWeek: seasonMaxWeek(sportId),
        players,
        playerId: getSession()?.playerId,
        cutPercent: league?.settings.cutPercent ?? 50,
        frozenField,
      });
      if (next.phase === "opening") {
        const picks = await loadMyPicks(week).catch(() => null);
        if (cancelled) return;
        if (picks?.lockedAt && Object.keys(picks.picks || {}).length > 0) {
          setCommand(null);
          return;
        }
      }
      setCommand(next);
    });
    return () => { cancelled = true; };
  }, []);

  if (!command) return null;
  return (
    <section className={`mb-4 rounded-2xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,.2)] ${TONE[command.tone]}`} data-season-command={command.phase}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-75">{command.kicker}</p>
      <h2 className="mt-1 text-xl font-black leading-tight text-white">{command.headline}</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/65">{command.order}</p>
      {(command.story || command.personal) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-current/20 pt-3 text-[10px] font-bold">
          {command.story && <span>{command.story}</span>}
          {command.personal && <span className="rounded-full border border-current/35 px-2 py-1 uppercase tracking-wide">{command.personal}</span>}
        </div>
      )}
    </section>
  );
}
