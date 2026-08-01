"use client";

/**
 * Slim multi-league switcher on Home.
 *
 * SINGLE LEAGUE: null — no chrome, no gap.
 *
 * 2–4 LEAGUES: collapsed bar + up to 3 needs-picks chips; expand = full short list.
 *
 * 5–10+ LEAGUES (scale mode):
 *   Collapsed: "Your rooms · 10 · CFB here · 4 need picks"
 *   Chips: max 2 + "+N more"
 *   Expand: active + rooms that need picks only (scrollable)
 *   Quiet rooms stay on Account — Home is a job list, not a directory.
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

/** At this count we stop listing “quiet” rooms on Home */
const SCALE_AT = 5;
/** Max amber chips when collapsed */
const CHIP_CAP_SMALL = 3;
const CHIP_CAP_SCALE = 2;
/** Max rows in the expanded needs list before scroll */
const NEEDS_SCROLL_MAX = 6;

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

export default function MultiLeagueHomeHub({ onSwitched }: Props) {
  const router = useRouter();
  const [list, setList] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeaguePulse>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /** Scale mode only: show quiet rooms in expand */
  const [showQuiet, setShowQuiet] = useState(false);

  const activeId = getSession()?.leagueId || getLeague()?.id || "";
  const me = getSession()?.playerId;

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      if (ms.length < 2) {
        setList([]);
        setPulse({});
        setExpanded(false);
        setShowQuiet(false);
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
      if (!p || m.leagueId === activeId) return false;
      return p.needsPicks;
    });
  }, [list, pulse, activeId]);

  const quietOthers = useMemo(() => {
    return list.filter((m) => {
      if (m.leagueId === activeId) return false;
      return !pulse[m.leagueId]?.needsPicks;
    });
  }, [list, pulse, activeId]);

  const scale = list.length >= SCALE_AT;

  /** Rows to paint when expanded */
  const expandedRows: LeagueMembership[] = useMemo(() => {
    const activeRow = list.find((m) => m.leagueId === activeId);
    const needs = [...needsYou].sort((a, b) =>
      (a.leagueName || "").localeCompare(b.leagueName || "")
    );
    if (!scale || showQuiet) {
      const rest = list
        .filter((m) => m.leagueId !== activeId && !needsYou.includes(m))
        .sort((a, b) =>
          (a.leagueName || "").localeCompare(b.leagueName || "")
        );
      return [activeRow, ...needs, ...rest].filter(
        Boolean
      ) as LeagueMembership[];
    }
    return [activeRow, ...needs].filter(Boolean) as LeagueMembership[];
  }, [list, activeId, needsYou, scale, showQuiet]);

  if (list.length < 2 || !active) return null;

  const chipCap = scale ? CHIP_CAP_SCALE : CHIP_CAP_SMALL;
  const chipShow = needsYou.slice(0, chipCap);
  const chipMore = needsYou.length - chipShow.length;
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
      aria-label="Your leagues"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-2 min-h-[48px] touch-manipulation hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            Your rooms · {list.length}
            {scale && (
              <span className="text-muted font-semibold normal-case tracking-normal ml-1">
                · jobs only
              </span>
            )}
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
            {needsYou.length === 0 && scale && (
              <>
                <span className="text-muted"> · </span>
                <span className="text-muted font-normal">all caught up</span>
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 text-muted text-xs font-bold px-1">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {/* Collapsed: needs chips + overflow count */}
      {!expanded && needsYou.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5 items-center">
          {chipShow.map((m) => {
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
                className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-100 text-[11px] font-bold touch-manipulation disabled:opacity-50 max-w-[11rem] truncate"
                title={m.leagueName}
              >
                {pack.emoji} {pack.shortLabel} · {week}
                {busyId === m.leagueId ? "…" : " →"}
              </button>
            );
          })}
          {chipMore > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center min-h-[36px] px-2.5 rounded-full border border-border text-muted text-[11px] font-bold touch-manipulation"
            >
              +{chipMore} more
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2">
          {scale && (
            <p className="text-[10px] text-muted leading-relaxed mb-2">
              With {list.length} rooms, Home only lists{" "}
              <strong className="text-foreground">here</strong> +{" "}
              <strong className="text-amber-200">needs picks</strong>. Full
              directory lives on Account.
            </p>
          )}

          <div
            className={`space-y-1.5 ${
              expandedRows.length > NEEDS_SCROLL_MAX
                ? "max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain pr-0.5"
                : ""
            }`}
          >
            {expandedRows.map((m) => {
              const pack = getSportPack(m.sportId || "cfb");
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
          </div>

          {scale && quietOthers.length > 0 && !showQuiet && (
            <button
              type="button"
              onClick={() => setShowQuiet(true)}
              className="w-full mt-2 min-h-[40px] rounded-lg border border-border/60 text-[11px] font-semibold text-muted hover:text-foreground"
            >
              +{quietOthers.length} quiet room
              {quietOthers.length === 1 ? "" : "s"} (no open picks)
            </button>
          )}
          {scale && showQuiet && quietOthers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQuiet(false)}
              className="w-full mt-2 min-h-[36px] text-[11px] font-medium text-muted"
            >
              Hide quiet rooms
            </button>
          )}

          <div className="flex items-center justify-between pt-2 pb-0.5 gap-2">
            <Link
              href="/account"
              className="text-[11px] font-semibold text-primary min-h-[32px] inline-flex items-center"
            >
              {scale
                ? `All ${list.length} on Account →`
                : "Manage leagues →"}
            </Link>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setShowQuiet(false);
              }}
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
