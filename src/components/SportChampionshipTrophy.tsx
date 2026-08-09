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

import { getLeague } from "@/lib/league";
import {
  NFL_LOMBARDI_IMG,
  resolveLeagueChampionshipOverride,
} from "@/lib/league-trophy-override";
import { getChampionshipTrophyDesign } from "@/lib/championship-trophy-catalog";
import ChampionshipTrophySilhouette from "@/components/ChampionshipTrophySilhouette";

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
  leagueCode?: string | null;
  trophyDesignId?: string | null;
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
  leagueCode,
  trophyDesignId,
}: Props) {
  const live = typeof window !== "undefined" ? getLeague() : null;
  // Prefer explicit props, else active room (name + code so HAT42A always hits)
  const resolvedName = leagueName ?? live?.name ?? null;
  const resolvedId = leagueId ?? live?.id ?? null;
  const resolvedCode = leagueCode ?? live?.code ?? null;
  // Sport: explicit prop wins; else live league — do NOT invent "cfb" for override checks
  const sportHint = sport ?? live?.sportId ?? null;
  const sid = resolveTrophySport(sportHint);

  const override = resolveLeagueChampionshipOverride({
    sportId: sportHint,
    leagueName: resolvedName,
    leagueId: resolvedId,
    leagueCode: resolvedCode,
  });
  const selectedDesignId = trophyDesignId || live?.settings?.championshipTrophyId || "command_cup";
  const selectedDesign = getChampionshipTrophyDesign(selectedDesignId);

  // Vonnagio ALWAYS uses the gold photo — never Lombardi SVG/photo
  const forceGoldPhoto = !!override;
  const useNflPhoto =
    forceGoldPhoto || (sid === "nfl" && preferPhoto && size >= 40);
  const nflSrc = override?.championshipImg ?? NFL_LOMBARDI_IMG;
  const goldRoom = override?.glow === "gold";
  const id = `champ-t-${sid}-${size}-${threePeat ? "3" : "1"}-${
    forceGoldPhoto ? "gold" : "std"
  }`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size * 1.15 }}
      data-trophy={forceGoldPhoto ? "vonnagio-gold" : sid}
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
        style={{
          width: size,
          height: size,
          filter:
            selectedDesignId === "brass_football"
              ? "sepia(.72) saturate(1.65)"
              : selectedDesignId === "last_one_standing"
                ? "contrast(1.18) saturate(.75)"
                : undefined,
        }}
      >
        {forceGoldPhoto ? (
          <NflTrophyPhoto
            size={size}
            threePeat={threePeat}
            src={override!.championshipImg}
            label="Vonnagio championship trophy"
          />
        ) : (
          <ChampionshipTrophySilhouette design={selectedDesign} size={size} threePeat={threePeat} />
        )}
      </div>
    </div>
  );
}

function TrophyDesignMark({ id, size, colors }: { id: string; size: number; colors: [string, string, string] }) {
  if (id === "command_cup") return null;
  const common = "absolute z-[3] left-1/2 -translate-x-1/2 flex items-center justify-center font-black drop-shadow-[0_3px_4px_rgba(0,0,0,.65)]";
  if (id === "insufferable_crown") {
    return <div aria-hidden className={`${common} top-[2%] text-amber-300`} style={{ fontSize: size * .28 }}>♛</div>;
  }
  if (id === "the_receipt") {
    return <div aria-hidden className={`${common} bottom-[3%] w-[70%] border-y-2 border-dashed bg-zinc-100 py-1 text-zinc-900`} style={{ fontSize: Math.max(7, size * .065) }}>RECEIPTS VERIFIED</div>;
  }
  if (id === "last_one_standing") {
    return <div aria-hidden className={`${common} bottom-[2%] -rotate-3 border-2 border-red-500 bg-zinc-950/90 px-2 py-1 text-red-400`} style={{ fontSize: Math.max(7, size * .065) }}>LAST ONE STANDING</div>;
  }
  return <div aria-hidden className={`${common} bottom-[4%] rounded-full border-2 px-2 py-1`} style={{ color: colors[0], borderColor: colors[1], background: colors[2], fontSize: Math.max(7, size * .065) }}>{id === "golden_gut" ? "TRUST THE GUT" : "BIG BRASS"}</div>;
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
        className="w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        draggable={false}
        // Sharper on retina when enlarged
        style={{ imageRendering: "auto" }}
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
  // CFP-style crystal football on tiered gold base — faceted glass look
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="National championship crystal trophy"
    >
      <defs>
        <linearGradient
          id={`${id}-crystal`}
          x1="28"
          y1="8"
          x2="92"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="0.2" stopColor="#f1f5f9" />
          <stop offset="0.45" stopColor="#cbd5e1" />
          <stop offset="0.75" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient
          id={`${id}-facet`}
          x1="40"
          y1="12"
          x2="70"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#e2e8f0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#94a3b8" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient
          id={`${id}-gold`}
          x1="30"
          y1="72"
          x2="90"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fef3c7" />
          <stop offset="0.35" stopColor="#fbbf24" />
          <stop offset="0.7" stopColor="#d97706" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id={`${id}-stem`} x1="54" y1="58" x2="66" y2="76">
          <stop stopColor="#fde68a" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="30%" r="48%">
          <stop stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="0.55" stopColor="#e2e8f0" stopOpacity="0.12" />
          <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="60" cy="42" r="44" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-sh)`}>
        {/* Crystal football (tilted, faceted) */}
        <ellipse
          cx="60"
          cy="36"
          rx="32"
          ry="20"
          fill={`url(#${id}-crystal)`}
          stroke="#e2e8f0"
          strokeWidth="1.2"
          transform="rotate(-18 60 36)"
        />
        {/* Facet highlight */}
        <ellipse
          cx="52"
          cy="30"
          rx="12"
          ry="8"
          fill={`url(#${id}-facet)`}
          transform="rotate(-18 52 30)"
        />
        {/* Lace / seam */}
        <path
          d="M42 30 Q60 22 78 42"
          stroke="#0f172a"
          strokeWidth="1.15"
          fill="none"
          opacity="0.35"
          transform="rotate(-18 60 36)"
        />
        <path
          d="M50 26 L53 32 M54 24 L57 30 M58 23 L61 29 M62 24 L65 30 M66 26 L69 32"
          stroke="#0f172a"
          strokeWidth="0.95"
          opacity="0.4"
          transform="rotate(-18 60 36)"
        />
        {/* Crystal edge glints */}
        <path
          d="M38 40 L44 28"
          stroke="#fff"
          strokeWidth="1.2"
          opacity="0.55"
          strokeLinecap="round"
        />
        <path
          d="M78 28 L84 38"
          stroke="#fff"
          strokeWidth="0.9"
          opacity="0.35"
          strokeLinecap="round"
        />
        {/* Collar under ball */}
        <ellipse cx="60" cy="56" rx="10" ry="3.5" fill={`url(#${id}-stem)`} />
        <rect
          x="55"
          y="56"
          width="10"
          height="16"
          rx="1.5"
          fill={`url(#${id}-stem)`}
        />
      </g>
      {/* Tiered gold base */}
      <rect
        x="40"
        y="72"
        width="40"
        height="7"
        rx="1.5"
        fill={`url(#${id}-gold)`}
      />
      <rect
        x="34"
        y="79"
        width="52"
        height="8"
        rx="1.5"
        fill={`url(#${id}-gold)`}
      />
      <rect
        x="26"
        y="87"
        width="68"
        height="12"
        rx="2.5"
        fill={`url(#${id}-gold)`}
        stroke="#92400e"
        strokeWidth="0.6"
      />
      {/* Base bevel highlight */}
      <path
        d="M30 90 H90"
        stroke="#fef3c7"
        strokeWidth="0.6"
        opacity="0.35"
      />
      {threePeat && (
        <text
          x="60"
          y="118"
          textAnchor="middle"
          fill="#fbbf24"
          fontSize="8"
          fontWeight="800"
          fontFamily="system-ui"
        >
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
  // Lombardi silhouette: silver football on three-leg tripod + base
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
        <linearGradient
          id={`${id}-silver`}
          x1="28"
          y1="6"
          x2="98"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#f8fafc" />
          <stop offset="0.5" stopColor="#e2e8f0" />
          <stop offset="0.75" stopColor="#C5CCD3" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#94a3b8" />
          <stop offset="0.35" stopColor="#475569" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient
          id={`${id}-collar`}
          x1="48"
          y1="50"
          x2="72"
          y2="62"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f8fafc" />
          <stop offset="0.5" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="32%" r="50%">
          <stop stopColor="#e2e8f0" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#C5CCD3" stopOpacity="0.2" />
          <stop offset="1" stopColor="#0B1426" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-25%" y="-10%" width="150%" height="150%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="2.5"
            floodColor="#000"
            floodOpacity="0.55"
          />
        </filter>
      </defs>
      <circle cx="60" cy="44" r="44" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-sh)`}>
        {/* Tripod legs */}
        <path
          d="M57 60 L32 114"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M63 60 L88 114"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M60 60 L60 116"
          stroke={`url(#${id}-leg)`}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Base feet */}
        <ellipse cx="32" cy="115" rx="5" ry="2.2" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.5" />
        <ellipse cx="88" cy="115" rx="5" ry="2.2" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.5" />
        <ellipse cx="60" cy="117" rx="5.5" ry="2.4" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.5" />
        {/* Base triangle plate */}
        <path
          d="M30 110 L60 118 L90 110 L80 122 L40 122 Z"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="0.75"
        />
        {/* Collar stack under ball */}
        <ellipse cx="60" cy="58" rx="12" ry="4.8" fill={`url(#${id}-collar)`} />
        <ellipse cx="60" cy="55.5" rx="9" ry="3.2" fill="#e2e8f0" opacity="0.9" />
        {/* Silver football */}
        <ellipse
          cx="60"
          cy="34"
          rx="31"
          ry="19.5"
          fill={`url(#${id}-silver)`}
          stroke="#f1f5f9"
          strokeWidth="1.15"
          transform="rotate(-22 60 34)"
        />
        {/* Specular highlight */}
        <ellipse
          cx="48"
          cy="28"
          rx="10"
          ry="6"
          fill="#fff"
          fillOpacity="0.35"
          transform="rotate(-22 48 28)"
        />
        {/* Seam + laces */}
        <path
          d="M38 28 Q60 20 82 42"
          stroke="#0B1426"
          strokeWidth="1.35"
          fill="none"
          opacity="0.45"
          transform="rotate(-22 60 34)"
        />
        <path
          d="M48 25 L51 31 M52 23 L55 29 M56 22 L59 28 M60 22 L63 28 M64 24 L67 30"
          stroke="#0B1426"
          strokeWidth="1.1"
          opacity="0.55"
          transform="rotate(-22 60 34)"
        />
      </g>
      {threePeat && (
        <text
          x="60"
          y="128"
          textAnchor="middle"
          fill="#fbbf24"
          fontSize="8"
          fontWeight="800"
          fontFamily="system-ui"
        >
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
