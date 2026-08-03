"use client";

/**
 * Sticky Guest chrome — contract, not "DEMO software."
 * Guests observe. Members belong.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  exitGuestDemo,
  getGuestState,
  isGuestMode,
  setGuestRole,
  type GuestRole,
} from "@/lib/guest-mode";
import { useRouter } from "next/navigation";

export default function GuestDemoChrome() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [role, setRole] = useState<GuestRole | null>(null);

  function refresh() {
    setOn(isGuestMode());
    setRole(getGuestState().role);
  }

  useEffect(() => {
    refresh();
    function onGuest() {
      refresh();
    }
    window.addEventListener("warroom-guest-mode", onGuest);
    return () => window.removeEventListener("warroom-guest-mode", onGuest);
  }, []);

  if (!on) return null;

  return (
    <div className="sticky top-0 z-[55] border-b-2 border-primary bg-primary text-black">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
            Guest · exploring
            {role
              ? ` · ${role === "commissioner" ? "host tour" : "player tour"}`
              : ""}
          </p>
          <p className="text-[10px] sm:text-[11px] font-semibold opacity-90 leading-snug">
            Look around. Real Locker &amp; leagues unlock when you join.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role && (
            <button
              type="button"
              onClick={() => {
                const next: GuestRole =
                  role === "player" ? "commissioner" : "player";
                setGuestRole(next);
                setRole(next);
                router.refresh();
                window.location.href = "/";
              }}
              className="px-2.5 py-1 rounded-lg bg-black/15 text-[11px] font-bold hover:bg-black/25"
            >
              Switch to {role === "player" ? "host tour" : "player tour"}
            </button>
          )}
          <Link
            href="/login?mode=join"
            onClick={() => exitGuestDemo()}
            className="px-2.5 py-1 rounded-lg bg-black text-primary text-[11px] font-extrabold"
          >
            Join a League →
          </Link>
          <Link
            href="/login"
            onClick={() => exitGuestDemo()}
            className="px-2.5 py-1 rounded-lg bg-black/20 text-[11px] font-bold"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
