import Link from "next/link";
import {
  COMMISSIONER_PLUS_PILLARS,
  COMMISSIONER_PLUS_PRICE,
  COMMISSIONER_PLUS_SEASON_PASSES,
} from "@/lib/commissioner-plus";

export default function CommissionerPlusPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-amber-300/35 bg-gradient-to-b from-amber-300/10 via-black/80 to-black shadow-[0_0_70px_rgba(251,191,36,0.1)]">
        <div className="bg-amber-300 px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.22em] text-black sm:text-xs">
          Under construction · Preview only · Purchases are disabled
        </div>

        <div className="px-5 py-8 sm:px-10 sm:py-12">
          <Link href="/" className="text-xs font-bold text-muted hover:text-white">← Back to Home</Link>

          <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300/80">Built for the person running the room</p>
              <h1 className="mt-2 text-4xl font-black text-white sm:text-6xl">
                COMMISSIONER<span className="text-amber-300">+</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-white">
                Your league should feel professionally produced without becoming your second job.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                One commissioner buys a sport-season pass. Every eligible league
                they run in that sports family receives the premium experience—without
                another player subscription.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-7 py-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">Planned price</p>
              <p className="mt-1 text-4xl font-black text-white">{COMMISSIONER_PLUS_PRICE}</p>
              <p className="text-sm font-bold text-amber-200">sports season</p>
              <p className="mt-2 text-[10px] text-muted">One time · No auto-renewal planned</p>
            </div>
          </div>

          <section className="mt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/70">Choose the season—not a subscription</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {COMMISSIONER_PLUS_SEASON_PASSES.map((pass) => (
                <div key={pass.id} className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-white">{pass.title}</h2>
                      <p className="mt-1 text-sm text-muted">{pass.sports}</p>
                    </div>
                    <span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-200">{pass.status}</span>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted">
                    One purchase covers Commissioner+ across your eligible leagues in this sports season.
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {COMMISSIONER_PLUS_PILLARS.map((pillar) => (
              <section key={pillar.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="text-2xl font-black text-amber-300/40">{pillar.number}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/70">{pillar.eyebrow}</p>
                    <h2 className="mt-1 text-2xl font-black text-white">{pillar.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.summary}</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  {pillar.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-stone-300">
                      <span aria-hidden className="font-black text-amber-300">+</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">The free-game promise</p>
            <h2 className="mt-2 text-xl font-black text-white">Commissioner+ produces the show. It never changes the competition.</h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              League creation, invitations, picks, scoring, standings, postseason,
              Locker Room, the core Dispatch, trophies, and competitive fairness stay free.
              No extra points, late picks, extra weapons, or paid advantage—ever.
            </p>
          </section>

          <div className="mt-7 rounded-xl border border-amber-300/20 bg-black/40 p-5 text-center">
            <p className="text-sm font-bold text-white">Why can&apos;t I upgrade yet?</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-muted">
              Commissioner+ season passes stay locked until the LLC, business bank account,
              payments, server entitlements, restore, refund, and support systems are complete and tested.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
