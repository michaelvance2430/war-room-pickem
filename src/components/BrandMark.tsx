"use client";

import { useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { normalizeSportId } from "@/lib/sports/registry";
import { SPORT_THEME_EVENT } from "@/lib/sports/sport-theme";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";

type Props = {
  size?: number;
  className?: string;
  /** Nav home: show short wordmark next to trophy on WWC */
  withWordmark?: boolean;
};

/**
 * App mark: classic WR square (CFB) vs Brazil trophy (WWC).
 * Same placement — completely different aesthetic.
 */
export default function BrandMark({
  size = 36,
  className = "",
  withWordmark = false,
}: Props) {
  const [sportId, setSportId] = useState("cfb");

  useEffect(() => {
    function sync() {
      setSportId(normalizeSportId(getLeague()?.sportId));
    }
    sync();
    window.addEventListener(SPORT_THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("warroom-view-as-player", sync);
    return () => {
      window.removeEventListener(SPORT_THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("warroom-view-as-player", sync);
    };
  }, []);

  if (sportId === "soccer_wwc") {
    return (
      <WwcTrophyLogo
        size={size}
        variant={withWordmark ? "banner" : "icon"}
        showWordmark={withWordmark}
        className={className}
      />
    );
  }

  // Classic CFB War Room monogram
  return (
    <div
      className={`rounded-lg bg-primary text-black font-bold flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label="War Room"
    >
      WR
    </div>
  );
}
