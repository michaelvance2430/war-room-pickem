"use client";

import type { CSSProperties } from "react";

/**
 * Ball drop + fireworks (New Year season theme).
 */

const BURSTS = [
  { left: "14%", top: "20%", delay: "0s", hue: "45" },
  { left: "80%", top: "16%", delay: "1.8s", hue: "320" },
  { left: "88%", top: "40%", delay: "3.4s", hue: "200" },
  { left: "18%", top: "46%", delay: "2.6s", hue: "140" },
  { left: "52%", top: "12%", delay: "4.2s", hue: "30" },
  { left: "70%", top: "50%", delay: "0.9s", hue: "280" },
];

export default function NewYearDecor() {
  return (
    <div className="ny-decor" aria-hidden>
      {/* Times Square–style pole + dropping ball */}
      <div className="ny-tower">
        <div className="ny-tower-mast">
          <span className="ny-tower-light" />
          <span className="ny-tower-light ny-tower-light--2" />
          <span className="ny-tower-light ny-tower-light--3" />
        </div>
        <div className="ny-ball-track">
          <div className="ny-ball">
            <span className="ny-ball-shine" />
            <span className="ny-ball-year">’26</span>
          </div>
        </div>
        <div className="ny-tower-base">
          <span>BALL</span>
          <span className="ny-tower-base-sub">DROP</span>
        </div>
      </div>

      {/* Champagne side */}
      <div className="ny-side ny-side--right">
        <span className="ny-emoji ny-emoji--xl">🥂</span>
        <span className="ny-emoji ny-emoji--lg">🍾</span>
        <span className="ny-emoji ny-emoji--md">🎉</span>
        <span className="ny-emoji ny-emoji--sm">✨</span>
      </div>

      {/* Firework bursts */}
      {BURSTS.map((b, i) => (
        <div
          key={i}
          className="ny-burst"
          style={
            {
              left: b.left,
              top: b.top,
              animationDelay: b.delay,
              ["--ny-hue"]: b.hue,
            } as CSSProperties
          }
        >
          {Array.from({ length: 10 }, (_, j) => (
            <span
              key={j}
              className="ny-spark"
              style={
                {
                  ["--a"]: `${j * 36}deg`,
                  animationDelay: b.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}

      <div className="ny-banner">Happy New Year</div>
    </div>
  );
}
