"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GazettePaper from "@/components/GazettePaper";
import { buildFoundryGazetteFixture } from "@/lib/foundry-gazette-fixtures";
import {
  createFoundryWalkthrough,
  FIELDHOUSE_REGIONS,
  FOUNDRY_WALKTHROUGH_EVENT,
  foundryWeekStartDate,
  isFoundrySeasonFinal,
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
      setView(simulation.kind === "week" ? "gazette" : simulation.kind === "regular" ? "postseason" : "home");
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
      {view === "home" && <Home state={state} go={setView} />}
      {view === "picks" && <Picks state={state} />}
      {view === "standings" && <Standings state={state} />}
      {view === "postseason" && <Postseason state={state} />}
      {view === "gazette" && <Gazette state={state} selectedWeek={gazetteWeek} onSelectWeek={setGazetteWeek} />}
      {view === "locker" && <Locker state={state} />}
      {view === "board" && <Board state={state} />}
      {view === "profile" && <Profile state={state} />}
      {view === "commissioner" && <Commissioner state={state} onAdvance={() => update(simulateNextFoundryWeek(state))} />}
    </div>
    {simulation && <SimulationPulse kind={simulation.kind} step={simulation.step} />}
    {ringCeremony && <PreviewRingCeremony state={ringCeremony} onClose={() => setRingCeremony(null)} />}
    <PreviewChrome state={state} busy={!!simulation} onWeek={() => isFoundrySeasonFinal(state) ? setRingCeremony(state) : setSimulation({ kind: "week", step: 0 })} onRegular={() => setSimulation({ kind: "regular", step: 0 })} onSeason={() => isFoundrySeasonFinal(state) ? setRingCeremony(state) : setSimulation({ kind: "season", step: 0 })} onRole={(role) => update(setFoundryWalkthroughRole(state, role))} onGazette={() => { setGazetteWeek(state.gazetteWeeks[state.gazetteWeeks.length - 1] || null); setView("gazette"); }} onBrackets={() => setView("postseason")} onHome={() => setView("home")} onReset={() => { update(createFoundryWalkthrough(state.sport, 1, state.role)); setGazetteWeek(null); setView("home"); }} />
  </main>;
}

function Home({ state, go }: { state: FoundryWalkthrough; go: (v: View) => void }) {
  const meta = PREVIEW_SPORTS[state.sport]; const me = state.players.find((p) => p.name === "Mike V") || state.players[0]; const rank = state.players.findIndex((p) => p.id === me.id) + 1;
  return <div className="space-y-3"><section className="rounded-2xl border border-primary/35 bg-card p-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">{meta.cadence} · card open</p><h2 className="mt-2 text-3xl font-black">{meta.weekLabel(state.week)}</h2><p className="mt-2 text-sm text-muted">Five games. Confidence 5 through 1. Lock before the first game begins.</p><button onClick={() => go("picks")} className="mt-4 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Open My Picks</button></section>
    <div className="grid grid-cols-2 gap-3"><Stat label="Your rank" value={`#${rank}`} note={`${me.points} season points`} /><Stat label="This week" value={`${me.weekPoints} pts`} note={`${me.correct} correct`} /></div>
    <button onClick={() => go("gazette")} className="w-full rounded-2xl border border-stone-500 bg-[#eee8da] p-4 text-left text-stone-900"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-800">{state.gazetteWeeks.length ? `${state.gazetteWeeks.length} archived edition${state.gazetteWeeks.length === 1 ? "" : "s"}` : "After the first score"}</p><strong className="mt-1 block font-serif text-xl">The War Room Gazette</strong><span className="text-xs">{state.gazetteWeeks.length ? "Tap a week in the archive to read that edition." : "The first weekly paper prints when you simulate Week 1."}</span></button>
    <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-black">Room pulse</h3><div className="mt-3 space-y-2">{state.players.slice(0, 3).map((p, i) => <div key={p.id} className="flex items-center justify-between text-sm"><span>{i + 1}. {p.name}</span><strong>{p.points}</strong></div>)}</div><button onClick={() => go("standings")} className="mt-3 text-xs font-bold text-primary">Full standings →</button></section></div>;
}

function Picks({ state }: { state: FoundryWalkthrough }) { return <Page title="My Picks" note={`${PREVIEW_SPORTS[state.sport].weekLabel(state.week)} · saved locally for preview`}><div className="space-y-3">{state.games.map((g) => <article key={g.id} className="rounded-xl border border-border bg-card p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-muted">{g.status === "final" ? "Final" : "Upcoming"}</p><h3 className="mt-1 font-black">{g.away} at {g.home}</h3><p className="text-xs text-muted">{g.spread}{g.result ? ` · ${g.result}` : ""}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-black">{g.confidence}</span></div><div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">Pick: <strong>{g.pick}</strong></div></article>)}</div><p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">Card locked · preview picks cannot reach a live league.</p></Page>; }

function Standings({ state }: { state: FoundryWalkthrough }) {
  if (state.sport === "cbb") {
    return <Page title="Regional Standings" note="East, West, South, and Midwest each carry their own cut line into the Fieldhouse postseason."><div className="grid gap-4 sm:grid-cols-2">{FIELDHOUSE_REGIONS.map((region) => {
      const players = state.players.filter((player) => player.region === region).sort((a, b) => b.points - a.points);
      const middle = Math.ceil(players.length / 2);
      return <section key={region} className="overflow-hidden rounded-2xl border border-orange-300/30 bg-card"><div className="border-b border-orange-300/20 bg-orange-300/10 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-300">Fieldhouse region</p><h3 className="text-lg font-black">{region}</h3></div>{players.map((player, index) => <div key={player.id}><div className={`grid grid-cols-[28px_1fr_48px] items-center gap-2 px-3 py-3 text-xs ${player.name === "Mike V" ? "bg-primary/15" : ""}`}><span className="text-muted">{index + 1}</span><span className="truncate font-bold">{player.name}{player.name === "Mike V" ? " · YOU" : ""}<small className="block font-normal text-muted">{player.locked ? "Locked" : "No card"} · {player.streak > 0 ? `W${player.streak}` : player.streak < 0 ? `L${Math.abs(player.streak)}` : "—"}</small></span><strong className="text-right">{player.points}</strong></div>{index + 1 === middle && <div className="flex items-center gap-2 bg-red-950 px-2 py-1.5 text-[8px] font-black uppercase tracking-[.13em] text-red-300"><span className="h-px flex-1 bg-red-400" />Championship cut<span className="h-px flex-1 bg-red-400" /></div>}</div>)}</section>;
    })}</div></Page>;
  }
  const middle = Math.ceil(state.players.length / 2);
  return <Page title="Standings" note="The cut moves with the field; before scored games it rests in the middle."><div className="overflow-hidden rounded-xl border border-border">{state.players.map((p, i) => <div key={p.id}><div className={`grid grid-cols-[32px_1fr_52px_46px] items-center gap-2 px-3 py-3 text-sm ${p.name === "Mike V" ? "bg-primary/15" : "bg-card"}`}><span className="text-muted">{i + 1}</span><span className="truncate font-bold">{p.name}{p.name === "Mike V" ? " · YOU" : ""}<small className="block font-normal text-muted">{p.locked ? "Locked" : "No card"} · {p.streak > 0 ? `W${p.streak}` : p.streak < 0 ? `L${Math.abs(p.streak)}` : "—"}</small></span><strong className="text-right">{p.points}</strong><span className="text-right text-xs text-muted">+{p.weekPoints}</span></div>{i + 1 === middle && <div className="flex items-center gap-2 bg-red-950 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-red-300"><span className="h-px flex-1 bg-red-400" />Championship cut<span className="h-px flex-1 bg-red-400" /></div>}</div>)}</div></Page>;
}

function Postseason({ state }: { state: FoundryWalkthrough }) {
  const finalWeek = state.sport === "cbb" ? 22 : state.sport === "nfl" ? 18 : 16;
  const cutWeek = finalWeek - 3;
  const stage = state.week < cutWeek ? -1 : Math.min(3, state.week - cutWeek);
  const regionalFields = FIELDHOUSE_REGIONS.map((region) => {
    const ranked = state.players.filter((player) => player.region === region).sort((a, b) => b.points - a.points);
    const cut = Math.ceil(ranked.length / 2);
    return { region, championship: ranked.slice(0, cut), toilet: ranked.slice(cut) };
  });
  const top = state.sport === "cbb" ? regionalFields.flatMap((field) => field.championship) : state.players.slice(0, 8);
  const bottom = state.sport === "cbb" ? regionalFields.flatMap((field) => field.toilet) : state.players.slice(8, 16);
  const phase = stage < 0 ? `Projected fields · cut locks after ${PREVIEW_SPORTS[state.sport].weekLabel(cutWeek - 1)}` : stage === 0 ? "Fields locked · quarterfinals ready" : stage === 1 ? "Quarterfinals complete · semifinals ready" : stage === 2 ? "Semifinals complete · championship matchups ready" : "Postseason complete · winners crowned";
  return <Page title="The Postseason" note={phase}><div className="mb-4 grid grid-cols-2 gap-2"><Stat label="Championship field" value={String(top.length)} note={stage < 0 ? "projected" : "locked"} /><Stat label="Toilet Bowl field" value={String(bottom.length)} note={stage < 0 ? "projected" : "locked"} /></div><div className="grid gap-5">{state.sport === "cbb" ? <><RegionalTournamentBracket title="Fieldhouse Championship" tone="gold" fields={regionalFields.map((field) => ({ region: field.region, players: field.championship }))} stage={stage} /><RegionalTournamentBracket title="Toilet Bowl" tone="purple" fields={regionalFields.map((field) => ({ region: field.region, players: field.toilet }))} stage={stage} /></> : <><TournamentBracket title="Championship" tone="gold" players={top} stage={stage} /><TournamentBracket title="Toilet Bowl" tone="purple" players={bottom} stage={stage} /></>}</div></Page>;
}

function RegionalTournamentBracket({ title, tone, fields, stage }: { title: string; tone: "gold" | "purple"; fields: Array<{ region: FieldhouseRegion; players: FoundryWalkthrough["players"] }>; stage: number }) {
  const color = tone === "gold" ? "border-amber-300/45 bg-amber-300/5 text-amber-200" : "border-purple-400/45 bg-purple-400/5 text-purple-200";
  const winner = fields[0]?.players[0];
  const left = fields.filter((field) => field.region === "East" || field.region === "West");
  const right = fields.filter((field) => field.region === "South" || field.region === "Midwest");
  return <section className={`rounded-2xl border p-3 sm:p-4 ${color}`}><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.18em]">Mini March Madness · four regions</p><h3 className="text-xl font-black">{title}</h3></div><span className="rounded-full border border-current/30 px-2 py-1 text-[8px] font-black">{stage < 0 ? "LIVE PROJECTION" : stage >= 3 ? "FINAL" : "IN PROGRESS"}</span></div>
    <div className="mt-4 grid grid-cols-[1fr_72px_1fr] items-center gap-2 sm:grid-cols-[1fr_120px_1fr]">
      <RegionSide fields={left} stage={stage} side="left" />
      <div className="space-y-3 text-center"><div className={`rounded-xl border border-current/35 bg-black/35 p-2 ${stage < 2 ? "opacity-40" : ""}`}><p className="text-[7px] font-black uppercase tracking-[.13em]">Final Four</p><p className="mt-1 text-[9px] font-bold">East/West</p><p className="text-[9px]">vs</p><p className="text-[9px] font-bold">South/Midwest</p></div><div className={`rounded-xl border-2 border-current bg-black/50 p-2 ${stage < 3 ? "opacity-35" : ""}`}><p className="text-[7px] font-black uppercase">Champion</p><p className="mt-1 truncate text-[10px] font-black">{stage >= 3 ? winner?.name : "TBD"}</p></div></div>
      <RegionSide fields={right} stage={stage} side="right" />
    </div>
    <p className="mt-4 text-center text-[9px] font-bold opacity-70">Every regional winner advances toward the center. Final Four winners meet for the hardware.</p>
  </section>;
}

function RegionSide({ fields, stage, side }: { fields: Array<{ region: FieldhouseRegion; players: FoundryWalkthrough["players"] }>; stage: number; side: "left" | "right" }) {
  return <div className="space-y-3">{fields.map((field) => {
    const players = [...field.players].sort((a, b) => b.points - a.points);
    const regionWinner = players[0];
    return <div key={field.region} className={`rounded-xl border border-current/25 bg-black/25 p-2 ${side === "right" ? "text-right" : "text-left"}`}><p className="text-[8px] font-black uppercase tracking-[.14em]">{field.region} Region</p><div className="mt-2 space-y-1">{players.length ? players.map((player, index) => <div key={player.id} className={`flex items-center justify-between gap-1 rounded bg-white/5 px-2 py-1.5 text-[9px] ${stage >= 1 && index === 0 ? "bg-white/15 font-black" : ""}`}><span className="truncate">{index + 1} · {player.name}</span><span>{stage >= 1 ? index === 0 ? "ADV" : "OUT" : "—"}</span></div>) : <div className="rounded bg-white/5 px-2 py-2 text-[9px] opacity-50">BYE / TBD</div>}</div><p className={`mt-2 text-[8px] font-black ${stage >= 1 ? "" : "opacity-35"}`}>{stage >= 1 ? `${regionWinner?.name || "TBD"} → center` : "Regional winner → center"}</p></div>;
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
  const edition = { ...raw, weekIndex: active, weekLabel: PREVIEW_SPORTS[state.sport].weekLabel(active), sportId: state.sport, volumeLabel: `${PREVIEW_SPORTS[state.sport].room.toUpperCase()} · FOUNDRY PREVIEW · NO CLOUD WRITES` };
  return <Page title="Gazette Archive" note={`${weeks.length} scored edition${weeks.length === 1 ? "" : "s"} · choose a week, then read its four pages.`}><nav className="mb-4 rounded-xl border border-border bg-card p-3" aria-label="Gazette editions"><div className="flex gap-2 overflow-x-auto pb-1">{weeks.map((week) => <button key={week} type="button" onClick={() => onSelectWeek(week)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-black ${week === active ? "bg-stone-100 text-stone-900" : "border border-border"}`}>{PREVIEW_SPORTS[state.sport].weekLabel(week)}</button>)}</div></nav><GazettePaper edition={edition} foundryPreview /></Page>;
}

function Locker({ state }: { state: FoundryWalkthrough }) { const crown = state.players[0]; return <Page title="Locker Room" note="Fictional room talk generated from this simulated week."><div className="space-y-3">{[["Kahmann", `Congrats ${crown.name}. Please stop refreshing the standings.`], ["Maria", "The confidence five was a crime scene."], ["Big Balls Ben", "I have reviewed the tape and decided the tape is biased."], ["Jstray", "Toilet Bowl scouts were in attendance. No comment."]].map(([name, message], i) => <div key={name} className={`max-w-[88%] rounded-2xl p-3 ${i % 2 ? "ml-auto bg-primary/15" : "border border-border bg-card"}`}><strong className="text-xs">{name}</strong><p className="mt-1 text-sm">{message}</p></div>)}</div><div className="mt-5 flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-xs text-muted">Message entry disabled in isolated preview</div></Page>; }

function Board({ state }: { state: FoundryWalkthrough }) { return <Page title="The Board" note="Weekly results, crowns, shame, and movement."><div className="grid gap-3 sm:grid-cols-2"><Feature kicker="Week crown" title={state.players[0].name} body={`${state.players[0].weekPoints} points · asked where the statue goes.`} /><Feature kicker="The shame desk" title={state.players[state.players.length - 1].name} body={`${state.players[state.players.length - 1].weekPoints} points · appeal denied.`} /><Feature kicker="Biggest mover" title={state.players[3].name} body="Up four places. Power ranking complaints formally reopened." /><Feature kicker="Cut watch" title="One card apart" body="The middle of the room is separated by six points." /></div></Page>; }

function Profile({ state }: { state: FoundryWalkthrough }) { const me = state.players.find((p) => p.name === "Mike V")!; return <Page title="Mike V" note="Account profile · preview identity"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-black text-black">MV</div><div><h3 className="text-xl font-black">Mike V</h3><p className="text-xs text-muted">Commissioner · Foundry tester</p></div></div><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Points" value={String(me.points)} /><Stat label="Correct" value={String(me.correct)} /><Stat label="Streak" value={me.streak > 0 ? `W${me.streak}` : "—"} /></div></section><section className="mt-3 rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-black uppercase tracking-wide text-muted">Sport passport</p><h3 className="mt-1 font-black">{PREVIEW_SPORTS[state.sport].sport}</h3><p className="mt-2 text-sm text-muted">2026 season active · one weekly crown · card lock streak intact.</p></section></Page>; }

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
    <div className="mt-2 grid grid-cols-3 gap-2"><button disabled={busy} onClick={onWeek} className="min-h-10 rounded-lg bg-emerald-300 px-2 text-[9px] font-black text-emerald-950 disabled:opacity-40">{seasonFinal ? "Ring Ceremony" : "Sim Week"}</button><button disabled={busy || seasonFinal} onClick={onRegular} className="min-h-10 rounded-lg border border-amber-300/50 px-1 text-[9px] font-black text-amber-200 disabled:opacity-40">Sim Regular Season</button><button disabled={busy} onClick={onSeason} className="min-h-10 rounded-lg border border-emerald-300/50 px-2 text-[9px] font-black text-emerald-200 disabled:opacity-40">{seasonFinal ? "Replay Rings" : "Sim Season"}</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCollapsed(true)} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Collapse</button><button type="button" onClick={() => setMore((v) => !v)} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">{more ? "Close tools" : "More tools"}</button></div>
    {more && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-emerald-400/20 pt-2"><button type="button" onClick={onHome} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Sandbox Home</button><button type="button" onClick={onBrackets} className="min-h-9 rounded-lg border border-amber-300/40 text-[9px] font-bold text-amber-200">View Brackets</button><button type="button" onClick={onGazette} className="min-h-9 rounded-lg border border-emerald-400/20 text-[9px] font-bold">Replay Gazette</button><button type="button" onClick={onReset} className="min-h-9 rounded-lg border border-red-400/30 text-[9px] font-bold text-red-200">Reset this sport</button><Link href="/foundry" className="col-span-2 flex min-h-9 items-center justify-center rounded-lg border border-emerald-400/20 text-[9px] font-bold">Change sport / Exit</Link></div>}
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
  const champion = state.players[0];
  const meta = PREVIEW_SPORTS[state.sport];
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  const slides = [
    { kicker: "The season is final", title: "ONE NAME REMAINS", body: `${meta.room} has receipts, casualties, and a champion.` },
    { kicker: "2026 champion", title: champion.name.toUpperCase(), body: `${champion.points} points. ${state.gazetteWeeks.length} windows survived. Every excuse has been entered into evidence.` },
    { kicker: "The ring", title: "HISTORY DOESN’T ASK HOW", body: "It only remembers whose name was engraved when everybody else ran out of weeks." },
  ];
  const current = slides[slide];
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[radial-gradient(circle_at_top,#78350f_0%,#111827_38%,#020617_100%)] px-4 py-[max(24px,env(safe-area-inset-top))] text-white" role="dialog" aria-modal="true" aria-label="Foundry Ring Ceremony">
    <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-between text-center">
      <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-full border border-white/25 px-4 text-xs font-bold">Skip</button>
      <section className="py-8"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">{current.kicker}</p>{slide === 2 && <div className="mx-auto my-7 flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-amber-300 bg-gradient-to-br from-yellow-100 via-amber-400 to-amber-800 text-5xl font-black text-black shadow-[0_0_70px_rgba(251,191,36,.65)]">WR</div>}<h2 className="mt-5 text-4xl font-black leading-none">{current.title}</h2><p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-white/75">{current.body}</p>{slide === 1 && <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-amber-300">{meta.sport} · Foundry Season</p>}</section>
      <div className="pb-[max(12px,env(safe-area-inset-bottom))]"><div className="mb-4 flex justify-center gap-2">{slides.map((_, i) => <span key={i} className={`h-1.5 w-10 rounded-full ${i <= slide ? "bg-amber-300" : "bg-white/20"}`} />)}</div><button type="button" onClick={() => slide < slides.length - 1 ? setSlide(slide + 1) : onClose()} className="min-h-12 w-full rounded-xl bg-amber-300 text-sm font-black text-black">{slide < slides.length - 1 ? "Continue" : "Enter completed season"}</button><p className="mt-3 text-[9px] uppercase tracking-wide text-white/40">Foundry preview · no trophy engraved · no cloud writes</p></div>
    </div>
  </div>;
}
function Page({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <section><h2 className="text-2xl font-black">{title}</h2><p className="mb-4 mt-1 text-xs text-muted">{note}</p>{children}</section>; }
function Stat({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="rounded-xl border border-border bg-card p-3"><span className="block text-[9px] font-black uppercase tracking-wide text-muted">{label}</span><strong className="mt-1 block text-xl">{value}</strong>{note && <span className="text-[10px] text-muted">{note}</span>}</div>; }
function Feature({ kicker, title, body }: { kicker: string; title: string; body: string }) { return <article className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">{kicker}</p><h3 className="mt-1 text-lg font-black">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{body}</p></article>; }
