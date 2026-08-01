"use client";

import {
  WWC_BRAZIL_COLORS,
  type SportHomeChrome,
} from "@/lib/sports/home-chrome";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";
import NflBrandMark from "@/components/NflBrandMark";
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
 * Home masthead — LEAGUE NAME first (people bounce multi-room).
 * War Room + sport are brand context, not the headline.
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
  const showBrandAsSecondary = room.toLowerCase() !== "war room";

  return (
    <section className="mb-4 sm:mb-6">
      {/* Sport mark + brand line (quiet) */}
      {isWwc ? (
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="shrink-0 rounded-xl p-1 border"
            style={{
              borderColor: `${gold}66`,
              background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
            }}
          >
            <WwcTrophyLogo size={40} />
          </div>
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-white/60">
            War Room · Women&apos;s World Cup · Brazil 2027
          </p>
        </div>
      ) : isNfl ? (
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="shrink-0 rounded-xl p-1 border"
            style={{
              borderColor: `${nfl.silver}55`,
              background: `linear-gradient(160deg, ${nfl.navy} 0%, ${nfl.crimson}55 100%)`,
            }}
          >
            <NflBrandMark size={40} />
          </div>
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-white/60">
            War Room · Pro Football · Sunday
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary">
            <span aria-hidden>{chrome.pack.emoji}</span>
            War Room · {chrome.sportBadge}
          </span>
        </div>
      )}

      {/* THE thing people scan for when they have 3+ rooms */}
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-1">
        You&apos;re in this room
      </p>
      <h1
        className={`text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] text-white break-words ${chrome.atmosphere.titleGlow}`}
      >
        {room}
      </h1>
      {showBrandAsSecondary && (
        <p className="mt-1.5 text-sm sm:text-base text-white/55 font-medium">
          {chrome.welcomeTitle.replace(/^Welcome to the\s+/i, "") || "War Room"}
          <span className="text-muted font-normal">
            {" "}
            · {chrome.pack.emoji} {chrome.pack.shortLabel}
          </span>
        </p>
      )}

      <p className="mt-2.5 text-muted max-w-xl text-sm sm:text-base leading-relaxed">
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
