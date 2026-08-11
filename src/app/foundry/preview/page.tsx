"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GazettePaper from "@/components/GazettePaper";
import FoundryCfbActThree from "@/components/FoundryCfbActThree";
import FoundryNflActThree from "@/components/FoundryNflActThree";
import WarRoomArsenalIcon from "@/components/WarRoomArsenalIcon";
import { buildFoundryGazetteFixture } from "@/lib/foundry-gazette-fixtures";
import {
  createFoundryWalkthrough,
  armFoundryTacticalNuke,
  FOUNDRY_TACTICAL_NUKE_LIMIT,
  FIELDHOUSE_REGIONS,
  FOUNDRY_WALKTHROUGH_EVENT,
  foundryWeekStartDate,
  foundryFinalWeek,
  foundryPostseasonStartWeek,
  foundryPostseasonRounds,
  foundryTacticalNukesRemaining,
  isFoundrySeasonFinal,
  launchFoundryHellfire,
  loadFoundryWalkthrough,
  PREVIEW_SPORTS,
  saveFoundryWalkthrough,
  setFoundryWalkthroughRole,
  simulateFoundrySeason,
  simulateFoundryRegularSeason,
  simulateNextFoundryWeek,
  type FoundryWalkthrough,
  type FieldhouseRegion,
  type PreviewRole,
} from "@/lib/foundry-walkthrough";
import { applySeasonTheme, DEFAULT_SEASON_THEME_ID, paintAutomaticSeasonTheme, resolveCfbSeasonSkin, resolveHolidaySkinInEasternTime, seasonThemeDisplayName } from "@/lib/season-theme";
import { applySportTheme, reapplySportThemeFromLocal } from "@/lib/sports/sport-theme";
import {
  NCAA_REGIONS,
  finalFourGames,
  firstFourGames,
  nationalChampionshipGame,
  ncaaPickCount,
  ncaaResultsWindow,
  ncaaScore,
  generateNcaaPicks,
  regionRoundGames,
  sanitizeNcaaPicks,
  type NcaaGame,
  type NcaaRegion,
} from "@/lib/ncaa-bracket";
import { resolveHomeSeasonCommand } from "@/lib/home-season-command";

type View = "home" | "picks" | "standings" | "postseason" | "gazette" | "locker" | "board" | "profile" | "commissioner";
const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Home" }, { id: "picks", label: "Picks" }, { id: "standings", label: "Standings" },
  { id: "postseason", label: "Brackets" }, { id: "gazette", label: "Gazette" }, { id: "locker", label: "Locker" }, { id: "board", label: "Board" }, { id: "profile", label: "Profile" },
];

export default function FoundryPreviewPage() {
  const [state, setState] = useState<FoundryWalkthrough | null>(null);
  const [view, setView] = useState<View>("home");
  const [simulation, setSimulation] = useState<{ kind: "week" | "regular" | "season"; step: number } | null>(null);
  const [ringCeremony, setRingCeremony] = useState<FoundryWalkthrough | null>(null);
  const [gazetteWeek, setGazetteWeek] = useState<number | null>(null);
  const [calendarLabel, setCalendarLabel] = useState("");
  const [themeLabel, setThemeLabel] = useState("");
  const [resetReceipt, setResetReceipt] = useState(false);
  useEffect(() => {
    const refresh = () => setState(loadFoundryWalkthrough());
    refresh(); window.addEventListener(FOUNDRY_WALKTHROUGH_EVENT, refresh);
    return () => window.removeEventListener(FOUNDRY_WALKTHROUGH_EVENT, refresh);
  }, []);

  function update(next: FoundryWalkthrough) { saveFoundryWalkthrough(next); setState(next); }
  useEffect(() => {
    if (!simulation || !state) return;
    const last = simulation.kind === "week" ? 3 : 4;
    const timer = window.setTimeout(() => {
      if (simulation.step < last) {
        setSimulation({ ...simulation, step: simulation.step + 1 });
        return;
      }
      const next = simulation.kind === "week"
        ? simulateNextFoundryWeek(state)
        : simulation.kind === "regular"
          ? simulateFoundryRegularSeason(state)
          : simulateFoundrySeason(state);
      update(next);
      setSimulation(null);
      setGazetteWeek(simulation.kind === "week" ? state.week : next.gazetteWeeks[next.gazetteWeeks.length - 1] || null);
      // The finale belongs to the championship result, regardless of whether
      // Mike arrived one week at a time or used Sim Season.
      if (isFoundrySeasonFinal(next)) setRingCeremony(next);
      const cfbPhaseThreeOpened = simulation.kind === "week" && next.sport === "cfb" && next.week === foundryPostseasonStartWeek("cfb") + 1;
      setView(cfbPhaseThreeOpened ? "postseason" : simulation.kind === "week" ? "gazette" : "home");
    }, simulation.step === 0 ? 500 : 850);
    return () => window.clearTimeout(timer);
  }, [simulation, state]);
  useEffect(() => {
    if (!state) return;
    const start = foundryWeekStartDate(state.sport, state.week);
    let themeDate = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
    for (let day = 0; day < 7; day++) {
      const candidate = new Date(start.getTime() + day * 24 * 60 * 60 * 1000);
      if (resolveHolidaySkinInEasternTime(candidate)) { themeDate = candidate; break; }
    }
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    // Preview calendar is authoritative here. Do not let an old creator skin
    // simulator override the week/date the sandbox is actively walking.
    const holiday = resolveHolidaySkinInEasternTime(themeDate);
    const theme = holiday || (state.sport === "cfb" ? resolveCfbSeasonSkin(state.week) : DEFAULT_SEASON_THEME_ID);
    applySportTheme(state.sport);
    applySeasonTheme(theme);
    setThemeLabel(seasonThemeDisplayName(theme));
    setCalendarLabel(`${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
  }, [state]);
  useEffect(() => () => {
    reapplySportThemeFromLocal();
    void paintAutomaticSeasonTheme();
  }, []);
  if (!state) return <main className="mx-auto min-h-screen max-w-lg px-4 py-12"><h1 className="text-xl font-black">No preview season yet</h1><p className="mt-2 text-sm text-muted">Build one in Foundry first.</p><Link href="/foundry" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-black text-black">Open Foundry</Link></main>;
  const meta = PREVIEW_SPORTS[state.sport];
  const visibleNav = state.role === "commissioner" ? [...NAV, { id: "commissioner" as View, label: "Commish" }] : NAV;
  return <main className="relative z-[1] min-h-screen bg-background/80 pb-32 text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-3 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Foundry preview · no cloud writes</p><h1 className="text-lg font-black">{meta.room}</h1><p className="text-[10px] text-muted">{meta.sport} · {meta.weekLabel(state.week)} · {calendarLabel} · {themeLabel} · {state.role}</p></div><Link href="/foundry" className="flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-bold">Foundry</Link></div>
      <nav className="mx-auto mt-3 flex max-w-3xl gap-1 overflow-x-auto pb-1" aria-label="Preview pages">{visibleNav.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold ${view === item.id ? "bg-primary text-black" : "border border-border bg-card"}`}>{item.label}</button>)}</nav>
    </header>
    <div className="mx-auto max-w-3xl px-3 py-4">
      {view === "home" && <Home state={state} go={setView} onUpdate={update} />}
      {view === "picks" && <Picks state={state} onUpdate={update} />}
      {view === "standings" && <Standings state={state} />}
      {view === "postseason" && <Postseason state={state} onUpdate={update} />}
      {view === "gazette" && <Gazette state={state} selectedWeek={gazetteWeek} onSelectWeek={setGazetteWeek} />}
      {view === "locker" && <Locker state={state} />}
      {view === "board" && <Board state={state} />}
      {view === "profile" && <Profile state={state} />}
      {view === "commissioner" && <Commissioner state={state} onAdvance={() => update(simulateNextFoundryWeek(state))} />}
    </div>
    {simulation && <SimulationPulse kind={simulation.kind} step={simulation.step} />}
    {resetReceipt && <div className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[70] mx-auto max-w-sm rounded-2xl border-2 border-emerald-300 bg-emerald-950/95 p-4 text-center shadow-2xl" role="status"><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-300">Foundry reset complete</p><p className="mt-2 text-sm font-black">Season, picks, brackets, simulations, and weapon states cleared.</p><p className="mt-1 text-[10px] text-emerald-100/65">No production data was touched.</p></div>}
    {ringCeremony && <PreviewRingCeremony state={ringCeremony} onClose={() => setRingCeremony(null)} />}
    <PreviewChrome state={state} busy={!!simulation} onWeek={() => isFoundrySeasonFinal(state) ? setRingCeremony(state) : state.sport === "cbb" && state.week >= foundryPostseasonStartWeek("cbb") && !state.ncaaBracketLocked ? setView("postseason") : setSimulation({ kind: "week", step: 0 })} onRegular={() => { if (state.sport === "cfb") localStorage.removeItem("warroom-foundry-cfb-act-three-v3"); if (state.sport === "nfl") localStorage.removeItem("warroom-foundry-nfl-maps-v1"); setSimulation({ kind: "regular", step: 0 }); }} onSeason={() => isFoundrySeasonFinal(state) ? setRingCeremony(state) : state.sport === "cbb" && state.week >= foundryPostseasonStartWeek("cbb") && !state.ncaaBracketLocked ? setView("postseason") : setSimulation({ kind: "season", step: 0 })} onRole={(role) => update(setFoundryWalkthroughRole(state, role))} onGazette={() => { setGazetteWeek(state.gazetteWeeks[state.gazetteWeeks.length - 1] || null); setView("gazette"); }} onBrackets={() => setView("postseason")} onHome={() => setView("home")} onReset={() => { localStorage.removeItem("warroom-foundry-cfb-act-three-v3"); localStorage.removeItem("warroom-foundry-cfb-act-three-v2"); localStorage.removeItem("warroom-foundry-nfl-maps-v1"); update(createFoundryWalkthrough(state.sport, 1, state.role)); setGazetteWeek(null); setView("home"); setResetReceipt(true); window.setTimeout(() => setResetReceipt(false), 3200); }} />
  </main>;
}

function Home({ state, go, onUpdate }: { state: FoundryWalkthrough; go: (v: View) => void; onUpdate: (next: FoundryWalkthrough) => void }) {
  const meta = PREVIEW_SPORTS[state.sport]; const me = state.players.find((p) => p.name === "Mike V") || state.players[0]; const rank = state.players.findIndex((p) => p.id === me.id) + 1;
  if (state.sport === "cfb" && state.week >= foundryPostseasonStartWeek("cfb")) { const phaseThreeWeek = foundryPostseasonStartWeek("cfb") + 1; return <div className="space-y-4"><FoundrySeasonCommand state={state}/><section className="grid grid-cols-2 gap-3"><Stat label="Final regular rank" value={`#${rank}`} note={`${me.points} season points`}/><Stat label="Season status" value={state.week < phaseThreeWeek ? "PHASE II" : "PHASE III"} note={state.week < phaseThreeWeek ? "conference championships" : "bowls + CFP"}/></section><FoundryCfbActThree key={`cfb-phase-${state.generatedAt}`} seasonWeek={state.week} postseasonWeek={phaseThreeWeek} /></div>; }
  if (state.sport === "nfl" && state.week >= foundryPostseasonStartWeek("nfl")) return <div className="space-y-4"><FoundrySeasonCommand state={state}/><section className="grid grid-cols-2 gap-3"><Stat label="Final regular rank" value={`#${rank}`} note={`${me.points} season points`}/><Stat label="Season status" value="PHASE III" note="Road to the Bowl"/></section><p className="rounded-xl border border-sky-300/25 bg-sky-950/20 px-3 py-2 text-center text-[9px] font-bold text-sky-200">PHASE I · REGULAR SEASON COMPLETE → PHASE II · SEEDS LOCKED → PHASE III · WAR ROOM PLAYOFFS</p><FoundryNflActThree seasonWeek={state.week} /></div>;
  if (state.sport === "cbb" && state.week >= foundryPostseasonStartWeek("cbb")) return <div className="space-y-4"><FoundrySeasonCommand state={state}/><section className="grid grid-cols-2 gap-3"><Stat label="Final regular rank" value={`#${rank}`} note={`${me.points} season points`}/><Stat label="Season status" value="PHASE III" note="Fieldhouse postseason"/></section><p className="rounded-xl border border-orange-300/25 bg-orange-950/20 px-3 py-2 text-center text-[9px] font-bold text-orange-200">PHASE I · CONFERENCE SEASON → PHASE II · CONFERENCE TOURNAMENTS COMPLETE → PHASE III · MARCH MADNESS</p><Page title="March Madness Command Center" note="Your national bracket opens clean. Hellfire remains available before the first human pick."><NcaaBracketPicker state={state} onUpdate={onUpdate} /></Page></div>;
  return <div className="space-y-3"><FoundrySeasonCommand state={state}/><section className="rounded-2xl border border-primary/35 bg-card p-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">{meta.cadence} · card open</p><h2 className="mt-2 text-3xl font-black">{meta.weekLabel(state.week)}</h2><p className="mt-2 text-sm text-muted">Five games. Confidence 5 through 1. Lock before the first game begins.</p><button onClick={() => go("picks")} className="mt-4 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Open My Picks</button></section>
    <div className="grid grid-cols-2 gap-3"><Stat label="Your rank" value={`#${rank}`} note={`${me.points} season points`} /><Stat label="This week" value={`${me.weekPoints} pts`} note={`${me.correct} correct`} /></div>
    <button onClick={() => go("gazette")} className="w-full rounded-2xl border border-stone-500 bg-[#eee8da] p-4 text-left text-stone-900"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-800">{state.gazetteWeeks.length ? `${state.gazetteWeeks.length} archived edition${state.gazetteWeeks.length === 1 ? "" : "s"}` : "After the first score"}</p><strong className="mt-1 block font-serif text-xl">The War Room Gazette</strong><span className="text-xs">{state.gazetteWeeks.length ? "Tap a week in the archive to read that edition." : "The first weekly paper prints when you simulate Week 1."}</span></button>
    <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-black">Room pulse</h3><div className="mt-3 space-y-2">{state.players.slice(0, 3).map((p, i) => <div key={p.id} className="flex items-center justify-between text-sm"><span>{i + 1}. {p.name}</span><strong>{p.points}</strong></div>)}</div><button onClick={() => go("standings")} className="mt-3 text-xs font-bold text-primary">Full standings →</button></section></div>;
}

function FoundrySeasonCommand({ state }: { state: FoundryWalkthrough }) {
  const me = state.players.find((player) => player.name === "Mike V") || state.players[0];
  const command = resolveHomeSeasonCommand({
    week: state.week,
    cutWeek: foundryPostseasonStartWeek(state.sport),
    finalWeek: foundryFinalWeek(state.sport),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      totalPoints: player.points,
      weeklyPoints: state.week > 1 ? [player.weekPoints] : [],
    })),
    playerId: me?.id,
    cutPercent: 50,
  });
  const tone = command.tone === "red" ? "border-red-500/60 bg-red-950/35 text-red-200" : command.tone === "gold" ? "border-yellow-300/50 bg-yellow-500/10 text-yellow-100" : command.tone === "amber" ? "border-amber-400/50 bg-amber-500/10 text-amber-200" : "border-emerald-400/45 bg-emerald-500/10 text-emerald-200";
  return <section className={`rounded-2xl border p-4 ${tone}`} data-season-command={command.phase}><p className="text-[9px] font-black uppercase tracking-[.2em] opacity-75">{command.kicker}</p><h2 className="mt-1 text-xl font-black leading-tight text-white">{command.headline}</h2><p className="mt-1 text-xs text-white/65">{command.order}</p>{(command.story || command.personal) && <div className="mt-3 flex flex-wrap gap-2 border-t border-current/20 pt-3 text-[10px] font-bold">{command.story && <span>{command.story}</span>}{command.personal && <span className="rounded-full border border-current/35 px-2 py-1 uppercase">{command.personal}</span>}</div>}</section>;
}

function Picks({ state, onUpdate }: { state: FoundryWalkthrough; onUpdate: (next: FoundryWalkthrough) => void }) {
  const [confirmNuke, setConfirmNuke] = useState(false);
  const remaining = foundryTacticalNukesRemaining(state);
  const regularSeason = state.week < foundryPostseasonStartWeek(state.sport);
  return <Page title="My Picks" note={`${PREVIEW_SPORTS[state.sport].weekLabel(state.week)} · saved locally for preview`}>
    {regularSeason && <section className={`mb-4 overflow-hidden rounded-2xl border-2 p-4 ${state.tacticalNukeActive ? "border-lime-300 bg-lime-950/25 shadow-[0_0_30px_rgba(190,242,100,.2)]" : "border-red-500/80 bg-[repeating-linear-gradient(135deg,#250303_0,#250303_12px,#050505_12px,#050505_24px)] shadow-[0_0_34px_rgba(239,68,68,.3)]"}`}>
      <div className="flex items-center gap-3"><WarRoomArsenalIcon kind="nuke" size={52}/><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-300">Regular season weapon</p><h3 className="text-xl font-black">TACTICAL NUCLEAR BUTTON</h3></div><strong className="rounded-full border-2 border-red-300 bg-black/70 px-3 py-2 text-lg tabular-nums text-red-100">{remaining}/{FOUNDRY_TACTICAL_NUKE_LIMIT}</strong></div>
      {state.tacticalNukeActive ? <div className="mt-3 rounded-xl border border-lime-300/40 bg-black/35 p-3 text-center"><p className="text-sm font-black text-lime-200">☢ NUCLEAR CARD ARMED · 2× WEEK</p><p className="mt-1 text-[10px] text-white/60">The targeting computer made every pick. No edits. No undo.</p></div> : <button type="button" disabled={remaining <= 0} onClick={() => setConfirmNuke(true)} className="mt-3 min-h-14 w-full rounded-xl bg-red-600 text-sm font-black text-white shadow-[0_0_24px_rgba(239,68,68,.45)] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none">{remaining > 0 ? `GO NUCLEAR · ${remaining}/${FOUNDRY_TACTICAL_NUKE_LIMIT}` : "ARSENAL EMPTY · 0/2"}</button>}
    </section>}
    <div className="space-y-3">{state.games.map((g) => <article key={g.id} className={`rounded-xl border bg-card p-4 ${state.tacticalNukeActive ? "border-lime-300/35" : "border-border"}`}><div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-muted">{g.status === "final" ? "Final" : "Upcoming"}</p><h3 className="mt-1 font-black">{g.away} at {g.home}</h3><p className="text-xs text-muted">{g.spread}{g.result ? ` · ${g.result}` : ""}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-full font-black text-black ${state.tacticalNukeActive ? "bg-lime-300" : "bg-primary"}`}>{g.confidence}</span></div><div className={`mt-3 rounded-lg border p-3 text-sm ${state.tacticalNukeActive ? "border-lime-300/30 bg-lime-300/10" : "border-primary/30 bg-primary/10"}`}>Pick: <strong>{g.pick}</strong></div></article>)}</div>
    <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">Card locked · preview picks cannot reach a live league.</p>
    {confirmNuke && <div className="fixed inset-0 z-[75] flex items-end justify-center bg-red-950/90 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Confirm Tactical Nuclear Button"><section className="w-full max-w-md rounded-3xl border-2 border-red-500 bg-black p-5 text-center shadow-[0_0_80px_rgba(239,68,68,.55)]"><WarRoomArsenalIcon kind="nuke" size={78}/><p className="mt-3 text-[10px] font-black uppercase tracking-[.24em] text-red-300">Tactical authorization required</p><h3 className="mt-2 text-3xl font-black">GO NUCLEAR?</h3><p className="mt-3 text-sm leading-relaxed text-white/70">The computer takes the entire weekly card. If it cooks, every point doubles. This spends one of your two season uses immediately.</p><p className="mt-3 text-xs font-black text-red-300">NO EDITS · NO REROLLS · NO REFUNDS</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmNuke(false)} className="min-h-12 rounded-xl border border-white/25 text-xs font-bold">Keep control</button><button type="button" onClick={() => { onUpdate(armFoundryTacticalNuke(state)); setConfirmNuke(false); }} className="min-h-12 rounded-xl bg-red-600 text-xs font-black text-white">AUTHORIZE ☢</button></div></section></div>}
  </Page>;
}

function Standings({ state }: { state: FoundryWalkthrough }) {
  if (state.sport === "cbb") {
    return <Page title="Regional Standings" note="East, West, South, and Midwest each carry their own cut line into the Fieldhouse postseason."><div className="grid gap-4 sm:grid-cols-2">{FIELDHOUSE_REGIONS.map((region) => {
      const players = state.players.filter((player) => player.region === region).sort((a, b) => b.points - a.points);
      const middle = Math.ceil(players.length / 2);
      return <section key={region} className="overflow-hidden rounded-2xl border border-orange-300/30 bg-card"><div className="border-b border-orange-300/20 bg-orange-300/10 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-300">Fieldhouse region</p><h3 className="text-lg font-black">{region}</h3></div>{players.map((player, index) => <div key={player.id}><div className={`grid grid-cols-[28px_1fr_48px] items-center gap-2 px-3 py-3 text-xs ${player.name === "Mike V" ? "bg-primary/15" : ""}`}><span className="text-muted">{index + 1}</span><span className="truncate font-bold">{player.name}{player.name === "Mike V" ? " · YOU" : ""}<small className="block font-normal text-muted">{player.locked ? "Locked" : "No card"} · {player.streak > 0 ? `W${player.streak}` : player.streak < 0 ? `L${Math.abs(player.streak)}` : "—"}{player.madnessPoints > 0 ? ` · Madness +${player.madnessPoints}` : ""}</small></span><strong className="text-right">{player.points}</strong></div>{index + 1 === middle && <div className="flex items-center gap-2 bg-red-950 px-2 py-1.5 text-[8px] font-black uppercase tracking-[.13em] text-red-300"><span className="h-px flex-1 bg-red-400" />Championship cut<span className="h-px flex-1 bg-red-400" /></div>}</div>)}</section>;
    })}</div></Page>;
  }
  const middle = Math.ceil(state.players.length / 2);
  return <Page title="Standings" note="The cut moves with the field; before scored games it rests in the middle."><div className="overflow-hidden rounded-xl border border-border">{state.players.map((p, i) => <div key={p.id}><div className={`grid grid-cols-[32px_1fr_52px_46px] items-center gap-2 px-3 py-3 text-sm ${p.name === "Mike V" ? "bg-primary/15" : "bg-card"}`}><span className="text-muted">{i + 1}</span><span className="truncate font-bold">{p.name}{p.name === "Mike V" ? " · YOU" : ""}<small className="block font-normal text-muted">{p.locked ? "Locked" : "No card"} · {p.streak > 0 ? `W${p.streak}` : p.streak < 0 ? `L${Math.abs(p.streak)}` : "—"}</small></span><strong className="text-right">{p.points}</strong><span className="text-right text-xs text-muted">+{p.weekPoints}</span></div>{i + 1 === middle && <div className="flex items-center gap-2 bg-red-950 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-red-300"><span className="h-px flex-1 bg-red-400" />Championship cut<span className="h-px flex-1 bg-red-400" /></div>}</div>)}</div></Page>;
}

function Postseason({ state, onUpdate }: { state: FoundryWalkthrough; onUpdate: (next: FoundryWalkthrough) => void }) {
  const [competition, setCompetition] = useState<"ncaa" | "championship" | "toilet">("ncaa");
  const cutWeek = foundryPostseasonStartWeek(state.sport);
  const stage = state.week < cutWeek ? -1 : Math.min(3, state.week - cutWeek);
  const championshipIds = new Set(state.postseasonFields?.championship || []);
  const toiletIds = new Set(state.postseasonFields?.toilet || []);
  const regionalFields = FIELDHOUSE_REGIONS.map((region) => {
    const ranked = state.players.filter((player) => player.region === region).sort((a, b) => b.points - a.points);
    const cut = Math.ceil(ranked.length / 2);
    const frozenChampionship = state.postseasonFields?.championship || [];
    const frozenToilet = state.postseasonFields?.toilet || [];
    return {
      region,
      championship: state.postseasonFields ? ranked.filter((player) => championshipIds.has(player.id)).sort((a, b) => frozenChampionship.indexOf(a.id) - frozenChampionship.indexOf(b.id)) : ranked.slice(0, cut),
      toilet: state.postseasonFields ? ranked.filter((player) => toiletIds.has(player.id)).sort((a, b) => frozenToilet.indexOf(a.id) - frozenToilet.indexOf(b.id)) : ranked.slice(cut),
    };
  });
  const top = state.sport === "cbb" ? regionalFields.flatMap((field) => field.championship) : state.players.slice(0, 8);
  const bottom = state.sport === "cbb" ? regionalFields.flatMap((field) => field.toilet) : state.players.slice(8, 16);
  const phase = stage < 0 ? `Projected fields · cut locks after ${PREVIEW_SPORTS[state.sport].weekLabel(cutWeek - 1)}` : stage === 0 ? "Fields locked · quarterfinals ready" : stage === 1 ? "Quarterfinals complete · semifinals ready" : stage === 2 ? "Semifinals complete · championship matchups ready" : "Postseason complete · winners crowned";
  if (state.sport === "cfb") { const phaseThreeWeek = cutWeek + 1; return <Page title={state.week < cutWeek ? "Regular Season Command" : state.week < phaseThreeWeek ? "CFB Phase II Lab" : "CFB Phase III Lab"} note={state.week < cutWeek ? `Phase II remains sealed until ${PREVIEW_SPORTS.cfb.weekLabel(cutWeek)}.` : state.week < phaseThreeWeek ? "Conference championships determine the final bowl and CFP field." : "Bowl Mania and the CFP are isolated Foundry previews. Nothing here writes to a live league."}><FoundryCfbActThree key={`cfb-phase-${state.generatedAt}`} seasonWeek={state.week} postseasonWeek={phaseThreeWeek} /></Page>; }
  if (state.sport === "nfl") return <Page title={state.week < cutWeek ? "Regular Season Command" : "NFL Phase III Lab"} note={state.week < cutWeek ? `The Road to the Bowl remains sealed until ${PREVIEW_SPORTS.nfl.weekLabel(cutWeek)}.` : "The playoff bracket and JDAM Protocol are isolated Foundry previews. Nothing here writes to a live league."}>{state.week < cutWeek ? <section className="rounded-2xl border border-sky-300/25 bg-card p-6 text-center"><h3 className="text-xl font-black">PLAYOFF OPERATIONS SEALED</h3><p className="mt-2 text-xs text-muted">Finish the regular season before the field exists.</p></section> : <FoundryNflActThree seasonWeek={state.week} />}</Page>;
  if (state.sport !== "cbb") return <Page title="The Postseason" note={phase}><div className="mb-4 grid grid-cols-2 gap-2"><Stat label="Championship field" value={String(top.length)} note={stage < 0 ? "projected" : "locked"} /><Stat label="Toilet Bowl field" value={String(bottom.length)} note={stage < 0 ? "projected" : "locked"} /></div><div className="grid gap-5"><TournamentBracket title="Championship" tone="gold" players={top} stage={stage} /><TournamentBracket title="Toilet Bowl" tone="purple" players={bottom} stage={stage} /></div></Page>;
  return <Page title="March Madness Command Center" note="Three separate competitions. NCAA picks never alter the player Championship or Toilet Bowl fields."><nav className="mb-4 grid grid-cols-3 gap-2">{([[
    "ncaa", "NCAA Bracket"], ["championship", "Championship"], ["toilet", "Toilet Bowl"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setCompetition(id)} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${competition === id ? "border-orange-300 bg-orange-300 text-black" : "border-border bg-card"}`}>{label}</button>)}</nav>
    {competition === "ncaa" && <NcaaBracketPicker state={state} onUpdate={onUpdate} />}
    {competition === "championship" && <RegionalTournamentBracket title="Fieldhouse Championship" tone="gold" fields={regionalFields.map((field) => ({ region: field.region, players: field.championship }))} stage={stage} rounds={foundryPostseasonRounds(state, "championship")} />}
    {competition === "toilet" && <RegionalTournamentBracket title="Toilet Bowl" tone="purple" fields={regionalFields.map((field) => ({ region: field.region, players: field.toilet }))} stage={stage} rounds={foundryPostseasonRounds(state, "toilet")} />}
  </Page>;
}

function NcaaBracketPicker({ state, onUpdate }: { state: FoundryWalkthrough; onUpdate: (next: FoundryWalkthrough) => void }) {
  const [guidedPick, setGuidedPick] = useState<number | null>(null);
  const [hellfireStep, setHellfireStep] = useState(0);
  const picks = state.ncaaPicks || {};
  const results = state.ncaaResults || {};
  const count = ncaaPickCount(picks);
  const score = ncaaScore(picks, results);
  const resultWindow = ncaaResultsWindow(results);
  const guidedGames = guidedNcaaGames(picks);
  function choose(game: NcaaGame, team: string) {
    if (state.ncaaBracketLocked) return;
    const nextPicks = sanitizeNcaaPicks({ ...picks, [game.id]: team });
    onUpdate({ ...state, ncaaPicks: nextPicks });
  }
  return <section className="rounded-2xl border border-orange-300/40 bg-orange-950/20 p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-300">Selection Sunday · 68 teams · 67 decisions</p><h3 className="text-xl font-black">The Bracket Drop</h3><p className="mt-1 text-[10px] text-muted">Fill the entire bracket once. Lock it before the First Four. Then watch the evidence accumulate.</p></div><div className="grid grid-cols-2 gap-1"><div className="rounded-xl border border-orange-300/30 bg-black/30 px-2 py-2 text-center"><strong className="block text-lg text-orange-200">{count}/67</strong><span className="text-[8px] uppercase text-muted">picked</span></div><div className="rounded-xl border border-emerald-300/30 bg-black/30 px-2 py-2 text-center"><strong className="block text-lg text-emerald-200">{score}</strong><span className="text-[8px] uppercase text-muted">points</span></div></div></div>
    {!state.ncaaBracketLocked && resultWindow === 0 && <><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onUpdate({ ...state, ncaaPicks: generateNcaaPicks(777) })} className="min-h-11 rounded-xl border border-orange-300/40 text-[10px] font-black text-orange-200">Test-fill 67 · no Hellfire</button><button type="button" disabled={count !== 67} onClick={() => onUpdate({ ...state, ncaaBracketLocked: true })} className="min-h-11 rounded-xl bg-orange-300 text-[10px] font-black text-black disabled:opacity-35">Lock entire bracket</button></div><HellfireAuthorizeButton count={count} onAuthorize={() => onUpdate(launchFoundryHellfire(state))}/><p className="mt-2 text-center text-[9px] font-bold text-orange-200/65">Hellfire fills every unpicked decision, replaces any human picks already on file, and locks the bracket.</p></>}
    {state.ncaaBracketLocked && <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-center text-[10px] font-black text-emerald-200">BRACKET LOCKED · No changes after first tip</div>}
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] text-muted"><strong className="text-foreground">Scoring:</strong> R64 1 · R32 2 · Sweet 16 4 · Elite Eight 8 · Final Four 16 · Title 32. {resultWindow ? `Results posted through postseason stage ${resultWindow}.` : "No tournament results posted yet."}</div>
    {guidedPick === null ? <FullBracketMap picks={picks} onBegin={() => setGuidedPick(Math.min(guidedGames.findIndex((game) => !picks[game.id]) < 0 ? 66 : guidedGames.findIndex((game) => !picks[game.id]), 66))} /> : <GuidedBracketPick game={guidedGames[guidedPick]} index={guidedPick} total={guidedGames.length} selected={picks[guidedGames[guidedPick].id] || null} result={results[guidedGames[guidedPick].id] || null} bracketLocked={state.ncaaBracketLocked} onChoose={(team) => { choose(guidedGames[guidedPick], team); window.setTimeout(() => setGuidedPick((current) => current === null || current >= guidedGames.length - 1 ? null : current + 1), 180); }} onBack={() => setGuidedPick((current) => current === null || current === 0 ? null : current - 1)} onMap={() => setGuidedPick(null)} onHellfire={() => onUpdate(launchFoundryHellfire(state))} />}
    {count === 67 && <div className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-300/10 p-3 text-center"><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-200">Bracket locked and loaded</p><p className="mt-1 text-sm font-black">Champion: {picks["national:championship"]}</p></div>}
    {state.mapsEvent?.protocol === "hellfire" && state.mapsEvent.reviewed && <HellfireDamageAssessment state={state} />}
    {state.mapsEvent?.protocol === "hellfire" && !state.mapsEvent.reviewed && <HellfireStrikeReview state={state} step={hellfireStep} onNext={() => setHellfireStep((value) => Math.min(value + 1, state.mapsEvent!.targetIds.length))} onComplete={() => onUpdate({ ...state, mapsEvent: state.mapsEvent ? { ...state.mapsEvent, reviewed: true } : null })} />}
  </section>;
}

function HellfireStrikeReview({ state, step, onNext, onComplete }: { state: FoundryWalkthrough; step: number; onNext: () => void; onComplete: () => void }) {
  const event = state.mapsEvent!;
  const complete = step >= event.targetIds.length;
  const id = event.targetIds[Math.min(step, event.targetIds.length - 1)];
  return <div className="fixed inset-0 z-[85] flex items-end justify-center overflow-y-auto bg-[#160300]/95 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Hellfire targeting review"><section className="w-full max-w-md rounded-3xl border-2 border-orange-500 bg-[radial-gradient(circle_at_top,#7c2d12,#130301_62%)] p-5 text-center shadow-[0_0_100px_rgba(249,115,22,.55)]"><div className="mx-auto flex justify-center"><WarRoomArsenalIcon kind={complete ? "maps" : "hellfire"} size={92}/></div><p className="mt-3 text-[9px] font-black uppercase tracking-[.24em] text-orange-300">M.A.P.’s · Hellfire Mode</p>{complete ? <><h3 className="mt-2 text-3xl font-black">STRIKE PACKAGE COMPLETE</h3><p className="mt-3 text-sm text-white/70">{event.humanPickCount ? `The targeting computer overwrote or filled ${event.changedCount} decisions. Your ${event.humanPickCount} human pick${event.humanPickCount === 1 ? " remains" : "s remain"} preserved as evidence.` : "No human bracket existed. The targeting computer made and locked all 67 decisions."}</p><button type="button" onClick={onComplete} className="mt-5 min-h-14 w-full rounded-xl bg-orange-500 text-sm font-black text-black">I HAVE SEEN THE DAMAGE</button></> : <><p className="mt-4 text-xs font-black text-orange-200">TARGET {step + 1} OF {event.targetIds.length}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[.16em] text-white/45">{event.originalPicks[id] ? "Original pick" : "No human pick on file"}</p><h3 className="mt-1 text-2xl font-black">{event.originalPicks[id] || "—"}</h3><div className="my-3 text-3xl text-orange-400">↓</div><p className="text-[9px] font-black uppercase tracking-[.16em] text-orange-200/65">Computer solution</p><h3 className="mt-1 text-2xl font-black text-orange-200">{state.ncaaPicks[id] || "COMPUTER PICK"}</h3><p className="mt-3 text-[10px] font-bold text-white/45">Game file: {id}</p><button type="button" onClick={onNext} className="mt-5 min-h-14 w-full rounded-xl bg-orange-500 text-sm font-black text-black">{step + 1 === event.targetIds.length ? "RUN DAMAGE ASSESSMENT" : "VIEW NEXT STRIKE"}</button></>}</section></div>;
}

function HellfireDamageAssessment({ state }: { state: FoundryWalkthrough }) {
  const event = state.mapsEvent!;
  const championChanged = event.originalPicks["national:championship"] !== state.ncaaPicks["national:championship"];
  async function share() {
    const text = event.humanPickCount ? `I authorized M.A.P.’s Hellfire Mode. ${event.changedCount} bracket decisions were overwritten or filled. Champion affected: ${championChanged ? "YES" : "NO"}. My bracket no longer reflects my personal beliefs.` : "I authorized M.A.P.’s Hellfire Mode before making a pick. The computer made and locked all 67 bracket decisions.";
    if (navigator.share) await navigator.share({ title: "War Room M.A.P.’s Damage Assessment", text });
    else await navigator.clipboard?.writeText(text);
  }
  return <section className="mt-4 rounded-2xl border-2 border-orange-500/70 bg-orange-950/30 p-4 text-center"><div className="mx-auto flex justify-center"><WarRoomArsenalIcon kind="maps" size={72}/></div><p className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-orange-300">Official damage assessment</p><h4 className="mt-1 text-xl font-black">{event.humanPickCount ? "THIS BRACKET NO LONGER REFLECTS YOUR PERSONAL BELIEFS." : "YOU PROVIDED NO BELIEFS. THE MACHINE IMPROVISED."}</h4><div className="mt-4 grid grid-cols-2 gap-2"><Stat label={event.humanPickCount ? "Decisions affected" : "Computer picks"} value={String(event.changedCount)} /><Stat label="Champion hit" value={event.humanPickCount ? championChanged ? "YES" : "NO" : "COMPUTER"} /></div><button type="button" onClick={() => void share()} className="mt-3 min-h-12 w-full rounded-xl border border-orange-400/60 text-xs font-black text-orange-200">SHARE THE EVIDENCE ↗</button></section>;
}

function guidedNcaaGames(picks: Record<string, string>): NcaaGame[] {
  return [
    ...firstFourGames(),
    ...NCAA_REGIONS.flatMap((region) => ([1, 2, 3, 4] as const).flatMap((round) => regionRoundGames(region, round, picks))),
    ...finalFourGames(picks),
    nationalChampionshipGame(picks),
  ];
}

function FullBracketMap({ picks, onBegin }: { picks: Record<string, string>; onBegin: () => void }) {
  const completed = ncaaPickCount(picks);
  return <section className="mt-4 overflow-hidden rounded-2xl border border-orange-300/30 bg-[radial-gradient(circle_at_center,rgba(251,146,60,.14),rgba(0,0,0,.35)_55%)] p-3"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-200">Your full bracket</p><h4 className="mt-1 text-lg font-black">Road to the Championship</h4></div><span className="rounded-full border border-orange-300/30 px-2 py-1 text-[9px] font-black">{completed}/67</span></div><div className="relative mt-4 grid grid-cols-2 gap-3 pb-20">{NCAA_REGIONS.map((region) => { const champion = picks[`${region}:r4:0`]; return <div key={region} className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="flex items-center justify-between"><strong className="text-[10px] uppercase tracking-wide">{region}</strong><span className="text-[8px] text-muted">8 → 4 → 2 → 1</span></div><div className="mt-3 space-y-1">{regionRoundGames(region, 1, picks).slice(0, 4).map((game) => <div key={game.id} className="h-1.5 rounded-full bg-white/10"><span className="block h-full rounded-full bg-orange-300/70" style={{ width: picks[game.id] ? "100%" : "0%" }} /></div>)}</div><p className="mt-3 truncate text-[9px] font-bold text-orange-200">{champion || "Regional champion"}</p></div>; })}<div className="absolute inset-x-[22%] bottom-0 rounded-xl border border-orange-300/40 bg-orange-950/80 p-3 text-center"><p className="text-[8px] font-black uppercase tracking-[.16em] text-orange-200">Final Four</p><p className="mt-1 text-xs font-black">{picks["national:championship"] || "One champion"}</p></div></div><button type="button" onClick={onBegin} className="mt-4 min-h-12 w-full rounded-xl bg-orange-300 text-sm font-black text-black">{completed ? "Continue Bracket" : "Begin Bracket"}</button><p className="mt-2 text-center text-[9px] text-muted">The view zooms into one matchup at a time.</p></section>;
}

function HellfireAuthorizeButton({ count, onAuthorize }: { count: number; onAuthorize: () => void }) {
  return <button type="button" onClick={onAuthorize} className="mt-3 flex min-h-16 w-full items-center justify-center rounded-2xl border-2 border-red-500 bg-[repeating-linear-gradient(135deg,#2a0802_0,#2a0802_12px,#050505_12px,#050505_24px)] px-4 text-sm font-black text-orange-100 shadow-[0_0_34px_rgba(249,115,22,.45)]"><span className="weapon-unstable flex items-center justify-center gap-3"><WarRoomArsenalIcon kind="hellfire" size={52}/><span><small className="block text-[8px] uppercase tracking-[.2em] text-orange-300">M.A.P.’s · Mutually Assured Picks</small>AUTHORIZE HELLFIRE MODE<small className="mt-1 block text-[8px] text-orange-200/70">Computer assumes command · {count}/67 human picks on file</small></span></span></button>;
}

function GuidedBracketPick({ game, index, total, selected, result, bracketLocked, onChoose, onBack, onMap, onHellfire }: { game: NcaaGame; index: number; total: number; selected: string | null; result: string | null; bracketLocked: boolean; onChoose: (team: string) => void; onBack: () => void; onMap: () => void; onHellfire: () => void }) {
  const section = game.id.startsWith("first-four:") ? "First Four" : game.id.startsWith("national:") ? game.label : `${game.id.split(":")[0]} Region · ${game.label}`;
  return <section className="mt-4 rounded-2xl border border-orange-300/35 bg-black/30 p-4 shadow-[0_18px_60px_rgba(0,0,0,.35)]"><div className="flex items-center justify-between"><button type="button" onClick={onBack} className="min-h-10 rounded-lg border border-border px-3 text-[9px] font-black">← Back</button><div className="text-center"><p className="text-[8px] font-black uppercase tracking-[.16em] text-orange-200">{section}</p><p className="mt-1 text-[10px] font-black">Pick {index + 1} of {total}</p></div><button type="button" onClick={onMap} className="min-h-10 rounded-lg border border-border px-3 text-[9px] font-black">Full Bracket</button></div><div className="my-5 h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-orange-300 transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} /></div><div className="mx-auto max-w-md"><NcaaPickGame game={game} selected={selected} result={result} bracketLocked={bracketLocked} onChoose={onChoose} /></div>{!bracketLocked && <HellfireAuthorizeButton count={index} onAuthorize={onHellfire}/>}<p className="mt-4 text-center text-[9px] font-bold text-muted">Choose a winner. The bracket advances automatically.</p></section>;
}

function NcaaPickGame({ game, selected, result, bracketLocked, onChoose }: { game: NcaaGame; selected: string | null; result: string | null; bracketLocked: boolean; onChoose: (team: string) => void }) {
  const ready = !!game.teamA && !!game.teamB;
  const teams = [{ team: game.teamA, seed: game.seedA }, { team: game.teamB, seed: game.seedB }];
  return <article className={`overflow-hidden rounded-xl border ${ready ? "border-orange-300/25 bg-black/25" : "border-border bg-card opacity-45"}`}><div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5"><span className="text-[8px] font-black uppercase tracking-wide text-muted">{game.label}</span>{result ? <span className={`text-[8px] font-black ${selected === result ? "text-emerald-300" : "text-red-300"}`}>{selected === result ? "CORRECT" : "FINAL"}</span> : selected && <span className="text-[8px] font-black text-orange-300">PICKED</span>}</div>{teams.map(({ team, seed }, index) => <button key={`${game.id}:${index}`} type="button" disabled={!team || !!result || bracketLocked} onClick={() => team && onChoose(team)} className={`flex min-h-11 w-full items-center justify-between border-b border-white/5 px-3 text-left text-xs last:border-0 disabled:cursor-not-allowed ${team && selected === team ? "bg-orange-300 font-black text-black" : ""} ${team && result === team ? "ring-1 ring-inset ring-emerald-300" : ""}`}><span className="flex min-w-0 items-center gap-2">{team && seed ? <strong className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] ${selected === team ? "border-black/30 bg-black/10" : "border-orange-300/35 bg-orange-300/10 text-orange-200"}`}>{seed}</strong> : null}<span className="truncate">{team || "Winner of prior game"}</span></span>{team && <span className="ml-2 shrink-0 text-[9px]">{result === team ? "WINNER" : selected === team ? result ? "WRONG" : bracketLocked ? "LOCKED" : "ADVANCES" : result ? "FINAL" : bracketLocked ? "" : "PICK"}</span>}</button>)}</article>;
}

function RegionalTournamentBracket({ title, tone, fields, stage, rounds }: { title: string; tone: "gold" | "purple"; fields: Array<{ region: FieldhouseRegion; players: FoundryWalkthrough["players"] }>; stage: number; rounds: ReturnType<typeof foundryPostseasonRounds> }) {
  const color = tone === "gold" ? "border-amber-300/45 bg-amber-300/5 text-amber-200" : "border-purple-400/45 bg-purple-400/5 text-purple-200";
  const playersById = new Map(fields.flatMap((field) => field.players).map((player) => [player.id, player]));
  const leftWinner = playersById.get(rounds.semifinalWinners[0]);
  const rightWinner = playersById.get(rounds.semifinalWinners[1]);
  const winner = rounds.champion ? playersById.get(rounds.champion) : undefined;
  const left = fields.filter((field) => field.region === "East" || field.region === "West");
  const right = fields.filter((field) => field.region === "South" || field.region === "Midwest");
  return <section className={`rounded-2xl border p-3 sm:p-4 ${color}`}><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.18em]">Mini March Madness · four regions</p><h3 className="text-xl font-black">{title}</h3></div><span className="rounded-full border border-current/30 px-2 py-1 text-[8px] font-black">{stage < 0 ? "LIVE PROJECTION" : stage >= 3 ? "FINAL" : "IN PROGRESS"}</span></div>
    <div className="mt-4 grid grid-cols-[1fr_72px_1fr] items-center gap-2 sm:grid-cols-[1fr_120px_1fr]">
      <RegionSide fields={left} stage={stage} side="left" regionalWinners={new Set(rounds.regionalWinners)} seedOrder={rounds.field} />
      <div className="space-y-3 text-center"><div className={`rounded-xl border border-current/35 bg-black/35 p-2 ${stage < 2 ? "opacity-40" : ""}`}><p className="text-[7px] font-black uppercase tracking-[.13em]">Final Four</p><p className="mt-1 truncate text-[9px] font-bold">{stage >= 2 ? leftWinner?.name : "East/West"}</p><p className="text-[9px]">vs</p><p className="truncate text-[9px] font-bold">{stage >= 2 ? rightWinner?.name : "South/Midwest"}</p></div><div className={`rounded-xl border-2 border-current bg-black/50 p-2 ${stage < 3 ? "opacity-35" : ""}`}><p className="text-[7px] font-black uppercase">Champion</p><p className="mt-1 truncate text-[10px] font-black">{stage >= 3 ? winner?.name : "TBD"}</p></div></div>
      <RegionSide fields={right} stage={stage} side="right" regionalWinners={new Set(rounds.regionalWinners)} seedOrder={rounds.field} />
    </div>
    <p className="mt-4 text-center text-[9px] font-bold opacity-70">Every regional winner advances toward the center. Final Four winners meet for the hardware.</p>
  </section>;
}

function RegionSide({ fields, stage, side, regionalWinners, seedOrder }: { fields: Array<{ region: FieldhouseRegion; players: FoundryWalkthrough["players"] }>; stage: number; side: "left" | "right"; regionalWinners: Set<string>; seedOrder: string[] }) {
  return <div className="space-y-3">{fields.map((field) => {
    const players = field.players;
    const regionWinner = players.find((player) => regionalWinners.has(player.id));
    return <div key={field.region} className={`rounded-xl border border-current/25 bg-black/25 p-2 ${side === "right" ? "text-right" : "text-left"}`}><p className="text-[8px] font-black uppercase tracking-[.14em]">{field.region} Region</p><div className="mt-2 space-y-1">{players.length ? players.map((player) => <div key={player.id} className={`flex items-center justify-between gap-1 rounded bg-white/5 px-2 py-1.5 text-[9px] ${stage >= 1 && regionalWinners.has(player.id) ? "bg-white/15 font-black" : ""}`}><span className="truncate">{seedOrder.indexOf(player.id) + 1} · {player.name}</span><span>{stage >= 1 ? regionalWinners.has(player.id) ? "ADV" : "OUT" : `+${player.madnessWindowPoints}`}</span></div>) : <div className="rounded bg-white/5 px-2 py-2 text-[9px] opacity-50">BYE / TBD</div>}</div><p className={`mt-2 text-[8px] font-black ${stage >= 1 ? "" : "opacity-35"}`}>{stage >= 1 ? `${regionWinner?.name || "TBD"} → center` : "Round points decide who advances"}</p></div>;
  })}</div>;
}


function TournamentBracket({ title, tone, players, stage }: { title: string; tone: "gold" | "purple"; players: FoundryWalkthrough["players"]; stage: number }) {
  const color = tone === "gold" ? "border-amber-300/45 bg-amber-300/5 text-amber-200" : "border-purple-400/45 bg-purple-400/5 text-purple-200";
  const seeded = players.map((player, index) => ({ ...player, seed: index + 1 }));
  const qf = [[seeded[0], seeded[7]], [seeded[3], seeded[4]], [seeded[1], seeded[6]], [seeded[2], seeded[5]]];
  const sf = [[seeded[0], seeded[3]], [seeded[1], seeded[2]]];
  const final = [[seeded[0], seeded[1]]];
  return <section className={`rounded-2xl border p-4 ${color}`}><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.18em]">War Room bracket</p><h3 className="text-xl font-black">{title}</h3></div><span className="rounded-full border border-current/30 px-2 py-1 text-[9px] font-black">{stage < 0 ? "LIVE PROJECTION" : stage >= 3 ? "FINAL" : "IN PROGRESS"}</span></div>
    {stage < 0 ? <div className="mt-4 space-y-2">{seeded.map((p) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs"><span><strong className="mr-2">{p.seed}</strong>{p.name}</span><span>{p.points}</span></div>)}</div> : <div className="mt-4 space-y-4"><BracketRound label="Quarterfinals" pairs={qf} completed={stage >= 1} /><BracketRound label="Semifinals" pairs={sf} completed={stage >= 2} muted={stage < 1} /><BracketRound label="Final" pairs={final} completed={stage >= 3} muted={stage < 2} />{stage >= 3 && <div className="rounded-xl border border-current/40 bg-black/35 p-4 text-center"><p className="text-[9px] font-black uppercase tracking-[.2em]">{title} winner</p><p className="mt-1 text-2xl font-black">{seeded[0]?.name}</p><p className="mt-1 text-[10px] opacity-70">Seed {seeded[0]?.seed} · survives the bracket</p></div>}</div>}
  </section>;
}

function BracketRound({ label, pairs, completed, muted }: { label: string; pairs: Array<Array<(FoundryWalkthrough["players"][number] & { seed: number }) | undefined>>; completed: boolean; muted?: boolean }) {
  return <div className={muted ? "opacity-35" : ""}><p className="mb-2 text-[9px] font-black uppercase tracking-[.16em] opacity-70">{label} · {completed ? "complete" : muted ? "waiting" : "up next"}</p><div className="space-y-2">{pairs.map((pair, index) => <div key={index} className="overflow-hidden rounded-lg border border-current/20 bg-black/25 text-xs">{pair.map((p, row) => <div key={p?.id || row} className={`flex items-center justify-between px-3 py-2 ${row === 0 && completed ? "bg-white/10 font-black" : ""}`}><span>{p ? `${p.seed} · ${p.name}` : "TBD"}</span><span>{completed ? row === 0 ? "ADV" : "OUT" : "—"}</span></div>)}</div>)}</div></div>;
}

function Gazette({ state, selectedWeek, onSelectWeek }: { state: FoundryWalkthrough; selectedWeek: number | null; onSelectWeek: (week: number) => void }) {
  const weeks = state.gazetteWeeks || [];
  const active = selectedWeek && weeks.includes(selectedWeek) ? selectedWeek : weeks[weeks.length - 1] || null;
  if (!active) return <Page title="Gazette Archive" note="One compact link per scored week. One full newspaper open at a time."><div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center"><h3 className="font-black">The presses are quiet</h3><p className="mt-2 text-xs text-muted">Simulate Week to score the card and publish the first Gazette.</p></div></Page>;
  const raw = buildFoundryGazetteFixture(((active - 1) % 18) + 1, state.generatedAt + active * 1000);
  let nflJdamAuthorized = false;
  let cfbDeadHandAuthorized = false;
  if (state.sport === "cfb" && typeof window !== "undefined") {
    try { const nuclear = JSON.parse(localStorage.getItem("warroom-foundry-cfb-act-three-v3") || "null")?.nuclear; cfbDeadHandAuthorized = !!nuclear?.active && nuclear.authorizationWeek === active; } catch { cfbDeadHandAuthorized = false; }
  }
  if (state.sport === "nfl" && typeof window !== "undefined") {
    try { const jdam = JSON.parse(localStorage.getItem("warroom-foundry-nfl-maps-v1") || "null"); nflJdamAuthorized = !!jdam?.original && jdam.authorizationWeek === active; } catch { nflJdamAuthorized = false; }
  }
  const emergencyProtocol = state.tacticalNukeWeeks?.includes(active)
    ? "tactical_nuke" as const
    : cfbDeadHandAuthorized
      ? "dead_hand" as const
    : state.sport === "cbb" && state.mapsEvent?.protocol === "hellfire" && state.mapsEvent.authorizationWeek === active
      ? "hellfire" as const
      : nflJdamAuthorized
        ? "jdam" as const
        : undefined;
  const tacticalNukeDetonation = emergencyProtocol === "tactical_nuke"
    ? {
        names: ["Mike V"],
        pts: state.players.find((player) => player.name === "Mike V")?.weekPoints || 0,
        kind: "clear" as const,
        headline: "MIKE V HAS REMOVED HIMSELF FROM COMMAND",
        deck: "The Tactical Nuclear Button was authorized before lock. A computer now has custody of the card, the points count double, and everyone is pretending this was covered in the bylaws.",
      }
    : emergencyProtocol === "hellfire"
      ? { names: ["Mike V"], pts: 0, kind: "clear" as const, headline: "MIKE V HAS CALLED IN HELLFIRE ON HIS OWN BRACKET", deck: state.mapsEvent?.humanPickCount ? `A drone overwrote or filled ${state.mapsEvent.changedCount} tournament decisions. The bracket no longer reflects his personal beliefs, which legal analysts agree may be the point.` : "Mike submitted no human bracket before authorizing Hellfire. A drone made and locked all 67 decisions, citing the complete absence of adult supervision." }
      : emergencyProtocol === "jdam"
        ? { names: ["Mike V"], pts: 0, kind: "clear" as const, headline: "MIKE V HAS RELEASED THE JDAM PACKAGE", deck: "The computer acquired the NFL playoff bracket, altered the flight plan, and locked every decision before the pilot could remember who had home-field advantage." }
        : emergencyProtocol === "dead_hand"
          ? { names: ["Mike V"], pts: 0, kind: "clear" as const, headline: "MIKE V HAS REMOVED HIMSELF FROM THE CHAIN OF COMMAND", deck: "Dead Hand seized all 25 bowl picks, spent every confidence point, and locked the board before its former commander could object. The machine continues to insist it identified something in Boise." }
        : raw.chaosDetonation;
  const edition = { ...raw, weekIndex: active, weekLabel: PREVIEW_SPORTS[state.sport].weekLabel(active), sportId: state.sport, volumeLabel: `${PREVIEW_SPORTS[state.sport].room.toUpperCase()} · FOUNDRY PREVIEW · NO CLOUD WRITES`, chaosDetonation: tacticalNukeDetonation, emergencyProtocol };
  return <Page title="Gazette Archive" note={`${weeks.length} scored edition${weeks.length === 1 ? "" : "s"} · choose a week, then read its four pages.`}><nav className="mb-4 rounded-xl border border-border bg-card p-3" aria-label="Gazette editions"><label className="block text-[9px] font-black uppercase tracking-[.16em] text-muted sm:hidden" htmlFor="gazette-edition-picker">Edition</label><select id="gazette-edition-picker" value={active} onChange={(event) => onSelectWeek(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-black sm:hidden">{[...weeks].reverse().map((week) => <option key={week} value={week}>{PREVIEW_SPORTS[state.sport].weekLabel(week)}{week === weeks[weeks.length - 1] ? " · latest" : ""}</option>)}</select><div className="hidden gap-2 overflow-x-auto pb-1 sm:flex">{weeks.map((week) => <button key={week} type="button" onClick={() => onSelectWeek(week)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-black ${week === active ? "bg-stone-100 text-stone-900" : "border border-border"}`}>{PREVIEW_SPORTS[state.sport].weekLabel(week)}</button>)}</div></nav>{state.sport === "cbb" && ncaaResultsWindow(state.ncaaResults || {}) > 0 && <MadnessGazetteBulletin state={state} />}<GazettePaper edition={edition} foundryPreview /></Page>;
}

function MadnessGazetteBulletin({ state }: { state: FoundryWalkthrough }) {
  const window = ncaaResultsWindow(state.ncaaResults || {});
  const me = state.players.find((player) => player.name === "Mike V");
  const champion = state.ncaaResults?.["national:championship"];
  const copy = window === 1
    ? { kicker: "Opening weekend emergency edition", headline: "BRACKETS BLEED. GROUP CHAT CLAIMS IT SAW THIS COMING.", body: "The First Four and Round of 64 left favorites standing, sleepers screaming, and several confidently selected teams legally deceased." }
    : window === 3
      ? { kicker: "Regional weekend", headline: "FOUR REGIONS ENTER. EVERYONE’S SCREENSHOTS BECOME EVIDENCE.", body: "Sweet 16 and Elite Eight results crowned regional survivors while the Fieldhouse Championship and Toilet Bowl tightened toward the middle." }
      : { kicker: "Final dispatch", headline: `${champion || "ONE TEAM"} CUTS DOWN THE NETS. RECEIPTS CUT DEEPER.`, body: "The national title is final. The player brackets have nowhere left to hide, and the Ring Ceremony is warming up backstage." };
  return <aside className="mb-4 rounded-2xl border-2 border-orange-300/50 bg-[#efe7d2] p-4 text-stone-950 shadow-lg"><p className="text-[9px] font-black uppercase tracking-[.18em] text-red-800">{copy.kicker}</p><h3 className="mt-2 font-serif text-xl font-black leading-tight">{copy.headline}</h3><p className="mt-2 text-xs leading-relaxed text-stone-700">{copy.body}</p><div className="mt-3 border-t border-stone-400/50 pt-2 text-[10px] font-bold">Mike’s bracket: {me?.madnessPoints || 0} points · League leader: {state.players[0]?.name} ({state.players[0]?.madnessPoints || 0} Madness points)</div></aside>;
}

function Locker({ state }: { state: FoundryWalkthrough }) { const crown = state.players[0]; return <Page title="Locker Room" note="Fictional room talk generated from this simulated week."><div className="space-y-3">{[["Kahmann", `Congrats ${crown.name}. Please stop refreshing the standings.`], ["Maria", "The confidence five was a crime scene."], ["Big Balls Ben", "I have reviewed the tape and decided the tape is biased."], ["Jstray", "Toilet Bowl scouts were in attendance. No comment."]].map(([name, message], i) => <div key={name} className={`max-w-[88%] rounded-2xl p-3 ${i % 2 ? "ml-auto bg-primary/15" : "border border-border bg-card"}`}><strong className="text-xs">{name}</strong><p className="mt-1 text-sm">{message}</p></div>)}</div><div className="mt-5 flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-xs text-muted">Message entry disabled in isolated preview</div></Page>; }

function Board({ state }: { state: FoundryWalkthrough }) { return <Page title="The Board" note="Weekly results, crowns, shame, and movement."><div className="grid gap-3 sm:grid-cols-2"><Feature kicker="Week crown" title={state.players[0].name} body={`${state.players[0].weekPoints} points · asked where the statue goes.`} /><Feature kicker="The shame desk" title={state.players[state.players.length - 1].name} body={`${state.players[state.players.length - 1].weekPoints} points · appeal denied.`} /><Feature kicker="Biggest mover" title={state.players[3].name} body="Up four places. Power ranking complaints formally reopened." /><Feature kicker="Cut watch" title="One card apart" body="The middle of the room is separated by six points." /></div></Page>; }

function Profile({ state }: { state: FoundryWalkthrough }) {
  const me = state.players.find((p) => p.name === "Mike V")!;
  const delivery: "dead_hand" | "jdam" | "hellfire" = state.sport === "cfb" ? "dead_hand" : state.sport === "nfl" ? "jdam" : "hellfire";
  const deliveryName = state.sport === "cfb" ? "Dead Hand Protocol" : state.sport === "nfl" ? "JDAM Protocol" : "Hellfire Mode";
  const nukesUsed = state.tacticalNukeWeeks?.length || 0;
  return <Page title="Mike V" note="Account profile · preview identity"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-black text-black">MV</div><div><h3 className="text-xl font-black">Mike V</h3><p className="text-xs text-muted">Commissioner · Foundry tester</p></div></div><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Points" value={String(me.points)} /><Stat label="Correct" value={String(me.correct)} /><Stat label="Streak" value={me.streak > 0 ? `W${me.streak}` : "—"} /></div></section>
    <section className="mt-3 overflow-hidden rounded-2xl border-2 border-slate-500/50 bg-[radial-gradient(circle_at_top,#172033,#05070b_70%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,.35)]"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-amber-300">Profile Arsenal</p><h3 className="mt-1 text-xl font-black">AUTHORIZED SYSTEMS</h3></div><WarRoomArsenalIcon kind="maps" size={62}/></div><div className="mt-4 grid grid-cols-2 gap-3"><ArsenalCard icon="nuke" name="Tactical Nuke" status={`${nukesUsed} used · ${foundryTacticalNukesRemaining(state)}/2 ready`} live={nukesUsed > 0}/><ArsenalCard icon={delivery} name={deliveryName} status={state.week >= foundryPostseasonStartWeek(state.sport) ? "M.A.P.’s available" : "Postseason sealed"} live={state.week >= foundryPostseasonStartWeek(state.sport)}/></div><p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Weapons appear here because the season remembers what you authorized.</p></section>
    <section className="mt-3 rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-black uppercase tracking-wide text-muted">Sport passport</p><h3 className="mt-1 font-black">{PREVIEW_SPORTS[state.sport].sport}</h3><p className="mt-2 text-sm text-muted">2026 season active · one weekly crown · card lock streak intact.</p></section></Page>;
}

function ArsenalCard({ icon, name, status, live }: { icon: "nuke" | "dead_hand" | "jdam" | "hellfire"; name: string; status: string; live: boolean }) {
  return <article className={`rounded-2xl border p-3 text-center ${live ? "border-amber-300/50 bg-amber-300/10" : "border-slate-700 bg-black/35 opacity-65"}`}><div className="mx-auto flex justify-center"><WarRoomArsenalIcon kind={icon} size={82}/></div><h4 className="mt-2 text-xs font-black">{name}</h4><p className={`mt-1 text-[9px] font-bold ${live ? "text-amber-200" : "text-slate-500"}`}>{status}</p></article>;
}

function Commissioner({ state, onAdvance }: { state: FoundryWalkthrough; onAdvance: () => void }) { return <Page title="Commissioner" note="Preview controls operate only on the local fictional room."><div className="space-y-3"><Feature kicker="Card status" title="Published and locked" body={`${state.games.length} games · ${state.players.filter((p) => p.locked).length} of ${state.players.length} cards locked.`} /><Feature kicker="Scoring" title="Week ready" body="Final results, standings movement, and Gazette edition are generated." /><button onClick={onAdvance} className="min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Score this week & open next</button><button className="min-h-12 w-full rounded-xl border border-border text-sm font-bold">Edit next card (preview)</button></div></Page>; }

function PreviewChrome({ state, busy, onWeek, onRegular, onSeason, onRole, onGazette, onBrackets, onHome, onReset }: { state: FoundryWalkthrough; busy: boolean; onWeek: () => void; onRegular: () => void; onSeason: () => void; onRole: (r: PreviewRole) => void; onGazette: () => void; onBrackets: () => void; onHome: () => void; onReset: () => void }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [more, setMore] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  function clamp(left: number, top: number) {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return { left, top };
    return { left: Math.max(8, Math.min(window.innerWidth - rect.width - 8, left)), top: Math.max(8, Math.min(window.innerHeight - rect.height - 8, top)) };
  }
  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const rect = root.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    setPosition(clamp(event.clientX - drag.current.dx, event.clientY - drag.current.dy));
  }
  function endDrag() { drag.current = null; }
  if (collapsed) return <div ref={root} className="fixed z-50 rounded-full border border-emerald-400/50 bg-emerald-950/95 p-1 shadow-2xl" style={position ? { left: position.left, top: position.top } : { left: 12, bottom: "max(10px, env(safe-area-inset-bottom))" }}><button type="button" onClick={() => setCollapsed(false)} className="min-h-11 rounded-full px-4 text-[10px] font-black text-emerald-200">FOUNDRY · OPEN</button></div>;
  const seasonFinal = isFoundrySeasonFinal(state);
  return <div ref={root} className="fixed z-50 w-[92vw] max-w-[360px] rounded-2xl border border-emerald-400/50 bg-emerald-950/95 p-2 shadow-2xl backdrop-blur" style={position ? { left: position.left, top: position.top } : { right: 12, bottom: "max(10px, env(safe-area-inset-bottom))" }}>
    <button type="button" aria-label="Drag Foundry controls" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="mb-1 flex min-h-6 w-full touch-none items-center justify-center rounded-lg border border-emerald-400/20 text-[8px] font-black uppercase tracking-[.16em] text-emerald-300"><span className="mr-2 text-sm leading-none">≡</span> Drag controller</button>
    <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10px] font-black">{PREVIEW_SPORTS[state.sport].room} · {PREVIEW_SPORTS[state.sport].weekLabel(state.week)}{seasonFinal ? " · FINAL" : ""}</p><button onClick={() => onRole(state.role === "player" ? "commissioner" : "player")} className="text-[9px] font-bold text-emerald-300">Viewing as {state.role} · switch</button></div></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><button disabled={busy} onClick={onWeek} className="min-h-10 rounded-lg bg-emerald-300 px-2 text-[9px] font-black text-emerald-950 disabled:opacity-40">{seasonFinal ? "Ring Ceremony" : "Sim Week"}</button><button disabled={busy || seasonFinal} onClick={onRegular} className="min-h-10 rounded-lg border border-amber-300/50 px-1 text-[9px] font-black text-amber-200 disabled:opacity-40">Sim Regular Season</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCollapsed(true)} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Collapse</button><button type="button" onClick={() => setMore((v) => !v)} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">{more ? "Close tools" : "More tools"}</button></div>
    {more && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-emerald-400/20 pt-2"><button type="button" onClick={onHome} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Sandbox Home</button><button type="button" onClick={onBrackets} className="min-h-9 rounded-lg border border-amber-300/40 text-[9px] font-bold text-amber-200">View Brackets</button><button type="button" onClick={onGazette} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Replay Gazette</button><button type="button" disabled={busy} onClick={() => { if (seasonFinal || window.confirm("Sim the entire remaining season and skip directly to the Ring Ceremony?")) onSeason(); }} className="min-h-9 rounded-lg border border-amber-300/35 text-[9px] font-bold text-amber-200 disabled:opacity-40">{seasonFinal ? "Replay Rings" : "Sim Entire Season"}</button><button type="button" onClick={onReset} className="min-h-9 rounded-lg border border-red-400/30 text-[9px] font-bold text-red-200">Reset this sport</button><Link href="/foundry" className="flex min-h-9 items-center justify-center rounded-lg border border-emerald-400/20 text-[9px] font-bold">Change sport / Exit</Link></div>}
  </div>;
}
function SimulationPulse({ kind, step }: { kind: "week" | "regular" | "season"; step: number }) {
  const weekSteps = ["Locking every card…", "Playing and scoring the slate…", "Moving standings and the cut line…", "Printing the Gazette…"];
  const seasonSteps = ["Building the full schedule…", "Playing every weekly card…", "Writing the rivalry history…", "Setting the postseason field…", "Opening the season archive…"];
  const regularSteps = ["Building the regular season…", "Playing every weekly card…", "Moving standings and cut lines…", "Locking both postseason fields…", "Opening the brackets…"];
  const steps = kind === "week" ? weekSteps : kind === "regular" ? regularSteps : seasonSteps;
  return <div className="pointer-events-none fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[60] mx-auto max-w-sm rounded-2xl border border-amber-300/50 bg-black/95 p-4 text-center shadow-2xl"><p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">Simulating {kind}</p><p className="mt-2 text-sm font-black">{steps[Math.min(step, steps.length - 1)]}</p><div className="mt-3 flex gap-1">{steps.map((_, i) => <span key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-amber-300" : "bg-white/15"}`} />)}</div></div>;
}
function PreviewRingCeremony({ state, onClose }: { state: FoundryWalkthrough; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const championship = foundryPostseasonRounds(state, "championship");
  const toilet = foundryPostseasonRounds(state, "toilet");
  const champion = state.players.find((player) => player.id === championship.champion) || state.players[0];
  const toiletChampion = state.players.find((player) => player.id === toilet.champion) || state.players[state.players.length - 1];
  const bracketWinner = [...state.players].sort((a, b) => b.madnessPoints - a.madnessPoints || b.points - a.points)[0];
  const ncaaChampion = state.ncaaResults?.["national:championship"];
  const nerds = state.players.filter((player) => ncaaChampion && state.preseasonChampionPicks?.[player.id] === ncaaChampion);
  const meta = PREVIEW_SPORTS[state.sport];
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  const slides = state.sport === "cbb" ? [
    { kicker: "The season is final", title: "THREE RACES. ONE PROPHECY.", body: `${meta.room} has a Fieldhouse Champion, a Toilet Bowl survivor, one bracket crown, and preseason receipts from the people who somehow knew.` },
    { kicker: "2026 Fieldhouse Champion", title: champion.name.toUpperCase(), body: `Survived the regional matchup, the semifinal, and the title game. The final standings did not award this ring. The bracket did.` },
    { kicker: "2026 Toilet Bowl Champion", title: toiletChampion.name.toUpperCase(), body: "Entered through the wrong side of the cut. Left carrying porcelain hardware and an alarming amount of confidence." },
    { kicker: "NCAA bracket crown", title: bracketWinner.name.toUpperCase(), body: `${bracketWinner.madnessPoints} bracket points. Sixty-seven decisions entered into evidence. Most of them survived cross-examination.` },
    { kicker: "Village Nerd · preseason prophecy", title: nerds.length ? nerds.map((player) => player.name).join(" · ").toUpperCase() : "NO SURVIVING PROPHETS", body: nerds.length ? `${ncaaChampion} was called before Window 1. This is not the Selection Sunday bracket prize. These receipts are months older and considerably more annoying.` : `Nobody named ${ncaaChampion} before the season. The crystal ball has been placed on administrative leave.` },
    { kicker: "The ring", title: "HISTORY DOESN’T ASK HOW", body: "It remembers who survived the Fieldhouse bracket when everybody else ran out of rounds." },
  ] : [
    { kicker: "The season is final", title: "ONE NAME REMAINS", body: `${meta.room} has receipts, casualties, and a champion.` },
    { kicker: "2026 champion", title: champion.name.toUpperCase(), body: `${champion.points} points. ${state.gazetteWeeks.length} windows survived. Every excuse has been entered into evidence.` },
    { kicker: "The ring", title: "HISTORY DOESN’T ASK HOW", body: "It only remembers whose name was engraved when everybody else ran out of weeks." },
  ];
  const current = slides[slide];
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[radial-gradient(circle_at_top,#78350f_0%,#111827_38%,#020617_100%)] px-4 py-[max(24px,env(safe-area-inset-top))] text-white" role="dialog" aria-modal="true" aria-label="Foundry Ring Ceremony">
    <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-between text-center">
      <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-full border border-white/25 px-4 text-xs font-bold">Skip</button>
      <section className="py-8"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">{current.kicker}</p>{slide === slides.length - 1 && <div className="mx-auto my-7 flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-amber-300 bg-gradient-to-br from-yellow-100 via-amber-400 to-amber-800 text-5xl font-black text-black shadow-[0_0_70px_rgba(251,191,36,.65)]">WR</div>}<h2 className="mt-5 text-4xl font-black leading-none">{current.title}</h2><p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-white/75">{current.body}</p>{slide === 1 && <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-amber-300">{meta.sport} · Foundry Season</p>}</section>
      <div className="pb-[max(12px,env(safe-area-inset-bottom))]"><div className="mb-4 flex justify-center gap-2">{slides.map((_, i) => <span key={i} className={`h-1.5 w-10 rounded-full ${i <= slide ? "bg-amber-300" : "bg-white/20"}`} />)}</div><button type="button" onClick={() => slide < slides.length - 1 ? setSlide(slide + 1) : onClose()} className="min-h-12 w-full rounded-xl bg-amber-300 text-sm font-black text-black">{slide < slides.length - 1 ? "Continue" : "Enter completed season"}</button><p className="mt-3 text-[9px] uppercase tracking-wide text-white/40">Foundry preview · no trophy engraved · no cloud writes</p></div>
    </div>
  </div>;
}
function Page({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <section><h2 className="text-2xl font-black">{title}</h2><p className="mb-4 mt-1 text-xs text-muted">{note}</p>{children}</section>; }
function Stat({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="rounded-xl border border-border bg-card p-3"><span className="block text-[9px] font-black uppercase tracking-wide text-muted">{label}</span><strong className="mt-1 block text-xl">{value}</strong>{note && <span className="text-[10px] text-muted">{note}</span>}</div>; }
function Feature({ kicker, title, body }: { kicker: string; title: string; body: string }) { return <article className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">{kicker}</p><h3 className="mt-1 text-lg font-black">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{body}</p></article>; }
