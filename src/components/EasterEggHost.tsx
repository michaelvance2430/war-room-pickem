"use client";

/**
 * Silent easter-egg runtime — discoverable, never a menu.
 * Zero points. Moments only.
 */

import { useCallback, useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import { defaultSeasonYear } from "@/lib/trophies";
import {
  EVENT_EASTER_EGG,
  noteAppOpen,
  noteChampionshipYears,
  noteSiblingStandings,
  type EasterEggMoment,
} from "@/lib/easter-eggs";
import { isGuestMode } from "@/lib/guest-mode";

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = ["#22c55e", "#C1121F", "#fbbf24", "#3b82f6", "#f4f0e6", "#a855f7"];
  const bits = Array.from({ length: 42 }, (_, i) => ({
    id: i,
    left: `${(i * 19 + 7) % 100}%`,
    delay: `${(i % 10) * 0.08}s`,
    duration: `${2.2 + (i % 5) * 0.3}s`,
    color: colors[i % colors.length],
    size: 5 + (i % 5) * 2,
  }));
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      aria-hidden
    >
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-[-8%] rounded-sm opacity-90 egg-confetti-bit"
          style={{
            left: b.left,
            width: b.size,
            height: b.size * 1.4,
            background: b.color,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function EasterEggHost() {
  const [queue, setQueue] = useState<EasterEggMoment[]>([]);
  const current = queue[0] ?? null;

  const pushMoments = useCallback((moments: EasterEggMoment[]) => {
    if (!moments.length) return;
    setQueue((q) => {
      const ids = new Set(q.map((m) => m.id));
      const next = moments.filter((m) => !ids.has(m.id));
      return next.length ? [...q, ...next] : q;
    });
  }, []);

  useEffect(() => {
    if (isGuestMode()) return;
    const session = getSession();
    if (!session?.playerId) return;

    let cancelled = false;

    async function run() {
      const league = getLeague();
      const playerId = session!.playerId;

      let memberSince: string | null = null;
      try {
        const { loadLeaguePlayers } = await import("@/lib/cloud");
        const players = await loadLeaguePlayers();
        const me = players.find((p) => p.id === playerId);
        memberSince = me?.memberSince || null;

        const sibling = noteSiblingStandings({
          playerId,
          playerName: me?.name || session!.playerName || "",
          myPoints: me?.totalPoints || 0,
          peers: players
            .filter((p) => !p.isMock)
            .map((p) => ({
              id: p.id,
              name: p.name,
              totalPoints: p.totalPoints,
            })),
          seasonYear: defaultSeasonYear(),
          weeksPlayed: me?.weeksPlayed || 0,
          // Room UUID only — rename-safe; never league display name
          leagueId: league?.id || session?.leagueId || null,
        });
        if (sibling && !cancelled) pushMoments([sibling]);
      } catch {
        /* offline ok */
      }

      try {
        const { getProfileHardware } = await import("@/lib/profile-hardware");
        const { loadLeagueTrophies } = await import("@/lib/trophies");
        const trophies = await loadLeagueTrophies();
        const meName = session!.playerName || "";
        const hardware = getProfileHardware({
          playerName: meName,
          playerId,
          leagueTrophies: trophies,
        });
        const champYears = hardware
          .filter((h) => h.kind === "championship")
          .map((h) => h.seasonYear);
        const three = noteChampionshipYears(playerId, champYears);
        if (three && !cancelled) pushMoments([three]);
      } catch {
        /* ok */
      }

      const openMoments = noteAppOpen({
        playerId,
        memberSince,
        sportId: league?.sportId,
        seasonYear: defaultSeasonYear(),
      });
      if (!cancelled) pushMoments(openMoments);
    }

    void run();

    function onEgg(e: Event) {
      const ce = e as CustomEvent<EasterEggMoment>;
      if (ce.detail) pushMoments([ce.detail]);
    }
    window.addEventListener(EVENT_EASTER_EGG, onEgg);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_EASTER_EGG, onEgg);
    };
  }, [pushMoments]);

  function dismiss() {
    setQueue((q) => q.slice(1));
  }

  if (!current) return null;

  return (
    <>
      <Confetti active={!!current.confetti} />
      <div
        className="fixed inset-0 z-[91] flex items-end sm:items-center justify-center bg-black/70 p-4"
        role="dialog"
        aria-modal
        aria-label={current.title}
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative overflow-hidden">
          <div className="text-4xl mb-3" aria-hidden>
            {current.icon}
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold mb-1">
            Discovered
          </p>
          <h2 className="text-xl font-bold leading-snug mb-2">{current.title}</h2>
          <p className="text-sm text-muted leading-relaxed mb-5">{current.body}</p>
          <p className="text-[10px] text-muted/80 mb-4 italic">
            No points. No standings. Just a “…did you know…” moment.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm"
          >
            {queue.length > 1 ? "Next" : "Nice"}
          </button>
        </div>
      </div>
    </>
  );
}
