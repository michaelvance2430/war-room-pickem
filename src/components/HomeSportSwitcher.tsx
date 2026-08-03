"use client";

/**
 * Sport Hub — primary navigation on Home hero.
 * Shows only sports the user already participates in.
 * Scales to NFL / CFB / NBA / MLB / etc. without redesign.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMyMemberships,
  switchToLeague,
  type LeagueMembership,
} from "@/lib/session-restore";
import { getLeague, getSession } from "@/lib/league";
import { getSportPack, normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  setSportScope,
  EVENT_SPORT_ROOM_SCOPE,
  resolveSportScope,
} from "@/lib/sport-room-scope";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";

type SportOption = {
  sportId: SportId;
  roomCount: number;
  /** Prefer stay in current room if same sport; else first room of that sport */
  sampleLeagueId: string;
};

function SportIcon({ sportId, size = 18 }: { sportId: string; size?: number }) {
  if (sportId === "nfl") {
    return <NflBrandMark size={size} className="rounded" />;
  }
  if (sportId === "cfb") {
    return <BrandMark size={size} variant="force" className="rounded" />;
  }
  return (
    <span style={{ fontSize: size * 0.9 }} aria-hidden>
      {getSportPack(sportId).emoji}
    </span>
  );
}

type Props = {
  className?: string;
  /** Called after a successful sport/room switch (full remount recommended) */
  onSwitched?: () => void;
};

export default function HomeSportSwitcher({
  className = "",
  onSwitched,
}: Props) {
  const router = useRouter();
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<SportId>(() =>
    normalizeSportId(getLeague()?.sportId || "cfb")
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      setMemberships(ms);
      const activeSport = getLeague()?.sportId;
      const next = resolveSportScope({
        membershipSportIds: ms.map((m) => m.sportId || "cfb"),
        activeSportId: activeSport,
      });
      setScope(next);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onScope(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) setScope(normalizeSportId(id));
    }
    window.addEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
    return () => window.removeEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const options: SportOption[] = useMemo(() => {
    const map = new Map<SportId, LeagueMembership[]>();
    for (const m of memberships) {
      const sid = normalizeSportId(m.sportId || "cfb");
      const arr = map.get(sid) || [];
      arr.push(m);
      map.set(sid, arr);
    }
    const activeId = getSession()?.leagueId || getLeague()?.id;
    return [...map.entries()]
      .map(([sportId, rooms]) => {
        const preferred =
          rooms.find((r) => r.leagueId === activeId) || rooms[0]!;
        return {
          sportId,
          roomCount: rooms.length,
          sampleLeagueId: preferred.leagueId,
        };
      })
      .sort(
        (a, b) =>
          getSportPack(a.sportId).sortOrder - getSportPack(b.sportId).sortOrder
      );
  }, [memberships]);

  const current = getSportPack(scope);
  const multiSport = options.length > 1;

  async function pickSport(sportId: SportId, leagueId: string) {
    if (busy) return;
    setOpen(false);
    const activeId = getSession()?.leagueId || getLeague()?.id;
    const activeSport = normalizeSportId(getLeague()?.sportId || "cfb");

    setSportScope(sportId);
    setScope(sportId);

    // Already on this sport and room
    if (sportId === activeSport && leagueId === activeId) return;

    // Different sport or room → switch league then hard land Home
    if (leagueId !== activeId) {
      setBusy(true);
      const ok = await switchToLeague(leagueId);
      setBusy(false);
      if (!ok) return;
      if (onSwitched) onSwitched();
      else window.location.assign("/");
      return;
    }

    // Same room, scope only (shouldn't happen often)
    router.refresh();
  }

  // Single sport, no switcher chrome — still show identity chip
  if (!multiSport) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-full border border-border/60 bg-black/30 text-xs font-bold text-foreground ${className}`}
        title={current.label}
      >
        <SportIcon sportId={scope} size={18} />
        <span>{current.shortLabel}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-full border border-primary/40 bg-primary/10 text-xs font-extrabold text-primary touch-manipulation hover:bg-primary/15 disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Switch sport"
      >
        <SportIcon sportId={scope} size={18} />
        <span>{current.shortLabel}</span>
        <span className="opacity-70 text-[10px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1.5 min-w-[14rem] rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden"
        >
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Sports you play
          </p>
          {options.map((opt) => {
            const pack = getSportPack(opt.sportId);
            const selected = opt.sportId === scope;
            return (
              <button
                key={opt.sportId}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void pickSport(opt.sportId, opt.sampleLeagueId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm min-h-[44px] touch-manipulation ${
                  selected
                    ? "bg-primary/15 text-primary font-bold"
                    : "text-foreground hover:bg-card-hover"
                }`}
              >
                <SportIcon sportId={opt.sportId} size={20} />
                <span className="flex-1 min-w-0 truncate">{pack.shortLabel}</span>
                {opt.roomCount > 1 && (
                  <span className="text-[10px] text-muted font-semibold tabular-nums">
                    {opt.roomCount} rooms
                  </span>
                )}
                {selected && (
                  <span className="text-[10px] font-extrabold">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
