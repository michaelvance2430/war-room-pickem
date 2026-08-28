"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import TrophyLightbox from "@/components/TrophyLightbox";
import { CHAMPIONSHIP_TROPHIES, championshipTrophiesForSport, type ChampionshipTrophyId } from "@/lib/championship-trophy-catalog";
import { getLeague, isActuallyCommissioner } from "@/lib/league";
import { saveLeagueToCloud, syncLeagueFromCloud } from "@/lib/league-sync";

export default function ChampionshipTrophyPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ChampionshipTrophyId | null>(null);
  const [inspect, setInspect] = useState<ChampionshipTrophyId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collection = championshipTrophiesForSport(getLeague()?.sportId);

  useEffect(() => {
    void syncLeagueFromCloud().then((league) => {
      const id = league?.settings?.championshipTrophyId;
      if (CHAMPIONSHIP_TROPHIES.some((item) => item.id === id)) setSelected(id as ChampionshipTrophyId);
    });
  }, []);

  async function save() {
    const league = getLeague();
    if (!selected || !league?.id) return;
    if (!isActuallyCommissioner()) {
      setError("Only the commissioner can choose championship hardware.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveLeagueToCloud({
      settings: { championshipTrophyId: selected },
    });
    if (!result.ok) {
      const message = result.error || "The trophy could not be saved. Try again.";
      setError(message.toLowerCase().includes("locked") ? "The trophy locked at opening kickoff. This season already has its hardware." : message);
      setBusy(false);
      return;
    }
    const confirmed = await syncLeagueFromCloud();
    if (confirmed?.settings?.championshipTrophyId !== selected) {
      setError("The trophy did not save. Check your connection and try again.");
      setBusy(false);
      return;
    }
    window.dispatchEvent(new Event("warroom-championship-trophy-selected"));
    router.push("/");
  }

  if (!isActuallyCommissioner()) return <main className="mx-auto max-w-xl p-6 text-sm text-muted">Only the commissioner chooses championship hardware.</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-7">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Season setup</p>
      <h1 className="mt-1 text-3xl font-black">Choose the hardware</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">This is what your league chases all season. Tap any trophy to inspect it. Choose one before opening kickoff; then it becomes permanent for the season.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collection.map((design) => (
          <section key={design.id} className={`relative rounded-2xl border p-5 text-center ${selected === design.id ? "border-amber-300 bg-amber-300/10 shadow-[0_0_30px_rgba(251,191,36,.2)]" : "border-border bg-card"}`}>
            <button type="button" onClick={() => setInspect(design.id)} className="mx-auto block" aria-label={`Inspect ${design.name}`}>
              <HardwareTrophyIcon kind="championship" sportId={getLeague()?.sportId} size={150} trophyDesignId={design.id} />
            </button>
            <h2 className="mt-2 text-lg font-black">{design.name}</h2>
            <p className="mt-1 text-xs font-bold text-amber-200">{design.short}</p>
            <p className="mt-3 min-h-12 text-xs italic leading-relaxed text-muted">“{design.inscription}”</p>
            <button type="button" onClick={() => setSelected(design.id)} className={`mt-4 min-h-11 w-full rounded-xl font-black ${selected === design.id ? "bg-amber-300 text-black" : "border border-amber-300/40 text-amber-200"}`}>{selected === design.id ? "Selected" : "Choose this trophy"}</button>
          </section>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <button type="button" disabled={!selected || busy} onClick={() => void save()} className="mt-6 min-h-14 w-full rounded-2xl bg-primary px-5 text-lg font-black text-black disabled:opacity-40">{busy ? "Locking it in…" : "Use This Championship Trophy"}</button>
      {inspect && (() => { const design = CHAMPIONSHIP_TROPHIES.find((item) => item.id === inspect)!; return <TrophyLightbox open onClose={() => setInspect(null)} kind="championship" sportId={getLeague()?.sportId} title={design.name} subtitle={`${design.short} · “${design.inscription}”`} trophyDesignId={design.id} />; })()}
    </main>
  );
}
