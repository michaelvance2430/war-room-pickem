"use client";

/**
 * Christmas: twinkling lights + tree with presents + Santa’s leg
 * (as if he just stepped half off-screen). Decorative only.
 */

type Bulb = {
  left: string;
  top: string;
  color: string;
  delay: string;
  duration: string;
  size: number;
};

const GARLAND: Bulb[] = [
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
  ...[
    [8, 22],
    [18, 48],
    [28, 35],
    [48, 28],
    [68, 40],
    [78, 68],
    [88, 32],
    [55, 18],
    [25, 62],
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

      {/* Tree + presents — left side */}
      <div className="xmas-scene xmas-scene--left">
        <div className="xmas-tree">
          <span className="xmas-tree-emoji">🎄</span>
          <span className="xmas-tree-star">⭐</span>
          <span className="xmas-ornament xmas-ornament--1" />
          <span className="xmas-ornament xmas-ornament--2" />
          <span className="xmas-ornament xmas-ornament--3" />
        </div>
        <div className="xmas-presents">
          <span className="xmas-gift xmas-gift--a">🎁</span>
          <span className="xmas-gift xmas-gift--b">🎁</span>
          <span className="xmas-gift xmas-gift--c">🎁</span>
          <span className="xmas-gift xmas-gift--d">🎁</span>
        </div>
      </div>

      {/*
        Santa mid-exit: only boot + red pants leg hang into the viewport
        from the top-right, as if he stepped outside our view.
      */}
      <div className="santa-exit" title="Santa's out for a walk">
        <div className="santa-pants" />
        <div className="santa-boot">
          <div className="santa-boot-cuff" />
          <div className="santa-boot-body" />
          <div className="santa-boot-toe" />
        </div>
        <div className="santa-boot santa-boot--back">
          <div className="santa-boot-cuff" />
          <div className="santa-boot-body" />
          <div className="santa-boot-toe" />
        </div>
      </div>
    </div>
  );
}
