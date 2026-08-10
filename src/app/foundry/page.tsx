"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FoundryGazetteStudio from "@/components/FoundryGazetteStudio";
import CreatorSkinPreview from "@/components/CreatorSkinPreview";
import WeeklyColdOpenModal from "@/components/WeeklyColdOpenModal";
import FinalDispatchPreview from "@/components/FinalDispatchPreview";
import FoundryRoomSimulator from "@/components/FoundryRoomSimulator";
import FoundryPlatformApiUsage from "@/components/FoundryPlatformApiUsage";
import FoundryIncidentControl from "@/components/FoundryIncidentControl";
import { markFoundrySessionActive } from "@/components/FoundrySessionChrome";
import { isAppCreator } from "@/lib/creator";
import {
  loadFounderLeagueFleetHealth,
  type LeagueFleetHealth,
  type RoomHealth,
} from "@/lib/founder-league-health";
import { switchToLeague } from "@/lib/session-restore";
import { createClient } from "@/lib/supabase/client";\nimport AccountDeletionFoundryProof from "@/components/AccountDeletionFoundryProof";

type Desk = "command" | "moments" | "sandbox";
type HealthPayload = {
  overall: "green" | "yellow" | "red";
  responseMs: number;
  checks: { id: string; label: string; status: "green" | "yellow" | "red"; detail: string }[];
};

const LIGHT = { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚪" } as const;

export default function FoundryPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [desk, setDesk] = useState<Desk>("command");
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [fleet, setFleet] = useState<LeagueFleetHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData.session?.user.id || null;
    if (!isAppCreator(uid)) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    markFoundrySessionActive();
    setError(null);
    try {
      const token = authData.session?.access_token;
      const [healthRes, fleetRes] = await Promise.all([
        fetch("/api/health", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((response) => response.json() as Promise<HealthPayload>),
        loadFounderLeagueFleetHealth(),
      ]);
      setHealth(healthRes);
      setFleet(fleetRes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Foundry health check failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enterRoom(room: RoomHealth) {
    setBusy(room.leagueId);
    const ok = await switchToLeague(room.leagueId);
    setBusy(null);
    if (!ok) {
      setLog("Could not enter that league.");
      return;
    }
    setLog(`Entered ${room.name}.`);
    void refresh();
  }

  function previewMoment(kind: "season" | "cold" | "ring") {
    setLog(null);
    if (kind === "season") {
      void import("@/lib/moments/season-open").then((module) =>
        module.requestSeasonOpenPreview()
      );
      return;
    }
    if (kind === "cold") {
      void import("@/lib/weekly-cold-open").then((module) =>
        module.requestWeeklyColdOpenPreview()
      );
      return;
    }
    void import("@/lib/creator-sandbox").then((module) =>
      module.jumpRingCeremony()
    );
  }

  if (allowed === null) return <FoundryMessage text="Checking creator access…" />;
  if (!allowed) return <FoundryMessage text="Foundry is creator-only." />;

  const rooms = fleet?.bySport.flatMap((sport) => sport.rooms) || [];
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-3 py-5 sm:px-5">
      <header className="mb-4 border-b border-border pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Creator only</p>
            <h1 className="text-2xl font-black">Foundry</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              Check the system, test the moments, or run a disposable season. Choose one job below.
            </p>
          </div>
          <button type="button" onClick={() => void refresh().then(() => setLog("✅ Foundry status refreshed. Sandbox state was not reset."))} className="min-h-10 rounded-lg border border-border px-3 text-xs font-bold">
            Refresh status
          </button>
        </div>
      </header>

      <nav className="mb-5 grid grid-cols-3 gap-2" aria-label="Foundry desks">
        <DeskButton active={desk === "command"} onClick={() => setDesk("command")} title="Command" note="League health" />
        <DeskButton active={desk === "moments"} onClick={() => setDesk("moments")} title="Moments" note="Player reveals" />
        <DeskButton active={desk === "sandbox"} onClick={() => setDesk("sandbox")} title="Sandbox" note="Simulate season" />
      </nav>

      {error && <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">{error}</p>}

      {desk === "command" && (
        <div className="space-y-4">
          <Intro title="Command · League Health" text="Use this desk to answer one question: is War Room healthy right now? Red needs attention, yellow needs watching, and green is operating normally." />
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Platform</h2>
            {!health && <p className="mt-2 text-xs text-muted">Checking website and database…</p>}
            {health && (
              <ul className="mt-3 space-y-2">
                {health.checks.map((check) => (
                  <li key={check.id} className="flex gap-2 text-xs">
                    <span aria-hidden>{LIGHT[check.status]}</span>
                    <span><strong>{check.label}</strong><span className="block text-muted">{check.detail}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <FoundryIncidentControl />
          <FoundryPlatformApiUsage />\n          <AccountDeletionFoundryProof />
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Leagues</h2>
            <p className="mt-1 text-xs text-muted">Every league you belong to. Entering a room changes which league the Sandbox controls.</p>
            <div className="mt-3 space-y-2">
              {rooms.map((room) => (
                <RoomRow key={room.leagueId} room={room} busy={busy === room.leagueId} onEnter={() => void enterRoom(room)} />
              ))}
              {!rooms.length && <p className="text-xs text-muted">No leagues found.</p>}
            </div>
          </section>
        </div>
      )}

      {desk === "moments" && (
        <div className="space-y-4">
          <Intro title="Moments · Player Experience" text="Use this desk to preview the emotional beats players see. These previews do not score games or change standings." />
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Quick previews</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Action title="Season Opening" note="The first welcome into a new season." onClick={() => previewMoment("season")} />
              <Action title="Cold Open" note="The returning-champion season reveal." onClick={() => previewMoment("cold")} />
              <Action title="Ring Ceremony" note="The championship hardware reveal." onClick={() => previewMoment("ring")} />
              <FinalDispatchPreview />
            </div>
          </section>
          <CreatorSkinPreview />
          <FoundryGazetteStudio />
          <WeeklyColdOpenModal forceOnly />
        </div>
      )}

      {desk === "sandbox" && (
        <div className="space-y-4">
          <Intro title="Sandbox · Live Season Simulation" text="Use this desk to create disposable league history, then walk the real Home, Picks, Standings, Board, and Gazette pages exactly as a player would." />
          <FoundryRoomSimulator />
        </div>
      )}

      <footer className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
        <Link href="/" className="text-muted hover:text-foreground">← Home</Link>
      </footer>
    </main>
  );
}

function FoundryMessage({ text }: { text: string }) {
  return <main className="mx-auto max-w-lg px-4 py-12 text-sm text-muted">{text}</main>;
}

function DeskButton({ active, onClick, title, note }: { active: boolean; onClick: () => void; title: string; note: string }) {
  return <button type="button" onClick={onClick} className={`min-h-16 rounded-xl border px-2 py-2 text-left ${active ? "border-primary bg-primary/15" : "border-border bg-card"}`}><strong className="block text-sm">{title}</strong><span className="block text-[10px] text-muted">{note}</span></button>;
}

function Intro({ title, text }: { title: string; text: string }) {
  return <section className="rounded-xl border border-primary/30 bg-primary/5 p-4"><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted">{text}</p></section>;
}

function Action({ title, note, onClick, disabled }: { title: string; note: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-20 rounded-lg border border-border bg-background p-3 text-left disabled:opacity-50"><strong className="block text-sm">{title}</strong><span className="mt-1 block text-[11px] leading-snug text-muted">{note}</span></button>;
}

function RoomRow({ room, busy, onEnter }: { room: RoomHealth; busy: boolean; onEnter: () => void }) {
  return <div className={`flex items-center gap-2 rounded-lg border p-3 ${room.isActive ? "border-primary/40 bg-primary/10" : "border-border"}`}><span aria-hidden>{LIGHT[room.light]}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{room.name}{room.isActive ? " · ACTIVE" : ""}</strong><span className="block text-[11px] text-muted">{room.summary}</span></div>{!room.isActive && <button type="button" disabled={busy} onClick={onEnter} className="min-h-9 rounded-lg border border-primary/40 px-3 text-xs font-bold text-primary disabled:opacity-50">{busy ? "…" : "Enter"}</button>}</div>;
}
