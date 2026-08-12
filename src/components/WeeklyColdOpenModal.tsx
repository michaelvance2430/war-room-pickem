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
  coldOpenSeasonOpenMs,
  markWeeklyColdOpenSeen,
  resolveColdOpenSubject,
  type ColdOpenSubject,
} from "@/lib/weekly-cold-open";
import { getSession, getLeague } from "@/lib/league";
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
import { acquireBodyLock } from "@/lib/smooth";
import {
  claimPresenterWhenIdle,
  releasePresenter,
} from "@/lib/moments/presenter";

type Props = {
  /** War Room Moments / Foundry: force event only — never auto-open */
  forceOnly?: boolean;
};

const COLD_OPEN_OWNER = "season-cold-open";

type CloseReason =
  | "done"
  | "x"
  | "escape"
  | "route"
  | "unmount"
  | "error"
  | "backdrop";

/**
 * Single exit path for Done / X / Escape / route / unmount / error / backdrop.
 * Releases presenter + body lock ownership so the next Moment can open cleanly.
 */
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
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const releaseLockRef = useRef<(() => void) | null>(null);
  const closingRef = useRef(false);

  const room = getLeague()?.name || "War Room";
  const sportId = getLeague()?.sportId;

  const releaseBody = useCallback(() => {
    if (releaseLockRef.current) {
      try {
        releaseLockRef.current();
      } catch {
        /* ok */
      }
      releaseLockRef.current = null;
    }
  }, []);

  const closeColdOpen = useCallback(
    (opts?: { markSeen?: boolean; reason?: CloseReason }) => {
      if (closingRef.current && !openRef.current) return;
      closingRef.current = true;
      const reason = opts?.reason || "done";
      try {
        console.log(`[WR-COLD-OPEN] close reason=${reason}`);
      } catch {
        /* ok */
      }

      const session = getSession();
      const league = getLeague();
      const sub = subjectRef.current;
      if (
        opts?.markSeen === true &&
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

      openRef.current = false;
      clearSessionDrama("weekly_cold_open");
      setOpen(false);
      setPreview(false);
      setSubject(null);
      subjectRef.current = null;
      setLoading(false);
      setLoadError(null);
      pathAtOpen.current = null;

      // Ownership release — order: body lock then presenter stage
      releaseBody();
      releasePresenter(COLD_OPEN_OWNER);

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

      // Allow next Moment after paint confirms unmount path
      window.setTimeout(() => {
        closingRef.current = false;
        try {
          console.log("[WR-COLD-OPEN] cleanup complete — stage idle");
        } catch {
          /* ok */
        }
      }, 0);
    },
    [releaseBody]
  );

  /** Alias — all UI exits use the same function */
  const dismiss = useCallback(
    (opts?: { markSeen?: boolean; reason?: CloseReason }) => {
      closeColdOpen(opts);
    },
    [closeColdOpen]
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
        // Wait for prior Moment (e.g. Gazette) to fully release stage + locks
        await claimPresenterWhenIdle(COLD_OPEN_OWNER, 2500);

        const sub = await loadSubject();
        if (!sub) {
          setLoadError(
            "No defending champ on file for this room yet. Seed trophies or wait for last year’s hardware."
          );
          setLoading(false);
          releasePresenter(COLD_OPEN_OWNER);
          return;
        }
        subjectRef.current = sub;
        previewRef.current = !!opts?.preview;
        setSubject(sub);
        setPreview(!!opts?.preview);
        // "Viewed once" means the broadcast successfully reached the player.
        // Burn the player · league · champ-year key at open so alternate exits
        // (backdrop, Escape, or route change) cannot replay it on a later login.
        if (!opts?.preview) {
          const session = getSession();
          const league = getLeague();
          if (session?.playerId && league?.id) {
            markWeeklyColdOpenSeen(session.playerId, league.id, sub.year);
          }
        }
        setOpen(true);
        openRef.current = true;
        closingRef.current = false;
        pathAtOpen.current =
          typeof window !== "undefined" ? window.location.pathname : null;
        // Named body lock — same manager as Gazette (no local position:fixed orphan)
        if (!releaseLockRef.current) {
          releaseLockRef.current = acquireBodyLock(COLD_OPEN_OWNER);
        }
        try {
          console.log("[WR-COLD-OPEN] open");
        } catch {
          /* ok */
        }
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
        closeColdOpen({ reason: "error", markSeen: false });
      }
    },
    [loadSubject, closeColdOpen]
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
    if (forceOnly) {
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

  // Escape — same cleanup as Done / X
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!openRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      closeColdOpen({ markSeen: false, reason: "escape" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeColdOpen]);

  // Route change → full cleanup
  useEffect(() => {
    if (!openRef.current || pathAtOpen.current == null) return;
    if (pathname !== pathAtOpen.current) {
      closeColdOpen({ markSeen: false, reason: "route" });
    }
  }, [pathname, closeColdOpen]);

  // Unmount → always release ownership (same close path)
  useEffect(() => {
    return () => {
      if (openRef.current || releaseLockRef.current) {
        openRef.current = false;
        clearSessionDrama("weekly_cold_open");
        releaseBody();
        releasePresenter(COLD_OPEN_OWNER);
      }
    };
  }, [releaseBody]);

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
  const openMs = coldOpenSeasonOpenMs(sportId ?? league?.sportId);
  const remainingMs = openMs != null ? Math.max(0, openMs - Date.now()) : null;
  const countdownLabel =
    remainingMs == null
      ? "OPENING WEEK APPROACHES"
      : remainingMs >= 24 * 60 * 60 * 1000
        ? `T−${Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))} DAYS`
        : `T−${Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)))} HOURS`;

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
        onClick={() => dismiss({ markSeen: false, reason: "backdrop" })}
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
              ● Live · Season Cold Open · {copy.sportTag}
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
              {subject.year ? ` · ${subject.year} ${copy.sportTag} champ` : ""} ·
              THE HUNT IS OPEN
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() =>
              dismiss({ markSeen: !preview, reason: "x" })
            }
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
              The Dispatch {preview ? "· preview" : ""}
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

          {/* Broadcast reveal — the emotional center of the Cold Open */}
          <section className="relative isolate overflow-hidden border-b border-amber-400/30 bg-black px-4 pb-6 pt-5 text-center">
            <div
              className="absolute inset-0 -z-20"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, rgba(251,191,36,.28), transparent 28%), radial-gradient(circle at 50% 90%, rgba(127,29,29,.45), transparent 42%), #050505",
              }}
            />
            <div className="absolute inset-0 -z-10 opacity-[0.16] bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.16)_3px,rgba(255,255,255,0.16)_4px)]" />
            <div className="pointer-events-none absolute -left-16 top-4 h-72 w-28 rotate-[18deg] bg-gradient-to-b from-amber-200/20 to-transparent blur-xl" />
            <div className="pointer-events-none absolute -right-16 top-4 h-72 w-28 -rotate-[18deg] bg-gradient-to-b from-amber-200/20 to-transparent blur-xl" />

            <p className="cold-open-rise text-[10px] font-black uppercase tracking-[0.32em] text-amber-300">
              Last season ended with one name
            </p>
            <p className="cold-open-rise cold-open-delay-1 mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">
              {countdownLabel} · {copy.sportTag} SEASON
            </p>

            <div className="cold-open-champ cold-open-delay-2 relative mx-auto mt-5 w-fit">
              <div className="absolute -inset-4 rounded-full border border-amber-300/30 shadow-[0_0_70px_rgba(251,191,36,0.38)]" />
              <div className="relative rounded-full ring-4 ring-amber-300 ring-offset-[6px] ring-offset-black">
                <Avatar
                  name={subject.name}
                  avatarUrl={subject.avatarUrl}
                  userId={subject.userId}
                  size="xl"
                />
              </div>
              <span
                className="absolute -right-5 -top-7 rotate-12 text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]"
                aria-hidden
              >
                👑
              </span>
            </div>

            <p className="cold-open-rise cold-open-delay-3 mt-6 text-[10px] font-black uppercase tracking-[0.26em] text-amber-400">
              Defending champion
            </p>
            <h2
              className="cold-open-name cold-open-delay-3 mt-1 break-words text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {subject.name}
            </h2>
            {copy.phonetic && (
              <p className="cold-open-rise cold-open-delay-4 mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
                {copy.phonetic}
              </p>
            )}
            <div className="cold-open-rise cold-open-delay-4 mx-auto mt-4 max-w-sm border-y border-amber-400/45 bg-amber-400/10 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                {copy.hardwareLabel}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                The trophy is theirs. The target is too.
              </p>
            </div>
            <p className="cold-open-rise cold-open-delay-5 mt-5 text-xl font-black uppercase leading-tight text-red-400 sm:text-2xl">
              Everyone else is coming.
            </p>
            <p className="cold-open-rise cold-open-delay-5 mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
              {copy.wanted} · {copy.cartonBanner}
            </p>
          </section>

          {/* Case file — story after the reveal */}
          <div className="px-4 py-5 space-y-4 text-sm text-muted leading-relaxed bg-gradient-to-b from-[#100d07] to-black">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-amber-400/35" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                The case against the champ
              </p>
              <span className="h-px flex-1 bg-amber-400/35" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
              From The Dispatch newsroom
              {copy.phonetic ? ` · ${copy.phonetic}` : ""}
            </p>
            <h3
              className="text-xl sm:text-2xl font-black text-amber-50 leading-[1.08]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {copy.headline}
            </h3>
            <p className="text-[14px] text-stone-200 font-medium leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:text-5xl first-letter:font-black first-letter:leading-[0.8] first-letter:text-amber-400">
              {copy.body}
            </p>
            <p className="rounded-r-lg border-l-4 border-red-500 bg-red-950/35 px-3 py-3 text-amber-50 font-semibold leading-relaxed">
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
              onClick={() =>
                dismiss({ markSeen: !preview, reason: "done" })
              }
              className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm touch-manipulation active:scale-[0.99]"
            >
              {preview || forceOnly
                ? "I'm ready — back to Moments"
                : copy.cta || "I'm hunting — open the room"}
            </button>
            {!preview && !forceOnly && (
              <a
                href="/trophy-room"
                onClick={() =>
                  dismiss({ markSeen: true, reason: "done" })
                }
                className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/45 text-amber-100 font-bold text-sm flex items-center justify-center hover:bg-amber-500/10"
              >
                See the hardware
              </a>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes coldOpenRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes coldOpenChamp {
          0% { opacity: 0; transform: scale(.72); filter: blur(5px); }
          70% { opacity: 1; transform: scale(1.06); filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes coldOpenName {
          from { opacity: 0; transform: scaleX(.84); letter-spacing: .08em; }
          to { opacity: 1; transform: scaleX(1); letter-spacing: -.04em; }
        }
        .cold-open-rise { animation: coldOpenRise .55s ease-out both; }
        .cold-open-champ { animation: coldOpenChamp .8s cubic-bezier(.2,.8,.2,1) both; }
        .cold-open-name { animation: coldOpenName .6s ease-out both; }
        .cold-open-delay-1 { animation-delay: .15s; }
        .cold-open-delay-2 { animation-delay: .3s; }
        .cold-open-delay-3 { animation-delay: .55s; }
        .cold-open-delay-4 { animation-delay: .75s; }
        .cold-open-delay-5 { animation-delay: .95s; }
        @media (prefers-reduced-motion: reduce) {
          .cold-open-rise, .cold-open-champ, .cold-open-name {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
