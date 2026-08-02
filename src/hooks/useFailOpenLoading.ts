"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_LOAD_MS, armLoadingFailSafe } from "@/lib/smooth";

/**
 * Standard page loading gate: starts true, always clears by `ms`.
 * Use for Standings/Locker/Stats/etc so cloud hangs never own the UI.
 */
export function useFailOpenLoading(ms: number = PAGE_LOAD_MS) {
  const [loading, setLoading] = useState(true);
  const cleared = useRef(false);

  const done = useCallback(() => {
    cleared.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    cleared.current = false;
    setLoading(true);
    const disarm = armLoadingFailSafe((v) => {
      if (!v) done();
      else setLoading(true);
    }, ms);
    return () => {
      disarm();
    };
  }, [ms, done]);

  return { loading, setLoading, done } as const;
}
