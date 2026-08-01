"use client";

/**
 * Trophy Room hardware icons — every award type has real art, not a lone emoji.
 * Championship → sport pack main trophy (crystal / Lombardi / cup).
 * Toilet Bowl → porcelain crown on a gold pedestal (still a trophy, still a toilet).
 * Village Nerd → custom Big Brain Nerd Cup (super nerdy on purpose).
 */

import SportChampionshipTrophy from "@/components/SportChampionshipTrophy";
import type { TrophyType } from "@/lib/trophies";
import type { ProfileTrophyKind } from "@/lib/profile-hardware";

type HardwareKind = TrophyType | ProfileTrophyKind | "championship" | "toilet_bowl" | "crystal_ball" | "division";

type Props = {
  kind: HardwareKind;
  sportId?: string | null;
  size?: number;
  className?: string;
  /** Soft float — great for hero / pedestals */
  animate?: boolean;
  /** Dim empty shelf */
  empty?: boolean;
  threePeat?: boolean;
};

export default function HardwareTrophyIcon({
  kind,
  sportId,
  size = 64,
  className = "",
  animate = false,
  empty = false,
  threePeat = false,
}: Props) {
  const wrap = empty ? "opacity-40 grayscale" : "";

  if (kind === "championship") {
    return (
      <div className={`${wrap} ${className}`.trim()}>
        <SportChampionshipTrophy
          sport={sportId}
          size={size}
          animate={animate && !empty}
          threePeat={threePeat}
        />
      </div>
    );
  }

  if (kind === "toilet_bowl") {
    return (
      <div
        className={`relative inline-flex items-center justify-center ${wrap} ${className}`.trim()}
        style={{ width: size, height: size * 1.1 }}
      >
        <div className={animate && !empty ? "champ-trophy-float" : undefined}>
          <ToiletBowlTrophySvg size={size} />
        </div>
      </div>
    );
  }

  if (kind === "crystal_ball") {
    return (
      <div
        className={`relative inline-flex items-center justify-center ${wrap} ${className}`.trim()}
        style={{ width: size, height: size * 1.15 }}
      >
        <div className={animate && !empty ? "champ-trophy-float" : undefined}>
          <NerdBrainTrophySvg size={size} />
        </div>
      </div>
    );
  }

  // Division shield
  return (
    <div
      className={`relative inline-flex items-center justify-center ${wrap} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <DivisionShieldSvg size={size} />
    </div>
  );
}

/** Toilet Bowl hardware — porcelain throne, gold base, still absolutely a trophy. */
function ToiletBowlTrophySvg({ size }: { size: number }) {
  const id = `tb-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Toilet Bowl trophy"
    >
      <defs>
        <linearGradient id={`${id}-porc`} x1="30" y1="20" x2="90" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#e2e8f0" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="30" y1="78" x2="90" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e9d5ff" />
          <stop offset="0.45" stopColor="#c084fc" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="50%">
          <stop stopColor="#c084fc" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="50" r="40" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-sh)`}>
        {/* Lid / crown */}
        <ellipse cx="60" cy="28" rx="26" ry="8" fill={`url(#${id}-porc)`} stroke="#cbd5e1" strokeWidth="1" />
        <path d="M38 28 Q38 16 60 14 Q82 16 82 28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        {/* Little gold crest on lid */}
        <path d="M60 12 L63 20 L60 18 L57 20 Z" fill="#fbbf24" />
        {/* Bowl */}
        <path
          d="M36 32 C34 48 38 62 60 66 C82 62 86 48 84 32 Z"
          fill={`url(#${id}-porc)`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />
        {/* Water */}
        <ellipse cx="60" cy="42" rx="16" ry="6" fill="#7dd3fc" fillOpacity="0.55" />
        {/* Tank back */}
        <rect x="72" y="24" width="16" height="28" rx="3" fill={`url(#${id}-porc)`} stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="80" cy="32" r="3" fill="#a855f7" opacity="0.7" />
        {/* Stem */}
        <rect x="52" y="66" width="16" height="14" rx="2" fill="#a78bfa" />
      </g>
      {/* Purple glory base */}
      <rect x="38" y="80" width="44" height="8" rx="2" fill={`url(#${id}-gold)`} />
      <rect x="30" y="88" width="60" height="12" rx="3" fill={`url(#${id}-gold)`} stroke="#7c3aed" strokeWidth="0.8" />
      <text x="60" y="97" textAnchor="middle" fill="#f5f3ff" fontSize="6" fontWeight="800" fontFamily="system-ui">
        STILL A CROWN
      </text>
    </svg>
  );
}

/**
 * Village Nerd / Big Brain hardware.
 * Crystal ball of prophecy on a fortress of textbooks, with glasses,
 * equations, pocket protector, and a glowing brain. Maximum nerd. Zero shame.
 */
function NerdBrainTrophySvg({ size }: { size: number }) {
  const id = `nerd-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Village Nerd Big Brain trophy"
    >
      <defs>
        <linearGradient id={`${id}-ball`} x1="35" y1="18" x2="85" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0f2fe" />
          <stop offset="0.4" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id={`${id}-brain`} x1="45" y1="8" x2="75" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbcfe8" />
          <stop offset="0.5" stopColor="#f472b6" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id={`${id}-book1`} x1="30" y1="72" x2="90" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3a5f" />
          <stop offset="1" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id={`${id}-book2`} x1="28" y1="84" x2="92" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14532d" />
          <stop offset="1" stopColor="#166534" />
        </linearGradient>
        <linearGradient id={`${id}-book3`} x1="26" y1="94" x2="94" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c2d12" />
          <stop offset="1" stopColor="#9a3412" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="35%" r="50%">
          <stop stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#a855f7" stopOpacity="0.15" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      <circle cx="60" cy="48" r="44" fill={`url(#${id}-glow)`} />

      {/* Orbiting nerd particles: π, Σ, √ */}
      <text x="22" y="36" fill="#7dd3fc" fontSize="9" fontFamily="Georgia, serif" opacity="0.85">
        π
      </text>
      <text x="92" y="42" fill="#c4b5fd" fontSize="8" fontFamily="Georgia, serif" opacity="0.85">
        Σ
      </text>
      <text x="18" y="62" fill="#67e8f9" fontSize="8" fontFamily="Georgia, serif" opacity="0.75">
        √
      </text>
      <text x="96" y="64" fill="#f0abfc" fontSize="7" fontFamily="ui-monospace, monospace" opacity="0.8">
        E=mc²
      </text>

      <g filter={`url(#${id}-sh)`}>
        {/* Big brain perched on top of the crystal ball */}
        <ellipse cx="60" cy="18" rx="16" ry="12" fill={`url(#${id}-brain)`} />
        <path
          d="M48 18 Q50 10 56 12 Q60 6 64 12 Q70 10 72 18 Q74 24 68 26 Q60 28 52 26 Q46 24 48 18"
          fill={`url(#${id}-brain)`}
          stroke="#9d174d"
          strokeWidth="0.6"
          opacity="0.95"
        />
        {/* Brain fold lines */}
        <path d="M54 14 Q60 16 66 14" stroke="#9d174d" strokeWidth="0.7" fill="none" opacity="0.5" />
        <path d="M52 20 Q60 22 68 20" stroke="#9d174d" strokeWidth="0.7" fill="none" opacity="0.45" />

        {/* Crystal ball of prophecy */}
        <circle
          cx="60"
          cy="48"
          r="22"
          fill={`url(#${id}-ball)`}
          stroke="#7dd3fc"
          strokeWidth="1.5"
        />
        {/* Highlight */}
        <ellipse cx="52" cy="40" rx="7" ry="5" fill="#fff" fillOpacity="0.35" />
        {/* Mini football / foresight inside ball */}
        <ellipse
          cx="60"
          cy="50"
          rx="8"
          ry="5"
          fill="none"
          stroke="#0c4a6e"
          strokeWidth="1"
          opacity="0.45"
          transform="rotate(-20 60 50)"
        />

        {/* Thick nerd glasses on the ball */}
        <g stroke="#0f172a" strokeWidth="2.2" fill="rgba(15,23,42,0.15)">
          <circle cx="50" cy="46" r="7" />
          <circle cx="70" cy="46" r="7" />
          <path d="M57 46 H63" strokeWidth="2" />
          <path d="M43 46 H38" strokeWidth="1.8" />
          <path d="M77 46 H82" strokeWidth="1.8" />
        </g>
        {/* Lens glare */}
        <circle cx="48" cy="44" r="1.5" fill="#fff" opacity="0.5" />
        <circle cx="68" cy="44" r="1.5" fill="#fff" opacity="0.5" />

        {/* Pocket protector on the side (clip) */}
        <path
          d="M86 52 L92 52 L94 68 L84 68 Z"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="0.8"
        />
        <rect x="87" y="54" width="1.5" height="10" rx="0.5" fill="#ef4444" />
        <rect x="89.5" y="54" width="1.5" height="11" rx="0.5" fill="#3b82f6" />
        <rect x="92" y="54" width="1.5" height="9" rx="0.5" fill="#22c55e" />

        {/* Pencil antenna */}
        <rect x="58" y="2" width="3" height="10" rx="0.5" fill="#fbbf24" transform="rotate(-12 60 8)" />
        <path d="M56 3 L61 1 L60 5 Z" fill="#f87171" transform="rotate(-12 60 8)" />
      </g>

      {/* Textbook fortress base */}
      <rect x="32" y="70" width="56" height="10" rx="1" fill={`url(#${id}-book1)`} stroke="#38bdf8" strokeWidth="0.5" />
      <text x="60" y="77" textAnchor="middle" fill="#7dd3fc" fontSize="5" fontWeight="700" fontFamily="ui-monospace, monospace">
        SPREADS VOL. I
      </text>
      <rect x="28" y="80" width="64" height="10" rx="1" fill={`url(#${id}-book2)`} stroke="#4ade80" strokeWidth="0.5" />
      <text x="60" y="87" textAnchor="middle" fill="#bbf7d0" fontSize="5" fontWeight="700" fontFamily="ui-monospace, monospace">
        ADVANCED VIBES
      </text>
      <rect x="24" y="90" width="72" height="12" rx="1.5" fill={`url(#${id}-book3)`} stroke="#fdba74" strokeWidth="0.5" />
      <text x="60" y="98" textAnchor="middle" fill="#fed7aa" fontSize="5.5" fontWeight="800" fontFamily="ui-monospace, monospace">
        100% CORRECT ONCE
      </text>

      {/* Tiny graph-paper corner mark */}
      <path d="M26 102 H34 V110" stroke="#38bdf8" strokeWidth="0.6" opacity="0.4" fill="none" />
    </svg>
  );
}

function DivisionShieldSvg({ size }: { size: number }) {
  const id = `div-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Division title"
    >
      <defs>
        <linearGradient id={`${id}-s`} x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path
        d="M32 6 L52 14 V32 C52 44 40 54 32 58 C24 54 12 44 12 32 V14 Z"
        fill={`url(#${id}-s)`}
        stroke="#34d399"
        strokeWidth="1.5"
      />
      <path d="M32 16 V48 M22 28 H42" stroke="#ecfdf5" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}
