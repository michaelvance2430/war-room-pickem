"use client";

/**
 * Conversion CTAs for Guest Mode — invitation, not error chrome.
 */

import Link from "next/link";
import { exitGuestDemo } from "@/lib/guest-mode";

type Props = {
  className?: string;
  /** Stack vertically (default) or row on sm+ */
  layout?: "stack" | "row";
  primary?: "join" | "create";
};

export default function GuestJoinCtas({
  className = "",
  layout = "stack",
  primary = "join",
}: Props) {
  function leaveGuestAndGo(href: string) {
    exitGuestDemo();
    window.location.assign(href);
  }

  const joinBtn = (
    <button
      type="button"
      onClick={() => leaveGuestAndGo("/login?mode=join")}
      className="flex-1 min-h-[48px] rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation px-4"
    >
      Join a League →
    </button>
  );

  const createBtn = (
    <button
      type="button"
      onClick={() => leaveGuestAndGo("/login?mode=signup")}
      className="flex-1 min-h-[48px] rounded-xl border border-primary/40 text-primary text-sm font-bold touch-manipulation px-4 hover:bg-primary/10"
    >
      Create My League →
    </button>
  );

  return (
    <div
      className={`${
        layout === "row"
          ? "flex flex-col sm:flex-row gap-2"
          : "flex flex-col gap-2"
      } ${className}`}
    >
      {primary === "join" ? (
        <>
          {joinBtn}
          {createBtn}
        </>
      ) : (
        <>
          {createBtn}
          {joinBtn}
        </>
      )}
      <Link
        href="/login"
        onClick={() => exitGuestDemo()}
        className="text-center text-[11px] text-muted hover:text-foreground py-1"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
}
