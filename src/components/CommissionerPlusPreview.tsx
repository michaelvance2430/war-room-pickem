import Link from "next/link";
import {
  COMMISSIONER_PLUS_PILLARS,
  COMMISSIONER_PLUS_PRICE,
  COMMISSIONER_PLUS_SEASON_PASSES,
} from "@/lib/commissioner-plus";
import { COMMISSIONER_PLUS_PUBLIC } from "@/lib/plus-contract";

/** Home preview only. No purchase control exists until every business gate passes. */
export default function CommissionerPlusPreview() {
  if (COMMISSIONER_PLUS_PUBLIC) return null;

  return (
    <section
      aria-labelledby="commissioner-plus-title"
      className="mt-10 overflow-hidden rounded-2xl border border-amber-300/35 bg-gradient-to-b from-amber-300/10 via-black/75 to-black/90 shadow-[0_0_60px_rgba(251,191,36,0.1)]"
    >
      <div className="border-b border-amber-300/30 bg-amber-300 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-black sm:text-[11px]">
        Under construction · Commissioner preview · Not available for purchase
      </div>

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/80">
              The commissioner gets the credit. We handle the work.
            </p>
            <h2 id="commissioner-plus-title" className="mt-2 text-3xl font-black text-white">
              COMMISSIONER<span className="text-amber-300">+</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              One sport-season pass transforms all of your eligible leagues with
              automation, premium identity, bigger Moments, and a permanent legacy.
              Every member gets the experience. Only the commissioner buys the pass.
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-center sm:min-w-48">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">
              Planned one-time price
            </p>
            <p className="mt-1 text-3xl font-black text-white">{COMMISSIONER_PLUS_PRICE}</p>
            <p className="text-xs font-semibold text-amber-200">per sports season</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMMISSIONER_PLUS_SEASON_PASSES.map((pass) => (
            <div key={pass.id} className="rounded-xl border border-amber-300/15 bg-black/35 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{pass.title}</p>
                <span className="text-[9px] font-bold uppercase tracking-wide text-amber-300/70">{pass.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Includes {pass.sports}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COMMISSIONER_PLUS_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-center">
              <p className="text-[9px] font-black tracking-[0.18em] text-amber-300/70">{pillar.number}</p>
              <p className="mt-1 text-xs font-bold text-white sm:text-sm">{pillar.title}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="max-w-xl text-center text-[11px] leading-relaxed text-muted sm:text-left">
            Creating leagues, publishing cards, scoring, standings, postseason,
            and competitive fairness remain free. Commissioner+ never changes a pick or point.
          </p>
          <Link
            href="/commissioner-plus"
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/10 px-5 text-sm font-extrabold text-amber-200 transition hover:border-amber-300/70 hover:bg-amber-300/15 sm:w-auto"
          >
            Preview the full package →
          </Link>
        </div>
      </div>
    </section>
  );
}
