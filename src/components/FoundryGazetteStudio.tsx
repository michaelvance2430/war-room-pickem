"use client";

/**
 * Read-only Gazette proof bench.
 * It renders archived production payloads through the production GazettePaper.
 * No mock edition builder and no score/achievement/engraving writes.
 */

import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  loadGazetteArchive,
  type ArchivedGazette,
} from "@/lib/gazette";
import {
  buildFoundryGazetteFixture,
  FOUNDRY_GAZETTE_VERSION_COUNT,
} from "@/lib/foundry-gazette-fixtures";

const GazettePaper = dynamic(
  () => import("@/components/GazettePaper").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <p className="bg-[#f4f0e6] px-4 py-10 text-center text-xs font-bold text-stone-600">
        Printing Foundry edition…
      </p>
    ),
  }
);

class GazettePreviewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WR-FOUNDRY-GAZETTE] preview contained", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-4 text-center">
          <p className="text-sm font-black text-danger">Preview renderer contained</p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Foundry remains operational. Reload this page to retry the Gazette preview.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

type Proof = { label: string; ok: boolean; detail: string };

function inspect(row: ArchivedGazette): Proof[] {
  const e = row.edition;
  return [
    {
      label: "Real edition",
      ok: Number.isFinite(row.weekNumber) && Boolean(e?.crown?.names?.length),
      detail: `Archived Week ${row.weekNumber} production payload`,
    },
    {
      label: "Front page",
      ok: Boolean(e?.sideStories?.length),
      detail: e?.sideStories?.length
        ? `${e.sideStories.length} community lead${e.sideStories.length === 1 ? "" : "s"}`
        : "Older/slim edition has no community lead",
    },
    {
      label: "Sports page",
      ok: Boolean(e?.crown?.headline),
      detail: e?.shame ? "Crown and shame sourced" : "Crown sourced; no truthful shame story",
    },
    {
      label: "Rivalry page",
      ok: Boolean(e?.rivalryWatch || e?.standingsDeadlock || e?.swing),
      detail: e?.rivalryWatch
        ? `${e.rivalryWatch.names.join(" vs ")} · dynamic live race`
        : "No fabricated rivalry; page explains the empty desk",
    },
    {
      label: "Back page",
      ok: Array.isArray(e?.classifieds),
      detail: `${e?.classifieds?.length || 0} filed classified${e?.classifieds?.length === 1 ? "" : "s"}`,
    },
  ];
}

export default function FoundryGazetteStudio() {
  const [lane, setLane] = useState<"simulator" | "proof">("simulator");
  const [fixtureVersion, setFixtureVersion] = useState(1);
  const [fixtureNonce, setFixtureNonce] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editions, setEditions] = useState<ArchivedGazette[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadGazetteArchive();
      if (!result.ok) {
        setEditions([]);
        setError(result.error || "Could not load Dispatch archive");
      } else {
        setEditions(result.editions || []);
        setSelected(0);
      }
    } catch (cause) {
      setEditions([]);
      setError(cause instanceof Error ? cause.message : "Could not load Dispatch archive");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const version = 1 + Math.floor(Math.random() * FOUNDRY_GAZETTE_VERSION_COUNT);
    setFixtureVersion(version);
    setFixtureNonce(Date.now());
    void load();
  }, [load]);

  const row = editions[selected] || null;
  const proofs = row ? inspect(row) : [];
  const fixture = buildFoundryGazetteFixture(
    fixtureVersion,
    fixtureNonce || 1
  );

  function regenerate() {
    setFixtureVersion((current) =>
      current >= FOUNDRY_GAZETTE_VERSION_COUNT ? 1 : current + 1
    );
    setFixtureNonce(Date.now());
    setPreviewOpen(true);
  }

  function openPreview() {
    setFixtureVersion(
      1 + Math.floor(Math.random() * FOUNDRY_GAZETTE_VERSION_COUNT)
    );
    setFixtureNonce(Date.now());
    setPreviewOpen(true);
  }

  return (
    <section className="rounded-xl border-2 border-red-500/50 bg-red-950/20 p-3 sm:p-4 space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">
            Foundry Studio · Flagship experience
          </p>
          <h3 className="mt-1 text-lg font-black">Dispatch proof bench</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Two lanes, one production reader: 18 fictional editorial stress tests plus archived
            real-edition proof. Neither preview writes scores, profiles, trophies, or Gazette rows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-[40px] shrink-0 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-background/60 p-1">
        <button
          type="button"
          onClick={() => setLane("simulator")}
          className={`min-h-[44px] rounded-lg px-2 text-xs font-black ${lane === "simulator" ? "bg-red-700 text-white" : "text-muted"}`}
        >
          Editorial Simulator
        </button>
        <button
          type="button"
          onClick={() => setLane("proof")}
          className={`min-h-[44px] rounded-lg px-2 text-xs font-black ${lane === "proof" ? "bg-emerald-700 text-white" : "text-muted"}`}
        >
          Production Proof
        </button>
      </div>

      {lane === "simulator" && (
        <>
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-red-200">
              FICTIONAL · Foundry only · Edition {fixtureVersion} of {FOUNDRY_GAZETTE_VERSION_COUNT}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              Auto-generated when Foundry opens. Scores, people, and stories below are deliberate fiction for copy and layout QA.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="text-[10px] font-black uppercase tracking-wide text-muted">
              Fixture edition
              <select
                value={fixtureVersion}
                onChange={(event) => {
                  setFixtureVersion(Number(event.target.value));
                  setFixtureNonce(Date.now());
                }}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
              >
                {Array.from({ length: FOUNDRY_GAZETTE_VERSION_COUNT }, (_, index) => (
                  <option key={index + 1} value={index + 1}>Edition {String(index + 1).padStart(2, "0")}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={regenerate}
              className="self-end min-h-[44px] rounded-lg bg-red-700 px-3 text-xs font-black text-white"
            >
              Generate next
            </button>
          </div>
          {!previewOpen ? (
            <button
              type="button"
              onClick={openPreview}
              className="min-h-[52px] w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white"
            >
              Open generated Foundry Gazette
            </button>
          ) : (
            <GazettePreviewBoundary>
              <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-red-500/40">
                <GazettePaper
                  key={`fixture-${fixtureVersion}-${fixtureNonce}`}
                  edition={fixture}
                  variant="archive"
                  foundryPreview
                />
              </div>
            </GazettePreviewBoundary>
          )}
        </>
      )}

      {lane === "proof" && loading && <p className="py-5 text-center text-xs text-muted">Opening the archive…</p>}
      {lane === "proof" && error && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      {lane === "proof" && !loading && !error && editions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center">
          <p className="text-sm font-bold">No real edition to inspect</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Use the LAB season factory or post + score a week in an explicitly marked LAB room.
            The real scoring pipeline will archive the paper here.
          </p>
        </div>
      )}

      {lane === "proof" && row && (
        <>
          <label className="block text-[10px] font-black uppercase tracking-wide text-muted">
            Production edition
            <select
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
            >
              {editions.map((edition, index) => (
                <option key={edition.id || `${edition.weekNumber}-${index}`} value={index}>
                  {edition.weekLabel || `Week ${edition.weekNumber}`} · {edition.edition.ritualName || edition.volumeLabel}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-1.5 sm:grid-cols-5">
            {proofs.map((proof) => (
              <div key={proof.label} className={`rounded-lg border px-2.5 py-2 ${proof.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                <p className="text-[10px] font-black uppercase tracking-wide">{proof.ok ? "PASS" : "TRUTH"} · {proof.label}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted">{proof.detail}</p>
              </div>
            ))}
          </div>

          <GazettePreviewBoundary>
            <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border">
              <GazettePaper
                key={row.id || row.weekNumber}
                edition={row.edition}
                variant="archive"
                foundryPreview
              />
            </div>
          </GazettePreviewBoundary>
        </>
      )}
    </section>
  );
}
