"use client";

import { useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { normalizeSportId } from "@/lib/sports/registry";
import { SPORT_THEME_EVENT } from "@/lib/sports/sport-theme";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";

type Props = {
  size?: number;
  className?: string;
  /** Show “War Room” wordmark next to crest */
  withWordmark?: boolean;
  /**
   * force — always crest (login, join, marketing)
   * sport — WWC keeps trophy mark; everything else uses crest
   * default sport
   */
  variant?: "sport" | "force";
};

/** Platform crest path (logo #2 shield — multi-sport War Room Pick'Em) */
export const WAR_ROOM_CREST_SRC = "/brand/war-room-crest.png";

/**
 * War Room brand mark — crest #2 as the house identity.
 * WWC rooms can still show the event trophy when variant="sport".
 */
export default function BrandMark({
  size = 36,
  className = "",
  withWordmark = false,
  variant = "sport",
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

  if (variant === "sport" && sportId === "soccer_wwc") {
    return (
      <WwcTrophyLogo
        size={size}
        variant={withWordmark ? "banner" : "icon"}
        showWordmark={withWordmark}
        className={className}
      />
    );
  }

  const crest = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={WAR_ROOM_CREST_SRC}
      alt="War Room Pick'Em"
      width={size}
      height={size}
      className={`shrink-0 object-contain rounded-lg ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );

  if (!withWordmark) return crest;

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      {crest}
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="font-extrabold text-sm tracking-tight text-foreground truncate">
          War Room
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted truncate">
          Pick&apos;Em
        </span>
      </span>
    </span>
  );
}
