"use client";

import { useMemo, useState } from "react";
import type { BadgeStatus, BadgeTier } from "@/lib/types";
import { TIER_LABEL, TIER_ORDER } from "@/lib/badges";
import {
  WWC_STAMP_EMOJI,
  WWC_STAMP_LABEL,
  type WwcBadgeDef,
  type WwcStampKind,
} from "@/lib/sports/wwc-achievements";
import { WWC_BRAZIL_COLORS } from "@/lib/sports/home-chrome";

type Props = {
  badges: BadgeStatus[];
};

const TIER_INK: Record<BadgeTier, string> = {
  common: WWC_BRAZIL_COLORS.emerald,
  rare: WWC_BRAZIL_COLORS.royal,
  epic: "#7c3aed",
  legendary: WWC_BRAZIL_COLORS.gold,
};

function stampKind(def: BadgeStatus["def"]): WwcStampKind {
  const w = def as WwcBadgeDef;
  return w.stamp || "visa";
}

function cleanName(name: string) {
  return name.replace(/^⭐ |🌍 |🏆 |👑 |🌎 /g, "");
}

/**
 * World Cup progression as a passport — discovery-first.
 * Layer 1 players see recently earned + next goal.
 * Full stamp book is optional explore (not day-1 homework).
 */
export default function WwcPassportShelf({ badges }: Props) {
  const [selected, setSelected] = useState<BadgeStatus | null>(null);
  const [explore, setExplore] = useState(false);
  const earnedList = useMemo(
    () => badges.filter((b) => b.earned),
    [badges]
  );
  const earned = earnedList.length;
  const { emerald, gold, royal, white } = WWC_BRAZIL_COLORS;

  /** Next goal: first locked stamp with progress, else first locked common */
  const nextGoal = useMemo(() => {
    const withProgress = badges.find(
      (b) =>
        !b.earned &&
        b.progress &&
        b.progress.target > 0 &&
        b.progress.current > 0
    );
    if (withProgress) return withProgress;
    return (
      badges.find((b) => !b.earned && b.def.tier === "common") ||
      badges.find((b) => !b.earned) ||
      null
    );
  }, [badges]);

  const recent = useMemo(() => {
    const list = [...earnedList];
    // Prefer most recently stamped if we have meta; else catalog order
    list.sort((a, b) => {
      const at = a.earnedAt ? Date.parse(a.earnedAt) : 0;
      const bt = b.earnedAt ? Date.parse(b.earnedAt) : 0;
      return bt - at;
    });
    return list.slice(0, 4);
  }, [earnedList]);

  const byTier = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        items: badges
          .filter((b) => b.def.tier === tier)
          .sort((a, b) => {
            if (a.earned !== b.earned) return a.earned ? -1 : 1;
            return a.def.name.localeCompare(b.def.name);
          }),
      })).filter((row) => row.items.length > 0),
    [badges]
  );

  return (
    <section className="mb-8">
      <div
        className="rounded-2xl border-2 overflow-hidden"
        style={{
          borderColor: `${gold}88`,
          background: `linear-gradient(165deg, ${royal}f2 0%, #061018 40%, ${emerald}22 100%)`,
        }}
      >
        <div
          className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b"
          style={{ borderColor: `${gold}44` }}
        >
          <div>
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: gold }}
            >
              Tournament passport
            </p>
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
              FIFA Women&apos;s World Cup Brazil 2027™
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              Simple stamps. Endless book — explore when you&apos;re curious.
            </p>
          </div>
          <div
            className="text-right rounded-xl px-3 py-2 border"
            style={{ borderColor: `${gold}66`, background: `${emerald}33` }}
          >
            <p className="text-[10px] uppercase tracking-wide text-white/70">
              Stamps
            </p>
            <p className="text-xl font-black" style={{ color: gold }}>
              {earned}
              <span className="text-sm text-white/60 font-bold">
                /{badges.length}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Layer 2 surface — not 80 locked tiles */}
          <div>
            <p
              className="text-[10px] font-black uppercase tracking-[0.18em] mb-2"
              style={{ color: gold }}
            >
              Recently stamped
            </p>
            {recent.length === 0 ? (
              <p className="text-sm text-white/65 leading-relaxed">
                Lock a matchday. Stamps show up here — no homework, no wall of
                grey.
              </p>
            ) : (
              <ul className="space-y-2">
                {recent.map((s) => (
                  <li key={s.def.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className="w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left touch-manipulation"
                      style={{
                        borderColor: `${gold}55`,
                        background: `${emerald}22`,
                      }}
                    >
                      <span className="text-2xl" aria-hidden>
                        {WWC_STAMP_EMOJI[stampKind(s.def)]}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white truncate">
                          ⭐ {cleanName(s.def.name)}
                        </span>
                        <span className="text-[11px] text-white/60">
                          {TIER_LABEL[s.def.tier]} · +{s.def.points} pts
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {nextGoal && (
            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: `${emerald}88`,
                background: "rgba(0,0,0,0.28)",
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-[0.18em] mb-1"
                style={{ color: emerald }}
              >
                Next goal
              </p>
              <button
                type="button"
                onClick={() => setSelected(nextGoal)}
                className="w-full text-left"
              >
                <p className="text-base font-bold text-white">
                  🏆 {cleanName(nextGoal.def.name)}
                </p>
                <p className="text-xs text-white/65 mt-0.5 leading-snug">
                  {nextGoal.def.howToEarn}
                </p>
                {nextGoal.progress && nextGoal.progress.target > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] text-white/70 mb-1">
                      <span>Progress</span>
                      <span className="font-bold" style={{ color: gold }}>
                        {nextGoal.progress.current} / {nextGoal.progress.target}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (nextGoal.progress.current /
                                nextGoal.progress.target) *
                                100
                            )
                          )}%`,
                          backgroundColor: emerald,
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExplore((e) => !e)}
            className="w-full py-2.5 rounded-xl border text-sm font-semibold touch-manipulation"
            style={{
              borderColor: `${gold}66`,
              color: gold,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {explore
              ? "Hide full passport"
              : `Explore full passport (${badges.length} stamps)`}
          </button>

          {explore && (
            <div className="space-y-6 pt-1 border-t" style={{ borderColor: `${gold}33` }}>
              <p className="text-[11px] text-white/55 leading-relaxed">
                Deep fan mode — the whole book. Not required. Discover when you
                care.
              </p>
              {byTier.map(({ tier, items }) => (
                <div key={tier}>
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                    style={{ color: TIER_INK[tier] }}
                  >
                    {TIER_LABEL[tier]} · {items.filter((i) => i.earned).length}/
                    {items.length}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {items.map((status) => {
                      const stamp = stampKind(status.def);
                      const ink = TIER_INK[status.def.tier];
                      return (
                        <button
                          key={status.def.id}
                          type="button"
                          onClick={() => setSelected(status)}
                          className={`relative aspect-[3/4] rounded-lg border-2 p-1.5 flex flex-col items-center justify-center text-center transition touch-manipulation ${
                            status.earned
                              ? "opacity-100"
                              : "opacity-40 grayscale"
                          }`}
                          style={{
                            borderColor: status.earned ? ink : `${ink}44`,
                            background: status.earned
                              ? `linear-gradient(160deg, ${white}12, ${ink}28)`
                              : "rgba(0,0,0,0.25)",
                          }}
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {status.earned
                              ? WWC_STAMP_EMOJI[stamp]
                              : "⬜"}
                          </span>
                          <span className="mt-1 text-[9px] font-bold text-white leading-tight line-clamp-2">
                            {cleanName(status.def.name)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 p-5 shadow-2xl"
            style={{
              borderColor: gold,
              background: `linear-gradient(180deg, ${royal} 0%, #0a1210 100%)`,
            }}
          >
            <p
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: gold }}
            >
              {WWC_STAMP_LABEL[stampKind(selected.def)]} ·{" "}
              {TIER_LABEL[selected.def.tier]}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-4xl">
                {selected.earned
                  ? WWC_STAMP_EMOJI[stampKind(selected.def)]
                  : selected.def.icon}
              </span>
              <h3 className="text-xl font-black text-white leading-tight">
                {selected.def.name}
              </h3>
            </div>
            <p className="text-sm text-white/85 mt-3 leading-relaxed">
              {selected.def.description}
            </p>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              <span className="font-bold text-white/80">How: </span>
              {selected.def.howToEarn}
            </p>
            {selected.earned ? (
              <p className="text-sm font-bold mt-3" style={{ color: gold }}>
                Stamped · +{selected.def.points} pts
              </p>
            ) : selected.progress ? (
              <p className="text-sm text-white/70 mt-3">
                Progress {selected.progress.current}/{selected.progress.target}
              </p>
            ) : (
              <p className="text-sm text-white/50 mt-3">Not stamped yet</p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-4 w-full py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: emerald, color: white }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
