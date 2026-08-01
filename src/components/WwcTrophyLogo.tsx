"use client";

import { WWC_BRAZIL_COLORS } from "@/lib/sports/home-chrome";

type Props = {
  /** Pixel size of the square mark */
  size?: number;
  className?: string;
  /** Show wordmark under/beside for larger placements */
  showWordmark?: boolean;
  /** compact = icon only; banner = icon + short title */
  variant?: "icon" | "banner";
  title?: string;
};

/**
 * FIFA Women's World Cup Brazil 2027™ mark — stylized trophy in flag colors.
 * SVG so it stays sharp on phones and matches emerald / gold / royal / white.
 * Not an official FIFA mark — War Room event-pack branding only.
 */
export default function WwcTrophyLogo({
  size = 40,
  className = "",
  showWordmark = false,
  variant = "icon",
  title = "FIFA Women's World Cup Brazil 2027™",
}: Props) {
  const { emerald, gold, royal, white } = WWC_BRAZIL_COLORS;
  const id = `wwc-t-${size}`;

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={variant === "icon" ? className : "shrink-0"}
      aria-hidden={variant === "banner" ? true : undefined}
      role={variant === "icon" ? "img" : undefined}
      aria-label={variant === "icon" ? title : undefined}
    >
      <defs>
        <linearGradient id={`${id}-cup`} x1="12" y1="8" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor={gold} />
          <stop offset="0.45" stopColor={emerald} />
          <stop offset="1" stopColor={royal} />
        </linearGradient>
        <linearGradient id={`${id}-stem`} x1="28" y1="36" x2="36" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor={gold} />
          <stop offset="1" stopColor={emerald} />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="16" y1="52" x2="48" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor={royal} />
          <stop offset="0.5" stopColor={emerald} />
          <stop offset="1" stopColor={gold} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="50%">
          <stop stopColor={gold} stopOpacity="0.35" />
          <stop offset="1" stopColor={royal} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft pitch glow */}
      <circle cx="32" cy="30" r="28" fill={`url(#${id}-glow)`} />

      {/* Outer ring — royal + gold rim */}
      <circle
        cx="32"
        cy="30"
        r="26"
        stroke={royal}
        strokeWidth="2.5"
        fill="rgba(4,10,12,0.55)"
      />
      <circle
        cx="32"
        cy="30"
        r="26"
        stroke={gold}
        strokeWidth="1"
        strokeOpacity="0.7"
        fill="none"
      />

      {/* Trophy cup body */}
      <path
        d="M20 16h24c0 4-1 8-3.5 11.5C37.5 32 35 36 32 36s-5.5-4-8.5-8.5C21 24 20 20 20 16z"
        fill={`url(#${id}-cup)`}
      />
      {/* Cup highlight */}
      <path
        d="M24 18c.5 5 2.5 9 5 12.2 1.2 1.5 2.2 2.5 3 3.2"
        stroke={white}
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Handles */}
      <path
        d="M20 18c-5 1-7 5-6 9 1 3 4 5 7 4"
        stroke={gold}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M44 18c5 1 7 5 6 9-1 3-4 5-7 4"
        stroke={emerald}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Neck / stem */}
      <rect x="29" y="36" width="6" height="10" rx="1.5" fill={`url(#${id}-stem)`} />

      {/* Base tiers */}
      <path
        d="M24 48h16l-1.5 4H25.5L24 48z"
        fill={royal}
      />
      <path
        d="M20 52h24l-2 6H22l-2-6z"
        fill={`url(#${id}-base)`}
      />
      <rect x="18" y="58" width="28" height="3" rx="1" fill={gold} />

      {/* Star on cup — white/gold Brasil nod */}
      <path
        d="M32 20.5l1.1 2.3 2.5.3-1.9 1.7.5 2.4L32 26l-2.2 1.2.5-2.4-1.9-1.7 2.5-.3L32 20.5z"
        fill={white}
        stroke={gold}
        strokeWidth="0.4"
      />
    </svg>
  );

  if (variant === "icon" && !showWordmark) {
    return icon;
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {icon}
      {(showWordmark || variant === "banner") && (
        <div className="min-w-0 leading-tight">
          <p
            className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.12em] truncate"
            style={{ color: gold }}
          >
            FIFA WWC
          </p>
          <p
            className="text-[10px] sm:text-xs font-bold truncate"
            style={{ color: white }}
          >
            Brazil 2027™
          </p>
        </div>
      )}
    </div>
  );
}
