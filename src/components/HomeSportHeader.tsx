"use client";

import {
  WWC_BRAZIL_COLORS,
  type SportHomeChrome,
} from "@/lib/sports/home-chrome";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";

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
  const { emerald, gold, royal, white } = WWC_BRAZIL_COLORS;

  return (
    <section className="mb-4 sm:mb-6">
      {isWwc ? (
        <div className="flex items-start gap-3 sm:gap-4 mb-4">
          <div
            className="shrink-0 rounded-2xl p-1.5 sm:p-2 border"
            style={{
              borderColor: `${gold}88`,
              background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
              boxShadow: `0 0 28px ${emerald}44, 0 0 12px ${gold}33`,
            }}
          >
            <WwcTrophyLogo size={72} />
          </div>
          <div className="min-w-0 pt-0.5">
            <span
              className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.14em] px-2.5 py-1 rounded-full border max-w-full leading-snug"
              style={{
                borderColor: `${gold}aa`,
                background: `linear-gradient(135deg, ${emerald}44 0%, ${royal}cc 50%, ${emerald}33 100%)`,
                color: white,
              }}
            >
              {chrome.sportBadge}
            </span>
            <p
              className="mt-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: gold }}
            >
              Brasil 2027 · event pack
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

      <h1
        className={`text-2xl sm:text-5xl font-bold tracking-tight mb-1.5 sm:mb-3 text-white ${chrome.atmosphere.titleGlow}`}
      >
        {chrome.welcomeTitle}
      </h1>
      <p className="text-muted max-w-xl text-sm sm:text-lg leading-relaxed">
        {tagline || chrome.defaultTagline}
      </p>

      {isWwc && (
        <p className="mt-2 text-xs sm:text-sm max-w-xl leading-relaxed text-white/80">
          Short tournament. Loud Gazette. Same sarcastic room — pitch in emerald,
          gold, and royal blue. Lock the card, talk trash, chase the Cup.
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
                style={isWwc ? { color: gold } : undefined}
              >
                {isWwc ? (
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
