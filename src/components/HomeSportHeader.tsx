"use client";

/**
 * Home masthead — where am I?
 * League name + sport identity + Share League.
 * Invite codes are infrastructure (Join page only) — not hero chrome.
 */

import { useState } from "react";
import {
  WWC_BRAZIL_COLORS,
  type SportHomeChrome,
} from "@/lib/sports/home-chrome";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";
import HomeSportSwitcher from "@/components/HomeSportSwitcher";
import { NFL_SUNDAY_COLORS } from "@/lib/sports/home-chrome";
import {
  markInviteCopied,
  shareLeagueInvite,
} from "@/lib/commish-onboarding";

type Props = {
  chrome: SportHomeChrome;
  tagline: string;
  leagueName: string | null;
  leagueCode: string | null;
  /** Any member can share; not host-only */
  canShare?: boolean;
  sportId?: string | null;
};

export default function HomeSportHeader({
  chrome,
  tagline,
  leagueName,
  leagueCode,
  canShare = true,
  sportId,
}: Props) {
  const isWwc = chrome.sportId === "soccer_wwc";
  const isNfl = chrome.sportId === "nfl";
  const isCfb = !isWwc && !isNfl;
  const { emerald, gold, royal } = WWC_BRAZIL_COLORS;
  const nfl = NFL_SUNDAY_COLORS;
  const room = (leagueName || "").trim() || "War Room";
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  async function onShareLeague() {
    if (!leagueCode || shareBusy) return;
    setShareBusy(true);
    setShareNote(null);
    try {
      const result = await shareLeagueInvite({
        leagueName: room,
        code: leagueCode,
        sportId: sportId || chrome.sportId,
        flavor: "random",
      });
      if (result === "shared" || result === "copied") {
        try {
          const { getLeague } = await import("@/lib/league");
          const id = getLeague()?.id;
          if (id) markInviteCopied(id);
        } catch {
          /* ok */
        }
        setShareNote(result === "shared" ? "Shared" : "Link copied");
        window.setTimeout(() => setShareNote(null), 2200);
      } else {
        setShareNote("Couldn’t share — try again");
      }
    } catch {
      setShareNote("Couldn’t share — try again");
    }
    setShareBusy(false);
  }

  return (
    <section className={`mb-3 sm:mb-4 ${isCfb ? "cfb-situation-masthead" : ""}`}>
      {/* Identity row: crest · Sport Hub · Share */}
      <div className="home-identity-row flex flex-wrap items-center gap-2 mb-2">
        <BrandMark size={isCfb ? 46 : 40} variant="force" className="rounded-lg shrink-0" />
        {isCfb ? (
          <div className="cfb-wordmark">
            <span>War Room</span>
            <small>Saturday Situation Room</small>
          </div>
        ) : null}
        {isWwc ? (
          <div
            className="shrink-0 rounded-lg p-0.5 border"
            style={{
              borderColor: `${gold}66`,
              background: `linear-gradient(160deg, ${royal}ee 0%, ${emerald}55 100%)`,
            }}
          >
            <WwcTrophyLogo size={22} />
          </div>
        ) : isNfl ? (
          <div
            className="shrink-0 rounded-lg p-0.5 border"
            style={{
              borderColor: `${nfl.silver}55`,
              background: `linear-gradient(160deg, ${nfl.navy} 0%, ${nfl.crimson}55 100%)`,
            }}
          >
            <NflBrandMark size={20} />
          </div>
        ) : null}

        {/* Sport Hub — primary navigation, not a static chip */}
        <HomeSportSwitcher
          onSwitched={() => {
            window.location.assign("/");
          }}
        />

        {canShare && leagueCode ? (
          <button
            type="button"
            disabled={shareBusy}
            onClick={() => void onShareLeague()}
            className="ml-auto sm:ml-0 min-h-[40px] px-3 rounded-full border border-border text-xs font-bold text-foreground hover:border-primary/40 touch-manipulation disabled:opacity-50"
          >
            {shareBusy
              ? "…"
              : shareNote
                ? shareNote
                : "Share League"}
          </button>
        ) : null}
      </div>

      {isCfb ? (
        <div className="cfb-situation-title-wrap">
          <span className="cfb-room-ribbon">{room}</span>
          <h1 className={`cfb-situation-title ${chrome.atmosphere.titleGlow}`}>
            <span>Saturday</span>
            <span>Situation Room</span>
          </h1>
          <p className="cfb-situation-tagline">
            Good teams show up. Bad picks don&apos;t.
          </p>
        </div>
      ) : (
        <>
          <h1
            className={`text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] text-white break-words ${chrome.atmosphere.titleGlow}`}
          >
            {room}
          </h1>

          <p className="mt-2 text-muted max-w-xl text-sm sm:text-base leading-relaxed">
            {tagline || chrome.defaultTagline}
          </p>
        </>
      )}
    </section>
  );
}
