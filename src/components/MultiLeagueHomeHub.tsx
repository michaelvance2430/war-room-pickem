"use client";

/**
 * Multi-league switcher — sport desk first, then rooms for that sport only.
 *
 * Tap CFB / NFL / … icons → only that sport’s leagues appear.
 * When baseball season starts you never see football rooms in the list.
 *
 * Within a sport: dropdown of room names (not a mixed multi-sport dump).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchMyMemberships,
  switchToLeague,
  type LeagueMembership,
} from "@/lib/session-restore";
import { getSession, getLeague } from "@/lib/league";
import { getSportPack } from "@/lib/sports/registry";
import { createClient } from "@/lib/supabase/client";
import {
  resolveSportScope,
  setSportScope,
  EVENT_SPORT_ROOM_SCOPE,
  syncSportScopeToActiveLeague,
} from "@/lib/sport-room-scope";
import { normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import NflBrandMark from "@/components/NflBrandMark";

const NEEDS_SCROLL_MAX = 8;

type LeaguePulse = {
  leagueId: string;
  openWeek: number | null;
  needsPicks: boolean;
  locked: boolean;
  isHost: boolean;
};

type Props = {
  onSwitched?: () => void;
};

type SportBucket = {
  sportId: SportId;
  rooms: LeagueMembership[];
  needsCount: number;
};

function SportDeskIcon({
  sportId,
  size = 28,
}: {
  sportId: string;
  size?: number;
}) {
  if (sportId === "nfl") {
    return <NflBrandMark size={size} className="rounded-lg" />;
  }
  const pack = getSportPack(sportId);
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg bg-black/40 border border-border/60"
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      aria-hidden
    >
      {pack.emoji}
    </span>
  );
}

export default function MultiLeagueHomeHub({ onSwitched }: Props) {
  const router = useRouter();
  const [list, setList] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeaguePulse>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<SportId>("cfb");

  const activeId = getSession()?.leagueId || getLeague()?.id || "";
  const me = getSession()?.playerId;

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      if (ms.length < 2) {
        setList([]);
        setPulse({});
        setExpanded(false);
        return;
      }
      setList(ms);

      const activeSport =
        ms.find((m) => m.leagueId === activeId)?.sportId ||
        getLeague()?.sportId;
      const nextScope = resolveSportScope({
        membershipSportIds: ms.map((m) => m.sportId || "cfb"),
        activeSportId: activeSport,
      });
      setScope(nextScope);

      const uid = getSession()?.playerId;
      if (!uid) return;
      const supabase = createClient();
      const next: Record<string, LeaguePulse> = {};

      await Promise.all(
        ms.map(async (m) => {
          const isHost =
            m.role === "commissioner" || m.commissionerId === uid;
          try {
            const { data: card } = await supabase
              .from("week_cards")
              .select("week_number")
              .eq("league_id", m.leagueId)
              .order("week_number", { ascending: false })
              .limit(1)
              .maybeSingle();
            const openWeek =
              card?.week_number != null ? Number(card.week_number) : null;

            if (openWeek == null || Number.isNaN(openWeek)) {
              next[m.leagueId] = {
                leagueId: m.leagueId,
                openWeek: null,
                needsPicks: false,
                locked: false,
                isHost,
              };
              return;
            }

            const { data: pick } = await supabase
              .from("picks")
              .select("locked_at")
              .eq("league_id", m.leagueId)
              .eq("user_id", uid)
              .eq("week_number", openWeek)
              .maybeSingle();

            const locked = !!(pick as { locked_at?: string | null } | null)
              ?.locked_at;
            next[m.leagueId] = {
              leagueId: m.leagueId,
              openWeek,
              needsPicks: !locked,
              locked,
              isHost,
            };
          } catch {
            next[m.leagueId] = {
              leagueId: m.leagueId,
              openWeek: null,
              needsPicks: false,
              locked: false,
              isHost,
            };
          }
        })
      );
      setPulse(next);
    } catch {
      /* optional */
    }
  }, [activeId]);

  useEffect(() => {
    void load();
  }, [load, activeId]);

  useEffect(() => {
    function onScope(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) setScope(normalizeSportId(id));
    }
    window.addEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
    return () => window.removeEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
  }, []);

  const buckets: SportBucket[] = useMemo(() => {
    const map = new Map<SportId, LeagueMembership[]>();
    for (const m of list) {
      const sid = normalizeSportId(m.sportId || "cfb");
      const arr = map.get(sid) || [];
      arr.push(m);
      map.set(sid, arr);
    }
    return [...map.entries()]
      .map(([sportId, rooms]) => ({
        sportId,
        rooms: rooms.sort((a, b) =>
          (a.leagueName || "").localeCompare(b.leagueName || "")
        ),
        needsCount: rooms.filter(
          (r) =>
            r.leagueId !== activeId && pulse[r.leagueId]?.needsPicks
        ).length,
      }))
      .sort((a, b) => {
        const pa = getSportPack(a.sportId).sortOrder;
        const pb = getSportPack(b.sportId).sortOrder;
        return pa - pb;
      });
  }, [list, pulse, activeId]);

  const multiSport = buckets.length >= 2;

  const scopedRooms = useMemo(() => {
    return (
      buckets.find((b) => b.sportId === scope)?.rooms ||
      buckets[0]?.rooms ||
      []
    );
  }, [buckets, scope]);

  const scopedNeeds = useMemo(() => {
    return scopedRooms.filter(
      (m) => m.leagueId !== activeId && pulse[m.leagueId]?.needsPicks
    );
  }, [scopedRooms, pulse, activeId]);

  const activeInScope = useMemo(
    () => scopedRooms.find((m) => m.leagueId === activeId) || null,
    [scopedRooms, activeId]
  );

  const scopePack = getSportPack(scope);

  /** Show hub when 2+ rooms total, OR 2+ sports (edge), OR 2+ in same sport */
  if (list.length < 2) return null;

  async function enterRoom(leagueId: string, goPicks: boolean) {
    if (busyId) return;
    setError(null);
    const target = list.find((m) => m.leagueId === leagueId);
    if (target?.sportId) {
      setSportScope(target.sportId);
      setScope(normalizeSportId(target.sportId));
    }
    if (leagueId === activeId) {
      if (goPicks) router.push("/picks");
      return;
    }
    setBusyId(leagueId);
    const ok = await switchToLeague(leagueId);
    setBusyId(null);
    if (!ok) {
      setError("Could not switch leagues");
      return;
    }
    syncSportScopeToActiveLeague();
    if (goPicks) {
      router.push("/picks");
      router.refresh();
      return;
    }
    if (onSwitched) onSwitched();
    else window.location.href = "/";
  }

  function pickSport(sportId: SportId) {
    setSportScope(sportId);
    setScope(sportId);
    setExpanded(true);
    // If active room is a different sport, stay — user just browsing that desk.
    // They enter a room to switch active league.
  }

  function rowNeed(m: LeagueMembership): string {
    const isActive = m.leagueId === activeId;
    const p = pulse[m.leagueId];
    const isHost =
      p?.isHost ||
      m.role === "commissioner" ||
      m.commissionerId === me;
    if (isActive) return "You're here";
    if (p?.needsPicks && p.openWeek != null)
      return `Needs picks · Week ${p.openWeek}`;
    if (p?.needsPicks) return "Needs picks";
    if (p?.locked) return "Picks locked";
    if (isHost) return "Host room";
    return "Switch anytime";
  }

  return (
    <section
      className="mb-4 rounded-xl border border-primary/30 bg-black/45 backdrop-blur-sm overflow-hidden"
      aria-label="Your leagues by sport"
    >
      {/* Sport desk rail — only sports you actually play */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary mb-2">
          Your sports · pick a desk
        </p>
        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => {
            const pack = getSportPack(b.sportId);
            const selected = b.sportId === scope;
            const isNfl = b.sportId === "nfl";
            return (
              <button
                key={b.sportId}
                type="button"
                onClick={() => pickSport(b.sportId)}
                className={`inline-flex items-center gap-2 min-h-[48px] px-3 rounded-xl border-2 touch-manipulation transition ${
                  selected
                    ? isNfl
                      ? "border-red-500/60 bg-red-500/15 shadow-[0_0_18px_rgba(193,18,31,0.2)]"
                      : "border-primary/60 bg-primary/15 shadow-[0_0_18px_rgba(34,197,94,0.15)]"
                    : "border-border/60 bg-background/40 hover:border-primary/35"
                }`}
                aria-pressed={selected}
                title={`${pack.label} · ${b.rooms.length} room${
                  b.rooms.length === 1 ? "" : "s"
                }`}
              >
                <SportDeskIcon sportId={b.sportId} size={32} />
                <span className="text-left">
                  <span
                    className={`block text-sm font-black leading-none ${
                      selected
                        ? isNfl
                          ? "text-red-100"
                          : "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {pack.shortLabel}
                  </span>
                  <span className="block text-[10px] text-muted mt-0.5 font-semibold">
                    {b.rooms.length} room{b.rooms.length === 1 ? "" : "s"}
                    {b.needsCount > 0 ? (
                      <span className="text-amber-300">
                        {" "}
                        · {b.needsCount} need picks
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {multiSport && (
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            Only <strong className="text-foreground">{scopePack.shortLabel}</strong>{" "}
            rooms below — other sports stay on their own desk.
          </p>
        )}
      </div>

      {/* Dropdown for rooms in the selected sport only */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-3 flex items-center gap-2 min-h-[52px] touch-manipulation hover:bg-white/5"
        aria-expanded={expanded}
      >
        <SportDeskIcon sportId={scope} size={28} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {scopePack.emoji} {scopePack.shortLabel} rooms ·{" "}
            {scopedRooms.length}
            {scopedNeeds.length > 0 && (
              <span className="text-amber-300 font-semibold normal-case tracking-normal">
                {" "}
                · {scopedNeeds.length} need picks
              </span>
            )}
          </p>
          {/*
            Do NOT repeat the active room name here — the masthead owns that.
            This control is only “switch desks / rooms.”
          */}
          <p className="text-sm font-bold text-white truncate mt-0.5">
            {activeInScope ? (
              <span className="text-muted font-semibold">
                Tap to switch rooms
                {scopedRooms.length > 1 ? (
                  <span className="text-foreground/80">
                    {" "}
                    · {scopedRooms.length} on this desk
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-muted font-semibold">
                Tap to open a {scopePack.shortLabel} room
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-muted text-sm font-bold px-1">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {/* Collapsed: needs-picks chips within this sport only */}
      {!expanded && scopedNeeds.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5 items-center">
          {scopedNeeds.slice(0, 4).map((m) => {
            const p = pulse[m.leagueId];
            const week =
              p?.openWeek != null ? `W${p.openWeek}` : "picks";
            const shortName = (m.leagueName || "Room").trim();
            const chipName =
              shortName.length > 20
                ? `${shortName.slice(0, 18)}…`
                : shortName;
            return (
              <button
                key={m.leagueId}
                type="button"
                disabled={!!busyId}
                onClick={() => void enterRoom(m.leagueId, true)}
                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-100 text-[11px] font-bold touch-manipulation disabled:opacity-50 max-w-[14rem] truncate"
                title={m.leagueName}
              >
                {chipName}
                <span className="opacity-80">· {week} →</span>
              </button>
            );
          })}
          {scopedNeeds.length > 4 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center min-h-[36px] px-2.5 rounded-full border border-border text-muted text-[11px] font-bold"
            >
              +{scopedNeeds.length - 4} more
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2.5">
          <p className="text-[10px] text-muted mb-2 leading-relaxed">
            {scopePack.shortLabel} desk only —{" "}
            {scopedRooms.length} room
            {scopedRooms.length === 1 ? "" : "s"}
            {multiSport
              ? ". Switch the sport chips above for other desks."
              : "."}
          </p>
          <div
            className={`space-y-1.5 ${
              scopedRooms.length > NEEDS_SCROLL_MAX
                ? "max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain pr-0.5"
                : ""
            }`}
          >
            {scopedRooms.map((m) => {
              const isActive = m.leagueId === activeId;
              const p = pulse[m.leagueId];
              const busy = busyId === m.leagueId;
              const isHost =
                p?.isHost ||
                m.role === "commissioner" ||
                m.commissionerId === me;
              const need = rowNeed(m);

              return (
                <div
                  key={m.leagueId}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 min-h-[48px] ${
                    isActive ? "bg-primary/12 border border-primary/30" : "bg-background/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate leading-tight">
                      {m.leagueName || "War Room"}
                      {isActive && (
                        <span className="ml-1.5 text-[10px] uppercase text-primary font-extrabold">
                          here
                        </span>
                      )}
                      {isHost && (
                        <span className="ml-1.5 text-[9px] uppercase text-amber-200/80">
                          host
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        p?.needsPicks && !isActive
                          ? "text-amber-200 font-medium"
                          : "text-muted"
                      }`}
                    >
                      {need}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void enterRoom(m.leagueId, true)}
                        className="min-h-[40px] px-3 rounded-lg bg-primary text-black text-[11px] font-bold disabled:opacity-50"
                      >
                        Picks
                      </button>
                    ) : p?.needsPicks ? (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void enterRoom(m.leagueId, true)}
                        className="min-h-[40px] px-3 rounded-lg border border-amber-400/50 text-amber-100 text-[11px] font-bold disabled:opacity-50"
                      >
                        {busy ? "…" : "Lock picks"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void enterRoom(m.leagueId, false)}
                        className="min-h-[40px] px-3 rounded-lg border border-border text-[11px] font-bold text-muted hover:text-foreground disabled:opacity-50"
                      >
                        {busy ? "…" : "Enter"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/join?mode=create`}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              + New {scopePack.shortLabel} room
            </Link>
            <Link
              href="/account"
              className="text-[11px] font-semibold text-muted hover:text-foreground"
            >
              All rooms on Account
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p className="px-3 pb-2 text-xs text-danger">{error}</p>
      )}
    </section>
  );
}
