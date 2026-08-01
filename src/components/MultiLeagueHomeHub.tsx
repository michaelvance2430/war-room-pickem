"use client";

/**
 * Slim multi-league switcher on Home.
 *
 * SINGLE LEAGUE: renders nothing (null). No bar, no margin, no layout gap —
 * Home looks like a normal one-room page.
 *
 * 2+ LEAGUES: collapsed strip + needs-picks chips. Active room cockpit stays below.
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

type LeaguePulse = {
  leagueId: string;
  /** Published week that needs a lock (null = no card yet) */
  openWeek: number | null;
  needsPicks: boolean;
  locked: boolean;
  isHost: boolean;
};

type Props = {
  onSwitched?: () => void;
};

export default function MultiLeagueHomeHub({ onSwitched }: Props) {
  const router = useRouter();
  const [list, setList] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeaguePulse>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const activeId = getSession()?.leagueId || getLeague()?.id || "";
  const me = getSession()?.playerId;

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      // One room (or none): stay invisible — no multi-league chrome at all
      if (ms.length < 2) {
        setList([]);
        setPulse({});
        setExpanded(false);
        return;
      }
      setList(ms);
      const uid = getSession()?.playerId;
      if (!uid) return;
      const supabase = createClient();
      const next: Record<string, LeaguePulse> = {};

      await Promise.all(
        ms.map(async (m) => {
          const isHost =
            m.role === "commissioner" || m.commissionerId === uid;
          try {
            // Latest published card week for this room
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
      /* optional hub */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeId]);

  const active = useMemo(
    () => list.find((m) => m.leagueId === activeId) || list[0],
    [list, activeId]
  );

  const needsYou = useMemo(() => {
    return list.filter((m) => {
      const p = pulse[m.leagueId];
      if (!p) return false;
      // Active room already has the big hero for picks
      if (m.leagueId === activeId) return false;
      return p.needsPicks;
    });
  }, [list, pulse, activeId]);

  // Critical: 0–1 leagues → zero DOM (no empty card, no spacing)
  if (list.length < 2 || !active) return null;

  const activePack = getSportPack(active.sportId || "cfb");

  async function enterRoom(leagueId: string, goPicks: boolean) {
    if (busyId) return;
    setError(null);
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
    if (goPicks) {
      router.push("/picks");
      router.refresh();
      return;
    }
    if (onSwitched) onSwitched();
    else window.location.href = "/";
  }

  const ordered = [...list].sort((a, b) => {
    if (a.leagueId === activeId) return -1;
    if (b.leagueId === activeId) return 1;
    // Needs picks first among the rest
    const an = pulse[a.leagueId]?.needsPicks ? 0 : 1;
    const bn = pulse[b.leagueId]?.needsPicks ? 0 : 1;
    if (an !== bn) return an - bn;
    return (a.leagueName || "").localeCompare(b.leagueName || "");
  });

  return (
    <section
      className="mb-4 rounded-xl border border-primary/30 bg-black/45 backdrop-blur-sm overflow-hidden"
      aria-label="Your leagues"
    >
      {/* Collapsed bar — one line */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-2 min-h-[48px] touch-manipulation hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            Your rooms · {list.length}
          </p>
          <p className="text-xs text-foreground font-medium truncate mt-0.5">
            <span className="text-primary">
              {activePack.emoji} {activePack.shortLabel}
            </span>
            <span className="text-muted"> · </span>
            <span className="truncate">{active.leagueName}</span>
            <span className="text-primary font-bold"> · here</span>
            {needsYou.length > 0 && (
              <>
                <span className="text-muted"> · </span>
                <span className="text-amber-300 font-semibold">
                  {needsYou.length === 1
                    ? `${getSportPack(needsYou[0].sportId || "cfb").shortLabel} needs picks`
                    : `${needsYou.length} need picks`}
                </span>
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 text-muted text-xs font-bold px-1">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {/* Needs-you chips (other rooms only) — visible even when collapsed */}
      {!expanded && needsYou.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
          {needsYou.slice(0, 3).map((m) => {
            const pack = getSportPack(m.sportId || "cfb");
            const p = pulse[m.leagueId];
            const week =
              p?.openWeek != null ? `W${p.openWeek}` : "picks";
            return (
              <button
                key={m.leagueId}
                type="button"
                disabled={!!busyId}
                onClick={() => void enterRoom(m.leagueId, true)}
                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-100 text-[11px] font-bold touch-manipulation disabled:opacity-50"
              >
                {pack.emoji} {pack.shortLabel} · lock {week}
                {busyId === m.leagueId ? "…" : " →"}
              </button>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-1.5">
          {ordered.map((m) => {
            const pack = getSportPack(m.sportId || "cfb");
            const isActive = m.leagueId === activeId;
            const p = pulse[m.leagueId];
            const busy = busyId === m.leagueId;
            const isHost =
              p?.isHost ||
              m.role === "commissioner" ||
              m.commissionerId === me;

            let need = "";
            if (isActive) need = "You're here";
            else if (p?.needsPicks && p.openWeek != null)
              need = `Needs picks · Week ${p.openWeek}`;
            else if (p?.needsPicks) need = "Needs picks";
            else if (p?.locked) need = "Picks locked";
            else if (isHost) need = "Host room";
            else need = "Switch anytime";

            return (
              <div
                key={m.leagueId}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 min-h-[44px] ${
                  isActive ? "bg-primary/10" : "bg-background/30"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    <span className="text-primary mr-1">
                      {pack.emoji} {pack.shortLabel}
                    </span>
                    {m.leagueName}
                    {isHost && !isActive && (
                      <span className="ml-1 text-[9px] uppercase text-amber-200/80">
                        host
                      </span>
                    )}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 ${
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
                      className="min-h-[36px] px-2.5 rounded-lg bg-primary text-black text-[11px] font-bold disabled:opacity-50"
                    >
                      Picks
                    </button>
                  ) : p?.needsPicks ? (
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => void enterRoom(m.leagueId, true)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-amber-400/50 text-amber-100 text-[11px] font-bold disabled:opacity-50"
                    >
                      {busy ? "…" : "Lock picks"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => void enterRoom(m.leagueId, false)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-border text-[11px] font-bold text-muted hover:text-foreground disabled:opacity-50"
                    >
                      {busy ? "…" : "Enter"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 pb-0.5">
            <Link
              href="/account"
              className="text-[11px] font-semibold text-primary min-h-[32px] inline-flex items-center"
            >
              Manage leagues →
            </Link>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[11px] text-muted font-medium min-h-[32px] px-2"
            >
              Collapse
            </button>
          </div>
          {error && (
            <p className="text-xs text-danger font-medium pb-1">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
