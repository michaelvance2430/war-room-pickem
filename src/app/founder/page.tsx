"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getSession, getLeague } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";
import { loadLeaguePlayers, loadLeagueActiveWeek } from "@/lib/cloud";
import {
  DEFAULT_INCIDENT_MESSAGE,
  loadPlatformIncident,
  setPlatformIncident,
  type PlatformIncident,
} from "@/lib/platform-status";

type Light = "green" | "yellow" | "red";

type HealthCheck = {
  id: string;
  label: string;
  status: Light;
  detail: string;
};

type HealthPayload = {
  ok: boolean;
  overall: Light;
  responseMs: number;
  checks: HealthCheck[];
  ts: string;
};

const DOT: Record<Light, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

export default function FounderDashboardPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<number | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [incident, setIncident] = useState<PlatformIncident | null>(null);
  const [incidentMsg, setIncidentMsg] = useState(DEFAULT_INCIDENT_MESSAGE);
  const [busy, setBusy] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [clientMs, setClientMs] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const session = getSession();
    const uid = session?.playerId || null;
    if (!isAppCreator(uid)) {
      setAllowed(false);
      return;
    }
    setAllowed(true);

    const t0 = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = (await res.json()) as HealthPayload;
      setHealth(json);
      setHealthError(null);
      setClientMs(Math.round(performance.now() - t0));
    } catch (e) {
      setHealth(null);
      setHealthError(e instanceof Error ? e.message : "Health check failed");
      setClientMs(Math.round(performance.now() - t0));
    }

    try {
      const players = await loadLeaguePlayers();
      setRoomPlayers(players.filter((p) => !p.isMock).length);
    } catch {
      setRoomPlayers(null);
    }

    try {
      const w = await loadLeagueActiveWeek();
      setActiveWeek(w);
    } catch {
      try {
        const raw = localStorage.getItem("warroom-active-week");
        setActiveWeek(raw != null ? parseInt(raw, 10) : null);
      } catch {
        setActiveWeek(null);
      }
    }
    setLeagueName(getLeague()?.name || null);

    const inc = await loadPlatformIncident();
    setIncident(inc);
    setIncidentMsg(inc.message || DEFAULT_INCIDENT_MESSAGE);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggleIncident(active: boolean) {
    setBusy(true);
    setSaveNote(null);
    const session = getSession();
    const result = await setPlatformIncident({
      active,
      message: incidentMsg,
      userId: session?.playerId,
    });
    const inc = await loadPlatformIncident();
    setIncident(inc);
    setBusy(false);
    if (result.source === "cloud") {
      setSaveNote(
        active
          ? "Incident ON — friends will see the banner."
          : "Incident OFF — banner cleared."
      );
    } else {
      setSaveNote(
        result.error ||
          "Saved locally only. Run supabase/platform-status.sql so everyone sees it."
      );
    }
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
          <p className="text-sm text-muted">Checking access…</p>
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 space-y-3">
          <h1 className="text-xl font-bold">Founder Dashboard</h1>
          <p className="text-sm text-muted leading-relaxed">
            This cockpit is for the app creator only — not league commissioners.
          </p>
          <Link href="/" className="text-sm text-primary underline">
            ← Back home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Cockpit
            </p>
            <h1 className="text-xl font-bold mt-0.5">Founder Dashboard</h1>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Not for users. Morning health. Controlled opening. No silence when
              things break.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-card-hover min-h-[40px]"
          >
            Refresh
          </button>
        </div>

        {/* Today's health */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Today&apos;s health</h2>
          {healthError && (
            <p className="text-xs text-danger">{healthError}</p>
          )}
          {!health && !healthError && (
            <p className="text-xs text-muted">Checking…</p>
          )}
          {health && (
            <ul className="space-y-2">
              {health.checks.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 text-sm leading-snug"
                >
                  <span className="shrink-0" aria-hidden>
                    {DOT[c.status]}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-[11px] text-muted">
                      {c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Real numbers only — no theater */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">This room (honest)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Players in room"
              value={roomPlayers != null ? String(roomPlayers) : "—"}
            />
            <Stat
              label="Active week"
              value={activeWeek != null ? String(activeWeek) : "—"}
            />
            <Stat
              label="Health response"
              value={
                clientMs != null
                  ? `${clientMs} ms`
                  : health
                    ? `${health.responseMs} ms`
                    : "—"
              }
            />
            <Stat
              label="Overall"
              value={
                health
                  ? `${DOT[health.overall]} ${health.overall}`
                  : healthError
                    ? "🔴 error"
                    : "—"
              }
            />
          </div>
          {leagueName && (
            <p className="text-[11px] text-muted mt-3">
              League: <span className="text-foreground">{leagueName}</span>
            </p>
          )}
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            No fake “users online.” Platform-wide counts come later when we can
            measure them honestly.
          </p>
        </section>

        {/* Bug emergency plan */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Bug emergency plan</h2>
          <p className="text-xs text-muted leading-relaxed">
            People forgive bugs. They rarely forgive being ignored. Flip this on
            when something breaks.
          </p>
          <label className="block text-xs text-muted">
            Banner message
            <textarea
              value={incidentMsg}
              onChange={(e) => setIncidentMsg(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleIncident(true)}
              className="flex-1 min-h-[44px] rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-sm font-semibold px-3 disabled:opacity-50"
            >
              ⚠️ Turn incident ON
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleIncident(false)}
              className="flex-1 min-h-[44px] rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-semibold px-3 disabled:opacity-50"
            >
              Clear banner
            </button>
          </div>
          {incident && (
            <p className="text-[11px] text-muted">
              Status:{" "}
              <span className="text-foreground font-medium">
                {incident.active ? "ACTIVE" : "off"}
              </span>
              {" · "}
              source: {incident.source}
              {incident.updatedAt
                ? ` · updated ${new Date(incident.updatedAt).toLocaleString()}`
                : ""}
            </p>
          )}
          {saveNote && (
            <p className="text-xs text-primary leading-relaxed">{saveNote}</p>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Controlled opening
          </h2>
          <ol className="text-xs text-muted space-y-1 list-decimal list-inside leading-relaxed">
            <li>Private alpha — you</li>
            <li>Friends (~20)</li>
            <li>Friends of friends (~100)</li>
            <li>Public beta (~500)</li>
            <li>App Store — same backend door</li>
          </ol>
          <p className="text-[11px] text-muted pt-1">
            Don&apos;t market hard until the room has scar tissue.
          </p>
        </section>

        <p className="text-[11px] text-muted text-center pb-6">
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            ← Home
          </Link>
          {" · "}
          <Link
            href="/account"
            className="text-primary underline-offset-2 hover:underline"
          >
            Account
          </Link>
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
