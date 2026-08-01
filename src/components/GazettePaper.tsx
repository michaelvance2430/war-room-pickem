"use client";

/**
 * Shared War Room Gazette layout — modal + archive.
 * Phone-first newspaper energy: big A1, weather, movers, classifieds, share.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GazetteEdition } from "@/lib/gazette";
import GazetteShareSheet from "@/components/GazetteShareSheet";
import { getSession } from "@/lib/league";
import {
  collectGazetteSecretLetter,
  getPersonalGazetteOverlay,
  noteRareHeadlineSeen,
  EVENT_EASTER_EGG,
} from "@/lib/easter-eggs";

type Props = {
  edition: GazetteEdition;
  /** Modal: sticky actions. Archive: inline. */
  variant?: "modal" | "archive";
  onDismiss?: () => void;
  className?: string;
};

/** Backfill older archived payloads missing new fields. */
export function normalizeEdition(raw: GazetteEdition): GazetteEdition {
  const wwc = raw.sportId === "soccer_wwc";
  return {
    ...raw,
    ritualName:
      raw.ritualName || (wwc ? "World Cup Extra" : "War Room Edition"),
    tagline:
      raw.tagline ||
      (wwc
        ? "WORLD CUP EDITION · all the news that fits the pitch"
        : "All the news that's fit to roast"),
    printedLine:
      raw.printedLine ||
      `${raw.ritualName || "Edition"} · ${raw.weekLabel || "Week"} · War Room`,
    weather: raw.weather || {
      kicker: wwc ? "Brasil forecast" : "War Room weather",
      body: wwc
        ? "High: emerald heat. Low: royal-blue despair."
        : "High confidence. Low dignity. Pack a paper bag.",
    },
    // Empty arrays are intentional (slim early editions) — don't invent filler
    classifieds: Array.isArray(raw.classifieds)
      ? raw.classifieds
      : ["Classifieds ran long. See Locker Room."],
    pullQuote: raw.pullQuote || {
      text: `"Trust the process."`,
      by: "Someone mid-process",
    },
    sideStories: Array.isArray(raw.sideStories) ? raw.sideStories : [],
    swing: raw.swing ?? null,
    chaosDetonation: raw.chaosDetonation ?? null,
    crystalBallMiss: raw.crystalBallMiss ?? null,
    standingsDeadlock: raw.standingsDeadlock ?? null,
    noLock: raw.noLock ?? null,
    shame: raw.shame ?? null,
    sportId: raw.sportId,
    stampLine: raw.stampLine || (wwc ? "EXTRA!" : "Extra · Extra"),
    eventLine: raw.eventLine,
    rareEgg: raw.rareEgg ?? null,
    secretLetter: raw.secretLetter ?? null,
    conferenceChampions: Array.isArray(raw.conferenceChampions)
      ? raw.conferenceChampions
      : raw.conferenceChampions ?? null,
  };
}

export default function GazettePaper({
  edition: raw,
  variant = "archive",
  onDismiss,
  className = "",
}: Props) {
  const edition = normalizeEdition(raw);
  const [shareOpen, setShareOpen] = useState(false);
  const [personal, setPersonal] = useState<{
    headline: string;
    deck: string;
  } | null>(null);

  useEffect(() => {
    const pid = getSession()?.playerId;
    if (!pid) return;
    setPersonal(getPersonalGazetteOverlay(pid));
    if (edition.rareEgg) {
      noteRareHeadlineSeen(pid);
    }
    const moment = collectGazetteSecretLetter(pid, edition.weekIndex);
    if (moment) {
      try {
        window.dispatchEvent(
          new CustomEvent(EVENT_EASTER_EGG, { detail: moment })
        );
      } catch {
        /* ignore */
      }
    }
  }, [edition.weekIndex, edition.rareEgg]);

  return (
    <div
      className={`bg-[#f4f0e6] text-stone-900 overflow-hidden ${
        variant === "modal"
          ? "rounded-t-2xl sm:rounded-sm border-2 border-stone-700 shadow-2xl"
          : "rounded-sm border-2 border-stone-600 shadow-lg"
      } ${className}`}
    >
      {/* EXTRA stamp strip — CFB red · NFL navy/crimson · WWC Brazil */}
      {edition.sportId === "soccer_wwc" ? (
        <div
          className="relative px-3 py-1.5 flex items-center justify-between gap-2 text-white"
          style={{
            background:
              "linear-gradient(90deg, #009C3B 0%, #002776 55%, #009C3B 100%)",
          }}
        >
          <span
            className="text-[12px] font-black uppercase tracking-[0.28em]"
            style={{ color: "#FFDF00" }}
          >
            {edition.stampLine || "EXTRA!"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-95">
            {edition.ritualName || "World Cup Extra"}
          </span>
        </div>
      ) : edition.sportId === "nfl" ? (
        <div
          className="relative px-3 py-1.5 flex items-center justify-between gap-2 text-white"
          style={{
            background:
              "linear-gradient(90deg, #0B1426 0%, #C1121F 55%, #0B1426 100%)",
          }}
        >
          <span
            className="text-[11px] font-black uppercase tracking-[0.25em]"
            style={{ color: "#C5CCD3" }}
          >
            {edition.stampLine || "Extra · Extra"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-95">
            {edition.ritualName || "Sunday Night Extra"}
          </span>
        </div>
      ) : (
        <div className="relative bg-red-700 text-[#f4f0e6] px-3 py-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">
            {edition.stampLine || "Extra · Extra"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            {edition.ritualName || "Read all about it"}
          </span>
        </div>
      )}

      {/* Masthead */}
      <div
        className={`border-b-4 border-double px-4 pt-4 pb-3 text-center ${
          edition.sportId === "soccer_wwc"
            ? "border-[#002776] bg-gradient-to-b from-[#009C3B]/10 to-transparent"
            : "border-stone-900"
        }`}
      >
        <p
          className={`text-[10px] font-black uppercase tracking-[0.28em] mb-1 ${
            edition.sportId === "soccer_wwc" ? "text-[#009C3B]" : "text-red-800"
          }`}
        >
          {edition.ritualName}
        </p>
        {edition.eventLine && (
          <p
            className="text-[10px] font-black uppercase tracking-[0.16em] mb-1"
            style={{ color: "#002776" }}
          >
            {edition.eventLine}
          </p>
        )}
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1 leading-snug px-1">
          {edition.printedLine}
        </p>
        <h2
          className={`font-serif text-2xl sm:text-3xl font-black tracking-tight leading-none ${
            edition.sportId === "soccer_wwc"
              ? "text-[#002776]"
              : "text-stone-950"
          }`}
        >
          {edition.masthead || "THE WAR ROOM GAZETTE"}
        </h2>
        {edition.sportId === "soccer_wwc" && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.2em] mt-2"
            style={{ color: "#009C3B" }}
          >
            Women&apos;s World Cup · Brazil 2027
          </p>
        )}
        <p className="text-[11px] italic text-stone-600 mt-2">
          {edition.tagline}
          {edition.secretLetter ? (
            <span
              className="ml-1 font-serif font-black text-stone-800 underline decoration-dotted decoration-stone-400"
              title=""
            >
              {edition.secretLetter}
            </span>
          ) : null}
        </p>
        <p className="text-[11px] uppercase tracking-widest text-stone-700 mt-2 border-t border-b border-stone-400 py-1.5 font-semibold">
          {edition.volumeLabel}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Personal / rare egg lines — zero points, pure desk energy */}
        {(personal || edition.rareEgg) && (
          <div className="rounded border border-stone-400 bg-stone-100/80 px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.2em] text-stone-500 font-bold mb-1">
              Desk note
            </p>
            {personal && (
              <>
                <p className="font-serif font-black text-sm text-stone-900 leading-snug">
                  {personal.headline}
                </p>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {personal.deck}
                </p>
              </>
            )}
            {edition.rareEgg && (
              <>
                <p
                  className={`font-serif font-black text-sm text-stone-900 leading-snug ${
                    personal ? "mt-2 pt-2 border-t border-stone-300" : ""
                  }`}
                >
                  {edition.rareEgg.headline}
                </p>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {edition.rareEgg.deck}
                </p>
              </>
            )}
          </div>
        )}
        {/* Conference / division clinch — cut-lock week only */}
        {edition.conferenceChampions &&
          edition.conferenceChampions.length > 0 && (
            <div className="rounded-lg border-4 border-amber-800 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50 px-3 py-3 space-y-3 shadow-md">
              <div className="flex items-center gap-2 border-b-2 border-amber-900/30 pb-2">
                <span className="text-2xl" aria-hidden>
                  🛡️
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-950">
                    {edition.sportId === "nfl"
                      ? "★ Division clinch night"
                      : "★ Conference title night"}
                  </p>
                  <p className="text-[11px] font-bold text-amber-900/80">
                    Engraved in the Trophy Room · not a drill
                  </p>
                </div>
              </div>
              {edition.conferenceChampions.map((story, i) => (
                <article
                  key={`${story.names[0]}-${i}`}
                  className={
                    i > 0 ? "pt-2 border-t border-amber-800/25" : undefined
                  }
                >
                  <h3 className="font-serif text-lg sm:text-xl font-black leading-[1.2] text-stone-950">
                    {story.headline}
                  </h3>
                  {story.deck && (
                    <p className="text-sm text-stone-800 mt-1.5 leading-snug font-medium">
                      {story.deck}
                    </p>
                  )}
                  <p className="text-xs text-amber-950/70 mt-1.5 font-bold">
                    {story.names.join(" · ")} · {story.pts} season pts
                  </p>
                </article>
              ))}
            </div>
          )}

        {/* A1 Crown */}
        <article className="relative">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-emerald-800 bg-emerald-100 flex items-center justify-center text-3xl shadow-inner"
              aria-hidden
            >
              👑
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800 mb-1">
                ★ A1 · This week&apos;s card
              </p>
              <h3 className="font-serif text-xl sm:text-2xl font-black leading-[1.15] text-stone-950">
                {edition.crown?.headline}
              </h3>
            </div>
          </div>
          {edition.crown?.deck && (
            <p className="text-sm sm:text-[15px] text-stone-800 mt-2.5 leading-snug font-medium">
              {edition.crown.deck}
            </p>
          )}
          <p className="text-xs text-stone-600 mt-2 font-bold">
            {edition.crown?.names?.join(" · ")} · {edition.crown?.pts} pts ·{" "}
            {edition.weekLabel}
          </p>
        </article>

        {/* Chaos lock-in — high on the page; Monday Morning Edition energy */}
        {edition.chaosDetonation && (
          <div className="space-y-1.5">
            <StoryBlock
              kicker="💥 First thing · Chaos desk"
              kickerClass="text-orange-900"
              story={edition.chaosDetonation}
              footer={`${edition.chaosDetonation.names.join(" · ")} · locked Chaos this week${
                edition.chaosDetonation.pts
                  ? ` · finished at ${edition.chaosDetonation.pts} pts`
                  : ""
              }`}
              avatar="☢️"
              avatarClass="border-orange-800 bg-orange-100"
            />
            <p className="text-[11px] text-stone-600 leading-snug px-0.5">
              New here?{" "}
              <span className="font-semibold text-stone-800">
                Chaos = random card · 2× week · limited uses · no undo.
              </span>{" "}
              That&apos;s why the paper is yelling.
            </p>
          </div>
        )}

        {/* Pull quote */}
        <blockquote className="border-l-4 border-stone-900 pl-3 py-1 my-1">
          <p className="font-serif text-base sm:text-lg italic text-stone-900 leading-snug">
            {edition.pullQuote.text}
          </p>
          <footer className="text-[11px] text-stone-600 mt-1 font-semibold">
            — {edition.pullQuote.by}
          </footer>
        </blockquote>

        {/* Weather */}
        <div className="rounded border-2 border-stone-800 bg-sky-50/90 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-900">
            ⛅ {edition.weather.kicker}
          </p>
          <p className="text-sm text-stone-800 mt-1 leading-snug">
            {edition.weather.body}
          </p>
        </div>

        {edition.standingsDeadlock && (
          <StoryBlock
            kicker="★ Season standings · Who pulls ahead?"
            kickerClass="text-amber-900"
            story={edition.standingsDeadlock}
            footer={`${edition.standingsDeadlock.names.join(" · ")} · ${edition.standingsDeadlock.pts} pts overall`}
          />
        )}

        {edition.swing && (
          <StoryBlock
            kicker="📈 Movers · Standings drama"
            kickerClass="text-teal-900"
            story={edition.swing}
            footer={`${edition.swing.names[0]} · ${edition.swing.pts} this week`}
            avatar="🚀"
            avatarClass="border-teal-800 bg-teal-100"
          />
        )}

        {edition.shame && (
          <StoryBlock
            kicker="🚽 Wall of shame"
            kickerClass="text-purple-900"
            story={edition.shame}
            footer={`${edition.shame.names[0]} · ${edition.shame.pts} pts this week`}
            avatar="🚽"
            avatarClass="border-purple-800 bg-purple-100"
          />
        )}

        {edition.noLock && (
          <div className="border-2 border-dashed border-amber-700 rounded-lg bg-amber-50 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-900 mb-1">
              🥛 Missing persons · No lock
            </p>
            <h3 className="font-serif text-lg font-black leading-snug">
              {edition.noLock.headline}
            </h3>
            <p className="text-sm text-stone-800 mt-1.5 leading-snug">
              {edition.noLock.deck}
            </p>
            <p className="text-xs text-stone-600 mt-2 font-bold">
              {edition.noLock.names?.join(" · ")} · 0 pts · never locked
            </p>
          </div>
        )}

        {edition.crystalBallMiss && (
          <div className="border-2 border-dashed border-indigo-500 rounded-lg bg-indigo-50 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-900 mb-1">
              🔮 Crystal Ball · No pick
            </p>
            <h3 className="font-serif text-lg font-black leading-snug">
              {edition.crystalBallMiss.headline}
            </h3>
            <p className="text-sm text-stone-800 mt-1.5 leading-snug">
              {edition.crystalBallMiss.deck}
            </p>
            <p className="text-xs text-stone-600 mt-2 font-bold">
              {edition.crystalBallMiss.names?.join(" · ")} · blank orb
            </p>
          </div>
        )}

        {/* Funny non-football (and barely-football) sub-stories */}
        {edition.sideStories?.length > 0 && (
          <div className="border-t-4 border-double border-stone-900 pt-3 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-800 text-center">
              Also in this paper · totally real news
            </p>
            {edition.sideStories.map((s, i) => (
              <article
                key={i}
                className="rounded-lg border border-stone-400 bg-stone-50/90 px-3 py-2.5"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 mb-0.5">
                  {s.kicker}
                </p>
                <h3 className="font-serif text-[15px] sm:text-base font-black leading-snug text-stone-950">
                  {s.headline}
                </h3>
                <p className="text-[13px] text-stone-700 mt-1.5 leading-snug">
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        )}

        {/* Classifieds — skip section if empty (slim editions) */}
        {edition.classifieds.length > 0 && (
          <div className="border-t-2 border-stone-900 pt-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-800 mb-2 text-center">
              Classifieds
            </p>
            <ul className="space-y-2">
              {edition.classifieds.map((line, i) => (
                <li
                  key={i}
                  className="text-[12px] sm:text-[13px] text-stone-800 leading-snug border-b border-stone-300 pb-2 last:border-0"
                >
                  <span className="font-bold text-stone-500 mr-1.5">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-stone-500 text-center italic">
          {variant === "modal"
            ? "You only see this splash once per scored week. Archive lives under Gazette anytime."
            : "Filed forever in the archive. Share it. Frame it. Deny it."}
        </p>
      </div>

      {/* Actions */}
      <div
        className={`px-4 pb-4 flex flex-col gap-2 ${
          variant === "modal"
            ? "pb-[max(1rem,env(safe-area-inset-bottom))]"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="w-full py-3.5 min-h-[52px] rounded-xl bg-red-700 text-[#f4f0e6] text-sm font-black uppercase tracking-wide touch-manipulation active:scale-[0.99]"
        >
          Share this edition
        </button>
        <p className="text-[10px] text-stone-500 text-center leading-snug -mt-0.5">
          Newspaper graphic · IG / FB / chat · War Room flex
        </p>
        <GazetteShareSheet
          edition={edition}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
        {variant === "modal" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-3 min-h-[48px] rounded-xl bg-stone-900 text-[#f4f0e6] text-sm font-bold touch-manipulation"
            >
              Got it
            </button>
            <Link
              href="/standings"
              onClick={onDismiss}
              className="flex-1 py-3 min-h-[48px] rounded-xl border-2 border-stone-900 text-stone-900 text-sm font-bold text-center flex items-center justify-center touch-manipulation"
            >
              Standings
            </Link>
            <Link
              href="/locker-room"
              onClick={onDismiss}
              className="flex-1 py-3 min-h-[48px] rounded-xl border-2 border-stone-700 text-stone-800 text-sm font-bold text-center flex items-center justify-center touch-manipulation"
            >
              Locker
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryBlock({
  kicker,
  kickerClass,
  story,
  footer,
  avatar,
  avatarClass,
}: {
  kicker: string;
  kickerClass: string;
  story: { headline: string; deck: string };
  footer: string;
  avatar?: string;
  avatarClass?: string;
}) {
  return (
    <article className="border-t border-stone-400 pt-3">
      <div className="flex items-start gap-2.5">
        {avatar && (
          <div
            className={`shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl ${avatarClass || "border-stone-700 bg-stone-100"}`}
            aria-hidden
          >
            {avatar}
          </div>
        )}
        <div className="min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.18em] mb-1 ${kickerClass}`}
          >
            {kicker}
          </p>
          <h3 className="font-serif text-lg sm:text-xl font-black leading-snug text-stone-950">
            {story.headline}
          </h3>
        </div>
      </div>
      <p className="text-sm text-stone-800 mt-1.5 leading-snug">{story.deck}</p>
      <p className="text-xs text-stone-600 mt-1.5 font-bold">{footer}</p>
    </article>
  );
}
