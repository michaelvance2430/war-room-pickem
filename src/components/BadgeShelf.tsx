"use client";

import { useState } from "react";
import { TIER_LABEL, TIER_ORDER } from "@/lib/badges";
import { BadgeStatus, BadgeTier } from "@/lib/types";

/** Hex colors so shelves always show even if Tailwind theme tokens miss */
const TIER_HEX: Record<BadgeTier, string> = {
  legendary: "#eab308",
  epic: "#a855f7",
  rare: "#3b82f6",
  common: "#22c55e",
};

function BadgeTile({
  status,
  onSelect,
  hex,
}: {
  status: BadgeStatus;
  onSelect: (s: BadgeStatus) => void;
  hex: string;
}) {
  const { def, earned } = status;

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      title={def.name}
      className="relative flex flex-col items-center gap-1 w-[4.5rem] sm:w-20 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg transition hover:-translate-y-0.5"
    >
      <div
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl border-2 bg-background ${
          earned ? "" : "grayscale opacity-50"
        }`}
        style={{
          borderColor: earned ? hex : "#2e2e2e",
          boxShadow: earned ? `0 0 12px ${hex}66` : undefined,
        }}
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

  const hex = TIER_HEX[tier];
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{ color: hex, borderColor: `${hex}66` }}
        >
          {TIER_LABEL[tier]}
        </span>
        <span className="text-[10px] text-muted">
          {earned}/{badges.length}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div
        className="relative rounded-t-xl border border-b-0 border-border px-3 pt-4 pb-2"
        style={{
          background: `linear-gradient(to bottom, ${hex}22, var(--card, #1a1a1a))`,
        }}
      >
        <div className="flex flex-wrap gap-x-2 gap-y-3 justify-start content-end min-h-[5.5rem]">
          {badges.map((b) => (
            <BadgeTile
              key={b.def.id}
              status={b}
              onSelect={onSelect}
              hex={hex}
            />
          ))}
        </div>
      </div>

      <div
        className="h-2 rounded-b-md shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
        style={{
          background: `linear-gradient(to right, ${hex}cc, ${hex}80, ${hex}33)`,
        }}
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
  const hex = TIER_HEX[def.tier];
  const isCreatorLocked = !!(def.creatorOnly && !earned);
  const lockedText = isCreatorLocked
    ? def.lockedLabel || "Hard locked — peasants don't get this one"
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
            className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 shrink-0 ${
              earned ? "" : "grayscale opacity-50"
            }`}
            style={{
              borderColor: earned ? hex : "#2e2e2e",
              boxShadow: earned ? `0 0 14px ${hex}80` : undefined,
            }}
          >
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">{def.name}</h3>
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: hex }}
              >
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
              <div className="font-medium" style={{ color: hex }}>
                Earned
              </div>
            ) : lockedText ? (
              <div className="font-medium text-warning">{lockedText}</div>
            ) : (
              <div className="font-medium text-muted">Locked</div>
            )}
          </div>

          <div
            className={`rounded-lg bg-background border px-3 py-2 ${
              isCreatorLocked ? "border-warning/40" : "border-border"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">
              {earned
                ? "About"
                : isCreatorLocked
                  ? "For the peasants"
                  : "How to earn"}
            </div>
            <div
              className={
                isCreatorLocked ? "text-warning/90" : "text-foreground"
              }
            >
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
            <span className="font-semibold" style={{ color: hex }}>
              +{def.points}
            </span>
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

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: badges
      .filter((b) => b.def.tier === tier)
      .sort((a, b) => {
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return a.def.name.localeCompare(b.def.name);
      }),
  })).filter((row) => row.items.length > 0);

  if (!badges.length) {
    return (
      <section>
        <h2 className="font-semibold text-lg mb-2">Badge shelves</h2>
        <p className="text-sm text-muted">No badges in catalog.</p>
      </section>
    );
  }

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
