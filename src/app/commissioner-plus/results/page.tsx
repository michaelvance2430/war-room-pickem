"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLeaguePlayers } from "@/lib/cloud";
import { getLeague, isOps } from "@/lib/league";
import {
  buildWeeklyResultsShareModel,
  renderWeeklyResultsCanvas,
  shareWeeklyResults,
  type WeeklyResultsShareModel,
} from "@/lib/weekly-results-share";

export default function CommissionerWeeklyResultsPage() {
  const [model, setModel] = useState<WeeklyResultsShareModel | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOps()) {
        setLoading(false);
        return;
      }
      const league = getLeague();
      const players = await loadLeaguePlayers("CommissionerWeeklyResults");
      if (cancelled) return;
      const next = buildWeeklyResultsShareModel(players, {
        leagueName: league?.name || "War Room",
        sportId: league?.sportId,
      });
      setModel(next);
      if (next) setPreview(renderWeeklyResultsCanvas(next).toDataURL("image/png"));
      setLoading(false);
    }
    void load().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  async function share() {
    if (!model) return;
    setStatus(null);
    const result = await shareWeeklyResults(model);
    setStatus(result === "shared" ? "Shared." : result === "downloaded" ? "Image downloaded—drop it in the group chat." : null);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-7">
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl bg-amber-300 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[.18em] text-black">
          Commissioner+ preview · Under construction
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Weekly after-action report</p>
            <h1 className="mt-1 text-2xl font-black">Give the group chat evidence.</h1>
          </div>
          <Link href="/" className="text-xs font-bold text-muted">Home</Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Real scored results. Crown, shame, board leader, and biggest mover—stamped with your league and ready to share.
        </p>

        {loading && <p className="py-12 text-center text-sm text-muted">Building the report…</p>}
        {!loading && !model && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-black">Nothing to report yet.</p>
            <p className="mt-2 text-sm text-muted">Score a real week first. War Room does not fabricate glory or shame.</p>
          </div>
        )}
        {model && preview && (
          <div className="mt-6 space-y-4">
            <button type="button" onClick={() => void share()} className="min-h-14 w-full rounded-2xl bg-amber-300 px-4 text-base font-black text-black shadow-[0_0_30px_rgba(252,211,77,.18)]">
              Share this card ↗
            </button>
            {status && <p className="text-center text-xs text-muted">{status}</p>}
            <div className="overflow-hidden rounded-2xl border-2 border-amber-300/30 bg-black shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={`${model.leagueName} ${model.weekLabel} weekly results card`} className="block h-auto w-full" />
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted">
              This never reveals anyone&apos;s picks. It only uses results already visible after scoring.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
