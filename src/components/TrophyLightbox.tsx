"use client";

/**
 * Full-screen trophy inspect — click any hardware to blow it up.
 * Not Gazette energy: dark pedestal, large art, caption.
 *
 * Scroll lock uses named acquireBodyLock (same system as other modals).
 * Raw body.overflow alone left orphan locks / broken scroll after close.
 */

import { useEffect, useId, useRef, useState } from "react";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import SportChampionshipTrophy, {
  trophyHardwareLabel,
} from "@/components/SportChampionshipTrophy";
import { acquireBodyLock } from "@/lib/smooth";
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
  // Stable owner id — do not re-acquire on every parent re-render
  const reactId = useId();
  const ownerId = `trophy-lightbox:${reactId}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    // Named project lock: position:fixed + scrollY restore + owner tracking
    const release = acquireBodyLock(ownerId);

    return () => {
      window.removeEventListener("keydown", onKey);
      release();
    };
    // onClose via ref — avoid lock thrash when parent re-renders
  }, [open, ownerId]);

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
  const animateArt = !reduceMotion;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4 overscroll-contain"
      onClick={() => onCloseRef.current()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-trophy-lightbox="1"
      data-body-lock-owner={ownerId}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCloseRef.current();
        }}
        className="absolute top-4 right-4 z-10 text-sm px-3 py-2 rounded-xl border border-border bg-card/90 text-muted hover:text-foreground min-h-[44px]"
      >
        Close
      </button>

      <div
        className="w-full max-w-md flex flex-col items-center gap-5 max-h-[min(92vh,900px)] overflow-y-auto overscroll-contain touch-pan-y"
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
                animate={animateArt}
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
                animate={animateArt}
                threePeat={threePeat}
                leagueName={leagueName}
                leagueId={leagueId}
                leagueCode={leagueCode}
              />
            )}
          </div>
          <p className="text-[10px] text-muted mt-1 px-4">
            Tap outside or Close · Esc to dismiss
          </p>
        </div>

        <div className="text-center space-y-1 px-2 pb-4">
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
