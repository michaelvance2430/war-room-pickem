"use client";

/**
 * Creator-only animated avatar rings — Living Flame / Molten Forge / Circuit.
 * Subtle motion; respects prefers-reduced-motion via CSS.
 */

import type { CreatorBorderEffect } from "@/lib/profile-borders";

type Props = {
  effect: CreatorBorderEffect;
  size: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  className?: string;
};

const pad: Record<Props["size"], string> = {
  sm: "p-[2px]",
  md: "p-[3px]",
  lg: "p-[4px]",
  xl: "p-[5px]",
};

export default function CreatorBorderFx({
  effect,
  size,
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`relative inline-flex rounded-full shrink-0 ${pad[size]} ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full overflow-visible"
        aria-hidden
      >
        {effect === "flame" && <FlameRing />}
        {effect === "forge" && <ForgeRing />}
        {effect === "circuit" && <CircuitRing />}
      </div>
      <div className="relative z-[1] rounded-full overflow-hidden">{children}</div>
    </div>
  );
}

function FlameRing() {
  return (
    <svg
      className="creator-fx-spin absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill="none"
    >
      <defs>
        <linearGradient id="cf-flame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#fb923c" />
          <stop offset="75%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <filter id="cf-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      {/* Outer soft glow ring */}
      <circle
        cx="50"
        cy="50"
        r="47"
        stroke="url(#cf-flame)"
        strokeWidth="5"
        opacity="0.35"
        filter="url(#cf-blur)"
        className="creator-fx-flicker"
      />
      {/* Flame scallops as stroked arcs around the circle */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a0 = (i / 12) * Math.PI * 2 - 0.2;
        const a1 = ((i + 0.55) / 12) * Math.PI * 2;
        const r = 46;
        const x0 = 50 + Math.cos(a0) * r;
        const y0 = 50 + Math.sin(a0) * r;
        const x1 = 50 + Math.cos(a1) * r;
        const y1 = 50 + Math.sin(a1) * r;
        const mid = (a0 + a1) / 2;
        const tip = 50 + Math.cos(mid) * (r + 5.5);
        const tipY = 50 + Math.sin(mid) * (r + 5.5);
        return (
          <path
            key={i}
            d={`M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${tip.toFixed(2)} ${tipY.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`}
            stroke="url(#cf-flame)"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            opacity={0.75 + (i % 3) * 0.08}
            className="creator-fx-flicker"
            style={{ animationDelay: `${(i % 6) * 0.15}s` }}
          />
        );
      })}
      <circle
        cx="50"
        cy="50"
        r="44.5"
        stroke="#fde68a"
        strokeWidth="1.2"
        opacity="0.85"
      />
    </svg>
  );
}

function ForgeRing() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill="none"
    >
      <defs>
        <linearGradient id="cf-forge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="35%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id="cf-forge-spin" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.1" />
          <stop offset="40%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="60%" stopColor="#fff7ed" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#92400e" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="46.5"
        stroke="url(#cf-forge)"
        strokeWidth="4.5"
        className="creator-fx-shimmer"
      />
      <circle
        cx="50"
        cy="50"
        r="46.5"
        stroke="url(#cf-forge-spin)"
        strokeWidth="3"
        strokeDasharray="40 80"
        className="creator-fx-spin-slow"
        opacity="0.9"
      />
      {/* Ember dots */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = 46.5;
        return (
          <circle
            key={i}
            cx={50 + Math.cos(a) * r}
            cy={50 + Math.sin(a) * r}
            r={1.1 + (i % 2) * 0.4}
            fill="#fef08a"
            className="creator-fx-flicker"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        );
      })}
      <circle cx="50" cy="50" r="43.5" stroke="#fde68a" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

function CircuitRing() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill="none"
    >
      <defs>
        <linearGradient id="cf-circuit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="url(#cf-circuit)"
        strokeWidth="2.5"
        opacity="0.9"
      />
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeDasharray="6 10"
        className="creator-fx-spin-slow"
        opacity="0.85"
      />
      <circle
        cx="50"
        cy="50"
        r="42.5"
        stroke="#fbbf24"
        strokeWidth="0.8"
        strokeDasharray="2 8"
        className="creator-fx-spin-rev"
        opacity="0.7"
      />
      {/* Node ticks */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r0 = 44;
        const r1 = 48;
        return (
          <line
            key={i}
            x1={50 + Math.cos(a) * r0}
            y1={50 + Math.sin(a) * r0}
            x2={50 + Math.cos(a) * r1}
            y2={50 + Math.sin(a) * r1}
            stroke={i % 4 === 0 ? "#fde68a" : "#34d399"}
            strokeWidth={i % 4 === 0 ? 1.6 : 1}
            opacity="0.85"
            className="creator-fx-flicker"
            style={{ animationDelay: `${(i % 8) * 0.12}s` }}
          />
        );
      })}
    </svg>
  );
}
