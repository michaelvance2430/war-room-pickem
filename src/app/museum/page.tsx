"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import PlayerLink from "@/components/PlayerLink";
import ChampionshipBanner from "@/components/ChampionshipBanner";
import {
  buildLeagueHistory,
  buildLeagueRecords,
  buildMuseumTimeline,
  type MuseumEvent,
} from "@/lib/player-history";
import { loadLeaguePlayers } from "@/lib/cloud";
import { loadLeagueTrophies, type LeagueTrophy } from "@/lib/trophies";
import { getLeague } from "@/lib/league";
import type { Player } from "@/lib/types";

function MuseumInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("player");

  const [players, setPlayers] = useState<Player[]>([]);
  const [trophies, setTrophies] = useState<LeagueTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [tab, setTab] = useState<"timeline" | "records" | "history">(
    "timeline"
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        setLeagueName(getLeague()?.name || "");
        const [plist, tlist] = await Promise.all([
          loadLeaguePlayers(),
          loadLeagueTrophies(),
        ]);
        if (cancelled) return;
        setPlayers(plist);
        setTrophies(tlist);
      } catch {
        if (!cancelled) {
          setPlayers([]);
          setTrophies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = useMemo(
    () =>
      buildMuseumTimeline({
        players,
        trophies,
        focusPlayerId: focusId,
      }),
    [players, trophies, focusId]
  );

  const records = useMemo(() => buildLeagueRecords(players), [players]);
  const history = useMemo(() => buildLeagueHistory(trophies), [trophies]);
  const focusName = focusId
    ? players.find((p) => p.id === focusId)?.name
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Living history
          </p>
          <h1 className="text-2xl font-black mt-1">War Room Museum</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed max-w-xl">
            Not just stats — the story of this room. Trophies, streaks, and
            milestones that make next August feel continuous with this one.
          </p>
          {focusName && (
            <p className="mt-2 text-xs text-primary font-medium">
              Showing timeline for {focusName}.{" "}
              <Link href="/museum" className="underline">
                Show full room
              </Link>
            </p>
          )}
        </div>

        <ChampionshipBanner trophies={trophies} leagueName={leagueName} />

        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["timeline", "Timeline"],
              ["records", "League records"],
              ["history", "Season history"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-black"
                  : "px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-sm text-muted py-12 text-center">
            Opening the archives…
          </p>
        )}

        {!loading && tab === "timeline" && (
          <Timeline events={timeline} />
        )}

        {!loading && tab === "records" && (
          <div className="space-y-3">
            {records.length === 0 ? (
              <Empty
                title="Records warm up after scored weeks"
                body="Play a few cards. Perfect weeks, streaks, and accuracy show up here."
              />
            ) : (
              records.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 flex gap-3"
                >
                  <span className="text-2xl shrink-0" aria-hidden>
                    {r.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                      {r.label}
                    </p>
                    <p className="font-semibold">
                      {r.userId ? (
                        <PlayerLink
                          id={r.userId}
                          name={r.name}
                          className="hover:text-primary"
                        />
                      ) : (
                        r.name
                      )}
                    </p>
                    <p className="text-amber-300 font-mono text-sm font-bold">
                      {r.stat}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{r.blurb}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && tab === "history" && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <Empty
                title="No seasons engraved yet"
                body="When the commissioner awards Championship, Toilet, and Village Nerd, years appear here forever."
              />
            ) : (
              history.map((h) => (
                <section
                  key={h.year}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <h2 className="font-bold text-lg mb-3">{h.year}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <HistCell
                      label="Champion"
                      emoji="🏆"
                      name={h.champion?.name}
                      userId={h.champion?.userId}
                    />
                    <HistCell
                      label="Toilet Bowl"
                      emoji="🚽"
                      name={h.toilet?.name}
                      userId={h.toilet?.userId}
                    />
                    <HistCell
                      label="Village Nerd"
                      emoji="🔮"
                      name={h.nerd?.name}
                      userId={h.nerd?.userId}
                    />
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        <p className="text-[11px] text-muted mt-10 text-center leading-relaxed">
          Museum v1 · feeds from trophies + live season. Season archive freeze
          will deepen multi-year memory next.
        </p>
      </main>
    </div>
  );
}

function Timeline({ events }: { events: MuseumEvent[] }) {
  if (!events.length) {
    return (
      <Empty
        title="Empty museum — for now"
        body="Score weeks, earn badges, engrave trophies. Your story starts filling in."
      />
    );
  }
  return (
    <ol className="relative border-l border-amber-400/40 ml-3 space-y-0">
      {events.map((e) => (
        <li key={e.id} className="ml-4 pb-8 relative">
          <span className="absolute -left-[1.4rem] top-1 w-6 h-6 rounded-full bg-card border border-amber-400/50 flex items-center justify-center text-xs">
            {e.emoji}
          </span>
          <p className="text-[10px] font-mono text-amber-300/90 font-bold">
            {e.year}
          </p>
          <p className="font-semibold text-foreground">{e.title}</p>
          <p className="text-sm text-muted">
            {e.userId ? (
              <PlayerLink
                id={e.userId}
                name={e.body}
                className="hover:text-primary"
              />
            ) : (
              e.body
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

function HistCell({
  label,
  emoji,
  name,
  userId,
}: {
  label: string;
  emoji: string;
  name?: string | null;
  userId?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">
        {emoji} {label}
      </p>
      {name ? (
        userId ? (
          <PlayerLink
            id={userId}
            name={name}
            className="font-semibold hover:text-primary"
          />
        ) : (
          <p className="font-semibold">{name}</p>
        )
      ) : (
        <p className="text-muted text-xs">—</p>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <p className="font-medium mb-1">{title}</p>
      <p className="text-sm text-muted max-w-md mx-auto">{body}</p>
    </div>
  );
}

export default function MuseumPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading museum…
        </div>
      }
    >
      <MuseumInner />
    </Suspense>
  );
}
