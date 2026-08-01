"use client";

/**
 * The Board — fantasy-football style league pick reveal.
 * Card freezes at first kickoff; each game's picks reveal only when *that*
 * game starts (like not knowing someone's QB until their kickoff).
 * Views: By game · Full cards
 */

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import PlayerLink from "@/components/PlayerLink";
import {
  loadWeekCard,
  loadWeekResultsFromCloud,
  loadLeagueWeekBoard,
  listPublishedWeekNumbers,
  listScoredWeekNumbers,
  loadLeagueActiveWeek,
  type WeekBoardSlip,
  type CloudCard,
} from "@/lib/cloud";
import { scoreWeek, type GameResult } from "@/lib/scoring";
import {
  weekTitle,
  formatKickoff,
  isCardLockDeadlinePassed,
  firstKickoffOnCardMs,
  isGamePickRevealed,
} from "@/lib/dates";
import { getSession } from "@/lib/league";
import { formatRankedTeam } from "@/lib/rankings";
import type { Game } from "@/lib/types";
import { formatLastSeen, isRecentlyActive } from "@/lib/last-seen";

type ViewMode = "games" | "cards";

function shortTeam(name: string, rank?: number | null) {
  const full = formatRankedTeam(name, rank);
  const bare = full.replace(/^#\d+\s*/, "");
  return bare.split(" ").pop() || bare;
}

function BoardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const weekParam = searchParams.get("week");

  const [week, setWeek] = useState(1);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [card, setCard] = useState<CloudCard | null>(null);
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [propResult, setPropResult] = useState<string | null>(null);
  const [slips, setSlips] = useState<WeekBoardSlip[]>([]);
  const [scored, setScored] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("games");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (w: number) => {
    setLoading(true);
    setError(null);
    setSelfId(getSession()?.playerId || null);
    try {
      const [pub, scoredList, active] = await Promise.all([
        listPublishedWeekNumbers(),
        listScoredWeekNumbers(),
        loadLeagueActiveWeek(),
      ]);
      const all = [...new Set([...pub, ...scoredList, active])].sort(
        (a, b) => a - b
      );
      setWeeks(all);
      setScoredWeeks(scoredList);

      let target = w;
      if (!all.includes(target)) {
        // Prefer active week (live slate) then last scored
        target = all.includes(active)
          ? active
          : scoredList[scoredList.length - 1] ??
            all[all.length - 1] ??
            active;
      }
      setWeek(target);

      const [c, res, board] = await Promise.all([
        loadWeekCard(target),
        loadWeekResultsFromCloud(target),
        loadLeagueWeekBoard(target),
      ]);
      setCard(c);
      setResults(res?.results || {});
      setPropResult(res?.propResult ?? null);
      setScored(board.scored || scoredList.includes(target));
      setLockedOpen(board.lockedOpen || board.scored);
      if (!board.ok) {
        setSlips([]);
        setError(
          board.error ||
            "Board unlocks at first kickoff — when the card freezes, every slip opens."
        );
      } else {
        setSlips(board.slips);
        setError(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const w =
      weekParam != null && weekParam !== ""
        ? parseInt(weekParam, 10)
        : NaN;
    void load(Number.isNaN(w) ? -1 : w);
  }, [weekParam, load]);

  function goWeek(w: number) {
    router.replace(`/board?week=${w}`);
    void load(w);
  }

  const games = card?.games || [];
  const prop = card?.prop;
  const lockedNow =
    lockedOpen ||
    (games.length > 0 && isCardLockDeadlinePassed(games, now));
  const firstKick = firstKickoffOnCardMs(games);

  const lockedCount = slips.filter((s) => s.lockedAt).length;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            League pick reveal
          </p>
          <h1 className="text-2xl font-black mt-1">The Board</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Like fantasy football: you don&apos;t see who they took until{" "}
            <strong className="text-foreground font-medium">
              that game kicks off
            </strong>
            . Earlier games on the card stay hidden until their own kickoff.
          </p>
        </div>

        {/* Status banner */}
        {!loading && games.length > 0 && (
          <div
            className={`rounded-xl border px-4 py-3 mb-5 ${
              lockedNow
                ? "border-primary/40 bg-primary/10"
                : "border-border bg-card"
            }`}
          >
            {lockedNow ? (
              <>
                <p className="text-sm font-bold text-primary">
                  {scored
                    ? `${weekTitle(week)} scored · full reveal`
                    : `${weekTitle(week)} live · progressive reveal`}
                </p>
                <p className="text-xs text-muted mt-1">
                  {lockedCount} of {slips.length} locked · each matchup unlocks
                  at its own kickoff (not the whole card at once)
                  {scored ? " · scored weeks show green/red" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Picks still secret
                </p>
                <p className="text-xs text-muted mt-1">
                  Cards freeze at first kickoff
                  {firstKick
                    ? ` (${new Date(firstKick).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })})`
                    : ""}
                  . Then each game reveals when it starts — like fantasy.
                </p>
              </>
            )}
          </div>
        )}

        {weeks.length > 0 && (
          <div className="phone-h-scroll sm:flex-wrap sm:overflow-visible mb-4">
            {weeks.map((w) => {
              const isScored = scoredWeeks.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => goWeek(w)}
                  className={`px-3.5 py-2.5 min-h-[40px] rounded-full text-xs font-semibold transition touch-manipulation ${
                    w === week
                      ? "bg-primary text-black"
                      : isScored
                        ? "border border-primary/40 text-primary hover:bg-primary/10"
                        : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {weekTitle(w)}
                  {isScored ? " · done" : ""}
                </button>
              );
            })}
          </div>
        )}

        {lockedNow && !error && (
          <div className="flex rounded-xl border border-border p-1 mb-5 bg-card gap-1">
            <button
              type="button"
              onClick={() => setMode("games")}
              className={`flex-1 py-3 min-h-[48px] rounded-lg text-sm font-bold transition touch-manipulation ${
                mode === "games"
                  ? "bg-primary text-black"
                  : "text-muted hover:text-foreground"
              }`}
            >
              By game
            </button>
            <button
              type="button"
              onClick={() => setMode("cards")}
              className={`flex-1 py-3 min-h-[48px] rounded-lg text-sm font-bold transition touch-manipulation ${
                mode === "cards"
                  ? "bg-primary text-black"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Full cards
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6 text-sm">
          <Link
            href="/picks"
            className="text-primary font-semibold hover:underline min-h-[44px] inline-flex items-center"
          >
            ← My Picks
          </Link>
          <span className="text-muted">·</span>
          <Link
            href="/standings"
            className="text-muted hover:text-foreground hover:underline"
          >
            Standings
          </Link>
        </div>

        {loading && (
          <p className="text-sm text-muted py-12 text-center">
            Opening the board…
          </p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-4 mb-6">
            <p className="text-sm text-warning font-medium">{error}</p>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Until first kickoff, only you see your card (like fantasy before
              lock). Then The Board is the group chat fuel.
            </p>
            <p className="text-[11px] text-muted mt-2">
              Commish: if kickoff already hit but this still blocks, run{" "}
              <code className="text-foreground">
                supabase/picks-reveal-after-lock.sql
              </code>{" "}
              in Supabase.
            </p>
            <Link
              href="/picks"
              className="inline-block mt-3 text-sm text-primary font-semibold hover:underline"
            >
              Back to your card →
            </Link>
          </div>
        )}

        {!loading && !error && !games.length && (
          <p className="text-sm text-muted text-center py-8">
            No card for {weekTitle(week)}.
          </p>
        )}

        {!loading && !error && games.length > 0 && lockedNow && mode === "games" && (
          <ByGameView
            games={games}
            slips={slips}
            results={results}
            prop={prop}
            propResult={propResult}
            selfId={selfId}
            scored={scored}
          />
        )}

        {!loading && !error && games.length > 0 && lockedNow && mode === "cards" && (
          <FullCardsView
            games={games}
            slips={slips}
            results={results}
            prop={prop}
            propResult={propResult}
            selfId={selfId}
            scored={scored}
          />
        )}
      </main>
    </div>
  );
}

function ByGameView({
  games,
  slips,
  results,
  prop,
  propResult,
  selfId,
  scored,
}: {
  games: Game[];
  slips: WeekBoardSlip[];
  results: Record<string, GameResult>;
  prop: CloudCard["prop"] | undefined;
  propResult: string | null;
  selfId: string | null;
  scored: boolean;
}) {
  const now = Date.now();
  // Prop locks with first kickoff on the card — reveal then
  const propRevealed =
    scored || isCardLockDeadlinePassed(games, now);

  return (
    <div className="space-y-5">
      {games.map((g, i) => {
        const res = results[g.id];
        const revealed = isGamePickRevealed(g, now, { weekScored: scored });
        const awayPicks = revealed
          ? slips.filter((s) => s.picks[g.id]?.pick === "away")
          : [];
        const homePicks = revealed
          ? slips.filter((s) => s.picks[g.id]?.pick === "home")
          : [];
        const noPick = revealed
          ? slips.filter((s) => s.lockedAt && !s.picks[g.id])
          : [];
        const kick = formatKickoff(g.commenceTime || g.startTime);

        return (
          <section
            key={g.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border bg-background/50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                    Game {i + 1}
                    {!revealed
                      ? " · locked until kickoff"
                      : res?.winner
                        ? res.winner === "push"
                          ? " · Push"
                          : res.winner === "away"
                            ? " · Away covers"
                            : " · Home covers"
                        : " · picks open"}
                  </p>
                  <h2 className="font-bold text-base mt-0.5">
                    {formatRankedTeam(g.awayTeam, g.awayRank)} @{" "}
                    {formatRankedTeam(g.homeTeam, g.homeRank)}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {kick.full}
                    {g.spread != null && (
                      <>
                        {" "}
                        ·{" "}
                        {g.favorite === "home"
                          ? `${shortTeam(g.homeTeam)} ${g.spread}`
                          : `${shortTeam(g.awayTeam)} ${g.spread}`}
                      </>
                    )}
                  </p>
                </div>
                {revealed ? (
                  <div className="text-[11px] text-muted tabular-nums">
                    {awayPicks.length} away · {homePicks.length} home
                  </div>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted border border-border px-2 py-1 rounded-full">
                    🔒 Hidden
                  </span>
                )}
              </div>
            </div>

            {!revealed ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Like fantasy — lineup hidden
                </p>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                  You don&apos;t see who they took until this game starts.
                  Come back after{" "}
                  {kick.full || "kickoff"}.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <PickSide
                    label={shortTeam(g.awayTeam, g.awayRank)}
                    side="Away"
                    list={awayPicks}
                    gameId={g.id}
                    winner={res?.winner}
                    selfId={selfId}
                    scored={scored}
                  />
                  <PickSide
                    label={shortTeam(g.homeTeam, g.homeRank)}
                    side="Home"
                    list={homePicks}
                    gameId={g.id}
                    winner={res?.winner}
                    selfId={selfId}
                    scored={scored}
                  />
                </div>
                {noPick.length > 0 && (
                  <p className="px-4 py-2 text-[11px] text-muted border-t border-border">
                    No pick: {noPick.map((s) => s.name).join(", ")}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}

      {prop?.question && (
        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Prop
            {!propRevealed ? " · locks with first kickoff" : ""}
          </p>
          <p className="text-sm font-medium mt-1">{prop.question}</p>
          {propResult && (
            <p className="text-xs text-primary mt-1">Result: {propResult}</p>
          )}
          {!propRevealed ? (
            <p className="text-xs text-muted mt-3">
              🔒 Prop picks stay hidden until the first game on the card kicks
              off.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {prop.options.map((opt) => {
                const who = slips.filter((s) => s.propChoice === opt);
                const hit = propResult === opt;
                return (
                  <div
                    key={opt}
                    className={`rounded-lg border px-3 py-2 ${
                      propResult
                        ? hit
                          ? "border-primary/40 bg-primary/10"
                          : "border-border"
                        : "border-border"
                    }`}
                  >
                    <p className="text-xs font-bold">{opt}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {who.length
                        ? who.map((s) => s.name).join(", ")
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PickSide({
  label,
  side,
  list,
  gameId,
  winner,
  selfId,
  scored,
}: {
  label: string;
  side: "Away" | "Home";
  list: WeekBoardSlip[];
  gameId: string;
  winner?: "home" | "away" | "push" | null;
  selfId: string | null;
  scored: boolean;
}) {
  const sideKey = side === "Away" ? "away" : "home";
  const isWin = winner === sideKey;
  const isLoss = winner && winner !== "push" && winner !== sideKey;

  // Sort by confidence desc
  const sorted = useMemo(
    () =>
      [...list].sort((a, b) => {
        const ca = a.picks[gameId]?.confidence || 0;
        const cb = b.picks[gameId]?.confidence || 0;
        return cb - ca;
      }),
    [list, gameId]
  );

  return (
    <div className="p-3 min-h-[4rem]">
      <p
        className={`text-xs font-bold mb-2 ${
          scored && isWin
            ? "text-primary"
            : scored && isLoss
              ? "text-muted"
              : "text-foreground"
        }`}
      >
        {side}: {label}
        {scored && isWin ? " ✓" : ""}
      </p>
      {sorted.length === 0 ? (
        <p className="text-[11px] text-muted">Nobody</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((s) => {
            const pk = s.picks[gameId];
            const conf = pk?.confidence || 0;
            const bb = pk?.isBestBet || s.bestBetId === gameId;
            return (
              <li
                key={s.userId}
                className={`flex items-center justify-between gap-2 text-sm ${
                  s.userId === selfId ? "text-primary font-semibold" : ""
                }`}
              >
                <PlayerLink
                  id={s.userId}
                  name={s.name}
                  chaosFlames={!!s.isChaos}
                />
                <span className="text-xs font-mono tabular-nums shrink-0">
                  {conf}
                  {bb ? (
                    <span className="text-primary font-bold"> ×2</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FullCardsView({
  games,
  slips,
  results,
  prop,
  propResult,
  selfId,
  scored,
}: {
  games: Game[];
  slips: WeekBoardSlip[];
  results: Record<string, GameResult>;
  prop: CloudCard["prop"] | undefined;
  propResult: string | null;
  selfId: string | null;
  scored: boolean;
}) {
  const now = Date.now();
  const propRevealed =
    scored || isCardLockDeadlinePassed(games, now);

  return (
    <div className="space-y-4">
      {slips.map((s) => {
        const scoredSlip =
          scored && prop
            ? scoreWeek(
                s.picks,
                s.bestBetId,
                s.propChoice,
                games,
                results,
                prop,
                propResult,
                !!s.isChaos
              )
            : null;
        const pts =
          s.totalPoints != null ? s.totalPoints : scoredSlip?.totalPoints;
        const isSelf = s.userId === selfId;
        const chaosTag =
          s.isChaos && pts != null
            ? pts >= 28
              ? "CHAOS NUKE"
              : pts <= 6
                ? "CHAOS MELTDOWN"
                : "CHAOS"
            : s.isChaos
              ? "CHAOS"
              : null;

        return (
          <section
            key={s.userId}
            className={`rounded-xl border bg-card p-4 ${
              s.isChaos
                ? "border-orange-500/50 bg-orange-500/5"
                : isSelf
                  ? "border-primary/40 bg-primary/5"
                  : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <PlayerLink
                  id={s.userId}
                  name={s.name}
                  chaosFlames={!!s.isChaos}
                />
                {chaosTag && (
                  <span className="ml-2 text-[10px] text-orange-300 font-extrabold uppercase tracking-wide">
                    🔥 {chaosTag}
                  </span>
                )}
                {!s.lockedAt && (
                  <span className="ml-2 text-[10px] text-danger font-bold uppercase">
                    No lock
                  </span>
                )}
                {!s.isBot && (
                  <p
                    className={`text-[11px] mt-0.5 font-normal ${
                      isRecentlyActive(s.lastSeenAt)
                        ? "text-primary"
                        : "text-muted"
                    }`}
                    title={
                      s.lastSeenAt
                        ? `Last in: ${new Date(s.lastSeenAt).toLocaleString()}`
                        : "No last-seen yet"
                    }
                  >
                    Last in · {formatLastSeen(s.lastSeenAt)}
                  </p>
                )}
              </div>
              {pts != null && scored && (
                <span className="text-lg font-black tabular-nums text-primary">
                  {pts}
                  {s.isChaos ? (
                    <span className="text-[10px] text-orange-300 ml-1">2×</span>
                  ) : null}
                </span>
              )}
            </div>
            <ul className="space-y-1.5 text-sm">
              {games.map((g) => {
                const revealed =
                  isSelf ||
                  isGamePickRevealed(g, now, { weekScored: scored });
                const pk = s.picks[g.id];
                const res = results[g.id];
                const gs = scoredSlip?.gameScores.find(
                  (x) => x.gameId === g.id
                );
                if (!revealed) {
                  return (
                    <li key={g.id} className="text-muted text-xs">
                      {shortTeam(g.awayTeam)} @ {shortTeam(g.homeTeam)} —{" "}
                      <span className="font-semibold">🔒 until kickoff</span>
                    </li>
                  );
                }
                if (!pk) {
                  return (
                    <li key={g.id} className="text-muted text-xs">
                      {shortTeam(g.awayTeam)} @ {shortTeam(g.homeTeam)} — —
                    </li>
                  );
                }
                const sideLabel =
                  pk.pick === "away"
                    ? shortTeam(g.awayTeam, g.awayRank)
                    : shortTeam(g.homeTeam, g.homeRank);
                let tone = "text-foreground";
                if (gs) {
                  if (gs.pushed) tone = "text-muted";
                  else if (gs.correct) tone = "text-primary font-semibold";
                  else tone = "text-danger/90";
                }
                return (
                  <li key={g.id} className={tone}>
                    <span className="font-mono text-xs">{pk.confidence}</span>
                    {(pk.isBestBet || s.bestBetId === g.id) && (
                      <span className="text-primary text-xs font-bold">
                        {" "}
                        ×2
                      </span>
                    )}{" "}
                    {sideLabel}
                    {res?.winner && gs && !gs.pushed && (
                      <span className="text-[10px] ml-1 opacity-80">
                        {gs.correct ? `+${gs.points}` : "miss"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {propRevealed || isSelf ? (
              s.propChoice ? (
                <p className="text-xs mt-2 text-muted">
                  Prop:{" "}
                  <span
                    className={
                      propResult
                        ? s.propChoice === propResult
                          ? "text-primary font-semibold"
                          : "text-danger/80"
                        : "text-foreground"
                    }
                  >
                    {s.propChoice}
                  </span>
                </p>
              ) : null
            ) : (
              <p className="text-xs mt-2 text-muted">
                Prop: 🔒 until first kickoff
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading board…
        </div>
      }
    >
      <BoardInner />
    </Suspense>
  );
}
