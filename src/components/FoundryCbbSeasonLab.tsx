"use client";

import { useMemo, useState } from "react";
import {
  advanceCbbSim,
  CBB_TAKEOVER_CATALOG,
  cbbSimSnapshot,
  createCbbSimState,
  type CbbSimConfig,
  type CbbTakeoverId,
  validateCbbSimConfig,
} from "@/lib/sports/cbb-foundry-sim";

const DEFAULT_CONFIG: CbbSimConfig = {
  playerCount: 24,
  regularWeeks: 14,
  conferenceChampionPicks: 6,
  takeoverIds: ["maui"],
};

export default function FoundryCbbSeasonLab() {
  const [draft, setDraft] = useState<CbbSimConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<ReturnType<typeof createCbbSimState> | null>(null);
  const errors = useMemo(() => validateCbbSimConfig(draft), [draft]);
  const snap = state ? cbbSimSnapshot(state) : null;

  function toggleTakeover(id: CbbTakeoverId) {
    setDraft((current) => ({
      ...current,
      takeoverIds: current.takeoverIds.includes(id)
        ? current.takeoverIds.filter((item) => item !== id)
        : [...current.takeoverIds, id],
    }));
  }

  return (
    <section className="rounded-xl border border-amber-300/35 bg-amber-300/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Local memory only · zero cloud writes</p>
          <h2 className="mt-1 text-base font-black">The Fieldhouse Season Engine</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">Configure a league, generate its scoring calendar, then advance through every regular-season and national-tournament state.</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-400/30 px-2 py-1 text-[9px] font-black text-emerald-300">ISOLATED</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberField label="Players" value={draft.playerCount} min={8} max={32} onChange={(playerCount) => setDraft((c) => ({ ...c, playerCount }))} />
        <NumberField label="Regular windows" value={draft.regularWeeks} min={8} max={18} onChange={(regularWeeks) => setDraft((c) => ({ ...c, regularWeeks }))} />
        <NumberField label="Conference picks" value={draft.conferenceChampionPicks} min={1} max={12} onChange={(conferenceChampionPicks) => setDraft((c) => ({ ...c, conferenceChampionPicks }))} />
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-muted">Tournament Takeovers · maximum three · no overlapping windows</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CBB_TAKEOVER_CATALOG.map((event) => (
            <label key={event.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs">
              <input type="checkbox" checked={draft.takeoverIds.includes(event.id)} onChange={() => toggleTakeover(event.id)} />
              <span><strong>{event.name}</strong><span className="block text-[10px] text-muted">{event.bracketGames} bracket games</span></span>
            </label>
          ))}
        </div>
      </div>

      {errors.length > 0 && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-[11px] text-red-200">{errors.join(" ")}</p>}
      <button type="button" disabled={errors.length > 0} onClick={() => setState(createCbbSimState(draft))} className="mt-3 min-h-11 w-full rounded-lg bg-amber-300 px-3 text-xs font-black text-black disabled:opacity-40">{state ? "Rebuild with these settings" : "Generate this season"}</button>

      {!state || !snap ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background/60 p-4 text-xs leading-relaxed text-muted">
          <strong className="block text-foreground">Nothing generated yet.</strong>
          Choose the league settings above, press <span className="font-bold text-amber-200">Generate this season</span>, then use the advance button to walk through every pick window.
        </div>
      ) : (
      <div className="mt-4 rounded-xl border border-emerald-400/35 bg-background p-4">
        <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
          Season generated · {state.steps.length} total steps · {state.config.regularWeeks} regular windows · {state.config.takeoverIds.length} Takeover{state.config.takeoverIds.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted">Step {snap.progress}</p>
            <h3 className="mt-1 text-lg font-black">{snap.step.label}</h3>
            <p className="mt-1 text-xs text-muted">{snap.step.games} games · {snap.step.maxPoints} max points · {snap.step.lockRule === "card" ? "one card lock" : snap.step.lockRule === "per_game" ? "per-game locks" : "ceremony"}</p>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${snap.step.elimination ? "border-red-400/40 text-red-300" : "border-sky-400/30 text-sky-300"}`}>{snap.step.elimination ? "Elimination" : "Season"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <Stat label="Championship" value={String(snap.split.championshipPlayers)} />
          <Stat label="Toilet Bowl" value={String(snap.split.toiletBowlPlayers)} />
          <Stat label="Total byes" value={String(snap.split.championshipByes + snap.split.toiletBowlByes)} />
          <Stat label="Cut" value={snap.standingsFrozen ? "FROZEN" : "MOVING"} />
        </div>
        <button type="button" disabled={snap.remaining === 0} onClick={() => setState((current) => current ? advanceCbbSim(current) : current)} className="mt-3 min-h-11 w-full rounded-lg border border-amber-300/45 text-xs font-black text-amber-200 disabled:opacity-35">{snap.remaining === 0 ? "Season complete" : "Score this window & advance"}</button>
      </div>
      )}
    </section>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wide text-muted">{label}<input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2"><span className="block text-[9px] uppercase tracking-wide text-muted">{label}</span><strong className="mt-0.5 block text-sm">{value}</strong></div>;
}
