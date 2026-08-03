"use client";

/**
 * Persistent chrome: Nav (and its deferred hydrators) mount ONCE.
 * Previously every page rendered <Nav />, so each tab switch tore down
 * and re-ran progressive snapshot, roster hydrator, walkthrough, etc.
 * That made every screen feel sticky/slow.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import { wrMount, wrRoute, wrProfileRoute } from "@/lib/runtime-iso";

/** Routes that should not show the app chrome (auth / bare flows). */
function isBareRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/join" || pathname.startsWith("/join/")) return true;
  // Deep-link open-room can render before session — keep chrome off until in-app
  if (pathname === "/open-room" || pathname.startsWith("/open-room/")) {
    return true;
  }
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);
  const isProfile = !!pathname?.startsWith("/profile");
  if (isProfile) wrProfileRoute("AppShell.render-start", pathname || "");

  useEffect(() => {
    return wrMount("AppShell");
  }, []);

  useEffect(() => {
    wrRoute(pathname);
    if (pathname?.startsWith("/profile")) {
      wrProfileRoute("AppShell.route-effect", pathname);
    }
  }, [pathname]);

  if (isProfile) wrProfileRoute("AppShell.render-end", pathname || "");

  return (
    <>
      {!bare && <Nav />}
      {children}
    </>
  );
}
