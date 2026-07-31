"use client";

/**
 * Shared War Room Gazette layout — modal + archive.
 * Phone-first newspaper energy: big A1, weather, movers, classifieds, share.
 */

import { useState } from "react";
import Link from "next/link";
import {
  formatGazetteShareText,
  type GazetteEdition,
} from "@/lib/gazette";

type Props = {
  edition: GazetteEdition;
  /** Modal: sticky actions. Archive: inline. */
  variant?: "modal" | "archive";
  onDismiss?: () => void;
  className?: string;
};

/** Backfill older archived payloads missing new fields. */
export function normalizeEdition(raw: GazetteEdition): GazetteEdition {
  return {
    ...raw,
    tagline: raw.tagline || "All the news that's fit to roast",
    printedLine:
      raw.printedLine ||
      `${raw.weekLabel || "Week"} edition · War Room`,
    weather: raw.weather || {
      kicker: "War Room weather",
      body: "High confidence. Low dignity. Pack a paper bag.",
    },
    classifieds: raw.classifieds?.length
      ? raw.classifieds
      : ["Classifieds ran long. See Locker Room."],
    pullQuote: raw.pullQuote || {
      text: `"Trust the process."`,
      by: "Someone mid-process",
    },
    swing: raw.swing ?? null,
    crystalBallMiss: raw.crystalBallMiss ?? null,
    standingsDeadlock: raw.standingsDeadlock ?? null,
    noLock: raw.noLock ?? null,
    shame: raw.shame ?? null,
  };
}

export default function GazettePaper({
  edition: raw,
  variant = "archive",
  onDismiss,
  className = "",
}: Props) {
  const edition = normalizeEdition(raw);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function sharePaper() {
    const text = formatGazetteShareText(edition);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: edition.masthead,
          text,
        });
        setShareStatus("Shared to the chat 🔥");
        setTimeout(() => setShareStatus(null), 2500);
        return;
      }
    } catch (e: unknown) {
      if (e instanceof Error && /Abort|cancel/i.test(e.message)) return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Copied — paste in the group chat");
      setTimeout(() => setShareStatus(null), 3000);
    } catch {
      setShareStatus("Couldn’t share — screenshot it");
      setTimeout(() => setShareStatus(null), 3000);
    }
  }

  return (
    <div
      className={`bg-[#f4f0e6] text-stone-900 overflow-hidden ${
        variant === "modal"
          ? "rounded-t-2xl sm:rounded-sm border-2 border-stone-700 shadow-2xl"
          : "rounded-sm border-2 border-stone-600 shadow-lg"
      } ${className}`}
    >
      {/* EXTRA stamp strip */}
      <div className="relative bg-red-700 text-[#f4f0e6] px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.25em]">
          Extra · Extra
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
          Read all about it
        </span>
      </div>

      {/* Masthead */}
      <div className="border-b-4 border-double border-stone-900 px-4 pt-4 pb-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.35em] text-stone-500 mb-1">
          {edition.printedLine}
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-black tracking-tight text-stone-950 leading-none">
          {edition.masthead || "THE WAR ROOM GAZETTE"}
        </h2>
        <p className="text-[11px] italic text-stone-600 mt-2">
          {edition.tagline}
        </p>
        <p className="text-[11px] uppercase tracking-widest text-stone-700 mt-2 border-t border-b border-stone-400 py-1.5 font-semibold">
          {edition.volumeLabel}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
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

        {/* Classifieds */}
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

        <p className="text-[10px] text-stone-500 text-center italic">
          {variant === "modal"
            ? "You only see this splash once per scored week. Archive lives under Gazette anytime."
            : "Filed forever in the archive. Share it. Frame it. Deny it."}
        </p>

        {shareStatus && (
          <p className="text-xs text-center font-bold text-emerald-800">
            {shareStatus}
          </p>
        )}
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
          onClick={() => void sharePaper()}
          className="w-full py-3.5 min-h-[52px] rounded-xl bg-red-700 text-[#f4f0e6] text-sm font-black uppercase tracking-wide touch-manipulation active:scale-[0.99]"
        >
          Share this edition
        </button>
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
