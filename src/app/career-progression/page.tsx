import { CAREER_RANKS } from "@/lib/career-ranks";

function requirements(rank: (typeof CAREER_RANKS)[number]): string[] {
  const list = [`${rank.achievementPoints.toLocaleString()} achievement points`];
  if (rank.seasons > 0) list.push(`${rank.seasons} completed season${rank.seasons === 1 ? "" : "s"}`);
  if (rank.sports > 1) list.push(`${rank.sports} War Room sports played`);
  if (rank.tacticalNukes > 0) list.push(`${rank.tacticalNukes} documented Tactical Nuke`);
  return list;
}

export default function CareerProgressionPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 pb-28">
      <header className="rounded-2xl border border-amber-300/40 bg-[radial-gradient(circle_at_top,rgba(146,64,14,.35),rgba(2,8,5,.96)_62%)] p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.4)]">
        <p className="text-[9px] font-black uppercase tracking-[.24em] text-amber-300">War Room Career</p>
        <h1 className="mt-2 text-3xl font-black text-amber-100">Career Progression</h1>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-white/60">The complete road from Private to Five-Star Field General. Promotions are permanent—once earned, a rank never moves backward.</p>
      </header>

      <section className="mt-5 space-y-3" aria-label="All career ranks and requirements">
        {CAREER_RANKS.map((rank, index) => (
          <article key={rank.id} className="rounded-2xl border border-white/10 bg-card p-4">
            <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
              <strong className="text-lg font-black text-amber-200">{rank.abbreviation}</strong>
              <div className="min-w-0"><h2 className="font-black">{rank.name}</h2><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.16em] text-white/35">Grade {index + 1} · {rank.grade}</p></div>
              <span className="text-[10px] font-black text-amber-300">{rank.achievementPoints.toLocaleString()} AP</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
              {requirements(rank).map((requirement) => <span key={requirement} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-bold text-white/60">{requirement}</span>)}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
