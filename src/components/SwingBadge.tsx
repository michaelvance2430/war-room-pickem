"use client";

import { swingBadgeClass, type SwingLabel } from "@/lib/fun-board";

type Props = {
  swing: SwingLabel;
  /** Show ±N rank change next to label */
  showDelta?: boolean;
  className?: string;
};

export default function SwingBadge({
  swing,
  showDelta = true,
  className = "",
}: Props) {
  const deltaText =
    showDelta && swing.delta !== 0
      ? swing.delta > 0
        ? ` ↑${swing.delta}`
        : ` ↓${Math.abs(swing.delta)}`
      : "";

  return (
    <span
      className={`inline-flex items-center max-w-full truncate px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${swingBadgeClass(
        swing.tone
      )} ${className}`}
      title={
        swing.key === "architect"
          ? "Built the War Room — permanent flex"
          : swing.key === "gavel"
            ? "League commissioner — runs this room"
            : swing.key === "preseason"
              ? "No weeks scored yet"
              : swing.delta > 0
                ? `Climbed ${swing.delta} spot(s) after last week`
                : swing.delta < 0
                  ? `Fell ${Math.abs(swing.delta)} spot(s) after last week`
                  : "No standings move"
      }
    >
      {swing.text}
      {deltaText}
    </span>
  );
}
