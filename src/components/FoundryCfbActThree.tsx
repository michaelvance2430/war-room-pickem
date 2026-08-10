"use client";

import { useEffect, useMemo, useState } from "react";
import SportChampionshipTrophy from "@/components/SportChampionshipTrophy";
import { getChampionshipTrophyDesign } from "@/lib/championship-trophy-catalog";
import { getLeague } from "@/lib/league";
import WarRoomArsenalIcon from "@/components/WarRoomArsenalIcon";
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
  actEntered?: boolean;
  nuclear?: { active: boolean; reviewStartedAt: number; acknowledged: boolean };
};

// v2 intentionally clears the old preview that could reopen directly at CFP.
const STORAGE_KEY = "warroom-foundry-cfb-act-three-v3";
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
const DEFAULT_PICKS: Record<string, string> = {};

function defaultLab(): SavedLab {
  return { stage: "board", allocations: DEFAULT_ALLOCATIONS, picks: DEFAULT_PICKS };
}

export default function FoundryCfbActThree({ seasonWeek = 16, postseasonWeek = 13 }: { seasonWeek?: number; postseasonWeek?: number }) {
  const [lab, setLab] = useState<SavedLab>(defaultLab);
  const [hydrated, setHydrated] = useState(false);
  const [tier, setTier] = useState<"marquee" | "sicko">("marquee");
  const [nuclearWarning, setNuclearWarning] = useState(false);
  const [nuclearJolt, setNuclearJolt] = useState({ x: 0, y: 0, r: 0 });
  const [reviewedTiers, setReviewedTiers] = useState<Set<string>>(new Set());

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
  useEffect(() => {
    if (lab.nuclear?.active || lab.stage !== "board") return;
    const timer = window.setInterval(() => setNuclearJolt({ x: Math.round(Math.random() * 12 - 6), y: Math.round(Math.random() * 8 - 4), r: Math.round(Math.random() * 6 - 3) }), 620);
    return () => window.clearInterval(timer);
  }, [lab.nuclear?.active, lab.stage]);

  const total = BOARD.games.reduce((sum, game) => sum + (lab.allocations[game.id] || 0), 0);
  const remaining = 100 - total;
  const errors = validateCfbBowlAllocation(BOARD, lab.allocations);
  const pickedCount = BOARD.games.filter((game) => !!lab.picks[game.id]).length;
  const visible = tier === "marquee" ? BOARD.marquee : BOARD.sicko;
  const results = useMemo(() => Object.fromEntries(BOARD.games.map((game, index) => {
    const fixture = BY_ID.get(game.id)!;
    return [game.id, index % 3 === 0 ? fixture.home : fixture.away];
  })), []);
  const correctIds = BOARD.games.filter((game) => lab.picks[game.id] === results[game.id]).map((game) => game.id);
  const score = correctIds.reduce((sum, id) => sum + (lab.allocations[id] || 0), 0);
  const finalScore = lab.nuclear?.active ? Math.round(score >= 60 ? score * 1.5 : score * 0.5) : score;
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
  function moveTier(next: "marquee" | "sicko") {
    setTier(next);
    if (lab.nuclear?.active) setReviewedTiers((current) => new Set([...current, next]));
    window.requestAnimationFrame(() => document.getElementById("bowl-tier-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function detonate() {
    const allocations: Record<string, number> = {};
    const picks: Record<string, string> = {};
    let remainingPoints = 100;
    BOARD.games.forEach((game, index) => {
      const fixture = BY_ID.get(game.id)!;
      const seed = [...game.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) + Date.now();
      picks[game.id] = seed % 2 === 0 ? fixture.away : fixture.home;
      const gamesLeft = BOARD.games.length - index;
      const points = gamesLeft === 1 ? remainingPoints : Math.max(1, Math.min(9, 1 + (seed % Math.max(1, Math.min(9, remainingPoints - (gamesLeft - 1))))));
      allocations[game.id] = points;
      remainingPoints -= points;
    });
    setTier("marquee");
    setReviewedTiers(new Set(["marquee"]));
    setNuclearWarning(false);
    setLab({ stage: "locked", allocations, picks, nuclear: { active: true, reviewStartedAt: Date.now(), acknowledged: false } });
  }
  async function shareNuclearBoard() {
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080); gradient.addColorStop(0, "#2b0303"); gradient.addColorStop(1, "#030101"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 8; ctx.strokeRect(28, 28, 1024, 1024); ctx.textAlign = "center"; ctx.fillStyle = "#fb923c"; ctx.font = "900 70px system-ui"; ctx.fillText("DEAD HAND PROTOCOL", 540, 105);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 34px system-ui"; ctx.fillText("THE MACHINE HAS IDENTIFIED SOMETHING IN BOISE", 540, 157);
    ctx.textAlign = "left"; ctx.font = "700 23px system-ui";
    BOARD.games.forEach((game, index) => { const col = index < 13 ? 0 : 1; const row = index < 13 ? index : index - 13; const x = 70 + col * 510; const y = 220 + row * 58; ctx.fillStyle = game.tier === "sicko" ? "#fb923c" : "#ef4444"; ctx.fillText(`${lab.allocations[game.id]} PTS`, x, y); ctx.fillStyle = "#fff"; ctx.fillText(`${lab.picks[game.id]} · ${game.name}`.slice(0, 39), x + 85, y); });
    ctx.textAlign = "center"; ctx.fillStyle = "#94a3b8"; ctx.font = "700 24px system-ui"; ctx.fillText("NO EDITS · NO APPEALS · FURTHER QUESTIONS DISCOURAGED", 540, 1020);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) return;
    const file = new File([blob], "war-room-dead-hand-board.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "My Dead Hand Bowl Board", text: "I removed myself from the chain of command. The machine has identified something in Boise." });
    else { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url); }
  }
  function reset() {
    setLab({ ...defaultLab(), actEntered: lab.actEntered });
    setTier("marquee");
  }

  if (!hydrated) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">Opening the Bowl Board…</p>;

  if (seasonWeek < postseasonWeek) return <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,.12),transparent_52%),linear-gradient(180deg,#07111f,#020617)] px-5 py-12 text-center"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-sky-300 to-transparent"/><p className="text-[10px] font-black uppercase tracking-[.28em] text-sky-300">Act II · Regular Season</p><h3 className="mt-4 text-3xl font-black">THE DOORS ARE STILL LOCKED</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">Standings are moving. Conference races are alive. Bowl Mania and the CFP do not exist yet.</p><div className="mx-auto mt-7 max-w-xs rounded-2xl border border-white/10 bg-black/35 p-4"><p className="text-[9px] font-black uppercase tracking-[.18em] text-muted">Act III opens</p><strong className="mt-1 block text-xl">Conference Championship Week</strong><p className="mt-1 text-xs text-sky-200">{postseasonWeek - seasonWeek} week{postseasonWeek - seasonWeek === 1 ? "" : "s"} away</p></div><p className="mt-6 text-[10px] italic text-white/40">No fake results. No premature buttons. The postseason earns its entrance.</p></section>;

  if (!lab.actEntered) return <section className="relative overflow-hidden rounded-3xl border-2 border-amber-300/45 bg-[radial-gradient(circle_at_center,rgba(251,191,36,.22),transparent_58%),linear-gradient(180deg,#1c1304,#030712)] px-5 py-12 text-center shadow-[0_0_70px_rgba(251,191,36,.12)]"><div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-500 via-amber-300 to-sky-400"/><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">Conference Championships</p><h3 className="mt-4 text-4xl font-black leading-none">THE REGULAR<br/>SEASON IS OVER</h3><p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-amber-100/70">The standings have spoken. The arguments have not. Twenty-five bowls, twelve playoff teams, and one piece of commissioner-selected hardware are waiting behind this door.</p><div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-amber-300/30"/><span className="text-xl">✦</span><span className="h-px flex-1 bg-amber-300/30"/></div><button type="button" onClick={() => setLab((current) => ({ ...current, actEntered: true }))} className="min-h-14 w-full rounded-2xl bg-amber-300 text-base font-black text-black shadow-[0_0_30px_rgba(251,191,36,.3)]">ENTER ACT III →</button></section>;

  if (lab.stage === "cfp") return <CfpHandoff onReset={reset} />;

  return <section className="space-y-4" aria-label="Foundry CFB Bowl Mania">
    <header className="rounded-2xl border border-amber-300/40 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.18),transparent_45%)] p-4">
      <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">CFB Act III · Foundry only · no cloud writes</p>
      <h3 className="mt-1 text-2xl font-black">Bowl Mania</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">Fifteen bowls you want to pick. Ten bowls you have no business knowing. Put all 100 points on the board.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Allocated" value={String(total)} />
        <Metric label="Remaining" value={String(remaining)} alert={remaining !== 0} />
        <Metric label="Picks" value={`${pickedCount}/25`} alert={pickedCount !== 25} />
      </div>
    </header>

    {lab.stage === "results" ? <Results score={finalScore} rawScore={score} deadHand={!!lab.nuclear?.active} sickoCorrect={sickoCorrect} onCfp={() => setLab((current) => ({ ...current, stage: "cfp" }))} onReset={reset} /> : <>
      <nav id="bowl-tier-top" className="scroll-mt-4 grid grid-cols-2 gap-2" aria-label="Bowl Board sections">
        <button type="button" onClick={() => moveTier("marquee")} className={`min-h-12 rounded-xl border text-xs font-black ${tier === "marquee" ? "border-amber-300 bg-amber-300 text-black" : "border-border bg-card"}`}>THE MARQUEE 15</button>
        <button type="button" onClick={() => moveTier("sicko")} className={`min-h-12 rounded-xl border text-xs font-black ${tier === "sicko" ? "border-lime-300 bg-lime-300 text-black" : "border-border bg-card"}`}>THE SICKO 10</button>
      </nav>
      {lab.stage === "board" && <button type="button" onClick={() => setNuclearWarning(true)} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-red-500 bg-[repeating-linear-gradient(135deg,#240303_0,#240303_12px,#050505_12px,#050505_24px)] px-4 text-sm font-black text-red-100 shadow-[0_0_34px_rgba(239,68,68,.42)] transition-transform duration-300" style={{ transform: `translate(${nuclearJolt.x}px,${nuclearJolt.y}px) rotate(${nuclearJolt.r}deg)` }}><WarRoomArsenalIcon kind="dead_hand" size={48}/>INITIATE DEAD HAND</button>}
      {lab.nuclear?.active && <section className="rounded-2xl border-2 border-red-500/70 bg-red-950/30 p-4 text-center shadow-[0_0_30px_rgba(239,68,68,.18)]"><p className="text-[9px] font-black uppercase tracking-[.22em] text-red-300">Critical system override · irreversible</p><h4 className="mt-1 text-xl font-black">THE MACHINE HAS IDENTIFIED SOMETHING IN BOISE.</h4><p className="mt-2 text-xs text-muted">Review both files. There are no edits, appeals, or commissioner overrides.</p><button type="button" onClick={() => void shareNuclearBoard()} className="mt-3 min-h-12 w-full rounded-xl border border-red-400/60 text-xs font-black text-red-200">SHARE THE EVIDENCE ↗</button></section>}
      <div className="space-y-3">{visible.map((game, index) => {
        const fixture = BY_ID.get(game.id)!;
        const locked = lab.stage === "locked";
        return <article key={game.id} className={`rounded-2xl border p-3 ${tier === "sicko" ? "border-lime-300/25 bg-lime-950/10" : "border-amber-300/25 bg-card"}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className={`text-[8px] font-black uppercase tracking-[.16em] ${tier === "sicko" ? "text-lime-300" : "text-amber-300"}`}>{tier === "sicko" ? `Sicko file ${index + 1}` : `Marquee ${index + 1}`}</p><h4 className="truncate text-sm font-black">{game.name}</h4></div><div className="flex shrink-0 items-center gap-1"><button type="button" disabled={locked || lab.allocations[game.id] <= 1} onClick={() => adjust(game.id, -1)} className="min-h-11 min-w-11 rounded-lg border border-border text-lg font-black disabled:opacity-30" aria-label={`Remove one point from ${game.name}`}>−</button><strong className="min-w-9 text-center text-xl">{lab.allocations[game.id]}</strong><button type="button" disabled={locked || remaining <= 0} onClick={() => adjust(game.id, 1)} className="min-h-11 min-w-11 rounded-lg border border-border text-lg font-black disabled:opacity-30" aria-label={`Add one point to ${game.name}`}>+</button></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{[fixture.away, fixture.home].map((team) => <button key={team} type="button" disabled={locked} onClick={() => choose(game.id, team)} className={`min-h-12 rounded-xl border px-2 text-left text-[11px] font-bold disabled:opacity-80 ${lab.picks[game.id] === team ? "border-primary bg-primary text-black" : "border-border"}`}>{team}</button>)}</div>
        </article>;
      })}</div>
      <div className="grid grid-cols-2 gap-2" aria-label="Continue through Bowl Board">
        {tier === "marquee" ? <button type="button" onClick={() => moveTier("sicko")} className="col-span-2 min-h-14 rounded-2xl bg-lime-300 text-sm font-black text-lime-950 shadow-[0_0_24px_rgba(190,242,100,.18)]">NEXT: THE SICKO 10 →</button> : <><button type="button" onClick={() => moveTier("marquee")} className="min-h-12 rounded-xl border border-amber-300/35 text-xs font-black text-amber-200">← MARQUEE 15</button><div className="flex min-h-12 items-center justify-center rounded-xl border border-lime-300/25 bg-lime-300/10 px-2 text-center text-[9px] font-black text-lime-200">SICKO FILES COMPLETE · {pickedCount}/25 TOTAL</div></>}
      </div>
      <div className="sticky bottom-3 z-20 rounded-2xl border border-amber-300/50 bg-black/95 p-3 shadow-2xl backdrop-blur">
        {errors.length > 0 && lab.stage === "board" ? <p className="mb-2 text-[10px] font-bold text-amber-200">{remaining > 0 ? `${remaining} points still need orders.` : remaining < 0 ? `${Math.abs(remaining)} points over budget.` : errors[0]}</p> : <p className="mb-2 text-[10px] font-bold text-emerald-300">All 100 points assigned. Bowl Board ready.</p>}
        {lab.stage === "board" ? <button type="button" disabled={errors.length > 0 || pickedCount !== 25} onClick={() => setLab((current) => ({ ...current, stage: "locked" }))} className="min-h-12 w-full rounded-xl bg-amber-300 text-sm font-black text-black disabled:opacity-35">{pickedCount !== 25 ? `Pick ${25 - pickedCount} More Bowl${25 - pickedCount === 1 ? "" : "s"}` : "Lock Bowl Board"}</button> : lab.nuclear?.active ? (!lab.nuclear.acknowledged ? <button type="button" disabled={!reviewedTiers.has("marquee") || !reviewedTiers.has("sicko")} onClick={() => setLab((current) => ({ ...current, nuclear: current.nuclear ? { ...current.nuclear, acknowledged: true } : undefined }))} className="min-h-12 w-full rounded-xl bg-red-600 text-xs font-black text-white disabled:opacity-35">{reviewedTiers.has("marquee") && reviewedTiers.has("sicko") ? "I HAVE SEEN THE DAMAGE" : "REVIEW MARQUEE + SICKO FILES"}</button> : <button type="button" onClick={() => setLab((current) => ({ ...current, stage: "results" }))} className="min-h-12 w-full rounded-xl bg-red-600 text-xs font-black text-white">Sim Dead Hand Fallout</button>) : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setLab((current) => ({ ...current, stage: "board" }))} className="min-h-12 rounded-xl border border-border text-xs font-bold">Unlock Preview</button><button type="button" onClick={() => setLab((current) => ({ ...current, stage: "results" }))} className="min-h-12 rounded-xl bg-emerald-300 text-xs font-black text-emerald-950">Sim Bowl Results</button></div>}
      </div>
      {nuclearWarning && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-red-950/90 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true"><section className="w-full max-w-md rounded-3xl border-2 border-red-500 bg-[repeating-linear-gradient(135deg,#220303_0,#220303_16px,#050505_16px,#050505_32px)] p-5 text-center shadow-[0_0_90px_rgba(239,68,68,.5)]"><p className="text-5xl">☢️</p><p className="mt-3 text-[10px] font-black uppercase tracking-[.24em] text-red-300">Critical system override</p><h3 className="mt-2 text-2xl font-black">THIS IS NOT YOUR UNCLE&apos;S NUCLEAR BUTTON</h3><p className="mt-3 text-sm leading-relaxed text-white/70">Tactical Nukes reward conviction. Dead Hand removes you from the chain of command. The machine chooses all 25 winners, spends all 100 points, and locks the board permanently.</p><p className="mt-3 text-xs font-black text-orange-300">60+ RAW: 1.5× DAMAGE · BELOW 60: SCORE CUT IN HALF</p><p className="mt-2 text-xs font-black text-red-300">HISTORY DOES NOT HAVE AN UNDO BUTTON.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setNuclearWarning(false)} className="min-h-12 rounded-xl border border-white/25 text-xs font-bold">Retain free will</button><button type="button" onClick={detonate} className="min-h-12 rounded-xl bg-red-600 text-xs font-black text-white shadow-[0_0_25px_rgba(239,68,68,.5)]">REMOVE ME FROM COMMAND</button></div></section></div>}
    </>}
  </section>;
}

function Results({ score, rawScore, deadHand, sickoCorrect, onCfp, onReset }: { score: number; rawScore: number; deadHand: boolean; sickoCorrect: number; onCfp: () => void; onReset: () => void }) {
  const standings = [
    { name: "Kahmann", correct: Math.min(10, sickoCorrect + 2) },
    { name: "Mike V", correct: sickoCorrect },
    { name: "Maria", correct: Math.max(0, sickoCorrect - 1) },
    { name: "Big Balls Ben", correct: Math.max(0, sickoCorrect - 2) },
  ].sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));
  return <div className="space-y-4"><section className="rounded-2xl border border-emerald-300/35 bg-emerald-950/15 p-5 text-center"><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-300">Bowl Board final</p><strong className="mt-2 block text-5xl">{score}</strong><span className="text-xs text-muted">bankroll points won</span></section><section className="overflow-hidden rounded-2xl border border-lime-300/35"><div className="bg-lime-300 p-3 text-black"><p className="text-[9px] font-black uppercase tracking-[.18em]">The Sicko 10</p><h4 className="text-xl font-black">Certified Sicko Watch</h4></div>{standings.map((player, index) => <div key={player.name} className="flex items-center justify-between border-t border-border bg-card px-4 py-3 text-sm"><span><strong className="mr-3">{index + 1}</strong>{player.name}</span><strong>{player.correct}/10</strong></div>)}<p className="border-t border-lime-300/20 bg-lime-950/15 p-3 text-[10px] italic text-lime-200">You knew way too much about these teams.</p></section><button type="button" onClick={onCfp} className="min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Advance to the CFP →</button><button type="button" onClick={onReset} className="min-h-11 w-full rounded-xl border border-border text-xs font-bold">Reset Bowl Mania Lab</button></div>;
}

function CfpHandoff({ onReset }: { onReset: () => void }) {
  const seeds = Array.from({ length: 12 }, (_, index) => `Seed ${index + 1}`);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"picking" | "locked" | "results">("picking");
  const trophyId = getLeague()?.settings?.championshipTrophyId || "command_cup";
  const trophy = getChampionshipTrophyDesign(trophyId);
  const winner = (id: string) => picks[id] || "TBD";
  const games = {
    r1a: [seeds[4], seeds[11]], r1b: [seeds[7], seeds[8]], r1c: [seeds[6], seeds[9]], r1d: [seeds[5], seeds[10]],
    q1: [seeds[3], winner("r1a")], q2: [seeds[0], winner("r1b")], q3: [seeds[1], winner("r1c")], q4: [seeds[2], winner("r1d")],
    s1: [winner("q1"), winner("q2")], s2: [winner("q3"), winner("q4")], final: [winner("s1"), winner("s2")],
  } as const;
  const order = ["r1a", "r1b", "r1c", "r1d", "q1", "q2", "q3", "q4", "s1", "s2", "final"] as const;
  const choose = (id: string, team: string) => {
    if (mode !== "picking" || team === "TBD") return;
    setPicks((current) => {
      const next = { ...current, [id]: team };
      // Earlier changes invalidate every downstream selection that no longer appears.
      for (let pass = 0; pass < 3; pass++) {
        const w = (key: string) => next[key] || "TBD";
        const legal: Record<string, readonly string[]> = { r1a: games.r1a, r1b: games.r1b, r1c: games.r1c, r1d: games.r1d, q1: [seeds[3], w("r1a")], q2: [seeds[0], w("r1b")], q3: [seeds[1], w("r1c")], q4: [seeds[2], w("r1d")], s1: [w("q1"), w("q2")], s2: [w("q3"), w("q4")], final: [w("s1"), w("s2")] };
        for (const key of order) if (next[key] && !legal[key].includes(next[key])) delete next[key];
      }
      return next;
    });
  };
  const complete = order.every((id) => !!picks[id]);
  const actual = (() => {
    const result: Record<string, string> = { r1a: seeds[4], r1b: seeds[8], r1c: seeds[6], r1d: seeds[10] };
    result.q1 = result.r1a; result.q2 = seeds[0]; result.q3 = seeds[1]; result.q4 = result.r1d;
    result.s1 = result.q2; result.s2 = result.q3; result.final = result.s2;
    return result;
  })();
  const weights: Record<string, number> = { r1a: 1, r1b: 1, r1c: 1, r1d: 1, q1: 2, q2: 2, q3: 2, q4: 2, s1: 4, s2: 4, final: 8 };
  const score = order.reduce((sum, id) => sum + (picks[id] === actual[id] ? weights[id] : 0), 0);
  return <section className="space-y-4" aria-label="Foundry CFP handoff"><header className="rounded-2xl border border-sky-300/40 bg-[radial-gradient(circle_at_top,#0c4a6e,transparent_60%)] p-5"><p className="text-[9px] font-black uppercase tracking-[.2em] text-sky-300">Separate scoring · same Act III</p><h3 className="mt-1 text-2xl font-black">Road Through the CFP</h3><p className="mt-2 text-xs text-muted">The Bowl Bankroll is closed. Now fill the fixed 12-team, 11-game playoff bracket. No reseeding.</p></header>
    <div className="overflow-x-auto rounded-2xl border border-sky-300/25 bg-[linear-gradient(90deg,rgba(15,23,42,.96),rgba(12,74,110,.32),rgba(15,23,42,.96))] p-3 pb-5" aria-label="CFP bracket fighting toward the selected trophy">
      <div className="grid min-w-[1130px] grid-cols-[170px_145px_125px_190px_125px_145px_170px] items-center gap-4">
        <PlayableColumn label="First Round" entries={[["r1a", games.r1a], ["r1b", games.r1b]]} picks={picks} choose={choose} locked={mode !== "picking"} />
        <PlayableColumn label="Quarterfinals" entries={[["q1", games.q1], ["q2", games.q2]]} picks={picks} choose={choose} locked={mode !== "picking"} />
        <PlayableColumn label="Semifinal" entries={[["s1", games.s1]]} picks={picks} choose={choose} locked={mode !== "picking"} centered />
        <section className="relative flex min-h-[360px] flex-col items-center justify-center text-center"><p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">National Championship</p><CfpGame id="final" teams={games.final} selected={picks.final} choose={choose} locked={mode !== "picking"} /><SportChampionshipTrophy sport="cfb" size={130} trophyDesignId={trophy.id} animate /><h4 className="-mt-2 text-lg font-black">{mode === "results" ? actual.final : picks.final || trophy.name}</h4><p className="mt-1 max-w-[170px] text-[9px] italic text-muted">{picks.final ? `Your champion · ${trophy.name}` : `“${trophy.inscription}”`}</p></section>
        <PlayableColumn label="Semifinal" entries={[["s2", games.s2]]} picks={picks} choose={choose} locked={mode !== "picking"} centered />
        <PlayableColumn label="Quarterfinals" entries={[["q3", games.q3], ["q4", games.q4]]} picks={picks} choose={choose} locked={mode !== "picking"} />
        <PlayableColumn label="First Round" entries={[["r1c", games.r1c], ["r1d", games.r1d]]} picks={picks} choose={choose} locked={mode !== "picking"} />
      </div>
      <p className="mt-3 text-center text-[9px] font-bold text-sky-200">Swipe the bracket · both sides fight toward the commissioner’s trophy</p>
    </div>
    {mode === "results" && <section className="rounded-2xl border border-emerald-300/35 bg-emerald-950/15 p-5 text-center"><p className="text-[9px] font-black uppercase text-emerald-300">CFP bracket final</p><strong className="block text-5xl">{score}/28</strong><p className="text-xs text-muted">separate playoff points · champion pick worth 8</p></section>}
    <div className="grid grid-cols-2 gap-2">{mode === "picking" ? <button type="button" disabled={!complete} onClick={() => setMode("locked")} className="col-span-2 min-h-12 rounded-xl bg-sky-300 font-black text-sky-950 disabled:opacity-35">Lock CFP Bracket</button> : mode === "locked" ? <><button type="button" onClick={() => setMode("picking")} className="min-h-12 rounded-xl border border-border text-xs font-bold">Unlock Preview</button><button type="button" onClick={() => setMode("results")} className="min-h-12 rounded-xl bg-emerald-300 text-xs font-black text-emerald-950">Sim CFP Results</button></> : <button type="button" onClick={() => { setPicks({}); setMode("picking"); }} className="col-span-2 min-h-12 rounded-xl border border-border text-xs font-bold">Pick Another Bracket</button>}<button type="button" onClick={onReset} className="col-span-2 min-h-12 rounded-xl border border-red-400/30 text-xs font-bold text-red-200">Reset Act III Lab</button></div></section>;
}

function PlayableColumn({ label, entries, picks, choose, locked, centered = false }: { label: string; entries: readonly (readonly [string, readonly string[]])[]; picks: Record<string, string>; choose: (id: string, team: string) => void; locked: boolean; centered?: boolean }) {
  return <section className={centered ? "flex min-h-[360px] flex-col justify-center" : ""}><p className="mb-4 text-center text-[8px] font-black uppercase tracking-[.16em] text-sky-300">{label}</p><div className="space-y-16">{entries.map(([id, teams]) => <CfpGame key={id} id={id} teams={teams} selected={picks[id]} choose={choose} locked={locked} />)}</div></section>;
}

function CfpGame({ id, teams, selected, choose, locked }: { id: string; teams: readonly string[]; selected?: string; choose: (id: string, team: string) => void; locked: boolean }) {
  return <div className="rounded-xl border border-sky-300/25 bg-black/35 shadow-lg">{teams.map((team) => <button type="button" key={team} disabled={locked || team === "TBD"} onClick={() => choose(id, team)} className={`flex min-h-11 w-full items-center gap-2 border-b border-white/10 px-3 text-left text-[10px] font-bold last:border-0 disabled:opacity-40 ${selected === team ? "bg-sky-300 text-sky-950" : ""}`}><span>{team.match(/\d+/)?.[0] || "→"}</span><span>{team}</span></button>)}</div>;
}

function BracketColumn({ label, games, inward, centered = false }: { label: string; games: string[][]; inward?: "left" | "right"; centered?: boolean }) {
  return <section className={centered ? "flex min-h-[360px] flex-col justify-center" : ""}><p className="mb-4 text-center text-[8px] font-black uppercase tracking-[.16em] text-sky-300">{label}</p><div className="space-y-16">{games.map((game, index) => <div key={`${label}-${index}`} className="relative rounded-xl border border-sky-300/25 bg-black/35 shadow-lg">{game.map((team) => <div key={team} className="flex min-h-11 items-center gap-2 border-b border-white/10 px-3 text-[10px] font-bold last:border-0"><span className="text-sky-300">{team.match(/\d+/)?.[0] || "→"}</span><span>{team}</span></div>)}{inward && <span aria-hidden className={`absolute top-1/2 h-px w-4 bg-amber-300 ${inward === "right" ? "-right-4" : "-left-4"}`} />}</div>)}</div></section>;
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`rounded-xl border p-2 text-center ${alert ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-black/25"}`}><strong className="block text-xl">{value}</strong><span className="text-[8px] font-black uppercase tracking-wide text-muted">{label}</span></div>;
}
