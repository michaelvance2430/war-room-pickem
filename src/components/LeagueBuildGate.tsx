"use client";

/**
 * Redirects new commissioners into League Build until complete (or locked).
 * Skips on the build page itself and during pure player sessions.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { shouldRedirectToLeagueBuild } from "@/lib/league-build";

export default function LeagueBuildGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (
      pathname.startsWith("/league-build") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/join") ||
      pathname.startsWith("/founder")
    ) {
      return;
    }
    try {
      if (shouldRedirectToLeagueBuild()) {
        router.replace("/league-build");
      }
    } catch {
      /* ignore */
    }
  }, [pathname, router]);

  return null;
}
