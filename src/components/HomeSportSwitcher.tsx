"use client";

/**
 * Home League Hub — the front door to War Room.
 *
 * Answers in under five seconds:
 * 1. Which sport am I viewing?
 * 2. Which leagues am I in?
 * 3. What do I need to do next?
 * 4. Can I join more leagues?
 *
 * Not Account. Not administration. Navigation — Discord/Slack energy.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import {
  loadLeagueHubPulses,
  leagueHubToneClasses,
  type LeagueHubPulse,
  type LeagueHubTone,
} from "@/lib/league-hub-actions";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";

/** Primary sports always on the hub. */
const HUB_SPORTS: SportId[] = ["nfl", "cfb"];

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

function sportEmoji(sportId: string): string {
  if (sportId === "nfl") return "🏈";
  if (sportId === "cfb") return "🎓";
  return getSportPack(sportId).emoji || "🏟️";
}

type Props = {
  className?: string;
  onSwitched?: () => void;
};

export default function HomeSportSwitcher({ className = "" }: Props) {
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeagueHubPulse>>({});
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scope, setScope] = useState<SportId>(() =>
    normalizeSportId(getLeague()?.sportId || "cfb")
  );
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeId = getSession()?.leagueId || getLeague()?.id || "";

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      setMemberships(ms);
      const activeSport = getLeague()?.sportId;
      const next = resolveSportScope({
        membershipSportIds: ms.map((m) => m.sportId || "cfb"),
        activeSportId: activeSport,
      });
      // Prefer a hub sport if scope is something else
      const hubScope = HUB_SPORTS.includes(next)
        ? next
        : HUB_SPORTS.includes(normalizeSportId(activeSport || "cfb"))
          ? normalizeSportId(activeSport || "cfb")
          : "cfb";
      setScope(hubScope);

      const uid = getSession()?.playerId;
      if (uid && ms.length > 0) {
        const p = await loadLeagueHubPulses(ms, uid);
        setPulse(p);
      } else {
        setPulse({});
      }
    } catch {
      /* optional */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onScope(e: Event) {
      const id = normalizeSportId((e as CustomEvent<string>).detail);
      if (HUB_SPORTS.includes(id)) setScope(id);
    }
    window.addEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
    return () => window.removeEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const roomsBySport = useMemo(() => {
    const map = new Map<SportId, LeagueMembership[]>();
    for (const sid of HUB_SPORTS) map.set(sid, []);
    for (const m of memberships) {
      const sid = normalizeSportId(m.sportId || "cfb");
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(m);
    }
    for (const [sid, rooms] of map) {
      rooms.sort((a, b) => {
        // Active league first, then alpha
        if (a.leagueId === activeId) return -1;
        if (b.leagueId === activeId) return 1;
        return (a.leagueName || "").localeCompare(b.leagueName || "");
      });
      map.set(sid, rooms);
    }
    return map;
  }, [memberships, activeId]);

  function selectSport(sportId: SportId) {
    setSportScope(sportId);
    setScope(sportId);
    setOpen(true);
  }

  function toggleHub() {
    setOpen((o) => !o);
  }

  /**
   * Switch league if needed, then hard-navigate to the task path.
   * Hard assign clears stale room data from the previous league.
   */
  async function runAction(leagueId: string, href: string) {
    if (busyId) return;
    setBusyId(leagueId);
    try {
      const target = memberships.find((m) => m.leagueId === leagueId);
      if (target?.sportId) {
        setSportScope(target.sportId);
        setScope(normalizeSportId(target.sportId));
      }

      if (leagueId !== activeId) {
        const ok = await switchToLeague(leagueId);
        if (!ok) {
          setBusyId(null);
          return;
        }
      }

      setOpen(false);
      window.location.assign(href || "/");
    } catch {
      setBusyId(null);
    }
  }

  const openRooms = roomsBySport.get(scope) || [];
  const pack = getSportPack(scope);
  const isNfl = scope === "nfl";
  const roomCount = openRooms.length;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      {/* Selected sport control — always visible front door */}
      <button
        type="button"
        onClick={toggleHub}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${pack.shortLabel} League Hub`}
        className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-xs font-extrabold touch-manipulation transition border ${
          isNfl
            ? "border-red-500/50 bg-red-500/15 text-red-100 hover:bg-red-500/20"
            : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20"
        }`}
      >
        <SportIcon sportId={scope} size={18} />
        <span>{pack.shortLabel}</span>
        {loaded && roomCount > 0 ? (
          <span className="opacity-70 text-[10px] font-semibold tabular-nums">
            {roomCount}
          </span>
        ) : null}
        <span className="opacity-70 text-[10px]" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={`${pack.shortLabel} leagues`}
          className="absolute left-0 top-full z-50 mt-1.5 w-[min(22.5rem,calc(100vw-1.25rem))] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Sport switch inside the hub — one destination selector */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 border-b border-border/40">
            {HUB_SPORTS.map((sid) => {
              const p = getSportPack(sid);
              const selected = sid === scope;
              const n = (roomsBySport.get(sid) || []).length;
              const nfl = sid === "nfl";
              return (
                <button
                  key={sid}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectSport(sid)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg text-xs font-extrabold touch-manipulation transition ${
                    selected
                      ? nfl
                        ? "bg-red-500/20 text-red-100 border border-red-500/40"
                        : "bg-primary/20 text-primary border border-primary/40"
                      : "text-muted hover:text-foreground border border-transparent"
                  }`}
                >
                  <SportIcon sportId={sid} size={16} />
                  <span>{p.shortLabel}</span>
                  {loaded ? (
                    <span className="opacity-60 text-[10px] tabular-nums">
                      {n}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {openRooms.length === 0 ? (
            <div className="px-4 py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted mb-2">
                No {pack.shortLabel} leagues yet
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed mb-4">
                Join friends, start your own, or browse open communities.
              </p>
              <GrowthActions
                onNavigate={() => setOpen(false)}
                stacked
              />
            </div>
          ) : (
            <>
              <div
                className={`px-2 py-2 space-y-1 ${
                  openRooms.length > 6
                    ? "max-h-[min(52vh,24rem)] overflow-y-auto overscroll-contain"
                    : ""
                }`}
              >
                {openRooms.map((m) => {
                  const isActive = m.leagueId === activeId;
                  const p = pulse[m.leagueId];
                  const busy = busyId === m.leagueId;
                  const action = p?.action || {
                    code: "ENTER" as const,
                    label: "Enter",
                    href: "/",
                  };
                  const weekLine = p?.weekLine || "—";
                  const tone: LeagueHubTone = p?.signal?.tone || "ready";
                  const signalLabel =
                    p?.signal?.label || "Ready — Enter";
                  const signalEmoji = p?.signal?.emoji || "🟢";
                  const tones = leagueHubToneClasses(tone);

                  return (
                    <div
                      key={m.leagueId}
                      role="option"
                      aria-selected={isActive}
                      className={`flex items-stretch gap-2 rounded-lg px-2.5 py-2.5 min-h-[56px] ${
                        isActive
                          ? "bg-primary/12 border border-primary/35"
                          : "bg-background/25 border border-transparent hover:bg-background/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-sm font-bold text-white truncate leading-tight">
                          <span className="mr-1" aria-hidden>
                            {sportEmoji(scope)}
                          </span>
                          {m.leagueName || "War Room"}
                          {isActive ? (
                            <span className="ml-1.5 text-[9px] uppercase tracking-wide text-primary font-extrabold align-middle">
                              here
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5 truncate">
                          {weekLine}
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 font-semibold truncate ${tones.text}`}
                        >
                          <span aria-hidden className="mr-1">
                            {signalEmoji}
                          </span>
                          {signalLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() =>
                          void runAction(m.leagueId, action.href)
                        }
                        className={`self-center shrink-0 min-h-[40px] px-2.5 rounded-lg text-[11px] font-extrabold tracking-wide touch-manipulation disabled:opacity-50 whitespace-nowrap ${tones.button}`}
                      >
                        {busy ? "…" : action.label}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border/50 px-3 py-2.5">
                <GrowthActions onNavigate={() => setOpen(false)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GrowthActions({
  onNavigate,
  stacked = false,
}: {
  onNavigate: () => void;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/join?mode=join"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-primary text-black text-xs font-extrabold touch-manipulation"
        >
          JOIN WITH CODE
        </Link>
        <Link
          href="/join?mode=create"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg border border-border text-xs font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          START NEW LEAGUE
        </Link>
        <Link
          href="/open-room"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg border border-border text-xs font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          BROWSE OPEN LEAGUES
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link
        href="/join?mode=join"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Join with Code
      </Link>
      <Link
        href="/join?mode=create"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Start New League
      </Link>
      <Link
        href="/open-room"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Browse Open Leagues
      </Link>
    </div>
  );
}
