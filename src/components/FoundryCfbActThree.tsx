"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCfbBowlBoard,
  cfbSickoGameIds,
  validateCfbBowlAllocation,
  type CfbBowlAllocation,
  type CfbBowlCandidate,
} from "@/lib/postseason/cfb-act-three";

type Fixture = CfbBowlCandidate & { away: string; home: string };
type Stage = "board" | "locked" | "results" | "cfp";
type SavedLab = {
  stage: Stage;
  allocations: CfbBowlAllocation;
  picks: Record<string, string>;
};

const STORAGE_KEY = "warroom-foundry-cfb-act-three-v1";
const MARQUEE_NAMES = [
  "Citrus Bowl", "Alamo Bowl", "Music City Bowl", "Gator Bowl", "Texas Bowl",
  "ReliaQuest Bowl", "Las Vegas Bowl", "Sun Bowl", "Pop-Tarts Bowl", "Holiday Bowl",
  "Liberty Bowl", "Duke's Mayo Bowl", "Pinstripe Bowl", "Independence Bowl", "Armed Forces Bowl",
];
const SICKO_NAMES = [
  "68 Ventures Bowl", "Salute to Veterans Bowl", "Cure Bowl", "Myrtle Beach Bowl", "Frisco Bowl",
  "Famous Idaho Potato Bowl", "New Orleans Bowl", "New Mexico Bowl", "Birmingham Bowl", "First Responder Bowl",
];
const SCHOOL_PAIRS = [
  ["North Georgia", "Great Lakes State"], ["Coastal Tech", "Heartland A&M"],
  ["Blue Ridge", "Western Plains"], ["Metro State", "Gulf Coast"],
  ["Piedmont", "Desert Valley"], ["Lake City", "Central Commonwealth"],
  ["Atlantic Tech", "Prairie State"], ["River Valley", "Mountain A&M"],
  ["Capital University", "Southern Tech"], ["Iron City", "Pacific State"],
  ["Eastern Plains", "North Coast"], ["Magnolia State", "Frontier Tech"],
  ["Appalachian Tech", "Bayou State"], ["Midland", "Coastal A&M"],
  ["Red River", "Great Basin"], ["Delta Tech", "Lakeshore"],
  ["Pine State", "Sun Coast"], ["Western Commonwealth", "Port City"],
  ["Canyon State", "Tidewater Tech"], ["Ozark A&M", "North Valley"],
  ["Eastern Shore", "High Plains"], ["Gulf Tech", "Mountain State"],
  ["Central Lakes", "Lowcountry A&M"], ["Prairie Tech", "Coastal State"],
  ["Valley Forge", "Southern Plains"],
] as const;

const FIXTURES: Fixture[] = [...MARQUEE_NAMES, ...SICKO_NAMES].map((name, index) => ({
  id: `${index < 15 ? "marquee" : "sicko"}-${String((index % 15) + 1).padStart(2, "0")}`,
  name,
  tier: index < 15 ? "marquee" : "sicko",
  rank: index < 15 ? index + 1 : index - 14,
  hostsCfpGame: false,
  away: SCHOOL_PAIRS[index][0],
  home: SCHOOL_PAIRS[index][1],
}));

const BOARD = buildCfbBowlBoard(FIXTURES);
const BY_ID = new Map(FIXTURES.map((game) => [game.id, game]));
const DEFAULT_ALLOCATIONS = Object.fromEntries(BOARD.games.map((game) => [game.id, 4]));
const DEFAULT_PICKS = Object.fromEntries(BOARD.games.map((game) => [game.id, BY_ID.get(game.id)!.away]));

function defaultLab(): SavedLab {
  return { stage: "board", allocations: DEFAULT_ALLOCATIONS, picks: DEFAULT_PICKS };
}

export default function FoundryCfbActThree() {
  const [lab, setLab] = useState<SavedLab>(defaultLab);
  const [hydrated, setHydrated] = useState(false);
  const [tier, setTier] = useState<"marquee" | "sicko">("marquee");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as SavedLab | null;
      if (parsed?.allocations && parsed?.picks && ["board", "locked", "results", "cfp"].includes(parsed.stage)) {
        setLab(parsed);
      }
    } catch { /* isolated preview resets safely */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lab));
  }, [hydrated, lab]);

  const total = BOARD.games.reduce((sum, game) => sum + (lab.allocations[game.id] || 0), 0);
  const remaining = 100 - total;
  const errors = validateCfbBowlAllocation(BOARD, lab.allocations);
  const visible = tier === "marquee" ? BOARD.marquee : BOARD.sicko;
  const results = useMemo(() => Object.fromEntries(BOARD.games.map((game, index) => {
    const fixture = BY_ID.get(game.id)!;
    return [game.id, index % 3 === 0 ? fixture.home : fixture.away];
  })), []);
  const correctIds = BOARD.games.filter((game) => lab.picks[game.id] === results[game.id]).map((game) => game.id);
  const score = correctIds.reduce((sum, id) => sum + (lab.allocations[id] || 0), 0);
  const sickoIds = new Set(cfbSickoGameIds(BOARD));
  const sickoCorrect = correctIds.filter((id) => sickoIds.has(id)).length;

  function adjust(id: string, delta: number) {
    if (lab.stage !== "board") return;
    setLab((current) => ({
      ...current,
      allocations: { ...current.allocations, [id]: Math.max(1, (current.allocations[id] || 1) + delta) },
    }));
  }
  function choose(id: string, team: string) {
    if (lab.stage !== "board") return;
    setLab((current) => ({ ...current, picks: { ...current.picks, [id]: team } }));
  }
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setLab(defaultLab());
    setTier("marquee");
  }

  if (!hydrated) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">Opening the Bowl Board…</p>;

  if (lab.stage === "cfp") return <CfpHandoff onBack={() => setLab((current) => ({ ...current, stage: "results" }))} onReset={reset} />;

  return <section className="space-y-4" aria-label="Foundry CFB Bowl Mania">
    <header className="rounded-2xl border border-amber-300/40 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.18),transparent_45%)] p-4">
      <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">CFB Act III · Foundry only · no cloud writes</p>
      <h3 className="mt-1 text-2xl font-black">Bowl Mania</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">Fifteen bowls you want to pick. Ten bowls you have no business knowing. Put all 100 points on the board.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Allocated" value={String(total)} />
        <Metric label="Remaining" value={String(remaining)} alert={remaining !== 0} />
        <Metric label="Games" value="25" />
      </div>
    </header>

    {lab.stage === "results" ? <Results score={score} sickoCorrect={sickoCorrect} onCfp={() => setLab((current) => ({ ...current, stage: "cfp" }))} onReset={reset} /> : <>
      <nav className="grid grid-cols-2 gap-2" aria-label="Bowl Board sections">
        <button type="button" onClick={() => setTier("marquee")} className={`min-h-12 rounded-xl border text-xs font-black ${tier === "marquee" ? "border-amber-300 bg-amber-300 text-black" : "border-border bg-card"}`}>THE MARQUEE 15</button>
        <button type="button" onClick={() => setTier("sicko")} className={`min-h-12 rounded-xl border text-xs font-black ${tier === "sicko" ? "border-lime-300 bg-lime-300 text-black" : "border-border bg-card"}`}>THE SICKO 10</button>
      </nav>
      <div className="space-y-3">{visible.map((game, index) => {
        const fixture = BY_ID.get(game.id)!;
        const locked = lab.stage === "locked";
        return <article key={game.id} className={`rounded-2xl border p-3 ${tier === "sicko" ? "border-lime-300/25 bg-lime-950/10" : "border-amber-300/25 bg-card"}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className={`text-[8px] font-black uppercase tracking-[.16em] ${tier === "sicko" ? "text-lime-300" : "text-amber-300"}`}>{tier === "sicko" ? `Sicko file ${index + 1}` : `Marquee ${index + 1}`}</p><h4 className="truncate text-sm font-black">{game.name}</h4></div><div className="flex shrink-0 items-center gap-1"><button type="button" disabled={locked || lab.allocations[game.id] <= 1} onClick={() => adjust(game.id, -1)} className="min-h-11 min-w-11 rounded-lg border border-border text-lg font-black disabled:opacity-30" aria-label={`Remove one point from ${game.name}`}>−</button><strong className="min-w-9 text-center text-xl">{lab.allocations[game.id]}</strong><button type="button" disabled={locked || remaining <= 0} onClick={() => adjust(game.id, 1)} className="min-h-11 min-w-11 rounded-lg border border-border text-lg font-black disabled:opacity-30" aria-label={`Add one point to ${game.name}`}>+</button></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{[fixture.away, fixture.home].map((team) => <button key={team} type="button" disabled={locked} onClick={() => choose(game.id, team)} className={`min-h-12 rounded-xl border px-2 text-left text-[11px] font-bold disabled:opacity-80 ${lab.picks[game.id] === team ? "border-primary bg-primary text-black" : "border-border"}`}>{team}</button>)}</div>
        </article>;
      })}</div>
      <div className="sticky bottom-3 z-20 rounded-2xl border border-amber-300/50 bg-black/95 p-3 shadow-2xl backdrop-blur">
        {errors.length > 0 && lab.stage === "board" ? <p className="mb-2 text-[10px] font-bold text-amber-200">{remaining > 0 ? `${remaining} points still need orders.` : remaining < 0 ? `${Math.abs(remaining)} points over budget.` : errors[0]}</p> : <p className="mb-2 text-[10px] font-bold text-emerald-300">All 100 points assigned. Bowl Board ready.</p>}
        {lab.stage === "board" ? <button type="button" disabled={errors.length > 0} onClick={() => setLab((current) => ({ ...current, stage: "locked" }))} className="min-h-12 w-full rounded-xl bg-amber-300 text-sm font-black text-black disabled:opacity-35">Lock Bowl Board</button> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setLab((current) => ({ ...current, stage: "board" }))} className="min-h-12 rounded-xl border border-border text-xs font-bold">Unlock Preview</button><button type="button" onClick={() => setLab((current) => ({ ...current, stage: "results" }))} className="min-h-12 rounded-xl bg-emerald-300 text-xs font-black text-emerald-950">Sim Bowl Results</button></div>}
      </div>
    </>}
  </section>;
}

function Results({ score, sickoCorrect, onCfp, onReset }: { score: number; sickoCorrect: number; onCfp: () => void; onReset: () => void }) {
  const standings = [
    { name: "Kahmann", correct: Math.min(10, sickoCorrect + 2) },
    { name: "Mike V", correct: sickoCorrect },
    { name: "Maria", correct: Math.max(0, sickoCorrect - 1) },
    { name: "Big Balls Ben", correct: Math.max(0, sickoCorrect - 2) },
  ].sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
  return <div className="space-y-4"><section className="rounded-2xl border border-emerald-300/35 bg-emerald-950/15 p-5 text-center"><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-300">Bowl Board final</p><strong className="mt-2 block text-5xl">{score}</strong><span className="text-xs text-muted">bankroll points won</span></section><section className="overflow-hidden rounded-2xl border border-lime-300/35"><div className="bg-lime-300 p-3 text-black"><p className="text-[9px] font-black uppercase tracking-[.18em]">The Sicko 10</p><h4 className="text-xl font-black">Certified Sicko Watch</h4></div>{standings.map((player, index) => <div key={player.name} className="flex items-center justify-between border-t border-border bg-card px-4 py-3 text-sm"><span><strong className="mr-3">{index + 1}</strong>{player.name}</span><strong>{player.correct}/10</strong></div>)}<p className="border-t border-lime-300/20 bg-lime-950/15 p-3 text-[10px] italic text-lime-200">You knew way too much about these teams.</p></section><button type="button" onClick={onCfp} className="min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Advance to the CFP →</button><button type="button" onClick={onReset} className="min-h-11 w-full rounded-xl border border-border text-xs font-bold">Reset Bowl Mania Lab</button></div>;
}

function CfpHandoff({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const seeds = Array.from({ length: 12 }, (_, index) => `Seed ${index + 1}`);
  return <section className="space-y-4" aria-label="Foundry CFP handoff"><header className="rounded-2xl border border-sky-300/40 bg-[radial-gradient(circle_at_top,#0c4a6e,transparent_60%)] p-5"><p className="text-[9px] font-black uppercase tracking-[.2em] text-sky-300">Separate scoring · same Act III</p><h3 className="mt-1 text-2xl font-black">Road Through the CFP</h3><p className="mt-2 text-xs text-muted">The Bowl Bankroll is closed. Now fill the fixed 12-team, 11-game playoff bracket. No reseeding.</p></header><div className="grid grid-cols-2 gap-3"><section className="rounded-2xl border border-border bg-card p-3"><p className="text-[9px] font-black uppercase text-muted">First-round byes</p>{seeds.slice(0, 4).map((seed) => <p key={seed} className="mt-2 rounded-lg bg-sky-300/10 px-3 py-2 text-xs font-bold">{seed}</p>)}</section><section className="rounded-2xl border border-border bg-card p-3"><p className="text-[9px] font-black uppercase text-muted">Campus games</p>{["5 vs 12", "6 vs 11", "7 vs 10", "8 vs 9"].map((game) => <p key={game} className="mt-2 rounded-lg bg-amber-300/10 px-3 py-2 text-xs font-bold">{game}</p>)}</section></div><section className="rounded-2xl border border-primary/30 bg-card p-4"><p className="text-[9px] font-black uppercase text-primary">Crystal Ball receipt</p><h4 className="mt-1 font-black">Your Week 0 champion stays on the wall.</h4><p className="mt-2 text-xs text-muted">The preseason prophecy remains visible beside the playoff bracket until the national champion is decided.</p></section><p className="rounded-xl border border-dashed border-border p-3 text-center text-[10px] text-muted">Interactive CFP bracket is the next Foundry increment. This handoff proves Bowl Mania and the CFP remain separate games.</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onBack} className="min-h-12 rounded-xl border border-border text-xs font-bold">← Sicko Results</button><button type="button" onClick={onReset} className="min-h-12 rounded-xl border border-red-400/30 text-xs font-bold text-red-200">Reset Lab</button></div></section>;
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`rounded-xl border p-2 text-center ${alert ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-black/25"}`}><strong className="block text-xl">{value}</strong><span className="text-[8px] font-black uppercase tracking-wide text-muted">{label}</span></div>;
}
