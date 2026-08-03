"use client";

/**
 * Home masthead — one room name, once.
 * Shared shell for every sport: crest + sport chip + title + tagline.
 * Sport color/energy may change; structure must not.
 */

import {
  WWC_BRAZIL_COLORS,
  type SportHomeChrome,
} from "@/lib/sports/home-chrome";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";
import { NFL_SUNDAY_COLORS } from "@/lib/sports/home-chrome";

type Props = {
  chrome: SportHomeChrome;
  tagline: string;
  leagueName: string | null;
  leagueCode: string | null;
  isCommish: boolean;
  codeCopied: boolean;
  onCopyCode: () => void;
};

export default function HomeSportHeader({
  chrome,
  tagline,
  leagueName,
  leagueCode,
  isCommish,
  codeCopied,
  onCopyCode,
}: Props) {
  const isWwc = chrome.sportId === "soccer_wwc";
  const isNfl = chrome.sportId === "nfl";
  const { emerald, gold, royal, white } = WWC_BRAZIL_COLORS;
  const nfl = NFL_SUNDAY_COLORS;
  const room = (leagueName || "").trim() || "War Room";

  return (
    <section className="mb-3 sm:mb-4">
      {/* Shared hierarchy: crest · sport chip — same frame every sport */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <BrandMark size={40} variant="force" className="rounded-lg shrink-0" />
        {isWwc ? (
          <>
            <div
              className="shrink-0 rounded-lg p-0.5 border"
              style={{
                borderColor: `${gold}66`,
                background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
              }}
            >
              <WwcTrophyLogo size={22} />
            </div>
            <span className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-yellow-400/40 text-yellow-100/90 bg-emerald-900/40">
              War Room · WWC
            </span>
          </>
        ) : isNfl ? (
          <>
            <div
              className="shrink-0 rounded-lg p-0.5 border"
              style={{
                borderColor: `${nfl.silver}55`,
                background: `linear-gradient(160deg, ${nfl.navy} 0%, ${nfl.crimson}55 100%)`,
              }}
            >
              <NflBrandMark size={20} />
            </div>
            <span
              className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `${nfl.silver}55`,
                color: nfl.silver,
                background: "rgba(15,23,42,0.65)",
              }}
            >
              War Room · NFL
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-primary/35 bg-primary/10 text-primary">
            <span aria-hidden>{chrome.pack.emoji}</span>
            War Room · {chrome.pack.shortLabel}
          </span>
        )}
      </div>

      <h1
        className={`text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] text-white break-words ${chrome.atmosphere.titleGlow}`}
      >
        {room}
      </h1>

      <p className="mt-2 text-muted max-w-xl text-sm sm:text-base leading-relaxed">
        {tagline || chrome.defaultTagline}
      </p>

      {isCommish && leagueCode && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted text-xs uppercase tracking-wide font-bold">
            Invite
          </span>
          <span
            className="font-mono tracking-[0.2em] text-base font-bold"
            style={
              isWwc
                ? { color: gold }
                : isNfl
                  ? { color: nfl.silver }
                  : undefined
            }
          >
            {isWwc || isNfl ? (
              leagueCode
            ) : (
              <span className="text-primary">{leagueCode}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onCopyCode}
            className="text-xs px-3 py-2 min-h-[40px] rounded-md border border-border font-semibold touch-manipulation hover:border-primary/40 text-foreground"
          >
            {codeCopied ? "Copied" : "Copy code"}
          </button>
        </div>
      )}
    </section>
  );
}
