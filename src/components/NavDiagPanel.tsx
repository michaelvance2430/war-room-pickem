"use client";

/**
 * Creator / runtime-debug only interaction diagnostic.
 * Enable: localStorage warroom-nav-diag=1  (and be app creator)
 * Or: warroom-runtime-debug=1
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSession, getLeague } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";
import { getBodyLockCount } from "@/lib/smooth";
import { getSessionDrama } from "@/lib/session-drama";
import {
  isSafeNavMode,
  isNavLocked,
  recoverNavigation,
} from "@/lib/safe-nav";

type Snap = {
  route: string;
  drama: string;
  bodyLock: number;
  bodyOverflow: string;
  navLock: boolean;
  safeNav: boolean;
  topEl: string;
  modalCount: number;
};

function snapshot(pathname: string | null): Snap {
  let topEl = "—";
  let modalCount = 0;
  try {
    const mid = document.elementFromPoint(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2)
    ) as HTMLElement | null;
    if (mid) {
      topEl = `${mid.tagName.toLowerCase()}${mid.id ? "#" + mid.id : ""}${
        mid.className && typeof mid.className === "string"
          ? "." + mid.className.split(/\s+/).slice(0, 2).join(".")
          : ""
      }`.slice(0, 80);
    }
    modalCount = document.querySelectorAll(
      '[aria-modal="true"], [role="dialog"]'
    ).length;
  } catch {
    /* ok */
  }
  return {
    route: pathname || "—",
    drama: getSessionDrama() || "none",
    bodyLock: getBodyLockCount(),
    bodyOverflow: document.body.style.overflow || "default",
    navLock: isNavLocked(),
    safeNav: isSafeNavMode(),
    topEl,
    modalCount,
  };
}

export default function NavDiagPanel() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);

  useEffect(() => {
    try {
      const uid = getSession()?.playerId;
      if (!isAppCreator(uid)) {
        setOn(false);
        return;
      }
      const flag =
        localStorage.getItem("warroom-nav-diag") === "1" ||
        localStorage.getItem("warroom-runtime-debug") === "1";
      setOn(flag);
    } catch {
      setOn(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!on) return;
    const tick = () => setSnap(snapshot(pathname));
    tick();
    const id = window.setInterval(tick, 800);
    return () => window.clearInterval(id);
  }, [on, pathname]);

  if (!on || !snap) return null;

  const league = getLeague()?.name || getLeague()?.id?.slice(0, 8) || "—";

  return (
    <div
      className="fixed bottom-16 right-2 z-[250] max-w-[16rem] rounded-lg border border-sky-500/50 bg-black/90 text-[9px] text-sky-100 p-2 font-mono shadow-xl pointer-events-auto"
      data-nav-diag="1"
    >
      <div className="flex justify-between gap-2 mb-1">
        <span className="font-bold text-sky-300">NAV DIAG</span>
        <button
          type="button"
          className="underline text-amber-300"
          onClick={() => recoverNavigation("nav-diag")}
        >
          Unlock
        </button>
      </div>
      <div>route: {snap.route}</div>
      <div>league: {league}</div>
      <div>safeNav: {snap.safeNav ? "ON" : "off"}</div>
      <div>drama: {snap.drama}</div>
      <div>bodyLock#: {snap.bodyLock}</div>
      <div>overflow: {snap.bodyOverflow}</div>
      <div>navLock: {snap.navLock ? "yes" : "no"}</div>
      <div>modals: {snap.modalCount}</div>
      <div className="truncate" title={snap.topEl}>
        midEl: {snap.topEl}
      </div>
    </div>
  );
}
