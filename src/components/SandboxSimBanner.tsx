"use client";

/**
 * Loud sandbox / dry-run strip so sim standings never feel like the real season.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSandboxMode } from "@/lib/season-mode";
import { isOps } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";

export default function SandboxSimBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // Everyone in sandbox — dry-run truth for the whole room
      setShow(!isGuestMode() && isSandboxMode());
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-400/45 bg-amber-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-amber-100 leading-snug">
        <span className="font-extrabold uppercase tracking-wide text-amber-300">
          Sandbox
        </span>
        {" · "}
        Demo cards / bots / practice scores. Career cheevos don&apos;t bank until
        the real season opens.
      </p>
      {isOps() && (
        <Link
          href="/commissioner?tab=card"
          className="text-[11px] font-bold text-amber-200 underline shrink-0"
        >
          Commish tools
        </Link>
      )}
    </div>
  );
}
