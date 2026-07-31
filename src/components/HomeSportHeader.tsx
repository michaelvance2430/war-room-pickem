"use client";

import type { SportHomeChrome } from "@/lib/sports/home-chrome";

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
 * WWC gets Cup energy; CFB stays classic War Room.
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

  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${
            isWwc
              ? "border-pink-400/50 bg-pink-500/15 text-pink-200"
              : "border-primary/40 bg-primary/10 text-primary"
          }`}
        >
          <span aria-hidden>{chrome.pack.emoji}</span>
          {chrome.sportBadge}
        </span>
        {isWwc && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-300/90">
            Event pack · matchday energy
          </span>
        )}
      </div>

      <h1
        className={`text-2xl sm:text-5xl font-bold tracking-tight mb-1.5 sm:mb-3 text-white ${chrome.atmosphere.titleGlow}`}
      >
        {chrome.welcomeTitle}
      </h1>
      <p className="text-muted max-w-xl text-sm sm:text-lg leading-relaxed">
        {tagline || chrome.defaultTagline}
      </p>

      {isWwc && (
        <p className="mt-2 text-xs sm:text-sm text-pink-200/80 max-w-xl leading-relaxed">
          Short tournament. Loud Gazette. Same sarcastic room — different
          pitch. Lock the card, talk trash, chase the Cup.
        </p>
      )}

      {leagueName && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted/90">
          <span className="text-foreground/90 font-medium">{leagueName}</span>
          {isCommish && leagueCode && (
            <>
              <span className="text-border">|</span>
              <span
                className={`font-mono tracking-[0.2em] text-base font-bold ${
                  isWwc ? "text-pink-300" : "text-primary"
                }`}
              >
                {leagueCode}
              </span>
              <button
                type="button"
                onClick={onCopyCode}
                className={`text-xs px-3 py-2 min-h-[40px] rounded-md border font-semibold touch-manipulation ${
                  isWwc
                    ? "border-pink-400/40 text-pink-200 hover:bg-pink-500/10"
                    : "border-primary/40 text-primary hover:bg-primary/10"
                }`}
              >
                {codeCopied ? "Copied!" : "Copy invite code"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
