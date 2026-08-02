"use client";

/**
 * Full-screen trophy inspect — click any hardware to blow it up.
 * Not Gazette energy: dark pedestal, large art, caption.
 */

import { useEffect } from "react";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import SportChampionshipTrophy, {
  trophyHardwareLabel,
} from "@/components/SportChampionshipTrophy";
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
  open: boolean;
  onClose: () => void;
  /** Prefer kind for toilet/nerd/champ; championship uses sport art */
  kind?: HardwareKind;
  sportId?: string | null;
  title?: string;
  subtitle?: string;
  threePeat?: boolean;
  leagueName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
  /** When true, only SportChampionshipTrophy (champ art) */
  championshipOnly?: boolean;
};

export default function TrophyLightbox({
  open,
  onClose,
  kind = "championship",
  sportId,
  title,
  subtitle,
  threePeat = false,
  leagueName,
  leagueId,
  leagueCode,
  championshipOnly = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const label =
    title ||
    (kind === "championship" || championshipOnly
      ? trophyHardwareLabel(sportId, threePeat, { leagueName, leagueId })
      : kind === "toilet_bowl"
        ? "Toilet Bowl crown"
        : kind === "crystal_ball"
          ? "Village Nerd hardware"
          : "Hardware");

  // Large display size — phone-friendly, detail readable
  const artSize = 280;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-sm px-3 py-2 rounded-xl border border-border bg-card/90 text-muted hover:text-foreground min-h-[44px]"
      >
        Close
      </button>

      <div
        className="w-full max-w-md flex flex-col items-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pedestal stage */}
        <div className="relative w-full flex flex-col items-center pt-6 pb-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-black/40 shadow-[0_0_80px_rgba(0,0,0,0.6)]">
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[55%] h-8 rounded-full blur-xl opacity-80"
            style={{
              background:
                sportId === "nfl"
                  ? "radial-gradient(ellipse, rgba(197,204,211,0.45), transparent 70%)"
                  : "radial-gradient(ellipse, rgba(251,191,36,0.4), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative z-[1] flex items-center justify-center min-h-[300px]">
            {championshipOnly || kind === "championship" ? (
              <SportChampionshipTrophy
                sport={sportId}
                size={artSize}
                animate
                preferPhoto
                threePeat={threePeat}
                leagueName={leagueName}
                leagueId={leagueId}
                leagueCode={leagueCode}
              />
            ) : (
              <HardwareTrophyIcon
                kind={kind}
                sportId={sportId}
                size={artSize}
                animate
                threePeat={threePeat}
                leagueName={leagueName}
                leagueId={leagueId}
                leagueCode={leagueCode}
              />
            )}
          </div>
          <p className="text-[10px] text-muted mt-1 px-4">
            Tap outside or Close · pinch-zoom not needed
          </p>
        </div>

        <div className="text-center space-y-1 px-2">
          <p className="text-lg sm:text-xl font-black text-foreground leading-snug">
            {label}
          </p>
          {subtitle && (
            <p className="text-sm text-muted leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
