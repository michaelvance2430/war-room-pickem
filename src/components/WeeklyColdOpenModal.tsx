"use client";

/**
 * Preseason cold-open — Gazette Network “wanted” on last year’s champ.
 * Static BREAKING NEWS GAZETTE: full article + profile face, zero caption animation.
 * Once per player · week before season · defending championship trophy only.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_FORCE_WEEKLY_COLD_OPEN,
  GAZETTE_STATION,
  getWeeklyColdOpenCopy,
  hasSeenWeeklyColdOpen,
  isWeeklyColdOpenWindowOpen,
  markWeeklyColdOpenSeen,
  resolveColdOpenSubject,
  type ColdOpenSubject,
} from "@/lib/weekly-cold-open";
import { getSession, getLeague } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  isPlayerTutorialActive,
  needsPlayerTutorial,
} from "@/lib/player-tutorial";
import { claimSessionDrama, clearSessionDrama } from "@/lib/session-drama";
import BrandMark from "@/components/BrandMark";
import Avatar from "@/components/Avatar";
import { loadLeagueTrophies } from "@/lib/trophies";
import { loadLeagueRoster } from "@/lib/cloud";
import {
  mergePriorSeasonTrophies,
  PRIOR_SEASON_YEAR,
} from "@/lib/prior-season-seed";
import { resolveLiveTrophyHolder } from "@/lib/trophy-share";

export default function WeeklyColdOpenModal() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [subject, setSubject] = useState<ColdOpenSubject | null>(null);

  const room = getLeague()?.name || "War Room";
  const sportId = getLeague()?.sportId;

  const loadSubject = useCallback(async (): Promise<ColdOpenSubject | null> => {
    const league = getLeague();
    const sid = league?.sportId || "cfb";
    let trophies = [] as Awaited<ReturnType<typeof loadLeagueTrophies>>;
    let roster: Awaited<ReturnType<typeof loadLeagueRoster>> = [];
    try {
      trophies = await loadLeagueTrophies();
    } catch {
      trophies = [];
    }
    try {
      roster = await loadLeagueRoster();
    } catch {
      roster = [];
    }
    // Always surface last-year hardware so empty rooms still get a face on the carton
    trophies = mergePriorSeasonTrophies(trophies, {
      players: roster.map((r) => ({ id: r.userId, name: r.name })),
      sportId: sid,
    });

    const base = resolveColdOpenSubject(trophies, sid);
    if (!base) return null;

    const live = resolveLiveTrophyHolder(roster, base.userId, base.name);

    return {
      year: base.year || PRIOR_SEASON_YEAR,
      name: live.name || base.name,
      userId: live.userId || base.userId,
      avatarUrl: live.avatarUrl,
    };
  }, []);

  const openBroadcast = useCallback(
    async (opts?: { preview?: boolean }) => {
      const sub = await loadSubject();
      if (!sub) return;
      setSubject(sub);
      setPreview(!!opts?.preview);
      setOpen(true);
    },
    [loadSubject]
  );

  useEffect(() => {
    function onForce(e: Event) {
      const ce = e as CustomEvent<{ preview?: boolean }>;
      const isPreview = ce.detail?.preview !== false;
      if (!isPreview) {
        if (!claimSessionDrama("weekly_cold_open")) return;
      } else {
        clearSessionDrama("weekly_cold_open");
      }
      void openBroadcast({ preview: isPreview });
    }

    window.addEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);

    if (isGuestMode()) {
      return () => {
        window.removeEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);
      };
    }

    async function tryOpen() {
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId || !league?.id) return;
      if (!isWeeklyColdOpenWindowOpen(league.sportId)) return;
      if (needsPlayerTutorial() || isPlayerTutorialActive()) return;
      try {
        if (sessionStorage.getItem("warroom-no-welcome-this-session") === "1") {
          return;
        }
      } catch {
        /* ok */
      }

      const sub = await loadSubject();
      if (!sub) return;
      if (hasSeenWeeklyColdOpen(session.playerId, league.id, sub.year)) return;
      if (!claimSessionDrama("weekly_cold_open")) return;

      setSubject(sub);
      setPreview(false);
      setOpen(true);
    }

    function onProgress() {
      void tryOpen();
    }

    const t = window.setTimeout(() => {
      void tryOpen();
    }, 900);
    window.addEventListener("warroom-first-week-progress", onProgress);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("warroom-first-week-progress", onProgress);
      window.removeEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);
    };
  }, [loadSubject]);

  function dismiss() {
    const session = getSession();
    const league = getLeague();
    if (!preview && session?.playerId && league?.id && subject) {
      markWeeklyColdOpenSeen(session.playerId, league.id, subject.year);
    }
    clearSessionDrama("weekly_cold_open");
    setOpen(false);
    setPreview(false);
  }

  if (!open || !subject) return null;

  const copy = getWeeklyColdOpenCopy(subject, sportId);
  const clock = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-open-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/93 backdrop-blur-sm"
        aria-label="Close broadcast"
        onClick={dismiss}
      />

      <div className="relative w-full sm:max-w-lg max-h-[96vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border-2 border-amber-400/50 bg-[#0a0a0a] shadow-[0_0_80px_rgba(251,191,36,0.18)] flex flex-col">
        {/* —— BREAKING NEWS GAZETTE masthead (gold palette) —— */}
        <div className="shrink-0 border-b-2 border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-amber-950/40 to-black">
          <div className="bg-amber-400 text-black px-3 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em]">
              ● Breaking news
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              Gazette
              {preview ? " · preview" : ""}
            </span>
            <span className="text-[10px] font-mono tabular-nums font-semibold">
              {clock}
            </span>
          </div>
          <div className="px-3 pt-3 pb-2.5 flex items-center gap-2.5">
            <BrandMark size={40} variant="force" className="rounded shrink-0" />
            <div className="min-w-0 flex-1 text-center">
              <h2
                id="cold-open-title"
                className="text-xl sm:text-2xl font-black tracking-tight text-amber-100 leading-none uppercase"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {GAZETTE_STATION.masthead}
              </h2>
              <p className="text-[10px] text-amber-200/75 italic mt-1">
                {GAZETTE_STATION.tagline}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-black text-amber-300 tracking-widest">
                {GAZETTE_STATION.callSign}
              </p>
              <p className="text-[8px] uppercase text-amber-400/90 font-bold">
                LIVE
              </p>
            </div>
          </div>
          <p className="text-[9px] text-amber-200/50 text-center pb-2 tracking-wide uppercase">
            {room} · {GAZETTE_STATION.desk} · week before season
          </p>
        </div>

        {/* —— HAVE YOU SEEN THIS MAN? wanted carton with profile pic —— */}
        <div className="relative bg-gradient-to-b from-amber-950/50 via-black to-black border-b border-amber-400/25 px-4 pt-5 pb-4 shrink-0">
          <div className="absolute inset-0 opacity-[0.1] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_2px,rgba(0,0,0,0.5)_4px)]" />
          <div className="relative mx-auto max-w-sm rounded-xl border-2 border-amber-400/55 bg-[#0c0a06] shadow-[0_0_40px_rgba(251,191,36,0.12)] overflow-hidden">
            <div className="bg-amber-400 text-black px-3 py-2 text-center">
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em]">
                {copy.wanted}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-5">
              <div className="rounded-full ring-4 ring-amber-400/70 ring-offset-4 ring-offset-black shadow-[0_0_28px_rgba(251,191,36,0.35)]">
                <Avatar
                  name={subject.name}
                  avatarUrl={subject.avatarUrl}
                  userId={subject.userId}
                  size="xl"
                />
              </div>
              <div className="text-center space-y-1">
                <p
                  className="text-xl sm:text-2xl font-black text-amber-50 tracking-tight"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {subject.name}
                </p>
                {copy.phonetic && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">
                    {copy.phonetic}
                  </p>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
                  {copy.hardwareLabel}
                </p>
              </div>
            </div>
            <div className="bg-amber-400/15 border-t border-amber-400/30 px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                Last year&apos;s championship · target on back
              </p>
            </div>
          </div>
        </div>

        {/* —— Full article — all copy visible immediately, zero animation —— */}
        <div className="px-4 py-3 space-y-3 text-sm text-muted leading-relaxed overflow-y-auto flex-1 min-h-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            From the Gazette newsroom
            {copy.phonetic ? ` · ${copy.phonetic}` : ""}
          </p>
          <h3
            className="text-base sm:text-lg font-black text-amber-50 leading-snug"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {copy.headline}
          </h3>
          <p className="text-foreground font-medium leading-relaxed">
            {copy.body}
          </p>
          <p className="text-amber-100/95 font-semibold border-l-2 border-amber-400/60 pl-2.5 leading-relaxed">
            {copy.kalshi}
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            One-time preseason drop — the week before kickoff. When the host
            scores a week, the full{" "}
            <Link
              href="/gazette"
              onClick={dismiss}
              className="text-amber-300 font-semibold underline"
            >
              Gazette
            </Link>{" "}
            still drops with crowns, shame, and the works.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-amber-400/20 shrink-0 flex flex-col gap-2 bg-black/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/trophy-room"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/45 text-amber-100 font-bold text-sm flex items-center justify-center hover:bg-amber-500/10"
            >
              See the hardware
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm"
            >
              {preview ? "Close preview" : copy.cta}
            </button>
          </div>
          <p className="text-[10px] text-muted text-center">
            {preview
              ? "Foundry preview · does not count as this season’s cold open"
              : "Once per season · week before open · last year’s champ"}
          </p>
        </div>
      </div>
    </div>
  );
}
