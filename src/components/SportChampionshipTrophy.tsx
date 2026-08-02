"use client";

/**
 * Championship hardware art by sport pack.
 * Stylized War Room silhouettes inspired by each league's main trophy —
 * not official marks. CFB crystal tower · NFL silver football on tripod ·
 * WWC cup · generic gold cup fallback.
 *
 * Default NFL → standard Super Bowl (Lombardi) art.
 * Vonnaggio Family Vacation only → custom gold family hardware.
 */

import {
  NFL_LOMBARDI_IMG,
  resolveLeagueChampionshipOverride,
} from "@/lib/league-trophy-override";

export type TrophySport = "cfb" | "nfl" | "soccer_wwc" | "other";

export { NFL_LOMBARDI_IMG };

type Props = {
  sport?: string | null;
  size?: number;
  className?: string;
  /** Extra glow / dynasty energy */
  threePeat?: boolean;
  /** Soft float animation */
  animate?: boolean;
  /**
   * Prefer photoreal PNG for NFL (default true).
   * Tiny shelf icons can still use SVG if preferPhoto is false.
   */
  preferPhoto?: boolean;
  /** Override active league (share cards / off-session). */
  leagueName?: string | null;
  leagueId?: string | null;
};

export function resolveTrophySport(sportId?: string | null): TrophySport {
  if (sportId === "nfl") return "nfl";
  if (sportId === "soccer_wwc") return "soccer_wwc";
  if (sportId === "cfb" || !sportId) return "cfb";
  return "other";
}

/** Hardware label under the art */
export function trophyHardwareLabel(
  sportId?: string | null,
  threePeat?: boolean,
  opts?: { leagueName?: string | null; leagueId?: string | null }
): string {
  const s = resolveTrophySport(sportId);
  if (threePeat) {
    if (s === "nfl") {
      const o = resolveLeagueChampionshipOverride({
        sportId: "nfl",
        leagueName: opts?.leagueName,
        leagueId: opts?.leagueId,
      });
      if (o) return `Dynasty · ${o.hardwareName}`;
      return "Dynasty ring · three straight";
    }
    if (s === "cfb") return "Dynasty crystal · three straight";
    return "Three-peat hardware";
  }
  if (s === "nfl") {
    const o = resolveLeagueChampionshipOverride({
      sportId: "nfl",
      leagueName: opts?.leagueName,
      leagueId: opts?.leagueId,
    });
    if (o) return o.hardwareLabel;
    return "Super Bowl trophy";
  }
  if (s === "cfb") return "National championship crystal";
  if (s === "soccer_wwc") return "World Cup hardware";
  return "Championship trophy";
}

export default function SportChampionshipTrophy({
  sport,
  size = 160,
  className = "",
  threePeat = false,
  animate = true,
  preferPhoto = true,
  leagueName,
  leagueId,
}: Props) {
  const sid = resolveTrophySport(sport);
  const id = `champ-t-${sid}-${size}-${threePeat ? "3" : "1"}`;
  const override =
    sid === "nfl"
      ? resolveLeagueChampionshipOverride({
          sportId: "nfl",
          leagueName,
          leagueId,
        })
      : null;
  const useNflPhoto = sid === "nfl" && preferPhoto && size >= 40;
  const nflSrc = override?.championshipImg ?? NFL_LOMBARDI_IMG;
  const goldRoom = override?.glow === "gold";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size * 1.15 }}
    >
      {/* Floor glow */}
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[70%] h-4 rounded-full blur-md opacity-70"
        style={{
          background: goldRoom
            ? "radial-gradient(ellipse, rgba(251,191,36,0.55), transparent 70%)"
            : sid === "nfl"
              ? "radial-gradient(ellipse, rgba(197,204,211,0.55), transparent 70%)"
              : sid === "soccer_wwc"
                ? "radial-gradient(ellipse, rgba(255,223,0,0.45), transparent 70%)"
                : "radial-gradient(ellipse, rgba(251,191,36,0.5), transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className={animate ? "champ-trophy-float" : undefined}
        style={{ width: size, height: size }}
      >
        {useNflPhoto ? (
          <NflTrophyPhoto
            size={size}
            threePeat={threePeat}
            src={nflSrc}
            label={
              override
                ? "Vonnaggio championship trophy"
                : "Super Bowl championship trophy"
            }
          />
        ) : sid === "nfl" ? (
          <NflLombardiSvg id={id} size={size} threePeat={threePeat} />
        ) : sid === "soccer_wwc" ? (
          <WwcCupSvg id={id} size={size} threePeat={threePeat} />
        ) : sid === "cfb" ? (
          <CfbCrystalSvg id={id} size={size} threePeat={threePeat} />
        ) : (
          <GoldCupSvg id={id} size={size} threePeat={threePeat} />
        )}
      </div>
    </div>
  );
}

/** NFL championship photo — Lombardi default, or league override (Vonnaggio gold). */
function NflTrophyPhoto({
  size,
  threePeat,
  src,
  label,
}: {
  size: number;
  threePeat: boolean;
  src: string;
  label: string;
}) {
  return (
    <div
      className="relative w-full h-full flex items-end justify-center"
      role="img"
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="w-full h-full object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
        draggable={false}
      />
      {threePeat && (
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-amber-300 font-black tracking-widest pointer-events-none"
          style={{ fontSize: Math.max(8, size * 0.08) }}
        >
          ★ ★ ★
        </span>
      )}
    </div>
  );
}

function CfbCrystalSvg({
  id,
  size,
  threePeat,
}: {
  id: string;
  size: number;
  threePeat: boolean;
}) {
  // Tall faceted crystal on gold base — CFP energy, War Room original
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="National championship crystal trophy"
    >
      <defs>
        <linearGradient id={`${id}-crystal`} x1="40" y1="8" x2="80" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="0.35" stopColor="#e2e8f0" />
          <stop offset="0.7" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id={`${id}-facet`} x1="50" y1="12" x2="70" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#cbd5e1" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="30" y1="78" x2="90" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde68a" />
          <stop offset="0.45" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="35%" r="50%">
          <stop stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="48" r="42" fill={`url(#${id}-glow)`} />
      {/* Crystal tower */}
      <g filter={`url(#${id}-sh)`}>
        <path
          d="M60 10 L78 28 L74 76 L46 76 L42 28 Z"
          fill={`url(#${id}-crystal)`}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <path d="M60 10 L78 28 L60 34 L42 28 Z" fill={`url(#${id}-facet)`} />
        <path d="M60 34 L74 76 L46 76 Z" fill="#94a3b8" fillOpacity="0.25" />
        <path d="M50 28 L55 70 L48 70 L46 30 Z" fill="#fff" fillOpacity="0.2" />
        {/* Small football engraving suggestion */}
        <ellipse cx="60" cy="48" rx="7" ry="10" stroke="#fbbf24" strokeWidth="1.2" fill="none" opacity="0.7" />
        <path d="M60 40 V56 M54 48 H66" stroke="#fbbf24" strokeWidth="0.8" opacity="0.5" />
      </g>
      {/* Gold base plates */}
      <rect x="38" y="76" width="44" height="8" rx="1.5" fill={`url(#${id}-gold)`} />
      <rect x="32" y="84" width="56" height="7" rx="1.5" fill={`url(#${id}-gold)`} />
      <rect x="26" y="91" width="68" height="10" rx="2" fill={`url(#${id}-gold)`} stroke="#b45309" strokeWidth="0.5" />
      {threePeat && (
        <text x="60" y="108" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="800" fontFamily="system-ui">
          ★ ★ ★
        </text>
      )}
    </svg>
  );
}

function NflLombardiSvg({
  id,
  size,
  threePeat,
}: {
  id: string;
  size: number;
  threePeat: boolean;
}) {
  // Silver football on three-leg tripod — real Super Bowl hardware silhouette
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Super Bowl championship trophy"
    >
      <defs>
        <linearGradient id={`${id}-silver`} x1="30" y1="8" x2="95" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#e8ecf0" />
          <stop offset="0.7" stopColor="#C5CCD3" />
          <stop offset="1" stopColor="#6b7280" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#4b5563" />
          <stop offset="0.5" stopColor="#1f2937" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`${id}-collar`} x1="50" y1="48" x2="70" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="35%" r="50%">
          <stop stopColor="#C5CCD3" stopOpacity="0.45" />
          <stop offset="1" stopColor="#0B1426" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-25%" y="-10%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
      <circle cx="60" cy="48" r="42" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-sh)`}>
        {/* Three tripod legs (front two + rear) */}
        <path
          d="M58 58 L34 112"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M62 58 L86 112"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M60 58 L60 114"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.4"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* Triangular base plate */}
        <path
          d="M32 112 L60 118 L88 112 L78 122 L42 122 Z"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="0.8"
        />
        {/* Collar under the ball */}
        <ellipse cx="60" cy="56" rx="11" ry="4.5" fill={`url(#${id}-collar)`} />
        <ellipse cx="60" cy="54" rx="8" ry="3" fill="#e2e8f0" opacity="0.85" />
        {/* Silver football (tilted) */}
        <ellipse
          cx="60"
          cy="34"
          rx="30"
          ry="19"
          fill={`url(#${id}-silver)`}
          stroke="#e2e8f0"
          strokeWidth="1.1"
          transform="rotate(-22 60 34)"
        />
        <path
          d="M40 30 Q60 22 80 40"
          stroke="#0B1426"
          strokeWidth="1.3"
          fill="none"
          opacity="0.5"
          transform="rotate(-22 60 34)"
        />
        <path
          d="M50 27 L53 32 M54 25 L57 30 M58 24 L61 29 M62 25 L65 30"
          stroke="#0B1426"
          strokeWidth="1.05"
          opacity="0.6"
          transform="rotate(-22 60 34)"
        />
      </g>
      {threePeat && (
        <text x="60" y="128" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="800" fontFamily="system-ui">
          ★ ★ ★
        </text>
      )}
    </svg>
  );
}

function WwcCupSvg({
  id,
  size,
  threePeat,
}: {
  id: string;
  size: number;
  threePeat: boolean;
}) {
  const emerald = "#009C3B";
  const gold = "#FFDF00";
  const royal = "#002776";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="World Cup championship trophy"
    >
      <defs>
        <linearGradient id={`${id}-cup`} x1="30" y1="12" x2="90" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor={gold} />
          <stop offset="0.5" stopColor={emerald} />
          <stop offset="1" stopColor={royal} />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="30" y1="80" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor={gold} />
          <stop offset="1" stopColor={royal} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="35%" r="50%">
          <stop stopColor={gold} stopOpacity="0.4" />
          <stop offset="1" stopColor={emerald} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="48" r="40" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-sh)`}>
        {/* Handles */}
        <path d="M32 32 Q18 40 28 58" stroke={gold} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M88 32 Q102 40 92 58" stroke={gold} strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Cup bowl */}
        <path
          d="M34 24 C34 24 36 58 60 62 C84 58 86 24 86 24 C86 24 80 18 60 18 C40 18 34 24 34 24 Z"
          fill={`url(#${id}-cup)`}
          stroke={gold}
          strokeWidth="1"
        />
        <ellipse cx="60" cy="24" rx="24" ry="6" fill={gold} opacity="0.9" />
        {/* Globe lines */}
        <ellipse cx="60" cy="40" rx="14" ry="16" stroke={royal} strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M46 40 H74 M60 24 V56" stroke={royal} strokeWidth="0.8" opacity="0.4" />
        {/* Stem + base */}
        <rect x="54" y="62" width="12" height="16" rx="1" fill={gold} />
        <rect x="40" y="78" width="40" height="8" rx="2" fill={`url(#${id}-base)`} />
        <rect x="32" y="86" width="56" height="12" rx="2" fill={`url(#${id}-base)`} stroke={gold} strokeWidth="0.8" />
      </g>
      {threePeat && (
        <text x="60" y="110" textAnchor="middle" fill={gold} fontSize="8" fontWeight="800" fontFamily="system-ui">
          ★ ★ ★
        </text>
      )}
    </svg>
  );
}

function GoldCupSvg({
  id,
  size,
  threePeat,
}: {
  id: string;
  size: number;
  threePeat: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Championship cup"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="30" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef3c7" />
          <stop offset="0.4" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M30 28 Q28 58 60 64 Q92 58 90 28 Z" fill={`url(#${id}-g)`} />
      <ellipse cx="60" cy="28" rx="30" ry="8" fill="#fde68a" />
      <path d="M30 34 Q18 42 28 54" stroke="#fbbf24" strokeWidth="5" fill="none" />
      <path d="M90 34 Q102 42 92 54" stroke="#fbbf24" strokeWidth="5" fill="none" />
      <rect x="54" y="64" width="12" height="18" fill="#d97706" />
      <rect x="36" y="82" width="48" height="10" rx="2" fill={`url(#${id}-g)`} />
      <rect x="28" y="92" width="64" height="10" rx="2" fill="#b45309" />
      {threePeat && (
        <text x="60" y="112" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="800">
          ★ ★ ★
        </text>
      )}
    </svg>
  );
}
