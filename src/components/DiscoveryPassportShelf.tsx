"use client";

/**
 * Passport / discovery shelf — silent collection, zero points.
 * Discoverable later on profile; never a “Secret Stuff” menu on home.
 */

import { useEffect, useMemo, useState } from "react";
import {
  EVENT_EASTER_EGG,
  EVENT_PASSPORT_STAMP,
  getEasterEggProgress,
  getPassportRows,
  type DiscoveryDef,
} from "@/lib/easter-eggs";

type Props = {
  playerId: string;
  /** Only show if they have at least one stamp, or always for self */
  isSelf?: boolean;
};

export default function DiscoveryPassportShelf({ playerId, isSelf }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DiscoveryDef | null>(null);

  useEffect(() => {
    function bump() {
      setTick((t) => t + 1);
    }
    window.addEventListener(EVENT_PASSPORT_STAMP, bump);
    window.addEventListener(EVENT_EASTER_EGG, bump);
    return () => {
      window.removeEventListener(EVENT_PASSPORT_STAMP, bump);
      window.removeEventListener(EVENT_EASTER_EGG, bump);
    };
  }, []);

  const rows = useMemo(() => {
    void tick;
    return getPassportRows(playerId);
  }, [playerId, tick]);

  const eggProgress = useMemo(() => {
    void tick;
    return getEasterEggProgress(playerId);
  }, [playerId, tick]);

  const earned = rows.filter((r) => r.earned);
  // Hide empty passport for other people's profiles (unless eggs unlocked)
  if (!isSelf && earned.length === 0 && !eggProgress.unlocked) return null;
  if (!playerId) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-0.5">
            Passport
          </p>
          <h2 className="font-semibold text-lg">Stamps &amp; discoveries</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {earned.length === 0 && !eggProgress.unlocked
              ? "Nothing here yet. Curiosity writes its own itinerary."
              : earned.length > 0
                ? `${earned.length} quiet mark${earned.length === 1 ? "" : "s"} — no points, no standings.`
                : "Quiet marks and eggs you found. No points. No standings."}
          </p>
          {eggProgress.unlocked && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-100 tabular-nums">
              <span aria-hidden>🥚</span>
              Easter eggs {eggProgress.found} / {eggProgress.total}
            </p>
          )}
        </div>
        <span className="text-2xl" aria-hidden>
          🛂
        </span>
      </div>

      {earned.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {earned.slice(0, open ? earned.length : 8).map((r) => (
            <button
              key={r.def.id}
              type="button"
              onClick={() => setSelected(r.def)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium hover:bg-amber-500/20 transition"
              title={r.def.name}
            >
              <span aria-hidden>{r.def.icon}</span>
              {r.def.stampLabel || r.def.name}
            </button>
          ))}
        </div>
      )}

      {earned.length > 8 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-primary font-semibold mb-2"
        >
          {open ? "Show less" : `Show all ${earned.length}`}
        </button>
      )}

      {isSelf && (
        <p className="text-[10px] text-muted/80 italic leading-relaxed">
          Founder Binder: eggs reward curiosity, loyalty, and joy — never
          competition.
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl mb-2">{selected.icon}</div>
            <h3 className="font-bold text-lg mb-1">{selected.name}</h3>
            <p className="text-sm text-muted mb-2">{selected.description}</p>
            <p className="text-xs text-foreground/80 italic mb-4">
              {selected.flavor}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="w-full min-h-[44px] rounded-xl border border-border font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
