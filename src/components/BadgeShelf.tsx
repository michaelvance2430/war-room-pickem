"use client";

import { useEffect, useState } from "react";
import { TIER_LABEL, TIER_ORDER } from "@/lib/badges";
import { getBadgeRewards } from "@/lib/badge-rewards";
import { BadgeStatus, BadgeTier } from "@/lib/types";
import CavalryScoutTrophy from "@/components/CavalryScoutTrophy";
import OlympianTrophy from "@/components/OlympianTrophy";

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
  const rewards = getBadgeRewards(def);
  const cavalry = def.id === "worlds_greatest_cavalry_scout";
  const olympian = def.id === "built_different_olympian";

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      title={`${def.name} — ${rewards.line}`}
      className="relative flex flex-col items-center gap-1 w-[4.5rem] sm:w-20 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg transition hover:-translate-y-0.5"
    >
      <div
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl border-2 bg-background ${
          earned ? "" : "grayscale opacity-50"
        }`}
        style={{
          borderColor: earned ? hex : "#2e2e2e",
          boxShadow: earned ? `0 0 12px ${hex}66` : undefined,
        }}
      >
        {cavalry ? (
          <CavalryScoutTrophy size={40} muted={!earned} />
        ) : olympian ? (
          <OlympianTrophy size={42} muted={!earned} />
        ) : (
          <span aria-hidden>{def.icon}</span>
        )}
        {(rewards.title || rewards.border) && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-400 text-black text-[8px] font-black flex items-center justify-center"
            title={rewards.line}
          >
            {rewards.title && rewards.border
              ? "★"
              : rewards.title
                ? "T"
                : "B"}
          </span>
        )}
      </div>
      <span
        className={`text-[10px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 ${
          earned ? "text-foreground" : "text-muted"
        }`}
      >
        {def.name}
      </span>
      <span className="text-[9px] text-muted text-center leading-none">
        {rewards.line.replace(" · ", "·")}
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
  const rewards = getBadgeRewards(def);
  const isCreatorLocked = !!(def.creatorOnly && !earned);
  const lockedText = isCreatorLocked
    ? def.lockedLabel || "Hard locked — peasants don't get this one"
    : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-[max(1rem,env(safe-area-inset-top))]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-auto max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
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
          {/* Rewards chase panel */}
          <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1.5">
              Rewards if you earn this
            </div>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-muted">Points</span>
                <span className="font-semibold" style={{ color: hex }}>
                  +{rewards.points}
                  {def.creatorOnly || def.careerOnly ? (
                    <span className="text-muted font-normal text-xs">
                      {" "}
                      · career only
                    </span>
                  ) : null}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-muted">Name title</span>
                <span
                  className={
                    rewards.title
                      ? "font-semibold text-amber-200 text-right"
                      : "text-muted text-right"
                  }
                >
                  {rewards.title
                    ? `“${rewards.title}”`
                    : "— none"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-muted">Profile border</span>
                <span
                  className={
                    rewards.border
                      ? "font-semibold text-sky-200 text-right"
                      : "text-muted text-right"
                  }
                >
                  {rewards.border || "— none"}
                </span>
              </li>
            </ul>
            {(rewards.title || rewards.border) && (
              <p className="text-[10px] text-muted mt-2 leading-relaxed">
                Equip on Account after you earn it. Never sold — chase it.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-background border border-border px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">
              Status
            </div>
            {earned ? (
              <div className="font-medium" style={{ color: hex }}>
                {(() => {
                  const stack =
                    status.def.stackable &&
                    status.earnCount != null &&
                    status.earnCount > 1
                      ? ` ×${status.earnCount}`
                      : status.def.stackable &&
                          status.earnCount != null &&
                          status.earnCount === 1
                        ? " ×1"
                        : "";
                  const when =
                    status.earnedSeasonYear != null
                      ? status.earnedWeek != null && status.earnedWeek >= 0
                        ? ` · ${status.earnedSeasonYear} · Week ${status.earnedWeek}`
                        : ` · ${status.earnedSeasonYear}`
                      : "";
                  if (status.def.stackable && status.earnCount) {
                    return `Earned${stack}${when ? ` · last${when}` : ""}`;
                  }
                  return `Earned${when}`;
                })()}
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
  // Easter eggs: only show found ones — never locked placeholders (catalog size is secret)
  const visible = badges.filter(
    (b) => !b.def.id.startsWith("egg_") || b.earned
  );
  const earnedCount = visible.filter((b) => b.earned).length;
  const lockedNonEgg = visible.filter(
    (b) => !b.earned && !b.def.id.startsWith("egg_")
  ).length;
  const [firstWeek, setFirstWeek] = useState(false);

  useEffect(() => {
    void import("@/lib/first-week").then((fw) => {
      setFirstWeek(fw.isFirstWeekChrome());
    });
  }, []);

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: visible
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
          {earnedCount} earned · {lockedNonEgg} locked · each tier on its own
          shelf · tap for details
        </p>
        {firstWeek && (
          <p className="text-xs text-primary/90 mt-1.5 leading-relaxed">
            Cheevos light up as the season plays out — lock your first card,
            then the flex starts popping.
          </p>
        )}
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
