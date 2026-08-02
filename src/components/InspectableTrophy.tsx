"use client";

/**
 * Wraps trophy art: single tap opens TrophyLightbox for detail.
 * Use everywhere hardware is shown small (wall, case, banner).
 */

import { useState, type ReactNode } from "react";
import TrophyLightbox from "@/components/TrophyLightbox";
import type { TrophyType } from "@/lib/trophies";
import type { ProfileTrophyKind } from "@/lib/profile-hardware";

type HardwareKind =
  | TrophyType
  | ProfileTrophyKind
  | "championship"
  | "toilet_bowl"
  | "crystal_ball"
  | "division";

type Props = {
  children: ReactNode;
  kind?: HardwareKind;
  sportId?: string | null;
  title?: string;
  subtitle?: string;
  threePeat?: boolean;
  leagueName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
  championshipOnly?: boolean;
  className?: string;
  /** Extra onClick (e.g. easter-egg tap counter) — still opens lightbox */
  onInspect?: () => void;
  ariaLabel?: string;
};

export default function InspectableTrophy({
  children,
  kind = "championship",
  sportId,
  title,
  subtitle,
  threePeat,
  leagueName,
  leagueId,
  leagueCode,
  championshipOnly,
  className = "",
  onInspect,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`relative inline-flex items-center justify-center touch-manipulation active:scale-[0.98] transition cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${className}`}
        aria-label={ariaLabel || `View ${title || "trophy"} larger`}
        onClick={(e) => {
          e.stopPropagation();
          onInspect?.();
          setOpen(true);
        }}
      >
        {children}
        <span className="sr-only">Tap to enlarge</span>
      </button>
      <TrophyLightbox
        open={open}
        onClose={() => setOpen(false)}
        kind={kind}
        sportId={sportId}
        title={title}
        subtitle={subtitle}
        threePeat={threePeat}
        leagueName={leagueName}
        leagueId={leagueId}
        leagueCode={leagueCode}
        championshipOnly={championshipOnly}
      />
    </>
  );
}
