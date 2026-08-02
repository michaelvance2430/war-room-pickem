"use client";

/**
 * Sticky hop bar for hosts in season SANDBOX (pre-doors dry-run).
 * Same job as Foundry’s bottom chrome — navigate the room without hunting menus.
 * Amber = sandbox. Sky = Foundry (creator). Don’t stack both.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isOps, getSession } from "@/lib/league";
import { isSandboxMode } from "@/lib/season-mode";
import { isGuestMode } from "@/lib/guest-mode";
import { isAppCreator } from "@/lib/creator";
import { getSeasonOpenLabel } from "@/lib/season-countdown";
import { getLeague } from "@/lib/league";
import {
  EVENT_CREATOR_EYES,
  isCreatorEyesActive,
} from "@/lib/creator-eyes";

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
      // Creator Foundry bar wins when active — one sticky only
      if (isAppCreator(getSession()?.playerId) && isFoundryChromeActive()) {
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

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[94] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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
            <Link
              href="/commissioner?tab=card"
              className="shrink-0 min-h-[44px] px-3.5 rounded-xl bg-amber-400 text-black text-xs font-extrabold inline-flex items-center touch-manipulation"
            >
              ← Host desk
            </Link>
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
        </div>
      </div>
    </div>
  );
}
