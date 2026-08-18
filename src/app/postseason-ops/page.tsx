"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/league";
import {
  CFB_CFP_GAME_ORDER,
  cfpMatchups,
  loadCfbPostseasonResults,
  loadCfbPostseasonSlate,
  publishCfbPostseasonSlate,
  saveCfbPostseasonResults,
  type CfbPostseasonBowlGame,
  type CfbPostseasonSlate,
} from "@/lib/postseason/cfb-cloud";

type View = "field" | "results";

function blankBowls(): CfbPostseasonBowlGame[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `bowl-${String(index + 1).padStart(2, "0")}`,
    name: "",
    tier: index < 15 ? "marquee" : "sicko",
    rank: index + 1,
    away: "",
    home: "",
  }));
}

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

export default function PostseasonOpsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("field");
  const [slate, setSlate] = useState<CfbPostseasonSlate | null>(null);
  const [bowls, setBowls] = useState<CfbPostseasonBowlGame[]>(blankBowls);
  const [seeds, setSeeds] = useState<string[]>(Array(12).fill(""));
  const [bowlResults, setBowlResults] = useState<Record<string, string>>({});
  const [cfpResults, setCfpResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const allowed = !!getSession()?.isCommissioner;
    setAuthorized(allowed);
    if (!allowed) return;
    void Promise.all([loadCfbPostseasonSlate(), loadCfbPostseasonResults()])
      .then(([nextSlate, nextResults]) => {
        setSlate(nextSlate);
        if (nextSlate) {
          setBowls(nextSlate.bowlGames);
          setSeeds(nextSlate.cfpSeeds);
        }
        setBowlResults(nextResults.bowlResults);
        setCfpResults(nextResults.cfpResults);
      })
      .catch((cause) => setError(errorText(cause)));
  }, []);

  const fieldReady = bowls.length === 25
    && bowls.every((game) => game.name.trim() && game.away.trim() && game.home.trim() && game.away.trim() !== game.home.trim())
    && new Set(bowls.map((game) => game.id)).size === 25
    && seeds.length === 12
    && seeds.every((team) => team.trim())
    && new Set(seeds.map((team) => team.trim().toLowerCase())).size === 12;
  const cfpGames = useMemo(() => cfpMatchups(seeds, cfpResults), [seeds, cfpResults]);

  function updateBowl(index: number, field: "name" | "away" | "home", value: string) {
    setBowls((current) => current.map((game, gameIndex) => gameIndex === index ? { ...game, [field]: value } : game));
  }

  async function publishField() {
    if (!fieldReady || busy) return;
    const warning = slate
      ? "Replace the published postseason field? This is allowed only before any player has started an entry."
      : "Publish this 25-bowl board and 12-team CFP field to every league member?";
    if (!window.confirm(warning)) return;
    setBusy(true); setError(null); setNotice(null);
    const result = await publishCfbPostseasonSlate({
      bowlGames: bowls.map((game, index) => ({ ...game, name: game.name.trim(), away: game.away.trim(), home: game.home.trim(), rank: index + 1 })),
      cfpSeeds: seeds.map((team) => team.trim()),
    });
    if (!result.ok) setError(result.error || "Could not publish the field.");
    else {
      setSlate(await loadCfbPostseasonSlate());
      setNotice("The postseason field is live for the league.");
    }
    setBusy(false);
  }

  async function recordWinner(kind: "bowl" | "cfp", gameId: string, team: string) {
    if (busy) return;
    const label = kind === "bowl" ? bowls.find((game) => game.id === gameId)?.name : gameId.toUpperCase();
    if (!window.confirm(`Record ${team} as the winner of ${label}? Recorded winners cannot be changed.`)) return;
    const nextBowls = kind === "bowl" ? { ...bowlResults, [gameId]: team } : bowlResults;
    const nextCfp = kind === "cfp" ? { ...cfpResults, [gameId]: team } : cfpResults;
    setBusy(true); setError(null); setNotice(null);
    const result = await saveCfbPostseasonResults({ bowlResults: nextBowls, cfpResults: nextCfp });
    if (!result.ok) setError(result.error || "Could not record the winner.");
    else {
      setBowlResults(nextBowls); setCfpResults(nextCfp);
      setNotice(`${team} recorded. League postseason scores were recalculated.`);
    }
    setBusy(false);
  }

  if (authorized === null) return <main className="mx-auto min-h-screen max-w-xl p-6 text-sm text-muted">Opening postseason operations…</main>;
  if (!authorized) return <main className="mx-auto min-h-screen max-w-xl p-6"><h1 className="text-2xl font-black">Commissioner only</h1><p className="mt-2 text-sm text-muted">Postseason field and result controls are restricted to the league commissioner.</p><Link href="/postseason" className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-border font-bold">Open Postseason</Link></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-4">
      <header className="rounded-2xl border border-amber-300/35 bg-amber-300/5 p-4">
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">Commissioner · CFB postseason</p>
        <h1 className="mt-1 text-3xl font-black">Postseason Operations</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">Publish one shared field, then record final winners. Every recorded result is permanent and automatically rescales league entries.</p>
        <Link href="/postseason" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-xs font-bold">View player postseason</Link>
      </header>

      <nav className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setView("field")} className={`min-h-12 rounded-xl border text-sm font-black ${view === "field" ? "border-amber-300 bg-amber-300 text-black" : "border-border"}`}>1 · Publish Field</button>
        <button type="button" onClick={() => setView("results")} disabled={!slate} className={`min-h-12 rounded-xl border text-sm font-black disabled:opacity-30 ${view === "results" ? "border-primary bg-primary text-black" : "border-border"}`}>2 · Record Results</button>
      </nav>
      {error && <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{notice}</p>}

      {view === "field" && <section className="mt-4 space-y-5">
        {slate && <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-xs text-amber-100">A field is already published. The database will reject replacement after any player begins an entry or any result is recorded.</p>}
        <div><h2 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-amber-300">25 Bowl Games</h2><div className="space-y-3">{bowls.map((game, index) => <article key={game.id} className="rounded-2xl border border-border bg-card p-3"><p className="mb-2 text-[9px] font-black uppercase tracking-wide text-muted">{index < 15 ? `Marquee ${index + 1}` : `Sicko ${index - 14}`}</p><input value={game.name} onChange={(event) => updateBowl(index, "name", event.target.value)} placeholder="Bowl name" className="min-h-11 w-full rounded-xl border border-border bg-black/25 px-3 text-sm font-bold"/><div className="mt-2 grid grid-cols-2 gap-2"><input value={game.away} onChange={(event) => updateBowl(index, "away", event.target.value)} placeholder="Away team" className="min-h-11 rounded-xl border border-border bg-black/25 px-3 text-xs"/><input value={game.home} onChange={(event) => updateBowl(index, "home", event.target.value)} placeholder="Home team" className="min-h-11 rounded-xl border border-border bg-black/25 px-3 text-xs"/></div></article>)}</div></div>
        <div><h2 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-sky-300">12-Team CFP Seeds</h2><div className="grid gap-2 sm:grid-cols-2">{seeds.map((team, index) => <label key={index} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3"><strong className="w-6 text-center text-sky-300">{index + 1}</strong><input value={team} onChange={(event) => setSeeds((current) => current.map((value, seedIndex) => seedIndex === index ? event.target.value : value))} placeholder={`Seed ${index + 1}`} className="min-h-10 flex-1 bg-transparent text-sm outline-none"/></label>)}</div></div>
        <button type="button" disabled={busy || !fieldReady} onClick={() => void publishField()} className="sticky bottom-3 min-h-14 w-full rounded-2xl bg-amber-300 text-sm font-black text-black disabled:opacity-35">{slate ? "Replace Published Field" : "Publish Postseason Field"}</button>
      </section>}

      {view === "results" && slate && <section className="mt-4 space-y-6">
        <div><h2 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-amber-300">Bowl Winners · {Object.keys(bowlResults).length}/25</h2><div className="space-y-3">{bowls.map((game) => <ResultCard key={game.id} title={game.name} teams={[game.away, game.home]} winner={bowlResults[game.id]} busy={busy} onChoose={(team) => void recordWinner("bowl", game.id, team)}/>)}</div></div>
        <div><h2 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-sky-300">CFP Winners · {Object.keys(cfpResults).length}/11</h2><div className="space-y-3">{CFB_CFP_GAME_ORDER.map((gameId) => <ResultCard key={gameId} title={gameId.toUpperCase()} teams={[...cfpGames[gameId]]} winner={cfpResults[gameId]} busy={busy} onChoose={(team) => void recordWinner("cfp", gameId, team)}/>)}</div></div>
      </section>}
    </main>
  );
}

function ResultCard({ title, teams, winner, busy, onChoose }: { title: string; teams: string[]; winner?: string; busy: boolean; onChoose: (team: string) => void }) {
  return <article className="rounded-2xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black">{title}</h3>{winner && <span className="rounded-full bg-primary/15 px-2 py-1 text-[9px] font-black text-primary">FINAL</span>}</div><div className="mt-2 grid grid-cols-2 gap-2">{teams.map((team) => <button key={team} type="button" disabled={busy || !!winner || team === "TBD"} onClick={() => onChoose(team)} className={`min-h-12 rounded-xl border px-2 text-left text-xs font-bold disabled:opacity-40 ${winner === team ? "border-primary bg-primary text-black opacity-100" : "border-border"}`}>{team}</button>)}</div></article>;
}
