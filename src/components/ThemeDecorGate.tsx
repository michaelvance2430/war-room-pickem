"use client";

/**
 * Isolation flag F: theme/decor components under layout.
 * localStorage warroom-iso: { "themeDecor": false }
 */

import { useEffect, useState } from "react";
import { isoEnabled, wrMount, wrLog } from "@/lib/runtime-iso";

export default function ThemeDecorGate({
  children,
}: {
  children: React.ReactNode;
}) {
  // SSR + first paint: show (product default). After mount, honor iso flag.
  const [on, setOn] = useState(true);

  useEffect(() => {
    const un = wrMount("ThemeDecorGate");
    const enabled = isoEnabled("themeDecor");
    setOn(enabled);
    if (!enabled) wrLog("[WR-RUNTIME]", "themeDecor disabled by iso");
    return un;
  }, []);

  if (!on) return null;
  return <>{children}</>;
}
