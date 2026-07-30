"use client";

/**
 * Twinkling multi-color Christmas light overlay (Christmas season theme only).
 * Pure CSS animation — no images, pointer-events none.
 */

type Bulb = {
  left: string;
  top: string;
  color: string;
  delay: string;
  duration: string;
  size: number;
};

/** Deterministic bulb layout so SSR/client match and it feels like a string of lights */
const GARLAND: Bulb[] = [
  // Top string across the header area
  ...Array.from({ length: 18 }, (_, i) => {
    const colors = ["#ef4444", "#22c55e", "#eab308", "#38bdf8", "#f472b6", "#f97316"];
    return {
      left: `${3 + i * 5.5}%`,
      top: `${1.2 + (i % 3) * 0.55}%`,
      color: colors[i % colors.length],
      delay: `${(i * 0.17) % 2.4}s`,
      duration: `${1.4 + (i % 5) * 0.22}s`,
      size: 5 + (i % 3),
    };
  }),
  // Soft scatter deeper in the page (subtle, not chaotic)
  ...[
    [8, 22],
    [18, 48],
    [28, 35],
    [38, 72],
    [48, 28],
    [58, 55],
    [68, 40],
    [78, 68],
    [88, 32],
    [12, 80],
    [42, 88],
    [72, 82],
    [92, 58],
    [25, 62],
    [55, 18],
    [85, 88],
  ].map(([left, top], i) => {
    const colors = ["#ef4444", "#22c55e", "#eab308", "#38bdf8", "#f472b6"];
    return {
      left: `${left}%`,
      top: `${top}%`,
      color: colors[i % colors.length],
      delay: `${(i * 0.31) % 3}s`,
      duration: `${1.8 + (i % 4) * 0.35}s`,
      size: 4 + (i % 2),
    };
  }),
];

export default function ChristmasLights() {
  return (
    <div className="christmas-lights" aria-hidden>
      {/* Faint wire for the top garland */}
      <svg
        className="christmas-garland-wire"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <path
          d="M0 3 Q 12.5 6 25 3 T 50 3 T 75 3 T 100 3"
          fill="none"
          stroke="rgba(180,160,100,0.35)"
          strokeWidth="0.35"
        />
      </svg>
      {GARLAND.map((b, i) => (
        <span
          key={i}
          className="christmas-bulb"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            backgroundColor: b.color,
            color: b.color,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}
