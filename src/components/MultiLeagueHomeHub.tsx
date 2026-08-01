"use client";

/**
 * Account-level strip on Home when you're in 2+ leagues.
 * Home stays the active-league room; this reminds you other rooms exist
 * and lets you switch or jump straight to picks for another card.
 */

import { useCallback, useEffect, useState } from "react";
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
  /** Latest week we found a picks row for this user */
  lastPickWeek: number | null;
  locked: boolean;
  hasRow: boolean;
};

type Props = {
  /** After switch — parent reloads league chrome */
  onSwitched?: () => void;
};

export default function MultiLeagueHomeHub({ onSwitched }: Props) {
  const router = useRouter();
  const [list, setList] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeaguePulse>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeId = getSession()?.leagueId || getLeague()?.id || "";

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      setList(ms);
      if (ms.length < 2) {
        setPulse({});
        return;
      }
      // Lightweight: latest pick row per league for THIS user (no sides)
      const session = getSession();
      const uid = session?.playerId;
      if (!uid) return;
      const supabase = createClient();
      const next: Record<string, LeaguePulse> = {};
      await Promise.all(
        ms.map(async (m) => {
          try {
            const { data } = await supabase
              .from("picks")
              .select("week_number, locked_at")
              .eq("league_id", m.leagueId)
              .eq("user_id", uid)
              .order("week_number", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!data) {
              next[m.leagueId] = {
                leagueId: m.leagueId,
                lastPickWeek: null,
                locked: false,
                hasRow: false,
              };
              return;
            }
            next[m.leagueId] = {
              leagueId: m.leagueId,
              lastPickWeek: Number(data.week_number),
              locked: !!(data as { locked_at?: string | null }).locked_at,
              hasRow: true,
            };
          } catch {
            next[m.leagueId] = {
              leagueId: m.leagueId,
              lastPickWeek: null,
              locked: false,
              hasRow: false,
            };
          }
        })
      );
      setPulse(next);
    } catch {
      /* ignore — hub is optional */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeId]);

  if (list.length < 2) return null;

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
    if (onSwitched) {
      onSwitched();
    } else {
      window.location.href = "/";
    }
  }

  // Active first, then alpha by name
  const ordered = [...list].sort((a, b) => {
    if (a.leagueId === activeId) return -1;
    if (b.leagueId === activeId) return 1;
    return (a.leagueName || "").localeCompare(b.leagueName || "");
  });

  return (
    <section
      className="mb-5 rounded-xl border border-primary/35 bg-black/50 backdrop-blur-sm p-3 sm:p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]"
      aria-label="Your leagues"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Account · {list.length} leagues
          </p>
          <h2 className="text-sm font-bold text-foreground">
            Your rooms
          </h2>
          <p className="text-[11px] text-muted leading-relaxed mt-0.5 max-w-xl">
            Home is{" "}
            <strong className="text-foreground">this week&apos;s room</strong>
            {" "}below. Jump to another league anytime — picks and invites stay
            with each room.
          </p>
        </div>
        <Link
          href="/account"
          className="shrink-0 text-[11px] font-semibold text-primary min-h-[36px] inline-flex items-center px-2"
        >
          Account →
        </Link>
      </div>

      <ul className="space-y-2">
        {ordered.map((m) => {
          const pack = getSportPack(m.sportId || "cfb");
          const active = m.leagueId === activeId;
          const p = pulse[m.leagueId];
          const busy = busyId === m.leagueId;
          let statusLine = "Open room · switch anytime";
          if (p?.hasRow && p.locked) {
            statusLine = `Picks locked · Week ${p.lastPickWeek}`;
          } else if (p?.hasRow && !p.locked) {
            statusLine = `Slip started · Week ${p.lastPickWeek} — finish & lock`;
          } else if (p && !p.hasRow) {
            statusLine = "No picks yet this season";
          }

          return (
            <li
              key={m.leagueId}
              className={`rounded-lg border px-3 py-2.5 ${
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-background/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary/90">
                      {pack.emoji} {pack.shortLabel}
                    </span>
                    {active && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary text-black">
                        You&apos;re here
                      </span>
                    )}
                    {(m.role === "commissioner" ||
                      m.commissionerId === getSession()?.playerId) && (
                      <span className="text-[9px] font-bold uppercase text-amber-200/90">
                        Host
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {m.leagueName}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">{statusLine}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!active && (
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => void enterRoom(m.leagueId, false)}
                      className="min-h-[40px] px-3 rounded-lg border border-border text-xs font-bold text-foreground hover:border-primary/50 disabled:opacity-50 touch-manipulation"
                    >
                      {busy ? "…" : "Enter room"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => void enterRoom(m.leagueId, true)}
                    className={`min-h-[40px] px-3 rounded-lg text-xs font-bold disabled:opacity-50 touch-manipulation ${
                      active
                        ? "bg-primary text-black"
                        : "border border-primary/40 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {busy ? "…" : active ? "Make picks" : "Picks for this room"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-xs text-danger mt-2 font-medium">{error}</p>
      )}
      <p className="text-[10px] text-muted mt-2 leading-relaxed">
        Tip: wrong sport on an invite? Check which room is{" "}
        <strong className="text-foreground">You&apos;re here</strong> first.
      </p>
    </section>
  );
}
