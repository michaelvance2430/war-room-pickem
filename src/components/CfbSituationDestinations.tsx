"use client";

import Link from "next/link";
import HomeTileUnseen from "@/components/HomeTileUnseen";

type Row = {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  art: string;
  tone: "gold" | "green";
  unseen?: "locker";
};

export default function CfbSituationDestinations({
  showGazette,
}: {
  showGazette: boolean;
}) {
  const rows: Row[] = [
    {
      href: "/standings",
      eyebrow: "Who’s winning",
      title: "Standings",
      blurb: "Season points · divisions · cut line · last in",
      art: "/skins/cfb-situation/standings.jpg",
      tone: "gold",
    },
    {
      href: "/board",
      eyebrow: "Card reveal",
      title: "See the matchups",
      blurb: "Peek the card · game notes · spreads",
      art: "/skins/cfb-situation/matchups.jpg",
      tone: "green",
    },
    ...(showGazette
      ? [
          {
            href: "/gazette",
            eyebrow: "The Dispatch",
            title: "The headlines",
            blurb: "Stories · rivalries · trash talk · history",
            art: "/skins/cfb-situation/gazette.jpg",
            tone: "gold" as const,
          },
        ]
      : []),
    {
      href: "/locker-room",
      eyebrow: "Locker room",
      title: "Sitrep & crew talk",
      blurb: "Trash talk · memes · calls · compliments",
      art: "/skins/cfb-situation/locker.jpg",
      tone: "green",
      unseen: "locker",
    },
  ];

  return (
    <section className="cfb-destinations" aria-label="The rest of the room">
      <p className="cfb-destinations-label">The rest of the room</p>
      <div className="cfb-destination-stack">
        {rows.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className="cfb-destination-row"
            data-tone={row.tone}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.art} alt="" className="cfb-destination-art" />
            <span className="cfb-destination-copy">
              <span className="cfb-destination-eyebrow">
                {row.eyebrow}
                {row.unseen ? <HomeTileUnseen kind={row.unseen} /> : null}
              </span>
              <strong>{row.title}</strong>
              <span className="cfb-destination-blurb">{row.blurb}</span>
            </span>
            <span className="cfb-destination-arrow" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
