"use client";

/**
 * Practice Mode product retired.
 * On mount: clear any sticky practice state so players never see dual-reality chrome.
 * Renders nothing.
 */

import { useEffect } from "react";

export default function PracticeModeChrome() {
  useEffect(() => {
    void import("@/lib/bored-practice").then((m) => {
      try {
        if (m.isBoredPracticeActive() || m.isBoredPracticeUrl()) {
          m.exitBoredPracticeToLive();
        }
      } catch {
        /* ok */
      }
    });
  }, []);

  return null;
}
