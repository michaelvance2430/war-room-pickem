"use client";

import { useEffect, useMemo, useState } from "react";
import WarRoomArsenalIcon from "@/components/WarRoomArsenalIcon";
import { authorizeFoundryJdam, generateNflPlayoffPicks, nflBracketComplete, nflPlayoffGames, sanitizeNflPlayoffPicks, type NflPlayoffPicks } from "@/lib/postseason/nfl-maps";

type Lab = { picks: NflPlayoffPicks; locked: boolean; original: NflPlayoffPicks | null; authorizationWeek: number | null; targets: string[]; changedCount: number; humanPickCount: number; reviewed: boolean };
const KEY = "warroom-foundry-nfl-maps-v1";
const fresh = (): Lab => ({ picks: {}, locked: false, original: null, authorizationWeek: null, targets: [], changedCount: 0, humanPickCount: 0, reviewed: false });

export default function FoundryNflActThree({ seasonWeek }: { seasonWeek: number }) {
  const [lab, setLab] = useState<Lab>(fresh);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved?.picks) setLab(saved); } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(lab)); }, [ready, lab]);
  const games = nflPlayoffGames(lab.picks);
  const complete = nflBracketComplete(lab.picks);
  const next = games.find((game) => !lab.picks[game.id]);
  const champion = games.find((game) => game.id === "super-bowl")?.teams.find((team) => team.id === lab.picks["super-bowl"]);
  const names = useMemo(() => new Map(nflPlayoffGames(generateNflPlayoffPicks(1)).flatMap((game) => game.teams.map((team) => [team.id, team.name]))), []);
  function choose(id: string, teamId: string) { if (lab.locked) return; setLab((current) => ({ ...current, picks: sanitizeNflPlayoffPicks({ ...current.picks, [id]: teamId }) })); }
  function jdam() { const result = authorizeFoundryJdam(lab.picks); if (!result.targets.length) return; setStep(0); setLab({ picks: result.picks, locked: true, original: { ...lab.picks }, authorizationWeek: seasonWeek, targets: result.targets, changedCount: result.changedCount, humanPickCount: Object.keys(lab.picks).length, reviewed: false }); }
  async function share() {
    const pickManifest = nflPlayoffGames(lab.picks).map((game) => {
      const winnerId = lab.picks[game.id];
      const winner = game.teams.find((team) => team.id === winnerId);
      return `${game.label}: ${winner?.name || winnerId || "TBD"}`;
    }).join("\n");
    const text = `I authorized M.A.P.’s JDAM Protocol. ${lab.changedCount} NFL playoff decisions were overwritten or filled.\n\nCOMPUTER BRACKET\n${pickManifest}\n\nChampion: ${champion?.name || "TBD"}\n\nMy bracket no longer reflects my personal beliefs. #WarRoom`;
    if (navigator.share) await navigator.share({ title: "War Room JDAM Computer Bracket", text });
    else await navigator.clipboard?.writeText(text);
  }
  if (!ready) return <p className="rounded-2xl border border-border p-5 text-center text-xs">Opening the playoff operations center…</p>;
  const reviewDone = step >= lab.targets.length;
  const target = lab.targets[Math.min(step, lab.targets.length - 1)];
  return <section className="space-y-4"><header className="rounded-2xl border border-sky-300/40 bg-[radial-gradient(circle_at_top,#0c4a6e,#020617_65%)] p-5"><p className="text-[9px] font-black uppercase tracking-[.2em] text-sky-300">NFL Phase III · Foundry only</p><h3 className="mt-1 text-2xl font-black">The Road to the Bowl</h3><p className="mt-2 text-xs text-muted">Fourteen teams. Thirteen decisions. The lowest remaining seed visits the 1-seed in each divisional round.</p><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Decisions" value={`${Object.keys(lab.picks).length}/13`}/><Metric label="Champion" value={champion?.name || "TBD"}/></div></header>
    {!lab.locked && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setLab((current) => ({ ...current, picks: generateNflPlayoffPicks(1) }))} className="min-h-11 rounded-xl border border-sky-300/40 text-[10px] font-black text-sky-200">Test-fill 13 · no JDAM</button><button type="button" disabled={!complete} onClick={() => setLab((current) => ({ ...current, locked: true }))} className="min-h-11 rounded-xl bg-sky-300 text-[10px] font-black text-sky-950 disabled:opacity-35">Lock playoff bracket</button></div>}
    {!lab.locked && <><button type="button" onClick={jdam} className="flex min-h-16 w-full items-center justify-center rounded-2xl border-2 border-blue-400 bg-[repeating-linear-gradient(135deg,#061a38_0,#061a38_12px,#020617_12px,#020617_24px)] px-4 text-sm font-black text-blue-100 shadow-[0_0_35px_rgba(96,165,250,.4)]"><span className="weapon-unstable flex items-center justify-center gap-3"><WarRoomArsenalIcon kind="jdam" size={54}/><span><small className="block text-[8px] uppercase tracking-[.2em] text-blue-300">M.A.P.’s · Mutually Assured Picks</small>AUTHORIZE JDAM PROTOCOL<small className="mt-1 block text-[8px] text-blue-200/70">Computer assumes command · {Object.keys(lab.picks).length}/13 human picks on file</small></span></span></button><p className="text-center text-[9px] font-bold text-blue-200/60">JDAM fills every unpicked decision, replaces any human targets already on file, and locks the precision package.</p></>}
    <NflConvergingBracket games={games} picks={lab.picks} locked={lab.locked} nextId={next?.id} choose={choose}/>
    {lab.original && lab.reviewed && <section className="rounded-2xl border-2 border-blue-400/60 bg-blue-950/25 p-4 text-center"><WarRoomArsenalIcon kind="maps" size={72}/><p className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-blue-300">JDAM damage assessment</p><h4 className="mt-1 text-xl font-black">PRECISION WAS CLAIMED. CONSEQUENCES WERE DELIVERED.</h4><p className="mt-2 text-xs text-muted">{lab.humanPickCount ? `${lab.changedCount} decisions overwritten or filled` : "No human targets on file · computer made all 13 decisions"} · champion: {champion?.name}</p><button type="button" onClick={() => void share()} className="mt-3 min-h-12 w-full rounded-xl border border-blue-300/50 text-xs font-black text-blue-200">SHARE THE EVIDENCE ↗</button></section>}
    {lab.original && !lab.reviewed && <div className="fixed inset-0 z-[85] flex items-end justify-center overflow-y-auto bg-[#020b1c]/95 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true"><section className="w-full max-w-md rounded-3xl border-2 border-blue-400 bg-[radial-gradient(circle_at_top,#0c4a6e,#020617_65%)] p-5 text-center shadow-[0_0_100px_rgba(96,165,250,.5)]"><WarRoomArsenalIcon kind={reviewDone ? "maps" : "jdam"} size={92}/>{reviewDone ? <><p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-blue-300">Target package complete</p><h3 className="mt-2 text-3xl font-black">BATTLE DAMAGE ASSESSMENT</h3><p className="mt-3 text-sm text-white/70">{lab.humanPickCount ? `${lab.changedCount} bracket decisions overwritten or filled. Review the complete impact file below before acknowledging the strike.` : "No human targeting plan existed. The computer made and locked all 13 decisions. Review the selected impact files below."}</p><DamageAssessmentRows lab={lab} names={names}/><button type="button" onClick={() => setLab((current) => ({ ...current, reviewed: true }))} className="mt-5 min-h-14 w-full rounded-xl bg-blue-300 text-sm font-black text-blue-950">I HAVE REVIEWED THE DAMAGE</button></> : <><p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-blue-300">JDAM {step + 1} OF {lab.targets.length}</p><p className="mt-4 text-sm text-muted">{lab.original[target] ? "ORIGINAL TARGET" : "NO HUMAN TARGET ON FILE"}</p><h3 className="text-2xl font-black">{lab.original[target] ? names.get(lab.original[target]) || lab.original[target] : "—"}</h3><div className="my-3 text-3xl text-red-400">⌖</div><p className="text-sm text-muted">COMPUTER SOLUTION</p><h3 className="text-2xl font-black text-blue-200">{names.get(lab.picks[target]) || lab.picks[target]}</h3><button type="button" onClick={() => setStep((value) => value + 1)} className="mt-5 min-h-14 w-full rounded-xl bg-blue-300 text-sm font-black text-blue-950">{step + 1 === lab.targets.length ? "RUN DAMAGE ASSESSMENT" : "VIEW NEXT IMPACT"}</button></>}</section></div>}
    <button type="button" onClick={() => { localStorage.removeItem(KEY); setLab(fresh()); setStep(0); }} className="min-h-11 w-full rounded-xl border border-red-400/30 text-xs font-bold text-red-200">Reset NFL Phase III Lab</button>
  </section>;
}

function DamageAssessmentRows({ lab, names }: { lab: Lab; names: Map<string, string> }) {
  const targetIds = new Set(lab.targets);
  return <div className="mt-4 space-y-2 text-left" aria-label="JDAM complete impact file">{nflPlayoffGames(lab.picks).map((game, index) => {
    const original = lab.original?.[game.id];
    const computer = lab.picks[game.id];
    const targeted = targetIds.has(game.id);
    return <article key={game.id} className={`rounded-xl border bg-black/30 p-3 ${targeted ? "border-red-400/55" : "border-blue-300/25"}`}><p className={`text-[8px] font-black uppercase tracking-[.18em] ${targeted ? "text-red-300" : "text-blue-300"}`}>Damage file {index + 1} · {game.label}{targeted ? " · DIRECT HIT" : ""}</p><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center"><div><span className="block text-[8px] font-black uppercase text-white/45">Human plan</span><strong className="mt-1 block text-xs">{original ? names.get(original) || original : "NO PICK"}</strong></div><span className="text-lg font-black text-red-400">→</span><div><span className="block text-[8px] font-black uppercase text-blue-300/70">Computer result</span><strong className="mt-1 block text-xs text-blue-100">{computer ? names.get(computer) || computer : "—"}</strong></div></div></article>;
  })}</div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center"><strong className="block truncate text-sm">{value}</strong><span className="text-[8px] font-black uppercase tracking-wide text-muted">{label}</span></div>; }

function NflConvergingBracket({ games, picks, locked, nextId, choose }: { games: ReturnType<typeof nflPlayoffGames>; picks: NflPlayoffPicks; locked: boolean; nextId?: string; choose: (id: string, teamId: string) => void }) {
  const select = (ids: string[]) => ids.map((id) => games.find((game) => game.id === id)).filter((game): game is NonNullable<typeof game> => !!game);
  const superBowl = games.find((game) => game.id === "super-bowl");
  return <section className="overflow-hidden rounded-2xl border border-blue-300/25 bg-[radial-gradient(circle_at_center,rgba(251,191,36,.13),transparent_24%),linear-gradient(90deg,rgba(3,30,66,.95),rgba(2,6,23,.98)_47%,rgba(55,10,18,.92))] p-3" aria-label="NFL playoff bracket converging on the Super Bowl"><div className="mb-3 flex items-center justify-between px-2"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-300">American Football Conference</p><strong className="text-sm">AFC advances right →</strong></div><div className="text-right"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-300">National Football Conference</p><strong className="text-sm">← NFC advances left</strong></div></div><div className="overflow-x-auto pb-3"><div className="grid min-w-[1320px] grid-cols-[220px_190px_170px_220px_170px_190px_220px] items-center gap-4">
    <NflBracketColumn label="Wild Card" games={select(["AFC:wc:2-7", "AFC:wc:3-6", "AFC:wc:4-5"])} picks={picks} locked={locked} nextId={nextId} choose={choose}/>
    <NflBracketColumn label="Divisional" games={select(["AFC:div:1", "AFC:div:2"])} picks={picks} locked={locked} nextId={nextId} choose={choose} centered/>
    <NflBracketColumn label="AFC Championship" games={select(["AFC:title"])} picks={picks} locked={locked} nextId={nextId} choose={choose} centered/>
    <section className="flex min-h-[510px] flex-col items-center justify-center text-center"><div className="mb-4 rounded-full border-4 border-amber-300 bg-gradient-to-br from-slate-100 via-slate-400 to-slate-800 p-2 shadow-[0_0_55px_rgba(251,191,36,.45)]"><WarRoomArsenalIcon kind="maps" size={92}/></div><p className="text-[9px] font-black uppercase tracking-[.24em] text-amber-300">AFC · Super Bowl · NFC</p>{superBowl ? <NflBracketGame game={superBowl} picks={picks} locked={locked} active={nextId === superBowl.id} choose={choose}/> : <div className="mt-3 w-full rounded-xl border border-dashed border-amber-300/35 bg-black/35 p-5 text-xs font-black text-muted">Conference champions converge here</div>}<p className="mt-3 text-[9px] text-amber-100/55">One champion. Both roads terminate in the middle.</p></section>
    <NflBracketColumn label="NFC Championship" games={select(["NFC:title"])} picks={picks} locked={locked} nextId={nextId} choose={choose} centered/>
    <NflBracketColumn label="Divisional" games={select(["NFC:div:1", "NFC:div:2"])} picks={picks} locked={locked} nextId={nextId} choose={choose} centered/>
    <NflBracketColumn label="Wild Card" games={select(["NFC:wc:2-7", "NFC:wc:3-6", "NFC:wc:4-5"])} picks={picks} locked={locked} nextId={nextId} choose={choose}/>
  </div></div><p className="text-center text-[9px] font-bold text-blue-100/60">Swipe the bracket · each conference mirrors the NFL postseason · 1-seeds enter in the Divisional Round</p></section>;
}

function NflBracketColumn({ label, games, picks, locked, nextId, choose, centered = false }: { label: string; games: ReturnType<typeof nflPlayoffGames>; picks: NflPlayoffPicks; locked: boolean; nextId?: string; choose: (id: string, teamId: string) => void; centered?: boolean }) {
  return <section className={centered ? "flex min-h-[510px] flex-col justify-center" : ""}><p className="mb-4 text-center text-[8px] font-black uppercase tracking-[.16em] text-slate-300">{label}</p><div className={games.length === 3 ? "space-y-8" : games.length === 2 ? "space-y-20" : "space-y-3"}>{games.length ? games.map((game) => <NflBracketGame key={game.id} game={game} picks={picks} locked={locked} active={nextId === game.id} choose={choose}/>) : <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-[9px] text-muted">Awaiting prior round</div>}</div></section>;
}

function NflBracketGame({ game, picks, locked, active, choose }: { game: ReturnType<typeof nflPlayoffGames>[number]; picks: NflPlayoffPicks; locked: boolean; active: boolean; choose: (id: string, teamId: string) => void }) {
  return <article className={`overflow-hidden rounded-xl border bg-black/45 shadow-lg ${picks[game.id] ? "border-sky-300/45" : active ? "border-amber-300/70 shadow-[0_0_24px_rgba(251,191,36,.16)]" : "border-white/10 opacity-60"}`}><p className="border-b border-white/10 px-3 py-1.5 text-[7px] font-black uppercase tracking-[.14em] text-slate-400">{game.label}</p>{game.teams.map((team) => <button key={team.id} type="button" disabled={locked} onClick={() => choose(game.id, team.id)} className={`flex min-h-11 w-full items-center justify-between border-b border-white/10 px-3 text-left text-[9px] font-bold last:border-0 ${picks[game.id] === team.id ? "bg-sky-300 text-sky-950" : ""}`}><span className="truncate"><strong className="mr-2">{team.seed}</strong>{team.name}</span><span>{picks[game.id] === team.id ? "ADV" : ""}</span></button>)}</article>;
}
