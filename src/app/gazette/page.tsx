"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GazettePaper from "@/components/GazettePaper";
import {
  loadGazetteArchive,
  markGazetteSeen,
  ritualEditionName,
  type ArchivedGazette,
} from "@/lib/gazette";
import { getLeague, getSession } from "@/lib/league";

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
          const list = res.editions || [];
          setEditions(list);
          // Opening the newsroom marks the latest paper read
          const session = getSession();
          const latest = list[0];
          if (session?.leagueId && latest) {
            markGazetteSeen(session.leagueId, latest.weekNumber);
          }
        }
      })
      .catch(() => {
        setError("Could not load archive");
        setEditions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const latest = editions[0] || null;
  const older = editions.slice(1);
  const ritual =
    latest?.edition?.ritualName ||
    ritualEditionName(
      latest?.createdAt ? new Date(latest.createdAt) : new Date()
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
            The weekly appointment
          </p>
          <h1 className="text-2xl sm:text-3xl font-black mt-0.5">
            War Room Gazette
          </h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            {leagueName ? `${leagueName} · ` : ""}
            Sunday / Monday paper energy after scores — crowns, shame, movers,
            fake news, milk cartons. The room looks forward to this. Share it.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-muted py-10 text-center">
            Opening the newsroom…
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-4">
            {error}
          </div>
        )}

        {!loading && !error && editions.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-red-800/40 bg-red-950/20 px-5 py-12 text-center">
            <div className="text-4xl mb-3" aria-hidden>
              📰
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300/90 mb-1">
              {ritualEditionName()}
            </p>
            <p className="font-bold text-lg mb-1">No paper yet</p>
            <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
              When the commish scores a week, the Gazette drops here — the Sunday /
              Monday appointment the room waits for. Lock picks. Wait for blood.
              Come back.
            </p>
            <Link
              href="/standings"
              className="inline-flex mt-4 text-primary font-bold text-sm min-h-[44px] items-center"
            >
              Standings →
            </Link>
          </div>
        )}

        {latest && (
          <section className="mb-10">
            <div className="flex items-end justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                  This week&apos;s paper
                </p>
                <h2 className="text-lg font-black text-foreground">
                  {ritual}
                  {latest.weekLabel ? (
                    <span className="text-muted font-bold text-sm">
                      {" "}
                      · {latest.weekLabel}
                    </span>
                  ) : null}
                </h2>
              </div>
              <p className="text-[11px] text-muted shrink-0">
                {latest.createdAt
                  ? new Date(latest.createdAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </p>
            </div>
            <GazettePaper edition={latest.edition} variant="archive" />
          </section>
        )}

        {older.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              Earlier editions
            </p>
          </div>
        )}

        <div className="space-y-8">
          {older.map((row) => (
            <section key={row.id || `${row.weekNumber}-${row.createdAt}`}>
              <p className="text-[11px] text-muted mb-2 font-medium">
                {row.edition?.ritualName || row.volumeLabel}
                {row.createdAt
                  ? ` · ${new Date(row.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : ""}
              </p>
              <GazettePaper edition={row.edition} variant="archive" />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
