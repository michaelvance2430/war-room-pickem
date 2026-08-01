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
 * Home masthead — sport badge + welcome + invite code.
 * WWC Brazil 2027 uses flag palette (emerald / gold / royal / white).
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

  return (
    <section className="mb-4 sm:mb-6">
      {isWwc ? (
        <div className="flex items-start gap-3 sm:gap-5 mb-5">
          <div
            className="shrink-0 rounded-2xl p-1.5 sm:p-2 border"
            style={{
              borderColor: `${gold}88`,
              background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
              boxShadow: `0 0 28px ${emerald}44, 0 0 12px ${gold}33`,
            }}
          >
            <WwcTrophyLogo size={80} />
          </div>
          <div className="min-w-0 pt-1">
            <p className="text-xl sm:text-3xl font-black text-white tracking-tight leading-none">
              War Room
            </p>
            <p className="mt-1.5 text-base sm:text-xl font-bold text-white/95 leading-tight">
              Women&apos;s World Cup
            </p>
            <p
              className="mt-0.5 text-base sm:text-xl font-extrabold leading-tight"
              style={{ color: gold }}
            >
              Brazil 2027
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
              Special event presentation
            </p>
          </div>
        </div>
      ) : isNfl ? (
        <div className="flex items-start gap-3 sm:gap-5 mb-5">
          <div
            className="shrink-0 rounded-2xl p-1.5 sm:p-2 border"
            style={{
              borderColor: `${nfl.silver}66`,
              background: `linear-gradient(160deg, ${nfl.navy} 0%, ${nfl.crimson}55 100%)`,
              boxShadow: `0 0 28px ${nfl.crimson}44`,
            }}
          >
            <NflBrandMark size={80} />
          </div>
          <div className="min-w-0 pt-1">
            <p className="text-xl sm:text-3xl font-black text-white tracking-tight leading-none">
              War Room
            </p>
            <p className="mt-1.5 text-base sm:text-xl font-bold text-white/95 leading-tight">
              Pro Football
            </p>
            <p
              className="mt-0.5 text-base sm:text-xl font-extrabold leading-tight"
              style={{ color: nfl.silver }}
            >
              Sunday
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
              Primetime presentation
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary max-w-full">
            <span aria-hidden>{chrome.pack.emoji}</span>
            {chrome.sportBadge}
          </span>
        </div>
      )}

      {!isWwc && !isNfl && (
        <h1
          className={`text-2xl sm:text-5xl font-bold tracking-tight mb-1.5 sm:mb-3 text-white ${chrome.atmosphere.titleGlow}`}
        >
          {chrome.welcomeTitle}
        </h1>
      )}
      <p className="text-muted max-w-xl text-sm sm:text-lg leading-relaxed">
        {tagline || chrome.defaultTagline}
      </p>

      {isWwc && (
        <p className="mt-2 text-xs sm:text-sm max-w-xl leading-relaxed text-white/80">
          Same War Room ops. World Cup paper. Lock the card, talk trash, chase
          the Cup — emerald, gold, and royal blue.
        </p>
      )}
      {isNfl && (
        <p className="mt-2 text-xs sm:text-sm max-w-xl leading-relaxed text-white/80">
          Primetime desk. Late windows. No campus filler. Holidays still live
          in settings — navy, crimson, and Sunday are the default pulse.
        </p>
      )}

      {leagueName && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted/90">
          <span className="text-foreground/90 font-medium">{leagueName}</span>
          {isCommish && leagueCode && (
            <>
              <span className="text-border">|</span>
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
                  {codeCopied ? "Copied!" : "Copy invite code"}
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
                  {codeCopied ? "Copied!" : "Copy invite code"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCopyCode}
                  className="text-xs px-3 py-2 min-h-[40px] rounded-md border border-primary/40 text-primary hover:bg-primary/10 font-semibold touch-manipulation"
                >
                  {codeCopied ? "Copied!" : "Copy invite code"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
