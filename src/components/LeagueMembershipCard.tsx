"use client";

/**
 * Multi-league scan card — sport, role, open/private, bots, seats.
 * Used on Account “Your leagues” and home league picker.
 */

import type { LeagueMembership } from "@/lib/session-restore";
import { membershipRoleLabel } from "@/lib/session-restore";
import { getSportPack } from "@/lib/sports/registry";

type Props = {
  membership: LeagueMembership;
  userId?: string | null;
  active?: boolean;
  /** Extra actions under the chips (Switch / Leave / etc.) */
  children?: React.ReactNode;
  /** Whole card clickable (home picker) */
  onSelect?: () => void;
  className?: string;
};

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "sport" | "role" | "open" | "private" | "bots" | "humans" | "active";
}) {
  const tones: Record<string, string> = {
    default: "border-border bg-background/60 text-muted",
    sport: "border-primary/40 bg-primary/10 text-primary",
    role: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    open: "border-sky-400/40 bg-sky-400/10 text-sky-200",
    private: "border-border bg-background/80 text-muted",
    bots: "border-violet-400/35 bg-violet-500/10 text-violet-200",
    humans: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
    active: "border-primary bg-primary/15 text-primary font-bold",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

export default function LeagueMembershipCard({
  membership: m,
  userId,
  active,
  children,
  onSelect,
  className = "",
}: Props) {
  const pack = getSportPack(m.sportId || "cfb");
  const role = membershipRoleLabel(m, userId);
  const isCommish = role === "Commissioner";
  const bots = m.botCount ?? 0;
  const humans = m.humanCount;
  const hasBotCount = typeof m.botCount === "number";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{m.leagueName}</div>
          <div className="text-[11px] text-muted mt-0.5 font-mono tracking-wide">
            {m.code}
            {active ? " · Active" : ""}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <Chip tone="sport">
          {pack.emoji} {pack.shortLabel}
        </Chip>
        <Chip tone="role">{isCommish ? "Commissioner" : role}</Chip>
        <Chip tone={m.isOpen ? "open" : "private"}>
          {m.isOpen ? "Open room" : "Private"}
        </Chip>
        {typeof humans === "number" && (
          <Chip tone="humans">
            {humans} player{humans === 1 ? "" : "s"}
          </Chip>
        )}
        {hasBotCount && (
          <Chip tone="bots">
            {bots > 0
              ? `${bots} bot${bots === 1 ? "" : "s"}`
              : "No bots"}
          </Chip>
        )}
        {active && <Chip tone="active">Active</Chip>}
      </div>

      {children}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-left rounded-xl border px-3 py-3 transition hover:border-primary/60 ${
          active ? "border-primary bg-primary/10" : "border-border bg-card/40"
        } ${className}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        active ? "border-primary bg-primary/10" : "border-border bg-card/40"
      } ${className}`}
    >
      {body}
    </div>
  );
}
