"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Power Rankings live under Stats → first tab. Keep URL for old links. */
export default function PowerRankingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/stats");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted bg-background">
      Moving to Stats…
    </div>
  );
}
