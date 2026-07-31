"use client";

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

/** Sticky DEMO bar for guest mode + role switch / exit. */
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
        <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
          DEMO · Simulated through Week 9
          {role ? ` · ${role === "commissioner" ? "Commish" : "Player"}` : ""}
        </p>
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
              Switch to {role === "player" ? "Commish" : "Player"}
            </button>
          )}
          <Link
            href="/login"
            onClick={() => exitGuestDemo()}
            className="px-2.5 py-1 rounded-lg bg-black text-primary text-[11px] font-extrabold"
          >
            Exit demo → Account
          </Link>
        </div>
      </div>
    </div>
  );
}
