"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GazettePaper from "@/components/GazettePaper";
import {
  loadGazetteArchive,
  type ArchivedGazette,
} from "@/lib/gazette";
import { getLeague } from "@/lib/league";

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
        }
      })
      .catch(() => {
        setError("Could not load archive");
        setEditions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Newsroom
          </p>
          <h1 className="text-2xl font-black mt-0.5">Gazette Archive</h1>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            {leagueName ? `${leagueName} · ` : ""}
            Every scored week&apos;s paper — crowns, shame, milk cartons, and
            classifieds. Share any edition into the group chat.
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
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
            <div className="text-4xl mb-3" aria-hidden>
              📰
            </div>
            <p className="font-semibold mb-1">No editions yet</p>
            <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
              When the commissioner scores a week, that Gazette cover is filed
              here forever. Lock picks. Wait for blood. Come back.
            </p>
            <Link
              href="/standings"
              className="inline-flex mt-4 text-primary font-bold text-sm min-h-[44px] items-center"
            >
              Standings →
            </Link>
          </div>
        )}

        <div className="space-y-8">
          {editions.map((row) => (
            <section key={row.id || `${row.weekNumber}-${row.createdAt}`}>
              <p className="text-[11px] text-muted mb-2 font-medium">
                Filed{" "}
                {row.createdAt
                  ? new Date(row.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
              <GazettePaper edition={row.edition} variant="archive" />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
