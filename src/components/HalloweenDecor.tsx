"use client";

/**
 * Pumpkins + floating ghost on the page edges (Halloween season theme).
 * Decorative only — never steals clicks.
 */

type Prop = {
  emoji: string;
  className: string;
  style?: React.CSSProperties;
  title?: string;
};

const LEFT: Prop[] = [
  {
    emoji: "🎃",
    className: "halloween-prop halloween-pumpkin halloween-prop--lg",
    style: { animationDelay: "0s" },
  },
  {
    emoji: "🎃",
    className: "halloween-prop halloween-pumpkin halloween-prop--md",
    style: { animationDelay: "0.6s", marginLeft: "0.75rem" },
  },
  {
    emoji: "🎃",
    className: "halloween-prop halloween-pumpkin halloween-prop--sm",
    style: { animationDelay: "1.1s", marginLeft: "0.25rem" },
  },
];

const RIGHT: Prop[] = [
  {
    emoji: "👻",
    className: "halloween-prop halloween-ghost halloween-prop--xl",
    style: { animationDelay: "0.2s" },
    title: "Boo",
  },
  {
    emoji: "🎃",
    className: "halloween-prop halloween-pumpkin halloween-prop--md",
    style: { animationDelay: "0.9s", marginRight: "0.5rem" },
  },
  {
    emoji: "🎃",
    className: "halloween-prop halloween-pumpkin halloween-prop--lg",
    style: { animationDelay: "0.4s" },
  },
  {
    emoji: "🦇",
    className: "halloween-prop halloween-bat halloween-prop--sm",
    style: { animationDelay: "0.3s", alignSelf: "flex-end" },
  },
];

export default function HalloweenDecor() {
  return (
    <div className="halloween-decor" aria-hidden>
      <div className="halloween-side halloween-side--left">
        {LEFT.map((p, i) => (
          <span key={`L${i}`} className={p.className} style={p.style}>
            {p.emoji}
          </span>
        ))}
      </div>
      <div className="halloween-side halloween-side--right">
        {RIGHT.map((p, i) => (
          <span
            key={`R${i}`}
            className={p.className}
            style={p.style}
            title={p.title}
          >
            {p.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
