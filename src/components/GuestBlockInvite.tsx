"use client";

/**
 * Guest blocked-action triad UI — invitation, never red error chrome.
 * Why? What am I missing? How do I unlock?
 */

import type { GuestBlockInvite as Invite } from "@/lib/guest-copy";
import GuestJoinCtas from "@/components/GuestJoinCtas";

type Props = {
  invite: Invite;
  className?: string;
  showCtas?: boolean;
};

export default function GuestBlockInvitePanel({
  invite,
  className = "",
  showCtas = true,
}: Props) {
  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-primary/35 bg-card px-4 py-5 sm:px-5 sm:py-6 space-y-3 ${className}`}
      role="status"
    >
      <p className="text-2xl leading-none" aria-hidden>
        🔒
      </p>
      <h2 className="text-base sm:text-lg font-black text-foreground leading-snug">
        {invite.title}
      </h2>
      <p className="text-sm text-muted leading-relaxed">{invite.why}</p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        <span className="text-muted">What you&apos;re missing: </span>
        {invite.missing}
      </p>
      <p className="text-sm font-semibold text-primary leading-relaxed">
        {invite.unlock}
      </p>
      {showCtas && <GuestJoinCtas className="pt-1" layout="row" />}
    </div>
  );
}
