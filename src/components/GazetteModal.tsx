"use client";

/**
 * Production Dispatch reader.
 *
 * Body lock: named owner "gazette-reader" via acquireBodyLock so the global
 * orphan watchdog never force-unlocks mid-read (position:fixed is intentional).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { loadLeaguePlayers } from "@/lib/cloud";
import {
  GAZETTE_ENABLED,
  markGazetteSeen,
  shouldOfferGazette,
  type GazetteEdition,
} from "@/lib/gazette";
import { notifyGazetteDone } from "@/lib/badge-celebration";
import GazettePaper from "@/components/GazettePaper";
import { acquireBodyLock } from "@/lib/smooth";
import {
  claimPresenterWhenIdle,
  releasePresenter,
} from "@/lib/moments/presenter";

const GAZETTE_LOCK_OWNER = "gazette-reader";

export default function GazetteModal() {
  const pathname = usePathname();
  const titleId = useId();
  const [edition, setEdition] = useState<GazetteEdition | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openRef = useRef(false);
  const pathAtOpen = useRef<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const editionRef = useRef<GazetteEdition | null>(null);
  const leagueIdRef = useRef<string | null>(null);
  const releaseLockRef = useRef<(() => void) | null>(null);

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

  const hardClose = useCallback(
    (opts?: { markSeen?: boolean }) => {
      const ed = editionRef.current;
      const lid = leagueIdRef.current;
      if (opts?.markSeen !== false && ed && lid) {
        try {
          markGazetteSeen(lid, ed.weekIndex);
        } catch {
          /* ok */
        }
      }
      openRef.current = false;
      editionRef.current = null;
      leagueIdRef.current = null;
      setOpen(false);
      setEdition(null);
      setLeagueId(null);
      pathAtOpen.current = null;
      releaseBody();
      releasePresenter(GAZETTE_LOCK_OWNER);
      try {
        console.log("[WR-GAZETTE] close");
      } catch {
        /* ok */
      }
      try {
        notifyGazetteDone();
      } catch {
        /* ok */
      }
    },
    [releaseBody]
  );

  const openReader = useCallback(
    async (ed: GazetteEdition, lid: string) => {
      // Wait for Cold Open (or any prior Moment) to fully release stage + locks
      await claimPresenterWhenIdle(GAZETTE_LOCK_OWNER, 2500);

      editionRef.current = ed;
      leagueIdRef.current = lid;
      setEdition(ed);
      setLeagueId(lid);
      setOpen(true);
      openRef.current = true;
      pathAtOpen.current =
        typeof window !== "undefined" ? window.location.pathname : null;
      if (!releaseLockRef.current) {
        releaseLockRef.current = acquireBodyLock(GAZETTE_LOCK_OWNER);
      }
      try {
        console.log("[WR-GAZETTE] open");
      } catch {
        /* ok */
      }
      window.setTimeout(() => {
        try {
          closeBtnRef.current?.focus();
          if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
        } catch {
          /* ok */
        }
      }, 40);
    },
    []
  );

  useEffect(() => {
    if (!GAZETTE_ENABLED) return;

    let cancelled = false;

    async function tryShow(opts?: { force?: boolean }) {
      try {
        const { isPreLockCalm } = await import("@/lib/first-week");
        const { getSession } = await import("@/lib/league");
        const { allowFoundryCeremonies } = await import(
          "@/lib/foundry-preview"
        );
        const calm = isPreLockCalm(getSession()?.playerId);
        if (calm && !opts?.force && !allowFoundryCeremonies()) {
          notifyGazetteDone();
          return;
        }
      } catch {
        /* ok */
      }

      try {
        const players = await loadLeaguePlayers();
        if (cancelled) return;
        let offer = await shouldOfferGazette(players);

        // Force path: build paper even if already seen
        if (!offer.show && opts?.force) {
          const { buildGazetteEdition, clearGazetteSeenForWeek } = await import(
            "@/lib/gazette"
          );
          const { getSession } = await import("@/lib/league");
          const session = getSession();
          if (session?.leagueId) {
            const edition = await buildGazetteEdition(players);
            if (edition) {
              try {
                clearGazetteSeenForWeek(session.leagueId, edition.weekIndex);
              } catch {
                /* ok */
              }
              offer = {
                show: true,
                edition,
                leagueId: session.leagueId,
              };
            }
          }
        }

        if (!offer.show) {
          if (!opts?.force) notifyGazetteDone();
          return;
        }
        void openReader(offer.edition, offer.leagueId);
      } catch {
        if (!opts?.force) notifyGazetteDone();
      }
    }

    const t1 = window.setTimeout(() => void tryShow(), 2200);

    function onStorage(e: StorageEvent) {
      if (e.key?.includes("warroom-rules") || e.key?.includes("gazette")) {
        void tryShow();
      }
    }
    function onForce() {
      void tryShow({ force: true });
    }
    function onScored() {
      void tryShow({ force: true });
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("warroom-force-gazette-paper", onForce);
    window.addEventListener("warroom-week-scored", onScored);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("warroom-force-gazette-paper", onForce);
      window.removeEventListener("warroom-week-scored", onScored);
    };
  }, [openReader]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!openRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      hardClose({ markSeen: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardClose]);

  useEffect(() => {
    if (!openRef.current || pathAtOpen.current == null) return;
    if (pathname !== pathAtOpen.current) {
      hardClose({ markSeen: false });
    }
  }, [pathname, hardClose]);

  useEffect(() => {
    return () => {
      openRef.current = false;
      releaseBody();
    };
  }, [releaseBody]);

  // Focus trap within shell only
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

  // Keyboard page scroll inside article body when focus is in dialog
  useEffect(() => {
    if (!open) return;
    function onKeyScroll(e: KeyboardEvent) {
      const body = scrollBodyRef.current;
      if (!body || !openRef.current) return;
      const keys = [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "Home",
        "End",
        " ",
      ];
      if (!keys.includes(e.key)) return;
      // Don't steal if user is typing in an input
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

      const max = body.scrollHeight - body.clientHeight;
      if (max <= 0) return;

      let delta = 0;
      if (e.key === "ArrowDown") delta = 40;
      else if (e.key === "ArrowUp") delta = -40;
      else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey))
        delta = body.clientHeight * 0.9;
      else if (e.key === "PageUp" || (e.key === " " && e.shiftKey))
        delta = -body.clientHeight * 0.9;
      else if (e.key === "Home") {
        e.preventDefault();
        body.scrollTop = 0;
        return;
      } else if (e.key === "End") {
        e.preventDefault();
        body.scrollTop = max;
        return;
      }
      if (delta !== 0) {
        e.preventDefault();
        body.scrollTop = Math.max(0, Math.min(max, body.scrollTop + delta));
      }
    }
    window.addEventListener("keydown", onKeyScroll);
    return () => window.removeEventListener("keydown", onKeyScroll);
  }, [open]);

  if (!open || !edition) return null;

  const issueLabel =
    edition.weekLabel ||
    edition.printedLine ||
    edition.masthead ||
    "The War Room Dispatch";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-stretch sm:items-center sm:justify-center"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
      data-moment="gazette"
      data-fullscreen-overlay="gazette"
    >
      {/* Backdrop — does not scroll, not the article container */}
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        aria-label="Close The Dispatch"
        tabIndex={-1}
        onClick={() => hardClose({ markSeen: true })}
      />

      {/*
        Shell: explicit height budget so flex child can shrink (min-height:0).
        overflow:hidden — shell itself never scrolls.
      */}
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex flex-col w-full sm:max-w-lg sm:mx-auto overflow-hidden rounded-t-2xl sm:rounded-sm shadow-2xl bg-[#f4f0e6] border-0 sm:border-2 sm:border-stone-700"
        style={{
          // Critical: fixed height budget → flex-1 body can scroll
          height: "min(100dvh, 100%)",
          maxHeight: "100dvh",
          minHeight: 0,
        }}
      >
        {/* Sticky header — always visible while article scrolls */}
        <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b-2 border-stone-800 bg-[#1c1917] text-[#f4f0e6]">
          <div className="min-w-0 flex-1">
            <p
              id={titleId}
              className="text-[11px] sm:text-xs font-black uppercase tracking-[0.14em] truncate"
            >
              {(edition.masthead || "The War Room Dispatch").replace(/Gazette/gi, "Dispatch")}
            </p>
            <p className="text-[10px] text-stone-400 truncate font-medium">
              {issueLabel}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => hardClose({ markSeen: true })}
            className="shrink-0 min-w-[44px] min-h-[44px] rounded-lg border border-stone-500 text-[#f4f0e6] text-xl font-bold leading-none flex items-center justify-center hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
            aria-label="Close The Dispatch"
          >
            ✕
          </button>
        </header>

        {/*
          THE scrollport — only this node scrolls.
          flex:1 1 0% + minHeight:0 is required inside a flex column.
        */}
        <div
          ref={scrollBodyRef}
          className="gazette-scroll-body"
          data-gazette-scroll="1"
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          <GazettePaper
            edition={edition}
            variant="modal"
            onDismiss={() => hardClose({ markSeen: true })}
            className="!rounded-none !border-0 !shadow-none"
          />
          <div className="h-6" aria-hidden />
        </div>
      </div>
    </div>
  );
}
