"use client";

/**
 * Sticky hop bar for hosts in season SANDBOX (pre-doors dry-run).
 *
 * OFF by default (login / league switch / Exit Host).
 * ON only after opening Host tools in THIS league.
 * Never on I’m bored practice. Never carries across leagues.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isOps, getSession, getLeague, isCommissioner } from "@/lib/league";
import { isSandboxMode } from "@/lib/season-mode";
import { isGuestMode } from "@/lib/guest-mode";
import { isAppCreator } from "@/lib/creator";
import { getSeasonOpenLabel } from "@/lib/season-countdown";
import {
  EVENT_CREATOR_EYES,
  isCreatorEyesActive,
} from "@/lib/creator-eyes";
import {
  EVENT_LEAGUE_SWITCHED,
  isSandboxHostHopActive,
  setSandboxHostHopActive,
} from "@/lib/sandbox-host-hop";

const EVENT_FOUNDRY_SESSION = "warroom-foundry-session";

function isFoundryChromeActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (isCreatorEyesActive()) return true;
    return localStorage.getItem("warroom-foundry-session-v1") === "1";
  } catch {
    return false;
  }
}

function isPracticePath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/picks")) {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("practice") === "1" || sp.get("week") === "99") return true;
    } catch {
      /* ok */
    }
  }
  return false;
}

const HOPS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/picks", label: "Picks" },
  { href: "/board", label: "Board" },
  { href: "/gazette", label: "Gazette" },
  { href: "/locker-room", label: "Locker" },
  { href: "/commissioner", label: "Host" },
];

export default function SandboxSessionChrome() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [openLabel, setOpenLabel] = useState("doors open");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      if (isGuestMode()) {
        setShow(false);
        return;
      }
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId || !isOps()) {
        setShow(false);
        return;
      }
      if (!isSandboxMode()) {
        setShow(false);
        return;
      }
      if (isAppCreator(session.playerId) && isFoundryChromeActive()) {
        setShow(false);
        return;
      }

      if (isPracticePath(pathname)) {
        setShow(false);
        return;
      }

      const onHost =
        pathname === "/commissioner" ||
        pathname?.startsWith("/commissioner/");
      const lid = league?.id || session.leagueId;

      if (onHost) {
        setSandboxHostHopActive(true, lid);
      }

      if (!onHost && !isSandboxHostHopActive(lid)) {
        setShow(false);
        return;
      }

      try {
        setOpenLabel(getSeasonOpenLabel(league?.sportId));
      } catch {
        setOpenLabel("doors open");
      }
      setShow(true);
    }
    refresh();
    window.addEventListener(EVENT_FOUNDRY_SESSION, refresh);
    window.addEventListener(EVENT_CREATOR_EYES, refresh);
    window.addEventListener(EVENT_LEAGUE_SWITCHED, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("warroom-progressive-disclosure", refresh);
    return () => {
      window.removeEventListener(EVENT_FOUNDRY_SESSION, refresh);
      window.removeEventListener(EVENT_CREATOR_EYES, refresh);
      window.removeEventListener(EVENT_LEAGUE_SWITCHED, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("warroom-progressive-disclosure", refresh);
    };
  }, [pathname]);

  async function exitHostAndWipe() {
    if (busy) return;
    const ok = confirm(
      "Exit Host?\n\n" +
        "1) Close this sandbox hop bar (stays off until you open Host tools in this league)\n" +
        "2) Wipe this dry-run board (cards, picks, sim scores)\n\n" +
        "Members & league code stay.\n" +
        "Prior-season trophies stay.\n\n" +
        "Switching leagues always clears this bar."
    );
    if (!ok) return;

    setBusy(true);
    setNote(null);

    const lid = getLeague()?.id || getSession()?.leagueId;
    setSandboxHostHopActive(false, lid);
    setShow(false);

    try {
      if (isCommissioner() || isOps()) {
        const { resetSeasonInCloud } = await import("@/lib/cloud");
        const res = await resetSeasonInCloud();
        if (!res.ok) {
          setNote(res.error || "Board wipe failed — bar still closed.");
        } else {
          try {
            if (isSandboxMode()) {
              const { scrubSandboxProgressOnThisDevice } = await import(
                "@/lib/sandbox-wipe"
              );
              scrubSandboxProgressOnThisDevice();
            }
          } catch {
            /* ok */
          }
        }
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Wipe failed — bar closed.");
    }

    window.location.replace("/");
  }

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[94] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-sandbox-chrome="hop-per-league-v4"
    >
      <div className="pointer-events-auto max-w-lg mx-auto px-3 pb-3">
        <div className="rounded-2xl border-2 border-amber-400/55 bg-amber-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(245,158,11,0.22)] px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                Sandbox mode
              </p>
              <p className="text-[11px] text-amber-100/85 truncate font-semibold">
                Dry-run until {openLabel} · sim scores, no career bank
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void exitHostAndWipe()}
              className="shrink-0 min-h-[44px] px-3.5 rounded-xl bg-red-500 text-white text-xs font-extrabold inline-flex items-center touch-manipulation disabled:opacity-50 border border-red-300/40"
              title="Close this bar and wipe the dry-run board"
            >
              {busy ? "Exiting…" : "Exit Host"}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto phone-h-scroll pb-0.5 -mx-0.5 px-0.5">
            {HOPS.map((h) => {
              const active =
                h.href === "/"
                  ? pathname === "/"
                  : pathname === h.href || pathname?.startsWith(`${h.href}/`);
              return (
                <Link
                  key={h.href}
                  href={h.href}
                  className={`shrink-0 min-h-[40px] px-3 rounded-lg text-[11px] font-bold inline-flex items-center touch-manipulation border ${
                    active
                      ? "bg-amber-400 text-black border-amber-300"
                      : "bg-black/40 text-amber-100 border-amber-400/30 hover:border-amber-400/60"
                  }`}
                >
                  {h.label}
                </Link>
              );
            })}
          </div>
          {note && (
            <p className="text-[10px] text-red-300 font-medium leading-snug">
              {note}
            </p>
          )}
          <p className="text-[9px] text-amber-200/60 leading-snug">
            <strong className="text-amber-200/90">Host</strong> = sim tools.{" "}
            <strong className="text-red-300">Exit Host</strong> = close bar +
            wipe dry-run. Switching leagues always clears this bar.
          </p>
        </div>
      </div>
    </div>
  );
}
