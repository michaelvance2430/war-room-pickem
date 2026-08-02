"use client";

/**
 * Crew page — permanent friend group story.
 * Pre-finale: quiet "season in progress".
 * Post-finale: founded, chapters timeline, next-sport promise.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession, isCommissioner } from "@/lib/league";
import {
  completedChapterCount,
  crewFoundedLabel,
  crewIsDualSport,
  ensureCrewForLeague,
  EVENT_CREW,
  getChaptersForCrew,
  getCrewForLeague,
  isCrewStoryRevealed,
  nextLiveSportChapter,
  sportChapterLabel,
  type Crew,
  type CrewChapter,
} from "@/lib/crew";
import { getSportPack } from "@/lib/sports/registry";
import CrewLiveBoard from "@/components/CrewLiveBoard";
import { filterCrewCheevos } from "@/lib/crew-cheevos";
import { getPlayerBadges, withPermanentBadges } from "@/lib/badges";
import { withCreatorFlag } from "@/lib/creator";
import type { Player } from "@/lib/types";
import BadgeShelf from "@/components/BadgeShelf";

export default function CrewPage() {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [chapters, setChapters] = useState<CrewChapter[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [crewBadges, setCrewBadges] = useState<
    ReturnType<typeof getPlayerBadges>
  >([]);

  function refresh() {
    const league = getLeague();
    const session = getSession();
    if (!league?.id) {
      setCrew(null);
      return;
    }
    setLeagueName(league.name || "");
    const ensured = ensureCrewForLeague({
      leagueId: league.id,
      leagueName: league.name || "War Room",
      sportId: league.sportId,
      createdBy: session?.playerId,
      foundedAt: league.createdAt,
    });
    setCrew(ensured.crew);
    setChapters(getChaptersForCrew(ensured.crew.id));
    setRevealed(isCrewStoryRevealed(league.id, session?.playerId));
    // Self crew cheevos for shelf
    try {
      if (session?.playerId) {
        const me = withPermanentBadges(
          withCreatorFlag({
            id: session.playerId,
            name: session.playerName || "You",
            division: "North",
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
          } as Player)
        );
        setCrewBadges(filterCrewCheevos(getPlayerBadges(me)));
      }
    } catch {
      setCrewBadges([]);
    }
  }

  useEffect(() => {
    refresh();
    function onCrew() {
      refresh();
    }
    window.addEventListener(EVENT_CREW, onCrew);
    return () => window.removeEventListener(EVENT_CREW, onCrew);
  }, []);

  if (!getLeague()?.id) {
    return (
      <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-muted">Join a room first.</p>
      </main>
      </div>
    );
  }

  const count = crew ? completedChapterCount(crew.id) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-6">
        <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/90">
            Crew
          </p>
      <h1 className="text-2xl font-black text-foreground mt-1">
            {crew?.name || leagueName || "War Room"}
          </h1>
          {crew && (
            <p className="text-sm text-muted mt-1">
              Founded {crewFoundedLabel(crew.foundedAt)}
              {revealed
                ? ` · ${count} chapter${count === 1 ? "" : "s"} together`
                : " · season in progress"}
            </p>
          )}
        </div>

        <CrewLiveBoard />

        {crewBadges.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 mb-2">
              Your Crew marks
            </p>
            <BadgeShelf badges={crewBadges} />
          </section>
        )}

        {!revealed ? (
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground">
              Story unlocks when you finish
            </p>
      <p className="text-sm text-muted leading-relaxed">
              Keep playing. When the season finale fires and hardware is
              engraved, this page becomes your Crew timeline — same people, next
              sport as the next chapter. No homework until then.
            </p>
      <p className="text-xs text-muted leading-relaxed border-t border-border pt-3">
              Current chapter:{" "}
              <strong className="text-foreground">
                {sportChapterLabel(getLeague()?.sportId || "cfb")} ·{" "}
                {leagueName}
              </strong>
      </p>
            <Link
              href="/"
              className="inline-flex text-sm font-bold text-primary"
            >
              ← Back to Home
            </Link>
      </section>
        ) : (
          <>
            <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                Permanent
              </p>
      <p className="text-sm text-foreground/90 leading-relaxed">
                Leagues end. Crews don&apos;t. Each sport you finish together is
                another chapter — CFB, NFL, whatever&apos;s next. Not a restart.
              </p>
      </section>

            <section className="space-y-3">
      <h2 className="text-sm font-bold text-foreground">Timeline</h2>
              {chapters.length === 0 ? (
                <p className="text-sm text-muted">No chapters yet.</p>
              ) : (
                <ul className="space-y-2">
                  {chapters.map((ch, i) => (
                    <li
                      key={ch.id}
                      className="rounded-xl border border-border bg-card px-4 py-3"
                    >
      <div className="flex items-start justify-between gap-2">
                        <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                            Chapter{" "}
                            {chapters.filter((c) => c.status === "complete")
                              .length > 0 && ch.status === "complete"
                              ? chapters
                                  .filter((c) => c.status === "complete")
                                  .findIndex((c) => c.id === ch.id) + 1 ||
                                chapters.length - i
                              : "·"}{" "}
                            · {sportChapterLabel(ch.sportId)} {ch.year}
                          </p>
      <p className="text-sm font-semibold text-foreground mt-0.5">
                            {ch.leagueName}
                          </p>
                          {ch.status === "complete" ? (
                            <div className="text-xs text-muted mt-1 space-y-0.5">
                              {ch.championshipName && (
                                <p>Champ · {ch.championshipName}</p>
                              )}
                              {ch.toiletName && (
                                <p>Toilet · {ch.toiletName}</p>
                              )}
                              {!ch.championshipName && !ch.toiletName && (
                                <p>Chapter complete</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-primary mt-1 font-medium">
                              In progress
                            </p>
                          )}
                        </div>
      <span
                          className={`text-[10px] font-bold uppercase shrink-0 px-2 py-0.5 rounded-full border ${
                            ch.status === "complete"
                              ? "border-amber-400/40 text-amber-200"
                              : "border-primary/40 text-primary"
                          }`}
                        >
                          {ch.status === "complete" ? "Done" : "Live"}
                        </span>
      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(() => {
              if (!crew) return null;
              const dual = crewIsDualSport(crew.id);
              const next = nextLiveSportChapter(
                crew.id,
                getLeague()?.sportId
              );
              if (dual) {
                return (
                  <section className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      Dual desk
                    </p>
      <p className="text-sm text-foreground/90 leading-relaxed">
                      This Crew already runs <strong>CFB</strong> and{" "}
                      <strong>NFL</strong> chapters. Switch rooms from Home —
                      same friends, two desks.
                    </p>
      </section>
                );
              }
              if (!next) return null;
              const pack = getSportPack(next);
              return (
                <section className="rounded-xl border border-amber-400/35 bg-amber-400/5 px-4 py-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                    Next chapter · not a new group
                  </p>
      <p className="text-sm text-foreground leading-relaxed">
                    Same people, different sport. When you&apos;re ready for{" "}
                    <strong>{pack.shortLabel || pack.label}</strong>, open it
                    as the next chapter of{" "}
                    <strong>{crew.name}</strong> — not a brand-new universe.
                  </p>
                  {isCommissioner() ? (
                    <Link
                      href="/commissioner?tab=settings"
                      className="inline-flex text-sm font-bold text-amber-200"
                    >
                      Commish · ask the room / sport pool →
                    </Link>
                  ) : (
                    <p className="text-xs text-muted">
                      Nudge your commish when the group wants {pack.shortLabel}.
                    </p>
                  )}
                </section>
              );
            })()}

            <section className="rounded-xl border border-border bg-card/50 px-4 py-3">
      <p className="text-xs text-muted leading-relaxed">
                Crew marks (achievements) stay hidden until your Crew earns the
                first one. No grind list. No nagging. Just receipts when
                something true happens.
              </p>
      </section>

            <div className="flex flex-wrap gap-3 text-sm">
      <Link href="/museum" className="font-bold text-primary">
                Museum →
              </Link>
      <Link href="/trophy-room" className="font-semibold text-muted">
                Trophy Room
              </Link>
      <Link href="/" className="font-semibold text-muted">
                Home
              </Link>
      </div>
          </>
        )}
      </main>
      </div>
  );
}
