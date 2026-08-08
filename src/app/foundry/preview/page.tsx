"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GazettePaper from "@/components/GazettePaper";
import { buildFoundryGazetteFixture } from "@/lib/foundry-gazette-fixtures";
import {
  FOUNDRY_WALKTHROUGH_EVENT,
  loadFoundryWalkthrough,
  PREVIEW_SPORTS,
  saveFoundryWalkthrough,
  setFoundryWalkthroughRole,
  simulateNextFoundryWeek,
  type FoundryWalkthrough,
  type PreviewRole,
} from "@/lib/foundry-walkthrough";

type View = "home" | "picks" | "standings" | "gazette" | "locker" | "board" | "profile" | "commissioner";
const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Home" }, { id: "picks", label: "Picks" }, { id: "standings", label: "Standings" },
  { id: "gazette", label: "Gazette" }, { id: "locker", label: "Locker" }, { id: "board", label: "Board" }, { id: "profile", label: "Profile" },
];

export default function FoundryPreviewPage() {
  const [state, setState] = useState<FoundryWalkthrough | null>(null);
  const [view, setView] = useState<View>("home");
  useEffect(() => {
    const refresh = () => setState(loadFoundryWalkthrough());
    refresh(); window.addEventListener(FOUNDRY_WALKTHROUGH_EVENT, refresh);
    return () => window.removeEventListener(FOUNDRY_WALKTHROUGH_EVENT, refresh);
  }, []);

  function update(next: FoundryWalkthrough) { saveFoundryWalkthrough(next); setState(next); }
  if (!state) return <main className="mx-auto min-h-screen max-w-lg px-4 py-12"><h1 className="text-xl font-black">No preview season yet</h1><p className="mt-2 text-sm text-muted">Build one in Foundry first.</p><Link href="/foundry" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-black text-black">Open Foundry</Link></main>;
  const meta = PREVIEW_SPORTS[state.sport];
  const visibleNav = state.role === "commissioner" ? [...NAV, { id: "commissioner" as View, label: "Commish" }] : NAV;
  return <main className="min-h-screen bg-background pb-32">
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-3 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Foundry preview · no cloud writes</p><h1 className="text-lg font-black">{meta.room}</h1><p className="text-[10px] text-muted">{meta.sport} · {meta.weekLabel(state.week)} · {state.role}</p></div><Link href="/foundry" className="flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-bold">Foundry</Link></div>
      <nav className="mx-auto mt-3 flex max-w-3xl gap-1 overflow-x-auto pb-1" aria-label="Preview pages">{visibleNav.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold ${view === item.id ? "bg-primary text-black" : "border border-border bg-card"}`}>{item.label}</button>)}</nav>
    </header>
    <div className="mx-auto max-w-3xl px-3 py-4">
      {view === "home" && <Home state={state} go={setView} />}
      {view === "picks" && <Picks state={state} />}
      {view === "standings" && <Standings state={state} />}
      {view === "gazette" && <Gazette state={state} />}
      {view === "locker" && <Locker state={state} />}
      {view === "board" && <Board state={state} />}
      {view === "profile" && <Profile state={state} />}
      {view === "commissioner" && <Commissioner state={state} onAdvance={() => update(simulateNextFoundryWeek(state))} />}
    </div>
    <PreviewChrome state={state} onAdvance={() => { update(simulateNextFoundryWeek(state)); setView("home"); }} onRole={(role) => update(setFoundryWalkthroughRole(state, role))} />
  </main>;
}

function Home({ state, go }: { state: FoundryWalkthrough; go: (v: View) => void }) {
  const meta = PREVIEW_SPORTS[state.sport]; const me = state.players.find((p) => p.name === "Mike V") || state.players[0]; const rank = state.players.findIndex((p) => p.id === me.id) + 1;
  return <div className="space-y-3"><section className="rounded-2xl border border-primary/35 bg-card p-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">{meta.cadence} · card open</p><h2 className="mt-2 text-3xl font-black">{meta.weekLabel(state.week)}</h2><p className="mt-2 text-sm text-muted">Five games. Confidence 5 through 1. Lock before the first game begins.</p><button onClick={() => go("picks")} className="mt-4 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Open My Picks</button></section>
    <div className="grid grid-cols-2 gap-3"><Stat label="Your rank" value={`#${rank}`} note={`${me.points} season points`} /><Stat label="This week" value={`${me.weekPoints} pts`} note={`${me.correct} correct`} /></div>
    <button onClick={() => go("gazette")} className="w-full rounded-2xl border border-stone-500 bg-[#eee8da] p-4 text-left text-stone-900"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-800">New edition</p><strong className="mt-1 block font-serif text-xl">The War Room Gazette</strong><span className="text-xs">Crowns, shame, movement, and receipts from the scored week.</span></button>
    <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-black">Room pulse</h3><div className="mt-3 space-y-2">{state.players.slice(0, 3).map((p, i) => <div key={p.id} className="flex items-center justify-between text-sm"><span>{i + 1}. {p.name}</span><strong>{p.points}</strong></div>)}</div><button onClick={() => go("standings")} className="mt-3 text-xs font-bold text-primary">Full standings →</button></section></div>;
}

function Picks({ state }: { state: FoundryWalkthrough }) { return <Page title="My Picks" note={`${PREVIEW_SPORTS[state.sport].weekLabel(state.week)} · saved locally for preview`}><div className="space-y-3">{state.games.map((g) => <article key={g.id} className="rounded-xl border border-border bg-card p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-muted">{g.status === "final" ? "Final" : "Upcoming"}</p><h3 className="mt-1 font-black">{g.away} at {g.home}</h3><p className="text-xs text-muted">{g.spread}{g.result ? ` · ${g.result}` : ""}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-black">{g.confidence}</span></div><div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">Pick: <strong>{g.pick}</strong></div></article>)}</div><p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">Card locked · preview picks cannot reach a live league.</p></Page>; }

function Standings({ state }: { state: FoundryWalkthrough }) {
  const middle = Math.ceil(state.players.length / 2);
  return <Page title="Standings" note="The cut moves with the field; before scored games it rests in the middle."><div className="overflow-hidden rounded-xl border border-border">{state.players.map((p, i) => <div key={p.id}><div className={`grid grid-cols-[32px_1fr_52px_46px] items-center gap-2 px-3 py-3 text-sm ${p.name === "Mike V" ? "bg-primary/15" : "bg-card"}`}><span className="text-muted">{i + 1}</span><span className="truncate font-bold">{p.name}{p.name === "Mike V" ? " · YOU" : ""}<small className="block font-normal text-muted">{p.locked ? "Locked" : "No card"} · {p.streak > 0 ? `W${p.streak}` : p.streak < 0 ? `L${Math.abs(p.streak)}` : "—"}</small></span><strong className="text-right">{p.points}</strong><span className="text-right text-xs text-muted">+{p.weekPoints}</span></div>{i + 1 === middle && <div className="flex items-center gap-2 bg-red-950 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-red-300"><span className="h-px flex-1 bg-red-400" />Championship cut<span className="h-px flex-1 bg-red-400" /></div>}</div>)}</div></Page>;
}

function Gazette({ state }: { state: FoundryWalkthrough }) {
  const raw = buildFoundryGazetteFixture(((state.week - 1) % 18) + 1, state.generatedAt);
  const edition = { ...raw, weekIndex: state.week, weekLabel: PREVIEW_SPORTS[state.sport].weekLabel(state.week), sportId: state.sport, volumeLabel: `${PREVIEW_SPORTS[state.sport].room.toUpperCase()} · FOUNDRY PREVIEW · NO CLOUD WRITES` };
  return <Page title="Gazette" note="The same four-page newspaper component used by the product."><GazettePaper edition={edition} foundryPreview /></Page>;
}

function Locker({ state }: { state: FoundryWalkthrough }) { const crown = state.players[0]; return <Page title="Locker Room" note="Fictional room talk generated from this simulated week."><div className="space-y-3">{[["Kahmann", `Congrats ${crown.name}. Please stop refreshing the standings.`], ["Maria", "The confidence five was a crime scene."], ["Big Balls Ben", "I have reviewed the tape and decided the tape is biased."], ["Jstray", "Toilet Bowl scouts were in attendance. No comment."]].map(([name, message], i) => <div key={name} className={`max-w-[88%] rounded-2xl p-3 ${i % 2 ? "ml-auto bg-primary/15" : "border border-border bg-card"}`}><strong className="text-xs">{name}</strong><p className="mt-1 text-sm">{message}</p></div>)}</div><div className="mt-5 flex min-h-12 items-center rounded-full border border-border bg-card px-4 text-xs text-muted">Message entry disabled in isolated preview</div></Page>; }

function Board({ state }: { state: FoundryWalkthrough }) { return <Page title="The Board" note="Weekly results, crowns, shame, and movement."><div className="grid gap-3 sm:grid-cols-2"><Feature kicker="Week crown" title={state.players[0].name} body={`${state.players[0].weekPoints} points · asked where the statue goes.`} /><Feature kicker="The shame desk" title={state.players[state.players.length - 1].name} body={`${state.players[state.players.length - 1].weekPoints} points · appeal denied.`} /><Feature kicker="Biggest mover" title={state.players[3].name} body="Up four places. Power ranking complaints formally reopened." /><Feature kicker="Cut watch" title="One card apart" body="The middle of the room is separated by six points." /></div></Page>; }

function Profile({ state }: { state: FoundryWalkthrough }) { const me = state.players.find((p) => p.name === "Mike V")!; return <Page title="Mike V" note="Account profile · preview identity"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-black text-black">MV</div><div><h3 className="text-xl font-black">Mike V</h3><p className="text-xs text-muted">Commissioner · Foundry tester</p></div></div><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Points" value={String(me.points)} /><Stat label="Correct" value={String(me.correct)} /><Stat label="Streak" value={me.streak > 0 ? `W${me.streak}` : "—"} /></div></section><section className="mt-3 rounded-2xl border border-border bg-card p-4"><p className="text-[10px] font-black uppercase tracking-wide text-muted">Sport passport</p><h3 className="mt-1 font-black">{PREVIEW_SPORTS[state.sport].sport}</h3><p className="mt-2 text-sm text-muted">2026 season active · one weekly crown · card lock streak intact.</p></section></Page>; }

function Commissioner({ state, onAdvance }: { state: FoundryWalkthrough; onAdvance: () => void }) { return <Page title="Commissioner" note="Preview controls operate only on the local fictional room."><div className="space-y-3"><Feature kicker="Card status" title="Published and locked" body={`${state.games.length} games · ${state.players.filter((p) => p.locked).length} of ${state.players.length} cards locked.`} /><Feature kicker="Scoring" title="Week ready" body="Final results, standings movement, and Gazette edition are generated." /><button onClick={onAdvance} className="min-h-12 w-full rounded-xl bg-primary text-sm font-black text-black">Score this week & open next</button><button className="min-h-12 w-full rounded-xl border border-border text-sm font-bold">Edit next card (preview)</button></div></Page>; }

function PreviewChrome({ state, onAdvance, onRole }: { state: FoundryWalkthrough; onAdvance: () => void; onRole: (r: PreviewRole) => void }) { return <div className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-400/40 bg-emerald-950/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center gap-2"><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wide text-emerald-300">Local Foundry session</p><p className="truncate text-xs font-bold">{PREVIEW_SPORTS[state.sport].room} · {PREVIEW_SPORTS[state.sport].weekLabel(state.week)}</p></div><button onClick={() => onRole(state.role === "player" ? "commissioner" : "player")} className="min-h-10 rounded-lg border border-emerald-400/40 px-2 text-[10px] font-bold">View as {state.role === "player" ? "Commish" : "Player"}</button><button onClick={onAdvance} className="min-h-10 rounded-lg bg-emerald-300 px-3 text-[10px] font-black text-emerald-950">Sim next week</button></div></div>; }
function Page({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <section><h2 className="text-2xl font-black">{title}</h2><p className="mb-4 mt-1 text-xs text-muted">{note}</p>{children}</section>; }
function Stat({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="rounded-xl border border-border bg-card p-3"><span className="block text-[9px] font-black uppercase tracking-wide text-muted">{label}</span><strong className="mt-1 block text-xl">{value}</strong>{note && <span className="text-[10px] text-muted">{note}</span>}</div>; }
function Feature({ kicker, title, body }: { kicker: string; title: string; body: string }) { return <article className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">{kicker}</p><h3 className="mt-1 text-lg font-black">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{body}</p></article>; }
