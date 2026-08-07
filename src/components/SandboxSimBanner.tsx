"use client";

/**
 * Preseason room strip — customer-safe language only.
 * Never "Sandbox" / "Dry run" / lab terminology.
 * Sim scores don't bank career cheevos until the season opens.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSandboxMode } from "@/lib/season-mode";
import { isOps } from "@/lib/league";

export default function SandboxSimBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(isSandboxMode());
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="preseason-room-strip mb-4 rounded-xl border border-amber-400/45 bg-amber-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
      <p className="preseason-room-copy text-xs text-amber-100 leading-snug">
        <span className="font-extrabold uppercase tracking-wide text-amber-300">
          Preseason
        </span>
        {" · "}
        The room is open before the real season. Early scores don&apos;t bank
        to career hardware.
      </p>
      {isOps() && (
        <Link
          href="/week-ops"
          className="preseason-league-tools text-[11px] font-bold text-amber-200 shrink-0"
        >
          League tools <span aria-hidden>›</span>
        </Link>
      )}
    </div>
  );
}
