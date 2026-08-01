"use client";

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

/**
 * Home masthead — one room name, once.
 * Sport is a quiet chip. No “you're in this room” essay, no second brand line.
 */
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
      {/* Sport chip only — not a second headline */}
      {isWwc ? (
        <div className="flex items-center gap-2 mb-2">
          <div
            className="shrink-0 rounded-lg p-0.5 border"
            style={{
              borderColor: `${gold}66`,
              background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
            }}
          >
            <WwcTrophyLogo size={28} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            War Room · WWC · Brazil 2027
          </p>
        </div>
      ) : isNfl ? (
        <div className="flex items-center gap-2 mb-2">
          <BrandMark size={32} variant="force" className="rounded-lg shrink-0" />
          <div
            className="shrink-0 rounded-lg p-0.5 border"
            style={{
              borderColor: `${nfl.silver}55`,
              background: `linear-gradient(160deg, ${nfl.navy} 0%, ${nfl.crimson}55 100%)`,
            }}
          >
            <NflBrandMark size={22} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            War Room · NFL
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <BrandMark size={32} variant="force" className="rounded-lg shrink-0" />
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-primary/35 bg-primary/10 text-primary">
            <span aria-hidden>{chrome.pack.emoji}</span>
            War Room · {chrome.pack.shortLabel}
          </span>
        </div>
      )}

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
          {isWwc ? (
            <button
              type="button"
              onClick={onCopyCode}
              className="text-xs px-3 py-2 min-h-[40px] rounded-md border font-semibold touch-manipulation"
              style={{
                borderColor: `${emerald}aa`,
                color: white,
                backgroundColor: `${emerald}28`,
              }}
            >
              {codeCopied ? "Copied!" : "Copy code"}
            </button>
          ) : isNfl ? (
            <button
              type="button"
              onClick={onCopyCode}
              className="text-xs px-3 py-2 min-h-[40px] rounded-md border font-semibold touch-manipulation"
              style={{
                borderColor: `${nfl.crimson}aa`,
                color: nfl.white,
                backgroundColor: `${nfl.crimson}33`,
              }}
            >
              {codeCopied ? "Copied!" : "Copy code"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCopyCode}
              className="text-xs px-3 py-2 min-h-[40px] rounded-md border border-primary/40 text-primary hover:bg-primary/10 font-semibold touch-manipulation"
            >
              {codeCopied ? "Copied!" : "Copy code"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
