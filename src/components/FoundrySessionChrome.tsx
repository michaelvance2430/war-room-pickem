"use client";

/**
 * One-tap back to Foundry while testing — no Account scroll.
 * Shows when creator eyes are on, or Foundry session sticky is set.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import {
  creatorEyesLabel,
  EVENT_CREATOR_EYES,
  getCreatorEyesMode,
  isCreatorEyesActive,
  setCreatorEyesMode,
  type CreatorEyesMode,
} from "@/lib/creator-eyes";

const STICKY_KEY = "warroom-foundry-session-v1";
export const EVENT_FOUNDRY_SESSION = "warroom-foundry-session";

export function markFoundrySessionActive(): void {
  if (typeof window === "undefined") return;
  try {
    // E0: do not arm sticky session while Foundry is quarantined
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const q = require("@/lib/foundry-quarantine") as typeof import("@/lib/foundry-quarantine");
    if (q.isFoundryQuarantined()) {
      localStorage.removeItem(STICKY_KEY);
      window.dispatchEvent(new CustomEvent(EVENT_FOUNDRY_SESSION));
      return;
    }
  } catch {
    /* continue arm if module missing */
  }
  try {
    localStorage.setItem(STICKY_KEY, "1");
    window.dispatchEvent(new CustomEvent(EVENT_FOUNDRY_SESSION));
  } catch {
    /* ignore */
  }
}

export function clearFoundrySession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STICKY_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_FOUNDRY_SESSION));
  } catch {
    /* ignore */
  }
}

function isFoundrySessionSticky(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STICKY_KEY) === "1";
  } catch {
    return false;
  }
}

export default function FoundrySessionChrome() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [eyes, setEyes] = useState<CreatorEyesMode>("off");

  useEffect(() => {
    function refresh() {
      const uid = getSession()?.playerId;
      if (!isAppCreator(uid)) {
        setShow(false);
        return;
      }
      const e = getCreatorEyesMode();
      setEyes(e);
      const onFoundry = pathname === "/founder" || pathname?.startsWith("/founder/");
      // Hide on Foundry itself; show everywhere else while testing
      setShow(
        !onFoundry && (isCreatorEyesActive() || isFoundrySessionSticky())
      );
    }
    refresh();
    window.addEventListener(EVENT_CREATOR_EYES, refresh);
    window.addEventListener(EVENT_FOUNDRY_SESSION, refresh);
    window.addEventListener("warroom-view-as-player", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_CREATOR_EYES, refresh);
      window.removeEventListener(EVENT_FOUNDRY_SESSION, refresh);
      window.removeEventListener("warroom-view-as-player", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  if (!show) return null;

  const eyesOn = eyes !== "off";

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[95] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto max-w-lg mx-auto px-3 pb-3">
        <div className="rounded-2xl border-2 border-sky-400/50 bg-sky-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(56,189,248,0.25)] px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
              LAB · Foundry
            </p>
            <p className="text-xs text-sky-100/90 truncate font-semibold">
              {(() => {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  const iso = require("@/lib/foundry-isolation") as typeof import("@/lib/foundry-isolation");
                  const lab = iso.isFoundryLabActiveOnCurrentRoom();
                  if (!lab) {
                    return "Not a LAB room — simulations blocked on production";
                  }
                } catch {
                  /* ok */
                }
                return eyesOn
                  ? `${creatorEyesLabel(eyes)} · first-hour / eyes preview`
                  : "LAB room — one tap back to Foundry";
              })()}
            </p>
          </div>
          <Link
            href="/founder"
            className="shrink-0 min-h-[44px] px-3.5 rounded-xl bg-sky-400 text-black text-xs font-extrabold inline-flex items-center touch-manipulation"
          >
            ← Foundry
          </Link>
          {eyesOn && (
            <button
              type="button"
              onClick={() => {
                // Back to Foundry eyes desk — not Home (you'll hop eyes often)
                setCreatorEyesMode("off");
                setEyes("off");
                window.location.href = "/founder#eyes";
              }}
              className="shrink-0 min-h-[44px] px-2.5 rounded-xl border border-sky-400/50 text-sky-100 text-[11px] font-bold touch-manipulation"
            >
              Exit → Foundry
            </button>
          )}
          {!eyesOn && (
            <button
              type="button"
              onClick={() => {
                clearFoundrySession();
                setShow(false);
              }}
              className="shrink-0 min-h-[44px] px-2.5 rounded-xl border border-sky-400/40 text-sky-200/80 text-[11px] font-bold touch-manipulation"
            >
              End
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
