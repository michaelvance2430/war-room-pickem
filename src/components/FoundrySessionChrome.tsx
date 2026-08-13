"use client";

/**
 * Creator-only one-tap return to Foundry while actively testing.
 * Normal gameplay stays clean: the permanent Foundry doorway lives on the
 * creator's own Profile. This chrome appears only for an active Foundry
 * session or Creator Eyes preview.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { createClient } from "@/lib/supabase/client";
import {
  EVENT_CREATOR_EYES,
  getCreatorEyesMode,
} from "@/lib/creator-eyes";
import {
  foundryPostseasonStartWeek,
  loadFoundryWalkthrough,
  PREVIEW_SPORTS,
  saveFoundryWalkthrough,
  simulateFoundryRegularSeason,
  simulateNextFoundryWeek,
} from "@/lib/foundry-walkthrough";
import { isFoundryLivePagesActive, setFoundryLivePagesActive } from "@/lib/foundry-live-adapter";

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
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [walkthrough, setWalkthrough] = useState(() => loadFoundryWalkthrough());

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const uid = authData.session?.user.id || getSession()?.playerId || null;
      if (cancelled) return;
      if (!isAppCreator(uid)) {
        setShow(false);
        return;
      }
      const e = getCreatorEyesMode();
      const onFoundry =
        pathname === "/foundry" ||
        pathname?.startsWith("/foundry/") ||
        pathname === "/founder" ||
        pathname?.startsWith("/founder/");
      // Eyes mode must be visually identical to the player product. Its exit
      // lives inside the ordinary You menu; never overlay LAB chrome on top of
      // the experience being evaluated.
      setShow(!onFoundry && e === "off" && isFoundrySessionSticky());
      setWalkthrough(loadFoundryWalkthrough());
    }

    const handleRefresh = () => void refresh();
    void refresh();
    window.addEventListener(EVENT_CREATOR_EYES, handleRefresh);
    window.addEventListener(EVENT_FOUNDRY_SESSION, handleRefresh);
    window.addEventListener("warroom-view-as-player", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_CREATOR_EYES, handleRefresh);
      window.removeEventListener(EVENT_FOUNDRY_SESSION, handleRefresh);
      window.removeEventListener("warroom-view-as-player", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [pathname]);

  if (!show) return null;

  const livePages = isFoundryLivePagesActive() && !!walkthrough;
  function advance(fullRegularSeason = false) {
    const current = loadFoundryWalkthrough();
    if (!current) return;
    const next = fullRegularSeason
      ? simulateFoundryRegularSeason(current)
      : simulateNextFoundryWeek(current);
    saveFoundryWalkthrough(next);
    setWalkthrough(next);
    router.refresh();
    window.setTimeout(() => window.location.reload(), 40);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[95] pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="pointer-events-auto max-w-lg mx-auto px-3 pb-3">
        <div className="rounded-2xl border-2 border-sky-400/50 bg-sky-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(56,189,248,0.25)] px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">LAB · Foundry</p>
            <p className="text-xs text-sky-100/90 truncate font-semibold">
              {livePages && walkthrough ? `${PREVIEW_SPORTS[walkthrough.sport].sport} · ${PREVIEW_SPORTS[walkthrough.sport].weekLabel(walkthrough.week)}` : "LAB testing · one tap back to Foundry"}
            </p>
          </div>
          <Link href="/foundry" className="shrink-0 min-h-[44px] px-3.5 rounded-xl bg-sky-400 text-black text-xs font-extrabold inline-flex items-center touch-manipulation">← Foundry</Link>
          <button type="button" onClick={() => { setFoundryLivePagesActive(false); clearFoundrySession(); setShow(false); }} className="shrink-0 min-h-[44px] px-2.5 rounded-xl border border-sky-400/40 text-sky-200/80 text-[11px] font-bold touch-manipulation">End</button>
          </div>
          {livePages && walkthrough && <>
            <div className="flex gap-1.5 overflow-x-auto phone-h-scroll">
              {[{ href: "/", label: "Home" }, { href: "/picks", label: "Picks" }, { href: "/standings", label: "Standings" }, { href: "/board", label: "Board" }, { href: "/locker-room", label: "Locker" }, { href: "/dispatch", label: "Dispatch" }].map((item) => <Link key={item.href} href={item.href} className={`shrink-0 min-h-[38px] rounded-lg border px-3 text-[11px] font-bold inline-flex items-center ${pathname === item.href ? "border-amber-300 bg-amber-300 text-black" : "border-sky-300/30 bg-black/30 text-sky-100"}`}>{item.label}</Link>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => advance(false)} className="min-h-[42px] rounded-xl bg-amber-300 px-3 text-xs font-black text-black">{walkthrough.week >= foundryPostseasonStartWeek(walkthrough.sport) ? "SIM PLAYOFF ROUND" : "SIM THIS WEEK"}</button>
              <button type="button" onClick={() => advance(true)} disabled={walkthrough.week >= foundryPostseasonStartWeek(walkthrough.sport)} className="min-h-[42px] rounded-xl border border-sky-300/40 px-3 text-xs font-black text-sky-100 disabled:opacity-35">ENTER POSTSEASON</button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
