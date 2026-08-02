"use client";

/**
 * Sticky hop bar for hosts in season SANDBOX (pre-doors dry-run).
 * Host chip → commissioner sim tools.
 * Exit Host → always dismiss the bar; wipe dry-run board when possible.
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

const EVENT_FOUNDRY_SESSION = "warroom-foundry-session";
/** Persist dismiss across reloads until they open Host tools again */
const DISMISS_KEY = "warroom-sandbox-chrome-dismissed-v1";

function isFoundryChromeActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (isCreatorEyesActive()) return true;
    return localStorage.getItem("warroom-foundry-session-v1") === "1";
  } catch {
    return false;
  }
}

function setDismissed(on: boolean) {
  try {
    if (on) {
      // localStorage so it survives full reloads (sessionStorage was too easy to miss)
      localStorage.setItem(DISMISS_KEY, "1");
      sessionStorage.setItem(DISMISS_KEY, "1");
    } else {
      localStorage.removeItem(DISMISS_KEY);
      sessionStorage.removeItem(DISMISS_KEY);
    }
  } catch {
    /* ok */
  }
}

function isDismissed(): boolean {
  try {
    return (
      localStorage.getItem(DISMISS_KEY) === "1" ||
      sessionStorage.getItem(DISMISS_KEY) === "1"
    );
  } catch {
    return false;
  }
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
      if (!getSession()?.playerId || !isOps()) {
        setShow(false);
        return;
      }
      if (!isSandboxMode()) {
        setShow(false);
        return;
      }
      if (isAppCreator(getSession()?.playerId) && isFoundryChromeActive()) {
        setShow(false);
        return;
      }

      const onHost =
        pathname === "/commissioner" ||
        pathname?.startsWith("/commissioner/");
      // Opening Host tools re-arms the hop bar
      if (onHost) {
        setDismissed(false);
      } else if (isDismissed()) {
        setShow(false);
        return;
      }

      try {
        setOpenLabel(getSeasonOpenLabel(getLeague()?.sportId));
      } catch {
        setOpenLabel("doors open");
      }
      setShow(true);
    }
    refresh();
    window.addEventListener(EVENT_FOUNDRY_SESSION, refresh);
    window.addEventListener(EVENT_CREATOR_EYES, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("warroom-progressive-disclosure", refresh);
    return () => {
      window.removeEventListener(EVENT_FOUNDRY_SESSION, refresh);
      window.removeEventListener(EVENT_CREATOR_EYES, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("warroom-progressive-disclosure", refresh);
    };
  }, [pathname]);

  async function exitHostAndWipe() {
    if (busy) return;
    const ok = confirm(
      "Exit Host?\n\n" +
        "1) Hide this sandbox hop bar\n" +
        "2) Wipe this dry-run board (cards, picks, sim scores)\n\n" +
        "Members & league code stay.\n" +
        "Prior-season trophies stay.\n\n" +
        "Tap Host chip later to open sim tools and bring the bar back."
    );
    if (!ok) return;

    setBusy(true);
    setNote(null);

    // Always dismiss the bar first so you can actually exit
    setDismissed(true);
    setShow(false);

    let wipeNote = "";
    try {
      if (isCommissioner() || isOps()) {
        const { resetSeasonInCloud } = await import("@/lib/cloud");
        const res = await resetSeasonInCloud();
        if (!res.ok) {
          wipeNote = res.error || "Board wipe failed — bar still closed.";
        } else {
          wipeNote = "Dry-run board wiped.";
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
      wipeNote = e instanceof Error ? e.message : "Wipe failed — bar closed.";
    }

    // Hard leave so UI can't repaint the old bar from cache
    try {
      sessionStorage.setItem(
        "warroom-sandbox-exit-flash",
        wipeNote || "Host bar closed."
      );
    } catch {
      /* ok */
    }
    window.location.replace("/");
  }

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[94] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-sandbox-chrome="exit-host-v2"
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
            <strong className="text-red-300">Exit Host</strong> = close this bar
            + wipe dry-run board. Open Host again to hop.
          </p>
        </div>
      </div>
    </div>
  );
}
