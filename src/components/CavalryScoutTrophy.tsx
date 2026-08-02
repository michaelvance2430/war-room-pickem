"use client";

/**
 * World Greatest Cavalry Scout hardware:
 * eggplant emoji perched on a wooden pedestal. Do not overthink it.
 */

type Props = {
  size?: number;
  className?: string;
  /** Dim locked state */
  muted?: boolean;
};

export default function CavalryScoutTrophy({
  size = 56,
  className = "",
  muted = false,
}: Props) {
  const h = size * 1.2;
  return (
    <div
      className={`relative inline-flex items-end justify-center ${muted ? "opacity-45 grayscale" : ""} ${className}`}
      style={{ width: size, height: h }}
      role="img"
      aria-label="Eggplant trophy on a wooden base"
      title="World Greatest Cavalry Scout"
    >
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-2 rounded-full blur-md"
        style={{
          background: muted
            ? "transparent"
            : "radial-gradient(ellipse, rgba(234,179,8,0.45), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center justify-end h-full pb-0.5">
        <span
          className="leading-none select-none drop-shadow-md"
          style={{ fontSize: size * 0.52 }}
          aria-hidden
        >
          🍆
        </span>
        <svg
          width={size * 0.72}
          height={size * 0.38}
          viewBox="0 0 72 38"
          className="-mt-1"
          aria-hidden
        >
          <rect
            x="8"
            y="2"
            width="56"
            height="8"
            rx="1.5"
            fill="#c48a4a"
            stroke="#6b3f1a"
            strokeWidth="0.8"
          />
          <rect
            x="4"
            y="10"
            width="64"
            height="9"
            rx="1.5"
            fill="#a66b2e"
            stroke="#5c3415"
            strokeWidth="0.8"
          />
          <rect
            x="0"
            y="19"
            width="72"
            height="12"
            rx="2"
            fill="#8b5a2b"
            stroke="#4a2a0f"
            strokeWidth="1"
          />
          <path
            d="M12 6 H60"
            stroke="#8b5a2b"
            strokeWidth="0.6"
            opacity="0.45"
          />
          <path
            d="M10 14 H62"
            stroke="#6b3f1a"
            strokeWidth="0.5"
            opacity="0.4"
          />
          <path
            d="M8 24 H64"
            stroke="#5c3415"
            strokeWidth="0.5"
            opacity="0.35"
          />
          <path
            d="M14 28 H58"
            stroke="#d4a574"
            strokeWidth="0.4"
            opacity="0.25"
          />
        </svg>
      </div>
    </div>
  );
}
