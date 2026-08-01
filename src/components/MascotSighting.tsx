"use client";

/**
 * Type 14 — tiny helmet hide-and-seek. Rare, silent, zero points.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  EVENT_EASTER_EGG,
  getMascotFindCount,
  recordMascotFind,
} from "@/lib/easter-eggs";

const SPOTS: {
  id: string;
  paths: string[];
  className: string;
}[] = [
  {
    id: "home_corner",
    paths: ["/"],
    className: "fixed bottom-[5.5rem] right-3 md:bottom-6 md:right-6 z-20",
  },
  {
    id: "standings_edge",
    paths: ["/standings"],
    className: "fixed top-[4.5rem] left-2 z-20",
  },
  {
    id: "gazette_margin",
    paths: ["/gazette"],
    className: "fixed bottom-24 left-3 z-20",
  },
  {
    id: "board_scoreboard",
    paths: ["/board"],
    className: "fixed top-[5rem] right-2 z-20",
  },
  {
    id: "locker_bench",
    paths: ["/locker-room"],
    className: "fixed bottom-[5.5rem] left-3 z-20",
  },
];

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate();
}

export default function MascotSighting() {
  const pathname = usePathname() || "/";
  const [foundHere, setFoundHere] = useState(false);
  const [visible, setVisible] = useState(false);

  // Always out — rotates hideout by day so people can actually find it.
  // Home is always a second hideout so you can test without hunting.
  const dailySpot = useMemo(() => {
    const seed = daySeed();
    return SPOTS[seed % SPOTS.length];
  }, []);

  const activeSpot = useMemo(() => {
    if (pathname === "/" || pathname === "") {
      return SPOTS.find((s) => s.id === "home_corner") || dailySpot;
    }
    const onDaily = dailySpot.paths.some(
      (p) => pathname === p || (p !== "/" && pathname.startsWith(p))
    );
    return onDaily ? dailySpot : null;
  }, [pathname, dailySpot]);

  useEffect(() => {
    setFoundHere(false);
    setVisible(!!activeSpot);
  }, [activeSpot]);

  if (isGuestMode() || !activeSpot || !visible || foundHere) return null;

  function onFind() {
    const pid = getSession()?.playerId;
    if (!pid || !activeSpot) return;
    const moment = recordMascotFind(pid, activeSpot.id);
    setFoundHere(true);
    if (moment) {
      try {
        window.dispatchEvent(
          new CustomEvent(EVENT_EASTER_EGG, { detail: moment })
        );
      } catch {
        /* ignore */
      }
    } else if (getMascotFindCount(pid) > 0) {
      try {
        window.dispatchEvent(
          new CustomEvent(EVENT_EASTER_EGG, {
            detail: {
              id: `mascot_${activeSpot.id}`,
              title: "Helmet spotted",
              body: "Another hideout. The mascot will move again.",
              icon: "🪖",
            },
          })
        );
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onFind}
      className={`${activeSpot.className} text-xl opacity-70 hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 border border-white/10 shadow-sm`}
      aria-label="Something small"
      title=""
    >
      🪖
    </button>
  );
}
