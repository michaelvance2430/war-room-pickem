"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import {
  loadGazetteArchive,
  type ArchivedGazette,
  type GazetteEdition,
} from "@/lib/gazette";
import { getLeague } from "@/lib/league";

function EditionCard({
  edition,
  volumeLabel,
  weekLabel,
}: {
  edition: GazetteEdition;
  volumeLabel: string;
  weekLabel: string;
}) {
  return (
    <article className="rounded-sm border-2 border-stone-600 bg-[#f4f0e6] text-stone-900 overflow-hidden shadow-lg">
      <div className="border-b-4 border-double border-stone-900 px-4 pt-4 pb-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-600 mb-0.5">
          Extra · Extra
        </p>
        <h2 className="font-serif text-xl font-black tracking-tight">
          {edition.masthead || "THE WAR ROOM GAZETTE"}
        </h2>
        <p className="text-[11px] uppercase tracking-widest text-stone-600 mt-1.5 border-t border-b border-stone-400 py-1">
          {volumeLabel || weekLabel}
        </p>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800 mb-1">
            ★ This week&apos;s card
          </p>
          <h3 className="font-serif text-lg font-black leading-snug">
            {edition.crown?.headline}
          </h3>
          {edition.crown?.deck && (
            <p className="text-sm text-stone-700 mt-1.5 leading-snug">
              {edition.crown.deck}
            </p>
          )}
          <p className="text-xs text-stone-500 mt-1.5 font-medium">
            {edition.crown?.names?.join(" · ")} · {edition.crown?.pts} pts ·{" "}
            {weekLabel}
          </p>
        </div>
        {edition.standingsDeadlock && (
          <div className="border-t border-stone-400 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-900 mb-1">
              ★ Season standings · Who pulls ahead?
            </p>
            <h3 className="font-serif text-base font-bold leading-snug">
              {edition.standingsDeadlock.headline}
            </h3>
            <p className="text-sm text-stone-700 mt-1 leading-snug">
              {edition.standingsDeadlock.deck}
            </p>
            <p className="text-xs text-stone-500 mt-1.5 font-medium">
              {edition.standingsDeadlock.names.join(" · ")} ·{" "}
              {edition.standingsDeadlock.pts} pts overall
            </p>
          </div>
        )}
        {edition.shame && (
          <div className="border-t border-stone-400 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-900 mb-1">
              🚽 Also in this edition
            </p>
            <h3 className="font-serif text-base font-bold leading-snug">
              {edition.shame.headline}
            </h3>
            <p className="text-sm text-stone-700 mt-1 leading-snug">
              {edition.shame.deck}
            </p>
            <p className="text-xs text-stone-500 mt-1.5 font-medium">
              {edition.shame.names?.join(" · ")} · {edition.shame.pts} pts
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function GazetteArchivePage() {
  const [editions, setEditions] = useState<ArchivedGazette[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    setLeagueName(getLeague()?.name || "");
    loadGazetteArchive()
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "Could not load archive");
          setEditions([]);
        } else {
          setEditions(res.editions || []);
          setError(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">Gazette Archive</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-500/20 text-stone-300 border border-stone-500/40">
              Season paper trail
            </span>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            {leagueName ? (
              <>
                <span className="text-foreground font-medium">{leagueName}</span>
                {" · "}
              </>
            ) : null}
            Every scored week&apos;s headlines, saved for the season. Cleared on{" "}
            <strong className="text-foreground">Reset season</strong> — Trophy
            Room stays.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-muted py-10 text-center">
            Opening the morgue…
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-4">
            {error}
          </div>
        )}

        {!loading && !error && editions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <div className="text-3xl mb-2" aria-hidden>
              📰
            </div>
            <p className="font-medium mb-1">No editions yet</p>
            <p className="text-sm text-muted max-w-md mx-auto">
              When the commissioner scores a week, that Gazette cover is filed
              here automatically. Come back after the first results land.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm text-primary hover:underline"
            >
              Back home →
            </Link>
          </div>
        )}

        <div className="space-y-8">
          {editions.map((ed) => (
            <div key={ed.id}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {ed.weekLabel}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted">
                  Week {ed.weekNumber}
                </span>
              </div>
              <EditionCard
                edition={ed.edition}
                volumeLabel={ed.volumeLabel}
                weekLabel={ed.weekLabel}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
