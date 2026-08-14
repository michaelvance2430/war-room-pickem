"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFoundryWalkthrough, loadFoundryWalkthrough, PREVIEW_SPORTS, saveFoundryWalkthrough, type PreviewSport } from "@/lib/foundry-walkthrough";
import { setFoundryLivePagesActive } from "@/lib/foundry-live-adapter";
import { markFoundrySessionActive } from "@/components/FoundrySessionChrome";

export default function FoundryRoomSimulator() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [savedSport, setSavedSport] = useState<PreviewSport>("cfb");

  useEffect(() => {
    const saved = loadFoundryWalkthrough();
    if (saved) { setSavedSport(saved.sport); setReady(true); }
  }, []);

  function enterSport(sport: PreviewSport) {
    const state = createFoundryWalkthrough(sport, undefined, "player");
    saveFoundryWalkthrough(state);
    setFoundryLivePagesActive(true);
    markFoundrySessionActive();
    router.push("/");
  }

  function testPickCoach(sportId: "cfb" | "nfl") {
    void import("@/lib/creator-eyes").then(({ startFirstHourAsNewPlayer }) => {
      startFirstHourAsNewPlayer({ sportId });
      router.push("/picks");
    });
  }

  return <section className="rounded-xl border border-emerald-400/35 bg-emerald-400/[0.04] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Walkable product · local memory only</p><h2 className="mt-1 text-lg font-black">Choose a sport</h2><p className="mt-1 text-xs leading-relaxed text-muted">The sport opens on the real War Room pages with isolated Foundry data. Sim weeks, then use the Foundry bar to inspect Home, Picks, Standings, Board, Locker, and Dispatch. Zero cloud writes.</p></div>
      <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-[9px] font-black text-emerald-300">ISOLATED</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      {(Object.keys(PREVIEW_SPORTS) as PreviewSport[]).map((id) => <button key={id} type="button" onClick={() => enterSport(id)} className="min-h-20 rounded-xl border border-border bg-background p-2 text-left hover:border-amber-300"><strong className="block text-sm">{PREVIEW_SPORTS[id].room}</strong><span className="text-[10px] text-muted">{PREVIEW_SPORTS[id].sport}</span><span className="mt-2 block text-[10px] font-black text-amber-300">ENTER SANDBOX →</span></button>)}
    </div>
    <div className="mt-4 rounded-xl border border-emerald-400/35 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">First-hour UX · blank card every launch</p>
      <h3 className="mt-1 text-sm font-black">Test New Player Pick Coach</h3>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">Opens the real Picks interface in isolated New Player Eyes. Clears only local preview picks—your live cards are never touched.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => testPickCoach("cfb")} className="min-h-11 rounded-xl bg-emerald-400 px-3 text-xs font-black text-black">CFB BLANK CARD</button>
        <button type="button" onClick={() => testPickCoach("nfl")} className="min-h-11 rounded-xl border border-emerald-400/50 px-3 text-xs font-black text-emerald-200">NFL BLANK CARD</button>
      </div>
    </div>
    {ready && <button type="button" onClick={() => { setFoundryLivePagesActive(true); markFoundrySessionActive(); router.push("/"); }} className="mt-3 min-h-11 w-full rounded-xl border border-border text-xs font-bold">Resume saved {PREVIEW_SPORTS[savedSport].room} sandbox</button>}
  </section>;
}
