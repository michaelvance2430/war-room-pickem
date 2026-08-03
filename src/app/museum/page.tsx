"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PlayerLink from "@/components/PlayerLink";
import ChampionshipBanner from "@/components/ChampionshipBanner";
import {
  buildLeagueHistory,
  buildLeagueRecords,
  buildMuseumTimeline,
  type MuseumEvent,
} from "@/lib/player-history";
import {
  loadLeaguePlayers,
  listScoredWeekNumbers,
  invalidateCloudWeekCaches,
} from "@/lib/cloud";
import { loadLeagueTrophies, type LeagueTrophy } from "@/lib/trophies";
import { getLeague, getSession, isCommissioner, isOps } from "@/lib/league";
import type { Player } from "@/lib/types";
import {
  mergePriorSeasonTrophies,
  PRIOR_SEASON_LABEL,
  seedPriorSeason2025Trophies,
} from "@/lib/prior-season-seed";
import { resolveLiveTrophyHolder } from "@/lib/trophy-share";
import LastSeasonHardwareWall from "@/components/LastSeasonHardwareWall";
import {
  completedChapterCount,
  crewFoundedLabel,
  ensureCrewForLeague,
  getChaptersForCrew,
  getCrewForLeague,
  isCrewStoryRevealed,
  sportChapterLabel,
} from "@/lib/crew";

function CrewMuseumStrip() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const league = getLeague();
    const session = getSession();
    if (league?.id) {
      ensureCrewForLeague({
        leagueId: league.id,
        leagueName: league.name || "War Room",
        sportId: league.sportId,
        createdBy: session?.playerId,
        foundedAt: league.createdAt,
      });
    }
    setReady(true);
  }, []);
  if (!ready) return null;
  const league = getLeague();
  if (!league?.id) return null;
  const session = getSession();
  const crew = getCrewForLeague(league.id);
  if (!crew) return null;
  const revealed = isCrewStoryRevealed(league.id, session?.playerId);
  const chapters = getChaptersForCrew(crew.id);
  const done = completedChapterCount(crew.id);

  if (!revealed) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Crew wing
        </p>
      <p className="text-sm text-muted mt-1 leading-relaxed">
          Shared marks and the full Crew timeline open after your first season
          finale. Until then — keep playing. Week 8 briefing explains multi-sport Crew loyalty.
        </p>
      <Link
          href="/crew"
          className="inline-block mt-2 text-xs font-bold text-primary"
        >
          Live foxhole + Crew page →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-400/35 bg-amber-400/5 px-4 py-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
        Crew wing
      </p>
      <p className="text-base font-black text-foreground">{crew.name}</p>
      <p className="text-xs text-muted">
        Founded {crewFoundedLabel(crew.foundedAt)} · {done} chapter
        {done === 1 ? "" : "s"} together
      </p>
      {chapters.slice(0, 3).map((ch) => (
        <p key={ch.id} className="text-xs text-foreground/80">
          {sportChapterLabel(ch.sportId)} {ch.year}
          {ch.status === "complete" && ch.championshipName
            ? ` · Champ ${ch.championshipName}`
            : ch.status === "active"
              ? " · live"
              : " · complete"}
        </p>
      ))}
      <p className="text-[11px] text-muted pt-1">
        Crew marks stay hidden until your Crew earns the first one.
      </p>
      <Link href="/crew" className="inline-block text-sm font-bold text-amber-200">
        Open Crew timeline →
      </Link>
      </div>
  );
}

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
  const [excelNote, setExcelNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sport = getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
      setLeagueName(getLeague()?.name || "");

      // Paint Excel / last-season hardware IMMEDIATELY so Museum never shows
      // "No championships engraved" + "Opening the archives…" with a blank wall.
      // Cloud + host seed refine in the background.
      const paintSeeds = (plist: Player[], tlist: LeagueTrophy[]) => {
        if (cancelled) return;
        setPlayers(plist);
        setTrophies(
          mergePriorSeasonTrophies(tlist, {
            players: plist,
            sportId: sport,
          })
        );
      };
      paintSeeds([], []);

      let plist: Player[] = [];
      let tlist: LeagueTrophy[] = [];
      try {
        // Fresh standings after season reset (avoid stale playersCache trial points)
        invalidateCloudWeekCaches(getLeague()?.id || undefined);
        const [p, t, scored] = await Promise.all([
          loadLeaguePlayers().catch(() => [] as Player[]),
          loadLeagueTrophies().catch(() => [] as LeagueTrophy[]),
          listScoredWeekNumbers().catch(() => [] as number[]),
        ]);
        // No scored weeks this season → strip live season stats so League records
        // stays empty after reset (last-season trophies still show on the wall).
        if (!scored.length) {
          plist = p.map((pl) => ({
            ...pl,
            totalPoints: 0,
            weeklyPoints: [],
            atsCorrect: 0,
            atsTotal: 0,
            currentStreak: 0,
            bestWeek: 0,
            worstWeek: 0,
            perfectWeeks: 0,
            bestBetHits: 0,
            bestBetTotal: 0,
            propHits: 0,
            propTotal: 0,
            weeksPlayed: 0,
          }));
        } else {
          plist = p;
        }
        tlist = t;
        paintSeeds(plist, tlist);
      } catch {
        paintSeeds([], []);
      }

      // Host seed never blocks first paint (was hanging archives + empty banner)
      if (isCommissioner() || isOps()) {
        try {
          const seeded = await seedPriorSeason2025Trophies();
          if (seeded.ok && !cancelled) {
            tlist = await loadLeagueTrophies().catch(() => tlist);
            paintSeeds(plist, tlist);
            setExcelNote(
              sport === "nfl"
                ? "Last season Super Bowl hardware on the wall."
                : `Last season ${PRIOR_SEASON_LABEL} hardware on the wall.`
            );
          } else if (!cancelled && !seeded.ok) {
            // Display merge already forced plaques; cloud engrave may need Trophy Room
            setExcelNote(
              "Showing last season on the wall (local). Commish can sync Trophy Room to engrave cloud."
            );
          }
        } catch {
          /* display merge already painted */
        }
      } else if (!cancelled) {
        setExcelNote(
          sport === "nfl"
            ? "Last season Super Bowl hardware is always on this wall."
            : `Last season ${PRIOR_SEASON_LABEL} Excel hardware is always on this wall.`
        );
      }

      if (!cancelled) setLoading(false);
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

  /** Roster-shaped list so Museum shows live names (Jstray, etc.). */
  const rosterHits = useMemo(
    () =>
      players.map((p) => ({
        userId: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl ?? null,
        isBot: !!p.isMock,
      })),
    [players]
  );

  function liveHolder(userId?: string | null, name?: string | null) {
    return resolveLiveTrophyHolder(rosterHits, userId, name);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Living history
          </p>
      <h1 className="text-2xl font-black mt-1">War Room Museum</h1>
      <p className="text-sm text-muted mt-2 leading-relaxed max-w-xl">
            Not just stats — the story of this room. Trophies, streaks, and
            milestones that make next August feel continuous with this one.
            Last season&apos;s big hardware stays on the wall forever (Excel
            plaques for CFB · Super Bowl for NFL). Names and photos follow live
            profiles.
          </p>
          {excelNote && (
            <p className="mt-2 text-xs text-primary font-medium">{excelNote}</p>
          )}
          {focusName && (
            <p className="mt-2 text-xs text-primary font-medium">
              Showing timeline for {focusName}.{" "}
              <Link href="/museum" className="underline">
                Show full room
              </Link>
      </p>
          )}
        </div>
      <LastSeasonHardwareWall
          plaques={trophies}
          rosterHits={rosterHits}
          sportId={getLeague()?.sportId}
        />

        {/* Crew story — full wall after first finale; quiet teaser before */}
        <CrewMuseumStrip />
      <ChampionshipBanner
          trophies={trophies}
          leagueName={leagueName}
          sportId={getLeague()?.sportId}
        />

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
          <Timeline events={timeline} rosterHits={rosterHits} />
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
      <h2 className="font-bold text-lg mb-3">
                    {h.year === 2025 ? `${h.year} · ${PRIOR_SEASON_LABEL} Excel` : h.year}
                  </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    {(() => {
                      const c = liveHolder(
                        h.champion?.userId,
                        h.champion?.name
                      );
                      const t = liveHolder(h.toilet?.userId, h.toilet?.name);
                      const n = liveHolder(h.nerd?.userId, h.nerd?.name);
                      return (
                        <>
                          <HistCell
                            label="Champion"
                            emoji="🏆"
                            name={h.champion ? c.name : null}
                            userId={c.userId || h.champion?.userId}
                          />
      <HistCell
                            label="Toilet Bowl"
                            emoji="🚽"
                            name={h.toilet ? t.name : null}
                            userId={t.userId || h.toilet?.userId}
                          />
                          <HistCell
                            label="Village Nerd"
                            emoji="🔮"
                            name={h.nerd ? n.name : null}
                            userId={n.userId || h.nerd?.userId}
                          />
                        </>
                      );
                    })()}
                  </div>
      </section>
              ))
            )}
          </div>
        )}

        <p className="text-[11px] text-muted mt-10 text-center leading-relaxed">
          Museum v1 · feeds trophies + live season. Hosts can import prior
          seasons from Trophy Room. Deeper multi-year archives still fill in.
        </p>
      </main>
    </div>
  );
}

function Timeline({
  events,
  rosterHits,
}: {
  events: MuseumEvent[];
  rosterHits: {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    isBot?: boolean;
  }[];
}) {
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
      {events.map((e) => {
        const live = resolveLiveTrophyHolder(
          rosterHits,
          e.userId,
          e.userName || e.body
        );
        const showName = e.kind === "trophy" ? live.name : e.body;
        const showId = live.userId || e.userId;
        return (
        <li key={e.id} className="ml-4 pb-8 relative">
      <span className="absolute -left-[1.4rem] top-1 w-6 h-6 rounded-full bg-card border border-amber-400/50 flex items-center justify-center text-xs">
            {e.emoji}
          </span>
      <p className="text-[10px] font-mono text-amber-300/90 font-bold">
            {e.year}
          </p>
      <p className="font-semibold text-foreground">{e.title}</p>
      <p className="text-sm text-muted">
            {showId ? (
              <PlayerLink
                id={showId}
                name={showName}
                className="hover:text-primary"
              />
            ) : (
              showName
            )}
          </p>
      </li>
        );
      })}
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
