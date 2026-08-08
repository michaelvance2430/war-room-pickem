"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type NflScene =
  | "home"
  | "picks"
  | "standings"
  | "locker"
  | "gazette"
  | "board"
  | "championship"
  | "toilet"
  | "profile";

function sceneForPath(pathname: string): NflScene {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/picks") || pathname.startsWith("/crystal-ball")) return "picks";
  if (pathname.startsWith("/standings") || pathname.startsWith("/stats") || pathname.startsWith("/power-rankings")) return "standings";
  if (pathname.startsWith("/locker-room") || pathname.startsWith("/announcements")) return "locker";
  if (pathname.startsWith("/gazette")) return "gazette";
  if (pathname.startsWith("/board")) return "board";
  if (pathname.startsWith("/championship")) return "championship";
  if (pathname.startsWith("/toilet-bowl")) return "toilet";
  if (pathname.startsWith("/profile") || pathname.startsWith("/players") || pathname.startsWith("/trophy-room") || pathname.startsWith("/museum") || pathname.startsWith("/crew")) return "profile";
  return "home";
}

/** Route-level NFL scenery. CSS activates it only while html[data-sport=nfl]. */
export default function NflRouteSkin() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.nflScene = sceneForPath(pathname || "/");
    return () => {
      delete root.dataset.nflScene;
    };
  }, [pathname]);
  return null;
}
