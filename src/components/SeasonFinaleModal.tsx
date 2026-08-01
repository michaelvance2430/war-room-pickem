"use client";

/**
 * Huge end-of-season announcements when winners are engraved.
 * Next login: multi-step sarcastic ceremony (champ / toilet / nerd).
 * Once per player per newly-awarded hardware.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueTrophies, type LeagueTrophy } from "@/lib/trophies";
import { loadLeagueRoster, type LeagueRosterMember } from "@/lib/cloud";
import {
  buildFinaleSlides,
  getUnseenFinaleTrophies,
  markFinaleSeen,
  type FinaleSlide,
} from "@/lib/season-finale";
import TrophyShareButton from "@/components/TrophyShareButton";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import type { ProfileTrophyKind } from "@/lib/profile-hardware";
import { isGuestMode } from "@/lib/guest-mode";
import {
  hasOpeningWeekStarted,
  isOpeningWeekLive,
} from "@/lib/ring-ceremony";
import { resolveLiveTrophyHolder } from "@/lib/trophy-share";

export default function SeasonFinaleModal() {
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<FinaleSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [yearItems, setYearItems] = useState<LeagueTrophy[]>([]);
  const [leagueName, setLeagueName] = useState("War Room");
  const [year, setYear] = useState(0);
  const [roster, setRoster] = useState<LeagueRosterMember[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (isGuestMode()) return;
        // Don't steal Opening Day ring ceremony
        if (isOpeningWeekLive()) return;
        // Don't stack multi-slide finale on first-login walkthrough
        try {
          const { isPlayerTutorialActive, needsPlayerTutorial } =
            await import("@/lib/player-tutorial");
          if (isPlayerTutorialActive() || needsPlayerTutorial()) return;
        } catch {
          /* ok */
        }

        const league = getLeague();
        const session = getSession();
        if (!session?.playerId || !league?.id) return;

        // Hold hardware / championship ceremony until Week 0 (CFB) / Week 1 (NFL)
        // starts — museum engravings shouldn't dump a multi-slide popup in June.
        if (!hasOpeningWeekStarted(league.sportId)) return;

        const [trophies, rosterRows] = await Promise.all([
          loadLeagueTrophies(),
          loadLeagueRoster().catch(() => [] as LeagueRosterMember[]),
        ]);
        if (cancelled || !trophies.length) return;

        const pack = getUnseenFinaleTrophies(
          trophies,
          league.id,
          session.playerId
        );
        if (!pack || !pack.hasNew) return;

        const built = buildFinaleSlides({
          year: pack.year,
          items: pack.items,
          leagueName: league.name || "War Room",
          sessionPlayerId: session.playerId,
          sessionName: session.playerName,
        });
        if (!built.length || cancelled) return;

        // Beat other soft modals; still after first paint
        await new Promise((r) => setTimeout(r, 900));
        if (cancelled) return;

        setRoster(rosterRows);
        setYearItems(pack.items);
        setLeagueName(league.name || "War Room");
        setYear(pack.year);
        setSlides(built);
        setIndex(0);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistSeen() {
    try {
      const league = getLeague();
      const session = getSession();
      if (league?.id && session?.playerId && yearItems.length) {
        markFinaleSeen(league.id, session.playerId, yearItems);
      }
    } catch {
      /* ignore */
    }
  }

  function dismissAll() {
    persistSeen();
    setOpen(false);
  }

  function next() {
    if (index >= slides.length - 1) {
      dismissAll();
      return;
    }
    setIndex((i) => i + 1);
  }

  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  const slide = slides[index] as FinaleSlide | undefined;

  const shareKind: ProfileTrophyKind | null =
    slide?.kind === "championship" ||
    slide?.kind === "toilet_bowl" ||
    slide?.kind === "crystal_ball"
      ? slide.kind
      : null;

  const liveWinner = useMemo(() => {
    if (!slide?.winnerName && !slide?.winnerUserId) return null;
    return resolveLiveTrophyHolder(
      roster,
      slide?.winnerUserId,
      slide?.winnerName
    );
  }, [roster, slide]);

  if (!open || !slides.length || !slide) return null;

  const isLast = index === slides.length - 1;
  const isFirst = index === 0;
  const progress = `${index + 1} / ${slides.length}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-finale-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        aria-label="Close announcements"
        onClick={dismissAll}
      />

      <div
        className={`relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 ${slide.border} bg-card shadow-[0_0_60px_rgba(0,0,0,0.55)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti-ish top bar */}
        <div
          className="h-2 w-full"
          style={{
            background:
              "linear-gradient(90deg, #fbbf24, #22c55e, #38bdf8, #a855f7, #fbbf24)",
            backgroundSize: "200% 100%",
          }}
        />

        <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Season finale · live from the Trophy Room
            </p>
            <p className="text-[11px] text-muted mt-0.5">{progress}</p>
          </div>
          <button
            type="button"
            onClick={dismissAll}
            className="text-xs text-muted hover:text-foreground shrink-0 px-2 py-1"
          >
            Skip all
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="text-center pt-2">
            {slide.kind === "championship" ||
            slide.kind === "toilet_bowl" ||
            slide.kind === "crystal_ball" ? (
              <div className="flex justify-center mb-2">
                <HardwareTrophyIcon
                  kind={slide.kind}
                  sportId={getLeague()?.sportId}
                  size={slide.kind === "championship" ? 140 : 128}
                  animate
                />
              </div>
            ) : (
              <div
                className="text-6xl sm:text-7xl mb-3 animate-bounce"
                style={{ animationDuration: "1.6s" }}
                aria-hidden
              >
                {slide.emoji}
              </div>
            )}
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.16em] ${slide.accent}`}
            >
              {slide.kicker}
            </p>
            <h2
              id="season-finale-title"
              className="text-2xl sm:text-3xl font-black tracking-tight mt-2 leading-tight"
            >
              {slide.title}
            </h2>
            {slide.isYou && (
              <p className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                That&apos;s you
              </p>
            )}
          </div>

          {(liveWinner?.name || slide.winnerName) && (
            <div
              className={`rounded-xl border ${slide.border} bg-black/30 px-4 py-4 text-center`}
            >
              {(liveWinner?.userId || slide.winnerUserId) ? (
                <Link
                  href={`/profile/${liveWinner?.userId || slide.winnerUserId}`}
                  onClick={dismissAll}
                  className={`text-2xl font-black ${slide.accent} hover:underline`}
                >
                  {liveWinner?.name || slide.winnerName}
                </Link>
              ) : (
                <p className={`text-2xl font-black ${slide.accent}`}>
                  {liveWinner?.name || slide.winnerName}
                </p>
              )}
              <p className="text-[11px] text-muted mt-1">
                {year} · {leagueName}
              </p>
            </div>
          )}

          <p className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed text-center whitespace-pre-line">
            {slide.body}
          </p>

          {shareKind && (liveWinner?.name || slide.winnerName) && (
            <div className="rounded-xl border border-border bg-black/25 px-3 py-3 space-y-2">
              <p className="text-[11px] text-center text-muted leading-snug">
                {slide.isYou
                  ? "Flex it. Group chat. Stories. Make it permanent."
                  : "Send it to the room. Tag the champ. Start the noise."}
              </p>
              <div className="flex justify-center">
                <TrophyShareButton
                  trophy={{
                    kind: shareKind,
                    seasonYear: year,
                    winnerName: liveWinner?.name || slide.winnerName || "",
                    leagueName,
                    subtitle: slide.kicker,
                    sportId: getLeague()?.sportId,
                    winnerUserId:
                      liveWinner?.userId ||
                      slide.winnerUserId ||
                      undefined,
                    winnerAvatarUrl: liveWinner?.avatarUrl || undefined,
                  }}
                  label={slide.isYou ? "Share my win" : "Share this win"}
                  className="min-h-[48px] px-5 font-bold"
                />
              </div>
            </div>
          )}

          {/* Dot progress */}
          <div className="flex justify-center gap-1.5 pt-1">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-border hover:bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {!isFirst && (
              <button
                type="button"
                onClick={prev}
                className="sm:flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground min-h-[48px]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex-[2] py-3 rounded-xl bg-primary text-black text-sm font-black min-h-[48px]"
            >
              {isLast
                ? "Enter the room"
                : slide.kind === "intro"
                  ? "Announce the winners →"
                  : "Next award →"}
            </button>
          </div>

          {isLast && (
            <Link
              href="/trophy-room"
              onClick={dismissAll}
              className="block w-full py-2.5 rounded-xl border border-amber-400/40 text-amber-200 text-sm font-bold text-center min-h-[44px] flex items-center justify-center"
            >
              Open Trophy Room
            </Link>
          )}

          <p className="text-[10px] text-muted text-center leading-relaxed">
            Shown once when new winners are engraved. Skip anytime — hardware
            stays in the Trophy Room forever.
          </p>
        </div>
      </div>
    </div>
  );
}
