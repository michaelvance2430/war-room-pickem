"use client";

import { useState } from "react";
import { TIER_LABEL, TIER_ORDER } from "@/lib/badges";
import { BadgeStatus, BadgeTier } from "@/lib/types";

const TIER_STYLES: Record<
  BadgeTier,
  {
    border: string;
    glow: string;
    text: string;
    shelf: string;
    shelfEdge: string;
    labelBg: string;
  }
> = {
  legendary: {
    border: "border-badge-legendary",
    glow: "shadow-[0_0_14px_rgba(234,179,8,0.45)]",
    text: "text-badge-legendary",
    shelf: "from-badge-legendary/15 via-card to-card",
    shelfEdge: "bg-gradient-to-r from-badge-legendary/80 via-badge-legendary/50 to-badge-legendary/20",
    labelBg: "text-badge-legendary border-badge-legendary/40",
  },
  epic: {
    border: "border-badge-epic",
    glow: "shadow-[0_0_12px_rgba(168,85,247,0.4)]",
    text: "text-badge-epic",
    shelf: "from-badge-epic/15 via-card to-card",
    shelfEdge: "bg-gradient-to-r from-badge-epic/80 via-badge-epic/50 to-badge-epic/20",
    labelBg: "text-badge-epic border-badge-epic/40",
  },
  rare: {
    border: "border-badge-rare",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    text: "text-badge-rare",
    shelf: "from-badge-rare/15 via-card to-card",
    shelfEdge: "bg-gradient-to-r from-badge-rare/80 via-badge-rare/50 to-badge-rare/20",
    labelBg: "text-badge-rare border-badge-rare/40",
  },
  common: {
    border: "border-badge-common",
    glow: "shadow-[0_0_10px_rgba(34,197,94,0.35)]",
    text: "text-badge-common",
    shelf: "from-badge-common/15 via-card to-card",
    shelfEdge: "bg-gradient-to-r from-badge-common/80 via-badge-common/50 to-badge-common/20",
    labelBg: "text-badge-common border-badge-common/40",
  },
};

function BadgeTile({
  status,
  onSelect,
}: {
  status: BadgeStatus;
  onSelect: (s: BadgeStatus) => void;
}) {
  const { def, earned } = status;
  const style = TIER_STYLES[def.tier];

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      title={def.name}
      className={`
        relative flex flex-col items-center gap-1 w-[4.5rem] sm:w-20 shrink-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg
        transition hover:-translate-y-0.5
      `}
    >
      <div
        className={`
          w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center
          text-xl sm:text-2xl border-2 bg-background
          ${earned
            ? `${style.border} ${style.glow}`
            : "border-border grayscale opacity-40"
          }
        `}
      >
        <span aria-hidden>{def.icon}</span>
      </div>
      <span
        className={`text-[10px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 ${
          earned ? "text-foreground" : "text-muted"
        }`}
      >
        {def.name}
      </span>
    </button>
  );
}

function TierShelf({
  tier,
  badges,
  onSelect,
}: {
  tier: BadgeTier;
  badges: BadgeStatus[];
  onSelect: (s: BadgeStatus) => void;
}) {
  if (badges.length === 0) return null;

  const style = TIER_STYLES[tier];
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="mb-5 last:mb-0">
      {/* Shelf label */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.labelBg}`}
        >
          {TIER_LABEL[tier]}
        </span>
        <span className="text-[10px] text-muted">
          {earned}/{badges.length}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Shelf body — badges sit above a ledge */}
      <div
        className={`
          relative rounded-t-xl border border-b-0 border-border
          bg-gradient-to-b ${style.shelf}
          px-3 pt-4 pb-2
        `}
      >
        <div className="flex flex-wrap gap-x-2 gap-y-3 justify-start content-end min-h-[5.5rem]">
          {badges.map((b) => (
            <BadgeTile key={b.def.id} status={b} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* Shelf edge (the board they sit on) */}
      <div
        className={`h-2 rounded-b-md ${style.shelfEdge} shadow-[0_4px_8px_rgba(0,0,0,0.35)]`}
      />
      <div className="mx-2 h-1.5 rounded-b bg-black/40" />
    </div>
  );
}

function BadgeDetailModal({
  status,
  onClose,
}: {
  status: BadgeStatus;
  onClose: () => void;
}) {
  const { def, earned, progress } = status;
  const style = TIER_STYLES[def.tier];
  const lockedText =
    def.creatorOnly && !earned
      ? def.lockedLabel || "Locked — you are NOT the creator"
      : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`
              w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 shrink-0
              ${earned
                ? `${style.border} ${style.glow}`
                : "border-border grayscale opacity-50"
              }
            `}
          >
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">{def.name}</h3>
              <span className={`text-xs font-semibold uppercase ${style.text}`}>
                {TIER_LABEL[def.tier]}
              </span>
            </div>
            <p className="text-sm text-muted mt-1">{def.description}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg bg-background border border-border px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">
              Status
            </div>
            {earned ? (
              <div className={`font-medium ${style.text}`}>Earned</div>
            ) : lockedText ? (
              <div className="font-medium text-warning">{lockedText}</div>
            ) : (
              <div className="font-medium text-muted">Locked</div>
            )}
          </div>

          <div className="rounded-lg bg-background border border-border px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">
              {earned ? "About" : "How to earn"}
            </div>
            <div className="text-foreground">
              {earned && def.creatorOnly ? def.description : def.howToEarn}
            </div>
            {!earned && progress && progress.target > 1 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Progress</span>
                  <span>
                    {progress.current} / {progress.target}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.round(
                        (progress.current / progress.target) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>Achievement points</span>
            <span className={`font-semibold ${style.text}`}>+{def.points}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-card-hover transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

interface BadgeShelfProps {
  badges: BadgeStatus[];
}

export default function BadgeShelf({ badges }: BadgeShelfProps) {
  const [selected, setSelected] = useState<BadgeStatus | null>(null);
  const earnedCount = badges.filter((b) => b.earned).length;

  // One shelf per tier — never mix tiers on the same row
  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: badges
      .filter((b) => b.def.tier === tier)
      .sort((a, b) => {
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return a.def.name.localeCompare(b.def.name);
      }),
  })).filter((row) => row.items.length > 0);

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Badge shelves</h2>
        <p className="text-xs text-muted">
          {earnedCount} earned · {badges.length - earnedCount} locked · each
          tier on its own shelf · tap for details
        </p>
      </div>

      <div className="space-y-1">
        {byTier.map(({ tier, items }) => (
          <TierShelf
            key={tier}
            tier={tier}
            badges={items}
            onSelect={setSelected}
          />
        ))}
      </div>

      {selected && (
        <BadgeDetailModal
          status={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
