"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/league";
import {
  CFB_CFP_GAME_ORDER,
  cfpMatchups,
  loadCfbPostseasonSlate,
  loadMyCfbPostseasonEntry,
  sanitizeCfpPicks,
  saveMyCfbPostseasonEntry,
  type CfbPostseasonEntry,
  type CfbPostseasonSlate,
} from "@/lib/postseason/cfb-cloud";

type Tab = "bowls" | "cfp";

export default function CfbPostseasonPage() {
  const [slate, setSlate] = useState<CfbPostseasonSlate | null>(null);
  const [entry, setEntry] = useState<CfbPostseasonEntry | null>(null);
  const [tab, setTab] = useState<Tab>("bowls");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [cfpPicks, setCfpPicks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [canOperate, setCanOperate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCanOperate(!!getSession()?.isCommissioner);
    void Promise.all([loadCfbPostseasonSlate(), loadMyCfbPostseasonEntry()])
      .then(([nextSlate, nextEntry]) => {
        if (cancelled) return;
        setSlate(nextSlate);
        setEntry(nextEntry);
        setPicks(nextEntry?.bowlPicks || {});
        setAllocations(
          nextEntry?.bowlAllocations && Object.keys(nextEntry.bowlAllocations).length
            ? nextEntry.bowlAllocations
            : Object.fromEntries((nextSlate?.bowlGames || []).map((game) => [game.id, 4]))
        );
        setCfpPicks(nextEntry?.cfpPicks || {});
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load postseason."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const total = Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const pickedBowls = slate?.bowlGames.filter((game) => !!picks[game.id]).length || 0;
  const bowlReady = !!slate && slate.bowlGames.length === 25 && pickedBowls === 25 && total === 100 && slate.bowlGames.every((game) => Number.isInteger(allocations[game.id]) && allocations[game.id] >= 1);
  const cfpGames = useMemo(() => cfpMatchups(slate?.cfpSeeds || [], cfpPicks), [slate?.cfpSeeds, cfpPicks]);
  const cfpReady = CFB_CFP_GAME_ORDER.every((id) => !!cfpPicks[id]);
  const bowlLocked = !!entry?.bowlLockedAt;
  const cfpLocked = !!entry?.cfpLockedAt;

  function adjust(gameId: string, delta: number) {
    if (bowlLocked) return;
    setAllocations((current) => ({
      ...current,
      [gameId]: Math.max(1, (current[gameId] || 1) + delta),
    }));
  }

  function chooseCfp(gameId: string, team: string) {
    if (cfpLocked || team === "TBD" || !slate) return;
    setCfpPicks((current) => sanitizeCfpPicks(slate.cfpSeeds, { ...current, [gameId]: team }));
  }

  async function persist(lock: Tab | null) {
    if (!slate || busy) return;
    if (lock === "bowls" && !bowlReady) {
      setError("Pick all 25 bowls and allocate exactly 100 positive points.");
      return;
    }
    if (lock === "cfp" && !cfpReady) {
      setError("Complete all 11 CFP games before locking.");
      return;
    }
    if (lock && !window.confirm(`Lock your ${lock === "bowls" ? "Bowl Board" : "CFP bracket"}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await saveMyCfbPostseasonEntry({
      bowlPicks: picks,
      bowlAllocations: allocations,
      cfpPicks,
      lockBowl: lock === "bowls",
      lockCfp: lock === "cfp",
    });
    if (!result.ok) setError(result.error || "Save failed.");
    else {
      const refreshed = await loadMyCfbPostseasonEntry();
      setEntry(refreshed);
      setNotice(lock ? `${lock === "bowls" ? "Bowl Board" : "CFP bracket"} locked.` : "Postseason draft saved.");
    }
    setBusy(false);
  }

  if (loading) return <main className="mx-auto min-h-screen max-w-3xl p-6 text-sm text-muted">Opening postseason command…</main>;

  if (!slate) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">CFB postseason</p>
        <h1 className="mt-1 text-3xl font-black">Selection is not final</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">The commissioner has not published the 25-bowl board and 12-team CFP field yet. This page will open for every league member from the same cloud slate.</p>
        {canOperate && <Link href="/postseason-ops" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-amber-300 font-black text-black">Build Postseason Field</Link>}
        <Link href="/" className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-border font-bold">Return Home</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-3 py-6 sm:px-4">
      <header className="rounded-2xl border border-amber-300/35 bg-amber-300/5 p-4">
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">CFB Phase III · Cloud certified</p>
        <h1 className="mt-1 text-3xl font-black">Postseason Command</h1>
        <p className="mt-2 text-xs text-muted">Bowl bankroll and CFP bracket save to the league. Locked picks cannot be changed.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-bold">
          <Link href="/championship" className="rounded-xl border border-primary/35 p-2 text-primary">Championship</Link>
          <Link href="/toilet-bowl" className="rounded-xl border border-toilet/35 p-2 text-toilet">Toilet Bowl</Link>
        </div>
        {canOperate && <Link href="/postseason-ops" className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-amber-300 font-black text-black">Commissioner Postseason Ops</Link>}
      </header>

      <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="Postseason pick sections">
        <button type="button" onClick={() => setTab("bowls")} className={`min-h-12 rounded-xl border text-sm font-black ${tab === "bowls" ? "border-amber-300 bg-amber-300 text-black" : "border-border"}`}>Bowl Board {bowlLocked ? "✓" : ""}</button>
        <button type="button" onClick={() => setTab("cfp")} className={`min-h-12 rounded-xl border text-sm font-black ${tab === "cfp" ? "border-sky-300 bg-sky-300 text-sky-950" : "border-border"}`}>CFP Bracket {cfpLocked ? "✓" : ""}</button>
      </nav>

      {error && <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{notice}</p>}

      {tab === "bowls" && (
        <section className="mt-4 space-y-3">
          <div className="sticky top-2 z-20 grid grid-cols-3 gap-2 rounded-2xl border border-amber-300/45 bg-black/95 p-3 text-center backdrop-blur">
            <Metric label="Allocated" value={`${total}/100`} alert={total !== 100} />
            <Metric label="Picks" value={`${pickedBowls}/25`} alert={pickedBowls !== 25} />
            <Metric label="Status" value={bowlLocked ? "LOCKED" : "OPEN"} />
          </div>
          {slate.bowlGames.map((game, index) => (
            <article key={game.id} className={`rounded-2xl border p-3 ${game.tier === "sicko" ? "border-lime-300/30 bg-lime-950/10" : "border-amber-300/25 bg-card"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[8px] font-black uppercase tracking-wide text-muted">{game.tier === "sicko" ? `Sicko ${index - 14}` : `Marquee ${index + 1}`}</p><h2 className="text-sm font-black">{game.name}</h2></div>
                <div className="flex items-center gap-1"><button type="button" disabled={bowlLocked || allocations[game.id] <= 1} onClick={() => adjust(game.id, -1)} className="min-h-11 min-w-11 rounded-lg border border-border text-xl disabled:opacity-30">−</button><strong className="min-w-8 text-center text-xl">{allocations[game.id] || 1}</strong><button type="button" disabled={bowlLocked || total >= 100} onClick={() => adjust(game.id, 1)} className="min-h-11 min-w-11 rounded-lg border border-border text-xl disabled:opacity-30">+</button></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">{[game.away, game.home].map((team) => <button key={team} type="button" disabled={bowlLocked} onClick={() => setPicks((current) => ({ ...current, [game.id]: team }))} className={`min-h-12 rounded-xl border px-2 text-left text-[11px] font-bold disabled:opacity-80 ${picks[game.id] === team ? "border-primary bg-primary text-black" : "border-border"}`}>{team}</button>)}</div>
            </article>
          ))}
          <SaveBar busy={busy} locked={bowlLocked} ready={bowlReady} onSave={() => void persist(null)} onLock={() => void persist("bowls")} label="Bowl Board" />
          {entry?.bowlScore != null && <Score label="Bowl score" value={entry.bowlScore} />}
        </section>
      )}

      {tab === "cfp" && (
        <section className="mt-4 space-y-4">
          {(["First Round", "Quarterfinals", "Semifinals", "National Championship"] as const).map((round, roundIndex) => {
            const ids = roundIndex === 0 ? CFB_CFP_GAME_ORDER.slice(0, 4) : roundIndex === 1 ? CFB_CFP_GAME_ORDER.slice(4, 8) : roundIndex === 2 ? CFB_CFP_GAME_ORDER.slice(8, 10) : CFB_CFP_GAME_ORDER.slice(10);
            return <div key={round}><h2 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-sky-300">{round}</h2><div className="grid gap-3 sm:grid-cols-2">{ids.map((id) => <article key={id} className="overflow-hidden rounded-xl border border-sky-300/25 bg-card">{cfpGames[id].map((team) => <button key={team} type="button" disabled={cfpLocked || team === "TBD"} onClick={() => chooseCfp(id, team)} className={`block min-h-12 w-full border-b border-border px-3 text-left text-xs font-bold last:border-0 disabled:opacity-35 ${cfpPicks[id] === team ? "bg-sky-300 text-sky-950" : ""}`}>{team}</button>)}</article>)}</div></div>;
          })}
          <SaveBar busy={busy} locked={cfpLocked} ready={cfpReady} onSave={() => void persist(null)} onLock={() => void persist("cfp")} label="CFP Bracket" />
          {entry?.cfpScore != null && <Score label="CFP score" value={entry.cfpScore} />}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`rounded-xl border p-2 ${alert ? "border-amber-300/50 text-amber-200" : "border-border"}`}><strong className="block text-base">{value}</strong><span className="text-[8px] uppercase tracking-wide text-muted">{label}</span></div>;
}

function SaveBar({ busy, locked, ready, onSave, onLock, label }: { busy: boolean; locked: boolean; ready: boolean; onSave: () => void; onLock: () => void; label: string }) {
  if (locked) return <p className="rounded-xl border border-primary/35 bg-primary/10 p-3 text-center text-sm font-black text-primary">{label} locked</p>;
  return <div className="sticky bottom-3 z-20 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-black/95 p-3 backdrop-blur"><button type="button" disabled={busy} onClick={onSave} className="min-h-12 rounded-xl border border-border text-sm font-bold disabled:opacity-40">Save Draft</button><button type="button" disabled={busy || !ready} onClick={onLock} className="min-h-12 rounded-xl bg-primary text-sm font-black text-black disabled:opacity-35">Lock {label}</button></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-primary/35 bg-primary/10 p-5 text-center"><p className="text-[9px] font-black uppercase tracking-wide text-primary">{label}</p><strong className="mt-1 block text-5xl">{value}</strong></div>;
}
