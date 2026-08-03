"use client";

/**
 * Practice Mode product retired.
 * Clears any pending practice-done state. Renders nothing.
 */

import { useEffect } from "react";
import { clearBoredPracticeDoneModal } from "@/lib/bored-practice";

export default function BoredPracticeDoneModal() {
  useEffect(() => {
    try {
      clearBoredPracticeDoneModal();
      void import("@/lib/bored-practice").then((m) => {
        if (m.isBoredPracticeActive()) m.exitBoredPracticeToLive();
      });
    } catch {
      /* ok */
    }
  }, []);

  return null;
}
