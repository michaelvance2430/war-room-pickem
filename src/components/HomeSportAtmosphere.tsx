"use client";

import type { SportAtmosphere } from "@/lib/sports/home-chrome";

/** Full-page background wash for sport packs (CFB green room vs WWC pink/sky). */
export default function HomeSportAtmosphere({
  atmosphere,
}: {
  atmosphere: SportAtmosphere;
}) {
  return (
    <>
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10"
        style={{ background: atmosphere.baseGradient }}
      />
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(${atmosphere.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${atmosphere.gridLine} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10"
        style={{ background: atmosphere.vignette }}
      />
      <div
        className="home-war-base pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: atmosphere.scanline }}
      />
    </>
  );
}
