"use client";

/**
 * Season Cold Open — production reading experience.
 *
 * Emotion: heat on last year’s champ + “you’re in the right room.”
 * Stays open until the player closes it. Article scrolls; background does not.
 * Sticky ✕ always visible. Preview never burns once-per-season.
 *
 * Multi-league: always resolves subject + copy from the *active* league
 * (sport + defending champ year). CFB / NFL / Foundry rooms share this shell;
 * switch league in Foundry to preview each. Future seasons re-fire when
 * champ year advances (seen key is player · league · year).
 *
 * forceOnly: Foundry / War Room Moments Test — no auto-launch.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

type Props = {
  /** War Room Moments / Foundry: force event only — never auto-open */
  forceOnly?: boolean;
};

export default function WeeklyColdOpenModal({ forceOnly = false }: Props) {
  const pathname = usePathname();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [subject, setSubject] = useState<ColdOpenSubject | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openRef = useRef(false);
  const previewRef = useRef(false);
  const subjectRef = useRef<ColdOpenSubject | null>(null);
  const pathAtOpen = useRef<string | null>(null);
  const scrollYRef = useRef(0);
  const bodyLocked = useRef(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const room = getLeague()?.name || "War Room";
  const sportId = getLeague()?.sportId;
  const sportLabel =
    sportId === "nfl"
      ? "NFL"
      : sportId === "soccer_wwc"
        ? "WWC"
        : "CFB";

  const lockBackground = useCallback(() => {
    if (typeof document === "undefined" || bodyLocked.current) return;
    bodyLocked.current = true;
    scrollYRef.current =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;
    const b = document.body;
    const h = document.documentElement;
    b.style.overflow = "hidden";
    b.style.position = "fixed";
    b.style.top = `-${scrollYRef.current}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.touchAction = "none";
    h.style.overflow = "hidden";
    h.style.touchAction = "none";
  }, []);

  const unlockBackground = useCallback(() => {
    if (typeof document === "undefined" || !bodyLocked.current) return;
    bodyLocked.current = false;
    const y = scrollYRef.current;
    const b = document.body;
    const h = document.documentElement;
    b.style.overflow = "";
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    b.style.touchAction = "";
    h.style.overflow = "";
    h.style.touchAction = "";
    try {
      window.scrollTo(0, y);
    } catch {
      try {
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
      } catch {
        /* ok */
      }
    }
  }, []);

  const hardClose = useCallback(() => {
    openRef.current = false;
    clearSessionDrama("weekly_cold_open");
    setOpen(false);
    setPreview(false);
    setSubject(null);
    setLoading(false);
    setLoadError(null);
    pathAtOpen.current = null;
    unlockBackground();
    try {
      const el = openerRef.current;
      openerRef.current = null;
      if (el && typeof el.focus === "function") {
        window.setTimeout(() => el.focus(), 0);
      }
    } catch {
      /* ok */
    }
    try {
      if (window.location.pathname.startsWith("/founder")) {
        document
          .getElementById("war-room-moments")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch {
      /* ok */
    }
  }, [unlockBackground]);

  const dismiss = useCallback(
    (opts?: { markSeen?: boolean }) => {
      const session = getSession();
      const league = getLeague();
      const sub = subjectRef.current;
      if (
        opts?.markSeen !== false &&
        !previewRef.current &&
        session?.playerId &&
        league?.id &&
        sub
      ) {
        try {
          markWeeklyColdOpenSeen(session.playerId, league.id, sub.year);
        } catch {
          /* ok */
        }
      }
      hardClose();
    },
    [hardClose]
  );

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
      setLoading(true);
      setLoadError(null);
      try {
        openerRef.current =
          (document.activeElement as HTMLElement | null) || null;
      } catch {
        openerRef.current = null;
      }
      try {
        const sub = await loadSubject();
        if (!sub) {
          setLoadError(
            "No defending champ on file for this room yet. Seed trophies or wait for last year’s hardware."
          );
          setLoading(false);
          return;
        }
        subjectRef.current = sub;
        previewRef.current = !!opts?.preview;
        setSubject(sub);
        setPreview(!!opts?.preview);
        setOpen(true);
        openRef.current = true;
        pathAtOpen.current =
          typeof window !== "undefined" ? window.location.pathname : null;
        lockBackground();
        setLoading(false);
        window.setTimeout(() => {
          try {
            closeBtnRef.current?.focus();
          } catch {
            /* ok */
          }
        }, 40);
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Cold Open failed to load"
        );
        setLoading(false);
        hardClose();
      }
    },
    [loadSubject, lockBackground, hardClose]
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

    // forceOnly (Foundry Test): never auto-launch
    if (forceOnly || isGuestMode()) {
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

      void openBroadcast({ preview: false });
    }

    const t = window.setTimeout(() => {
      void tryOpen();
    }, 900);
    function onProgress() {
      void tryOpen();
    }
    window.addEventListener("warroom-first-week-progress", onProgress);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("warroom-first-week-progress", onProgress);
      window.removeEventListener(EVENT_FORCE_WEEKLY_COLD_OPEN, onForce);
    };
  }, [forceOnly, loadSubject, openBroadcast]);

  // Escape always closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!openRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss({ markSeen: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  // Route change → full cleanup
  useEffect(() => {
    if (!openRef.current || pathAtOpen.current == null) return;
    if (pathname !== pathAtOpen.current) {
      dismiss({ markSeen: false });
    }
  }, [pathname, dismiss]);

  // Unmount → always release background
  useEffect(() => {
    return () => {
      openRef.current = false;
      clearSessionDrama("weekly_cold_open");
      if (bodyLocked.current) {
        bodyLocked.current = false;
        const y = scrollYRef.current;
        try {
          document.body.style.overflow = "";
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.left = "";
          document.body.style.right = "";
          document.body.style.width = "";
          document.body.style.touchAction = "";
          document.documentElement.style.overflow = "";
          document.documentElement.style.touchAction = "";
          window.scrollTo(0, y);
        } catch {
          /* ok */
        }
      }
    };
  }, []);

  // Focus trap inside shell
  useEffect(() => {
    if (!open) return;
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !shellRef.current) return;
      const root = shellRef.current;
      const nodes = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(nodes).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  if (loading && !open) {
    return (
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75"
        role="status"
        data-moment="season_cold_open"
      >
        <p className="text-sm font-bold text-amber-100">Loading Cold Open…</p>
      </div>
    );
  }

  if (loadError && !open) {
    return (
      <div
        className="fixed bottom-24 left-0 right-0 z-[140] px-3 pointer-events-none"
        role="alert"
      >
        <div className="pointer-events-auto max-w-md mx-auto rounded-xl border border-amber-400/40 bg-card p-3 text-xs text-amber-100">
          {loadError}
          <button
            type="button"
            className="block mt-2 underline text-muted"
            onClick={() => setLoadError(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!open || !subject) return null;

  const league = getLeague();
  const copy = getWeeklyColdOpenCopy(subject, {
    sportId: sportId ?? league?.sportId,
    leagueId: league?.id,
    leagueName: league?.name || room,
    preview: preview || forceOnly,
  });
  const clock = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-[140] flex items-stretch sm:items-center justify-center p-0 sm:p-3"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
      data-moment="season_cold_open"
      data-fullscreen-overlay="cold-open"
    >
      {/* Backdrop — frozen, not the scroll container */}
      <button
        type="button"
        className="absolute inset-0 bg-black/93 backdrop-blur-sm"
        aria-label="Close Cold Open"
        tabIndex={-1}
        onClick={() => dismiss({ markSeen: false })}
      />

      {/* Shell: fixed height; only article scrolls */}
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex flex-col w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[min(94dvh,900px)] overflow-hidden rounded-t-2xl sm:rounded-2xl border-2 border-amber-400/50 bg-[#0a0a0a] shadow-[0_0_80px_rgba(251,191,36,0.18)]"
      >
        {/* Sticky header — always-visible close */}
        <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b-2 border-amber-400/40 bg-gradient-to-r from-amber-500 to-amber-400 text-black">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">
              ● Live · Season Cold Open · {sportLabel}
            </p>
            <p
              id={titleId}
              className="text-sm font-black uppercase tracking-tight truncate"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {GAZETTE_STATION.masthead}
            </p>
            <p className="text-[10px] font-extrabold truncate">
              {room}
              {subject.year ? ` · ${subject.year} champ` : ""} · THE HUNT IS OPEN
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => dismiss({ markSeen: !preview })}
            className="shrink-0 min-w-[44px] min-h-[44px] rounded-lg border-2 border-black/30 bg-black/10 text-black text-xl font-black leading-none flex items-center justify-center hover:bg-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-black touch-manipulation"
            aria-label="Close Cold Open"
          >
            ✕
          </button>
        </header>

        {/* Scrollable article only */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          {/* Live strip */}
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-amber-950/80 border-b border-amber-400/25 text-amber-100/90">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Gazette {preview ? "· preview" : ""}
            </span>
            <span className="text-[10px] font-mono tabular-nums font-semibold">
              {clock}
            </span>
            <span className="text-[10px] font-black tracking-widest text-amber-300">
              {GAZETTE_STATION.callSign} · LIVE
            </span>
          </div>

          <div className="px-3 pt-3 pb-2 flex items-center gap-2.5 border-b border-amber-400/20">
            <BrandMark size={36} variant="force" className="rounded shrink-0" />
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] text-amber-200/75 italic">
                {GAZETTE_STATION.tagline}
              </p>
              <p className="text-[9px] text-amber-200/50 tracking-wide uppercase mt-0.5">
                {room} · {GAZETTE_STATION.desk} · week before season
              </p>
            </div>
          </div>

          {/* Wanted carton */}
          <div className="relative bg-gradient-to-b from-amber-950/50 via-black to-black border-b border-amber-400/25 px-4 pt-5 pb-4">
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
              <div className="bg-amber-400/15 border-t border-amber-400/30 px-3 py-2 text-center space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                  Last year&apos;s championship · target on back
                </p>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-100">
                  Competition is brewing · load your card
                </p>
              </div>
            </div>
          </div>

          {/* Full article — stay open to read */}
          <div className="px-4 py-4 space-y-3 text-sm text-muted leading-relaxed">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
              The room is awake · the chase is the product
            </p>
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
            <p className="text-[11px] text-muted leading-relaxed">{copy.foot}</p>
            <p className="text-[10px] text-muted/80 text-center pt-2 pb-1">
              {preview || forceOnly
                ? `Preview · pack ${copy.packId} · does not burn once-per-season`
                : copy.editionLine}
            </p>
          </div>

          {/* Secondary actions (scroll with article; ✕ is the always-on exit) */}
          <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 flex flex-col gap-2 border-t border-amber-400/15 bg-black/60">
            <button
              type="button"
              onClick={() => dismiss({ markSeen: !preview })}
              className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm touch-manipulation active:scale-[0.99]"
            >
              {preview || forceOnly
                ? "I'm ready — back to Moments"
                : copy.cta || "I'm hunting — open the room"}
            </button>
            {!preview && !forceOnly && (
              <a
                href="/trophy-room"
                onClick={() => dismiss({ markSeen: true })}
                className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/45 text-amber-100 font-bold text-sm flex items-center justify-center hover:bg-amber-500/10"
              >
                See the hardware
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
