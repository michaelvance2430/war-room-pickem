"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFoundryWalkthrough, loadFoundryWalkthrough, PREVIEW_SPORTS, saveFoundryWalkthrough, type PreviewSport } from "@/lib/foundry-walkthrough";

export default function FoundryRoomSimulator() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [savedSport, setSavedSport] = useState<PreviewSport>("cfb");

  useEffect(() => {
    const saved = loadFoundryWalkthrough();
    if (saved) { setSavedSport(saved.sport); setReady(true); }
  }, []);

  function enterSport(sport: PreviewSport) {
    const state = createFoundryWalkthrough(sport, 1, "player");
    saveFoundryWalkthrough(state);
    router.push("/foundry/preview");
  }

  return <section className="rounded-xl border border-emerald-400/35 bg-emerald-400/[0.04] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Walkable product · local memory only</p><h2 className="mt-1 text-lg font-black">Choose a sport</h2><p className="mt-1 text-xs leading-relaxed text-muted">The sport opens directly on its sandbox Home page. Use the movable Foundry bar inside to simulate a week or the full season. Zero cloud writes.</p></div>
      <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-[9px] font-black text-emerald-300">ISOLATED</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      {(Object.keys(PREVIEW_SPORTS) as PreviewSport[]).map((id) => <button key={id} type="button" onClick={() => enterSport(id)} className="min-h-20 rounded-xl border border-border bg-background p-2 text-left hover:border-amber-300"><strong className="block text-sm">{PREVIEW_SPORTS[id].room}</strong><span className="text-[10px] text-muted">{PREVIEW_SPORTS[id].sport}</span><span className="mt-2 block text-[10px] font-black text-amber-300">ENTER SANDBOX →</span></button>)}
    </div>
    {ready && <button type="button" onClick={() => router.push("/foundry/preview")} className="mt-3 min-h-11 w-full rounded-xl border border-border text-xs font-bold">Resume saved {PREVIEW_SPORTS[savedSport].room} sandbox</button>}
  </section>;
}
