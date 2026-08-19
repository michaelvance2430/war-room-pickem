"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BracketView from "@/components/BracketView";
import SportChampionshipTrophy from "@/components/SportChampionshipTrophy";
import { getChampionshipTrophyDesign } from "@/lib/championship-trophy-catalog";
import { advanceBracketFromCfpWeeks, buildBracket, type Bracket } from "@/lib/brackets";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getLeague, getSession } from "@/lib/league";
import {
  listBracketScoredWeekNumbers,
  loadFrozenPostseasonSnapshot,
} from "@/lib/postseason/cloud";
import type { Player } from "@/lib/types";

type Competition = "championship" | "toilet";

export default function PostseasonBracketScreen({
  competition,
}: {
  competition: Competition;
}) {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [field, setField] = useState<Player[]>([]);
  const [frozenAt, setFrozenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selfId = getSession()?.playerId || null;
  const league = getLeague();
  const isNfl = league?.sportId === "nfl";
  const isChampionship = competition === "championship";
  const championshipTrophyId = league?.settings?.championshipTrophyId || "command_cup";
  const championshipTrophy = getChampionshipTrophyDesign(championshipTrophyId, league?.sportId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [snapshot, players, scored] = await Promise.all([
          loadFrozenPostseasonSnapshot(),
          loadLeaguePlayers(`PostseasonBracketScreen.${competition}`),
          listBracketScoredWeekNumbers(),
        ]);
        if (cancelled) return;
        if (!snapshot) {
          setError("The postseason field has not been frozen yet.");
          return;
        }
        const byId = new Map(players.map((player) => [player.id, player]));
        const seeded = snapshot.participants
          .filter((participant) => participant.field === competition)
          .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
          .map((participant) => byId.get(participant.userId))
          .filter((player): player is Player => !!player);
        setField(seeded);
        setFrozenAt(snapshot.frozenAt);
        if (seeded.length >= 2) {
          setBracket(
            advanceBracketFromCfpWeeks(
              buildBracket(competition, seeded),
              scored,
              getLeague()?.sportId
            )
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load the bracket.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition]);

  const title = isChampionship ? "Championship" : "Toilet Bowl";
  const accent = isChampionship ? "primary" : "toilet";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isChampionship ? "text-primary" : "text-toilet"}`}>
            Frozen postseason authority
          </p>
          <h1 className="mt-1 text-3xl font-black">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {isNfl
              ? "Seeds lock after Week 18. Weekly playoff scores advance each matchup."
              : "Seeds lock after Conference Championships. Weekly postseason scores advance each matchup."}
          </p>
        </div>
        <Link href="/standings" className="min-h-11 rounded-xl border border-border px-4 py-3 text-sm font-bold">
          Standings
        </Link>
      </div>

      {isChampionship && (
        <section className="mt-6 grid items-center gap-4 rounded-2xl border border-amber-300/30 bg-[radial-gradient(circle_at_top,rgba(251,191,36,.13),transparent_62%)] p-4 sm:grid-cols-[170px_1fr]">
          <div className="flex justify-center">
            <SportChampionshipTrophy
              sport={league?.sportId || "cfb"}
              size={140}
              trophyDesignId={championshipTrophyId}
              animate
            />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">The object at the middle</p>
            <h2 className="mt-1 text-2xl font-black">{championshipTrophy.name}</h2>
            <p className="mt-1 text-xs font-bold text-amber-100">{championshipTrophy.short}</p>
            <p className="mt-3 text-sm italic text-muted">“{championshipTrophy.inscription}”</p>
          </div>
        </section>
      )}

      {loading && <p className="mt-8 text-sm text-muted">Loading the frozen field…</p>}
      {error && (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-6">
          <p className="font-bold">Bracket unavailable</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
        </section>
      )}
      {!loading && !error && field.length < 2 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <p className="font-bold">No contested {title} field</p>
          <p className="mt-1 text-sm text-muted">
            This league did not have enough eligible players at the cut to run this bracket.
          </p>
        </section>
      )}
      {bracket && (
        <section className="mt-7 rounded-2xl border border-border bg-card/70 p-3 sm:p-5">
          <BracketView bracket={bracket} accent={accent} selfId={selfId} />
        </section>
      )}
      {!loading && !error && field.length > 0 && (
        <section className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wide">Locked field</h2>
            {frozenAt && (
              <span className="text-[10px] text-muted">
                Frozen {new Date(frozenAt).toLocaleString()}
              </span>
            )}
          </div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {field.map((player, index) => (
              <li key={player.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <span className="mr-2 font-black text-muted">{index + 1}</span>
                <span className={player.id === selfId ? "font-black text-primary" : "font-bold"}>
                  {player.name}{player.id === selfId ? " · You" : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
