"use client";

import { NFL_SUNDAY_COLORS } from "@/lib/sports/home-chrome";

type Props = {
  size?: number;
  className?: string;
};

/**
 * Generic pro-football mark — stylized ball, not any league shield or logo.
 * Navy / crimson / silver only.
 */
export default function NflBrandMark({ size = 36, className = "" }: Props) {
  const { navy, crimson, silver, white } = NFL_SUNDAY_COLORS;
  const id = `nfl-ball-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Pro football War Room"
    >
      <defs>
        <linearGradient id={`${id}-leather`} x1="8" y1="12" x2="56" y2="52">
          <stop stopColor={crimson} />
          <stop offset="0.55" stopColor="#8B0E18" />
          <stop offset="1" stopColor={navy} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="12" fill={navy} />
      <ellipse
        cx="32"
        cy="32"
        rx="22"
        ry="14"
        transform="rotate(-28 32 32)"
        fill={`url(#${id}-leather)`}
        stroke={silver}
        strokeWidth="1.5"
      />
      <path
        d="M22 30c4-2 8-3 12-3s8 1 12 3"
        stroke={white}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M28 27v6M32 26v8M36 27v6"
        stroke={white}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
