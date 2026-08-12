"use client";

/**
 * The War Room Dispatch — a four-page, phone-first weekly newspaper.
 * One component powers the production modal, archive, and Foundry preview.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { GazetteEdition, GazetteStory } from "@/lib/gazette";
import GazetteShareSheet from "@/components/GazetteShareSheet";
import { getSession } from "@/lib/league";
import {
  collectGazetteSecretLetter,
  getPersonalGazetteOverlay,
  noteRareHeadlineSeen,
  EVENT_EASTER_EGG,
} from "@/lib/easter-eggs";
import { weekDateRangeLabel } from "@/lib/season-calendar";

type Props = {
  edition: GazetteEdition;
  variant?: "modal" | "archive";
  onDismiss?: () => void;
  className?: string;
  /** Read-only Foundry rendering: exact pages, no personal local claims. */
  foundryPreview?: boolean;
};

const PAGE_META = [
  { name: "Front Page", short: "Front", next: "Sports" },
  { name: "Sports", short: "Sports", next: "Standings & Rivalries" },
  { name: "Standings & Rivalries", short: "Rivalries", next: "Back Page" },
  { name: "Back Page", short: "Back", next: "" },
] as const;

/** Backfill older archived payloads without inventing competitive events. */
export function normalizeEdition(raw: GazetteEdition): GazetteEdition {
  const wwc = raw.sportId === "soccer_wwc";
  return {
    ...raw,
    ritualName: raw.ritualName || (wwc ? "World Cup Extra" : "War Room Edition"),
    tagline:
      raw.tagline ||
      (wwc
        ? "WORLD CUP EDITION · all the news that fits the pitch"
        : "All the news that's fit to roast"),
    printedLine:
      raw.printedLine ||
      `${raw.ritualName || "Edition"} · ${raw.weekLabel || "Week"} · War Room`,
    coverageLine:
      raw.coverageLine ||
      (() => {
        const range =
          raw.sportId === "cfb" || raw.sportId === "nfl"
            ? weekDateRangeLabel(raw.weekIndex, raw.sportId)
            : "";
        return range ? `Coverage: ${range}` : `Coverage: ${raw.weekLabel || `Week ${raw.weekIndex}`}`;
      })(),
    masthead: (raw.masthead || "THE WAR ROOM DISPATCH").replace(/GAZETTE/gi, "DISPATCH"),
    weather: raw.weather || {
      kicker: wwc ? "Brasil forecast" : "War Room weather",
      body: wwc
        ? "High: emerald heat. Low: royal-blue despair."
        : "High confidence. Low dignity. Pack a paper bag.",
    },
    classifieds: Array.isArray(raw.classifieds) ? raw.classifieds : [],
    pullQuote: raw.pullQuote || {
      text: `"Trust the process."`,
      by: "Someone mid-process",
    },
    sideStories: Array.isArray(raw.sideStories) ? raw.sideStories : [],
    swing: raw.swing ?? null,
    rivalryWatch: raw.rivalryWatch ?? null,
    chaosDetonation: raw.chaosDetonation ?? null,
    promotionOrders: Array.isArray(raw.promotionOrders) ? raw.promotionOrders : [],
    crystalBallMiss: raw.crystalBallMiss ?? null,
    standingsDeadlock: raw.standingsDeadlock ?? null,
    noLock: raw.noLock ?? null,
    shame: raw.shame ?? null,
    stampLine: raw.stampLine || (wwc ? "EXTRA!" : "Extra · Extra"),
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
  foundryPreview = false,
}: Props) {
  const edition = normalizeEdition(raw);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [page, setPage] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [personal, setPersonal] = useState<{ headline: string; deck: string } | null>(null);

  useEffect(() => setPage(0), [edition.weekIndex]);

  useEffect(() => {
    if (foundryPreview) return;
    const pid = getSession()?.playerId;
    if (!pid) return;
    setPersonal(getPersonalGazetteOverlay(pid));
    if (edition.rareEgg) noteRareHeadlineSeen(pid);
    const moment = collectGazetteSecretLetter(pid, edition.weekIndex);
    if (moment) {
      try {
        window.dispatchEvent(new CustomEvent(EVENT_EASTER_EGG, { detail: moment }));
      } catch {
        /* ignore */
      }
    }
  }, [edition.weekIndex, edition.rareEgg, foundryPreview]);

  function turnPage(next: number) {
    const target = Math.max(0, Math.min(PAGE_META.length - 1, next));
    if (target === page) return;
    setPage(target);
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      pageTitleRef.current?.focus({ preventScroll: true });
    });
  }

  return (
    <div
      ref={rootRef}
      className={`bg-[#f4f0e6] text-stone-900 ${
        variant === "modal"
          ? "overflow-visible rounded-none border-0 shadow-none"
          : "overflow-hidden rounded-sm border-2 border-stone-600 shadow-lg"
      } ${className}`}
    >
      <EditionStrip edition={edition} />
      <Masthead edition={edition} />

      <nav
        aria-label="Dispatch pages"
        className="border-b border-stone-400 bg-[#e8e1d2] px-2 py-2"
      >
        <div className="grid grid-cols-4 gap-1">
          {PAGE_META.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => turnPage(index)}
              aria-current={page === index ? "page" : undefined}
              className={`min-h-[40px] rounded px-1 py-1.5 text-[9px] font-black uppercase tracking-wide touch-manipulation ${
                page === index
                  ? "bg-stone-900 text-[#f4f0e6]"
                  : "text-stone-600 hover:bg-stone-200"
              }`}
            >
              <span className="block text-[8px] opacity-70">{index + 1}</span>
              {item.short}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-4 pb-3 pt-4 min-h-[420px]">
        <p className="mb-1 text-[9px] font-black uppercase tracking-[0.22em] text-red-800">
          Page {page + 1} of {PAGE_META.length}
        </p>
        <h2
          ref={pageTitleRef}
          tabIndex={-1}
          className="mb-4 border-b-4 border-double border-stone-900 pb-2 font-serif text-2xl font-black leading-none outline-none"
        >
          {PAGE_META[page].name}
        </h2>

        {page === 0 && <FrontPage edition={edition} />}
        {page === 1 && <SportsPage edition={edition} />}
        {page === 2 && <RivalryPage edition={edition} />}
        {page === 3 && <BackPage edition={edition} personal={personal} />}
      </main>

      <PageTurner page={page} onTurn={turnPage} />

      <footer className="border-t-4 border-double border-stone-900 bg-[#e8e1d2] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-stone-700">
        {edition.coverageLine}
      </footer>

      {page === PAGE_META.length - 1 && (
        <div className="border-t-4 border-double border-stone-900 px-4 pb-4 pt-4">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="w-full min-h-[52px] rounded-xl bg-red-700 py-3.5 text-sm font-black uppercase tracking-wide text-[#f4f0e6] touch-manipulation active:scale-[0.99]"
          >
            Share this edition
          </button>
          <p className="mt-1 text-center text-[10px] leading-snug text-stone-500">
            Newspaper graphic · IG / FB / chat · War Room flex
          </p>
          <GazetteShareSheet
            edition={edition}
            open={shareOpen}
            onClose={() => setShareOpen(false)}
          />
          {variant === "modal" && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-[48px] rounded-xl bg-stone-900 px-3 py-3 text-sm font-bold text-[#f4f0e6]"
              >
                Return to War Room
              </button>
              <Link href="/locker-room" onClick={onDismiss} className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-stone-700 px-3 py-3 text-center text-sm font-bold">
                Locker Room
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditionStrip({ edition }: { edition: GazetteEdition }) {
  const bg =
    edition.sportId === "soccer_wwc"
      ? "linear-gradient(90deg,#009C3B,#002776,#009C3B)"
      : edition.sportId === "nfl"
        ? "linear-gradient(90deg,#0B1426,#C1121F,#0B1426)"
        : undefined;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[#f4f0e6] ${bg ? "" : "bg-red-700"}`}
      style={bg ? { background: bg } : undefined}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.25em]">
        {edition.stampLine}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
        {edition.ritualName}
      </span>
    </div>
  );
}

function Masthead({ edition }: { edition: GazetteEdition }) {
  return (
    <header className="border-b-4 border-double border-stone-900 px-4 pb-3 pt-4 text-center">
      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-red-800">
        {edition.eventLine || edition.printedLine}
      </p>
      <h1 className="font-serif text-2xl font-black leading-none tracking-tight sm:text-3xl">
        {edition.masthead || "THE WAR ROOM DISPATCH"}
      </h1>
      <p className="mt-2 text-[11px] italic text-stone-600">
        {edition.tagline}
        {edition.secretLetter ? (
          <span className="ml-1 font-serif font-black text-stone-800 underline decoration-dotted decoration-stone-400">
            {edition.secretLetter}
          </span>
        ) : null}
      </p>
      <p className="mt-2 border-y border-stone-400 py-1 text-[10px] font-semibold uppercase tracking-widest text-stone-700">
        {edition.volumeLabel}
      </p>
    </header>
  );
}

function FrontPage({ edition }: { edition: GazetteEdition }) {
  if (edition.chaosDetonation) {
    const launch = edition.chaosDetonation;
    const operators = launch.names.length > 1 ? "THEY HAVE" : "THIS PERSON HAS";
    const protocol = edition.emergencyProtocol || "tactical_nuke";
    const art = protocol === "hellfire" ? "/gazette/hellfire-extra.png" : protocol === "jdam" ? "/gazette/jdam-extra.png" : "/gazette/tactical-nuclear-extra.png";
    const authorization = protocol === "hellfire" ? "Hellfire strike confirmed" : protocol === "jdam" ? "JDAM release confirmed" : protocol === "dead_hand" ? "Dead Hand activated" : "Nuclear authorization confirmed";
    const caption = protocol === "hellfire"
      ? `Artist's reconstruction of ${launch.names.join(" and ")} asking a drone to improve a basketball bracket. The drone has no known Final Four experience.`
      : protocol === "jdam"
        ? `Artist's reconstruction of ${launch.names.join(" and ")} releasing a precision-guided playoff bracket, then leaving the airspace before anyone could ask about the wild-card picks.`
        : protocol === "dead_hand"
          ? `Artist's reconstruction of ${launch.names.join(" and ")} surrendering the entire bowl board to Dead Hand. The machine declined comment but circled Boise twice.`
        : `Artist's reconstruction of ${launch.names.join(" and ")} surrendering all decision-making authority to a computer. ${operators} declined to remove themselves from command before publication.`;
    return (
      <article className="text-center">
        <div className="border-y-[6px] border-double border-stone-950 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-800">
            Emergency extra · {authorization}
          </p>
        </div>
        <h3 className="mx-auto mt-4 max-w-3xl font-serif text-5xl font-black uppercase leading-[0.84] tracking-[-0.045em] text-stone-950 sm:text-7xl">
          {launch.headline}
        </h3>
        <p className="mx-auto mt-4 max-w-2xl border-y border-stone-500 py-3 font-serif text-lg font-bold leading-tight text-stone-800 sm:text-xl">
          {launch.deck}
        </p>
        <figure className="mt-4">
          <div className="overflow-hidden border-4 border-stone-950 bg-stone-900">
            <Image
              src={art}
              alt={`A fictional newspaper halftone illustration for ${protocol.replace("_", " ")}`}
              width={1536}
              height={1024}
              priority
              className="aspect-[3/2] w-full object-cover grayscale contrast-125"
            />
          </div>
          <figcaption className="mt-2 border-b-4 border-double border-stone-950 pb-3 text-left text-[10px] font-bold uppercase leading-snug tracking-wide text-stone-700">
            {caption}
          </figcaption>
        </figure>
        <div className="mt-4 grid grid-cols-2 border-y-2 border-stone-900 text-left text-[10px] font-black uppercase tracking-wide">
          <p className="border-r border-stone-900 px-2 py-3">Status: Button pushed</p>
          <p className="px-2 py-3">Damage report: Sports, page 2</p>
        </div>
      </article>
    );
  }

  const [lead, ...briefs] = edition.sideStories;
  return (
    <div className="space-y-4">
      {lead ? (
        <article>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-800">
            {lead.kicker} · Above the fold
          </p>
          <h3 className="font-serif text-3xl font-black leading-[1.02] text-stone-950">
            {lead.headline}
          </h3>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-stone-800">
            {lead.body}
          </p>
        </article>
      ) : (
        <article>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-800">Room desk · Above the fold</p>
          <h3 className="font-serif text-3xl font-black leading-[1.02]">THE ROOM SURVIVED ANOTHER WEEK</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-800">The official record is still being assembled. The Locker Room has already reached several conclusions.</p>
        </article>
      )}

      <blockquote className="border-y-4 border-double border-stone-900 py-3 text-center">
        <p className="font-serif text-xl font-black italic leading-snug">{edition.pullQuote.text}</p>
        <footer className="mt-1 text-[11px] font-semibold text-stone-600">— {edition.pullQuote.by}</footer>
      </blockquote>

      <div className="rounded border-2 border-stone-800 bg-sky-50/90 px-3 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-900">War Room forecast · {edition.weather.kicker}</p>
        <p className="mt-1 text-sm leading-snug text-stone-800">{edition.weather.body}</p>
      </div>

      {briefs.map((story, index) => (
        <article key={`${story.headline}-${index}`} className="border-t border-stone-400 pt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">{story.kicker}</p>
          <h3 className="mt-1 font-serif text-lg font-black leading-snug">{story.headline}</h3>
          <p className="mt-1 text-[13px] leading-snug text-stone-700">{story.body}</p>
        </article>
      ))}
    </div>
  );
}

function SportsPage({ edition }: { edition: GazetteEdition }) {
  return (
    <div className="space-y-4">
      <StoryCard kicker="A1 · Week winner" story={edition.crown} tone="crown" large />
      {edition.conferenceChampions?.map((story, index) => (
        <StoryCard key={`${story.headline}-${index}`} kicker="Title desk · Clinched" story={story} tone="title" />
      ))}
      {edition.chaosDetonation && <StoryCard kicker="Chaos desk · Lock confirmed" story={edition.chaosDetonation} tone="chaos" />}
      {edition.shame && <StoryCard kicker="Wall of shame" story={edition.shame} tone="shame" />}
      {edition.noLock && <StoryCard kicker="Missing persons · No lock" story={edition.noLock} tone="warning" />}
      {edition.crystalBallMiss && <StoryCard kicker="Crystal Ball · No pick" story={edition.crystalBallMiss} tone="crystal" />}
    </div>
  );
}

function RivalryPage({ edition }: { edition: GazetteEdition }) {
  return (
    <div className="space-y-4">
      {edition.rivalryWatch ? (
        <StoryCard kicker="Rivalry watch · Closest live race" story={edition.rivalryWatch} tone="rivalry" large />
      ) : (
        <EmptyDesk title="Rivalry desk awaiting a real race" body="No rivalry was manufactured. Once two active players have scored cards, the closest season race earns this space." />
      )}
      {edition.standingsDeadlock && <StoryCard kicker="Top of the table · Deadlock" story={edition.standingsDeadlock} tone="title" />}
      {edition.swing && <StoryCard kicker="Standings wire · Biggest move" story={edition.swing} tone="mover" />}
      {!edition.standingsDeadlock && !edition.swing && edition.rivalryWatch && (
        <EmptyDesk title="The rest of the table held steady" body="No fake movement, no invented drama. The next scored card will rewrite this page if the standings actually move." />
      )}
      <p className="border-t border-stone-400 pt-3 text-[11px] italic leading-snug text-stone-600">
        Rivalry Watch follows the closest active real players. It changes as the standings change; dead rivalries do not receive lifetime appointments.
      </p>
    </div>
  );
}

function BackPage({ edition, personal }: { edition: GazetteEdition; personal: { headline: string; deck: string } | null }) {
  return (
    <div className="space-y-4">
      {!!edition.promotionOrders?.length && <section className="border-4 border-double border-stone-900 bg-amber-50 px-4 py-4"><p className="text-center text-[10px] font-black uppercase tracking-[.24em] text-red-800">Department of the War Room · Promotion Orders</p>{edition.promotionOrders.map((order) => <article key={`${order.name}-${order.to}`} className="mt-3 border-t border-stone-500 pt-3 first:border-t-0 first:pt-0"><h3 className="font-serif text-xl font-black leading-tight">{order.name.toUpperCase()} PROMOTED: {order.from} → {order.to}</h3><p className="mt-2 text-[13px] leading-snug text-stone-700">{order.deck}</p></article>)}</section>}
      {(personal || edition.rareEgg) && (
        <section className="border-2 border-stone-800 bg-stone-100 px-3 py-3">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">From the editor&apos;s desk</p>
          {personal && <DeskNote headline={personal.headline} deck={personal.deck} />}
          {edition.rareEgg && <DeskNote headline={edition.rareEgg.headline} deck={edition.rareEgg.deck} divided={Boolean(personal)} />}
        </section>
      )}

      <section>
        <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em]">Classifieds · Notices · Questionable commerce</p>
        {edition.classifieds.length ? (
          <ul className="divide-y divide-stone-400 border-y-2 border-stone-900">
            {edition.classifieds.map((line, index) => (
              <li key={`${line}-${index}`} className="py-3 text-[13px] leading-snug text-stone-800">
                <span className="mr-2 font-black text-red-800">{String.fromCharCode(65 + index)}.</span>{line}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyDesk title="Classified desk closed early" body="No notice was filed for this edition. The Locker Room remains dangerously available." />
        )}
      </section>

      <section className="bg-stone-900 px-4 py-5 text-center text-[#f4f0e6]">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-300">Final word</p>
        <h3 className="mt-2 font-serif text-2xl font-black leading-tight">THE NEXT CARD WRITES THE NEXT PAPER.</h3>
        <p className="mt-2 text-xs leading-relaxed text-stone-300">Nothing here is permanent except the archive—and screenshots in the group chat.</p>
      </section>

      <p className="text-center text-[10px] italic text-stone-500">Filed forever in the archive. Share it. Frame it. Deny it.</p>
    </div>
  );
}

function StoryCard({ kicker, story, tone, large = false }: { kicker: string; story: GazetteStory; tone: "crown" | "title" | "chaos" | "shame" | "warning" | "crystal" | "rivalry" | "mover"; large?: boolean }) {
  const tones = {
    crown: "border-emerald-800 bg-emerald-50",
    title: "border-amber-800 bg-amber-50",
    chaos: "border-orange-800 bg-orange-50",
    shame: "border-purple-800 bg-purple-50",
    warning: "border-amber-700 bg-[#fff8df]",
    crystal: "border-indigo-700 bg-indigo-50",
    rivalry: "border-red-800 bg-red-50",
    mover: "border-teal-800 bg-teal-50",
  } as const;
  return (
    <article className={`border-l-4 px-3 py-3 ${tones[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-600">{kicker}</p>
      <h3 className={`mt-1 font-serif font-black leading-[1.08] text-stone-950 ${large ? "text-2xl" : "text-lg"}`}>{story.headline}</h3>
      {story.deck && <p className="mt-2 text-sm leading-snug text-stone-800">{story.deck}</p>}
      <p className="mt-2 text-[11px] font-bold text-stone-600">{story.names.join(" · ")}{tone !== "rivalry" ? ` · ${story.pts} pts` : ""}</p>
    </article>
  );
}

function EmptyDesk({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-stone-500 bg-stone-100/70 px-3 py-4">
      <h3 className="font-serif text-lg font-black">{title}</h3>
      <p className="mt-1 text-[13px] leading-snug text-stone-600">{body}</p>
    </div>
  );
}

function DeskNote({ headline, deck, divided = false }: { headline: string; deck: string; divided?: boolean }) {
  return (
    <div className={divided ? "mt-3 border-t border-stone-400 pt-3" : ""}>
      <h3 className="font-serif text-base font-black leading-snug">{headline}</h3>
      <p className="mt-1 text-[12px] leading-snug text-stone-600">{deck}</p>
    </div>
  );
}

function PageTurner({ page, onTurn }: { page: number; onTurn: (page: number) => void }) {
  const meta = PAGE_META[page];
  return (
    <div className="border-t-2 border-stone-900 bg-[#e8e1d2] px-3 py-3">
      {meta.next && <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">Next page · {meta.next}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTurn(page - 1)}
          disabled={page === 0}
          className="min-h-[48px] rounded-lg border-2 border-stone-900 px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-25"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={() => onTurn(page + 1)}
          disabled={page === PAGE_META.length - 1}
          className="min-h-[48px] rounded-lg bg-stone-900 px-3 py-2 text-sm font-black text-[#f4f0e6] disabled:cursor-not-allowed disabled:opacity-25"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
