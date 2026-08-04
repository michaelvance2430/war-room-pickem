"use client";

/**
 * Type 14 — tiny helmet hide-and-seek. Rare, silent, zero points.
 * Out about every third calendar day; hideout rotates by day.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSession } from "@/lib/league";
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

  const spot = useMemo(() => {
    // ~every third calendar day the mascot is out; which spot by day
    const seed = daySeed();
    if (seed % 3 !== 0) return null;
    return SPOTS[seed % SPOTS.length];
  }, []);

  useEffect(() => {
    if (!spot) {
      setVisible(false);
      return;
    }
    const onPath = spot.paths.some(
      (p) => pathname === p || (p !== "/" && pathname.startsWith(p))
    );
    setVisible(onPath);
    setFoundHere(false);
  }, [pathname, spot]);

  if (!spot || !visible || foundHere) return null;

  function onFind() {
    const pid = getSession()?.playerId;
    if (!pid || !spot) return;
    const moment = recordMascotFind(pid, spot.id);
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
              id: `mascot_${spot.id}`,
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
      className={`${spot.className} text-lg opacity-40 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/5`}
      aria-label="Something small"
      title=""
    >
      🪖
    </button>
  );
}
