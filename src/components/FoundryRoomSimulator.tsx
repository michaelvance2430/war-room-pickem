"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFoundryWalkthrough, loadFoundryWalkthrough, PREVIEW_SPORTS, saveFoundryWalkthrough, type PreviewRole, type PreviewSport } from "@/lib/foundry-walkthrough";

export default function FoundryRoomSimulator() {
  const router = useRouter();
  const [sport, setSport] = useState<PreviewSport>("cfb");
  const [week, setWeek] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadFoundryWalkthrough();
    if (saved) { setSport(saved.sport); setWeek(saved.week); setReady(true); }
  }, []);

  function build(role: PreviewRole) {
    const state = createFoundryWalkthrough(sport, week, role);
    saveFoundryWalkthrough(state);
    setReady(true);
    router.push("/foundry/preview");
  }

  const meta = PREVIEW_SPORTS[sport];
  return <section className="rounded-xl border border-emerald-400/35 bg-emerald-400/[0.04] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Walkable product · local memory only</p><h2 className="mt-1 text-lg font-black">Simulate, then enter the room</h2><p className="mt-1 text-xs leading-relaxed text-muted">Creates a complete fictional week—card, results, standings, cut line, Gazette, locker talk, and profile history. Refresh-safe. Zero cloud writes.</p></div>
      <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-[9px] font-black text-emerald-300">ISOLATED</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      {(Object.keys(PREVIEW_SPORTS) as PreviewSport[]).map((id) => <button key={id} type="button" onClick={() => setSport(id)} className={`min-h-16 rounded-xl border p-2 text-left ${sport === id ? "border-amber-300 bg-amber-300/10" : "border-border bg-background"}`}><strong className="block text-sm">{PREVIEW_SPORTS[id].room}</strong><span className="text-[10px] text-muted">{PREVIEW_SPORTS[id].sport}</span></button>)}
    </div>
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <label className="text-[10px] font-black uppercase tracking-wide text-muted">Starting {sport === "cbb" ? "window" : "week"}<input type="number" min={1} max={18} value={week} onChange={(e) => setWeek(Math.max(1, Math.min(18, Number(e.target.value) || 1)))} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" /></label>
      <p className="mt-2 text-xs"><strong>{meta.room}</strong> · {meta.cadence} · {meta.weekLabel(week)}</p>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => build("player")} className="min-h-12 rounded-xl bg-amber-300 px-3 text-sm font-black text-black">Simulate & enter as Player</button>
      <button type="button" onClick={() => build("commissioner")} className="min-h-12 rounded-xl border border-amber-300/60 bg-amber-300/10 px-3 text-sm font-black text-amber-200">Simulate & enter as Commissioner</button>
    </div>
    {ready && <button type="button" onClick={() => router.push("/foundry/preview")} className="mt-2 min-h-11 w-full rounded-xl border border-border text-xs font-bold">Resume saved {meta.room} session</button>}
  </section>;
}
