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
import {
  creatorEyesBlurb,
  creatorEyesLabel,
  EVENT_CREATOR_EYES,
  getCreatorEyesMode,
  setCreatorEyesMode,
  startFirstHourAsNewCommissioner,
  startFirstHourAsNewPlayer,
  type CreatorEyesMode,
} from "@/lib/creator-eyes";
import {
  founderEnsureFullBotRoster,
  founderOpenLockedBoard,
  founderPostAndScoreWeek,
  founderPostWeek,
  founderScoreWeek,
} from "@/lib/founder-one-click";
import { useRouter } from "next/navigation";
import { markFoundrySessionActive } from "@/components/FoundrySessionChrome";
import { switchToLeague } from "@/lib/session-restore";
import {
  loadFounderLeagueFleetHealth,
  type LeagueFleetHealth,
  type RoomHealth,
  type RoomLight,
} from "@/lib/founder-league-health";

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

const ROOM_DOT: Record<RoomLight, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  gray: "⚪",
};

export default function FounderDashboardPage() {
  const router = useRouter();
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
  const [eyes, setEyes] = useState<CreatorEyesMode>("off");
  /** One week knob for the whole playground */
  const [week, setWeek] = useState(1);
  const [labBusy, setLabBusy] = useState(false);
  const [labLog, setLabLog] = useState<string | null>(null);
  const [labSteps, setLabSteps] = useState<string[]>([]);
  const [fleet, setFleet] = useState<LeagueFleetHealth | null>(null);
  const [fleetBusy, setFleetBusy] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [enterBusy, setEnterBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = getSession();
    const uid = session?.playerId || null;
    if (!isAppCreator(uid)) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    markFoundrySessionActive();

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

    setFleetBusy(true);
    setFleetError(null);
    try {
      const f = await loadFounderLeagueFleetHealth();
      setFleet(f);
    } catch (e) {
      setFleet(null);
      setFleetError(
        e instanceof Error ? e.message : "Could not load league fleet"
      );
    }
    setFleetBusy(false);

    const inc = await loadPlatformIncident();
    setIncident(inc);
    setIncidentMsg(inc.message || DEFAULT_INCIDENT_MESSAGE);
  }, []);

  async function enterRoom(leagueId: string) {
    if (enterBusy) return;
    setEnterBusy(leagueId);
    const ok = await switchToLeague(leagueId);
    setEnterBusy(null);
    if (!ok) {
      setLabLog("❌ Could not switch into that room");
      return;
    }
    void refresh();
    router.push("/");
  }

  useEffect(() => {
    void refresh();
    setEyes(getCreatorEyesMode());
    function onEyes() {
      setEyes(getCreatorEyesMode());
    }
    window.addEventListener(EVENT_CREATOR_EYES, onEyes);
    // Deep link / exit-from-eyes: scroll to eyes desk
    if (typeof window !== "undefined" && window.location.hash === "#eyes") {
      window.setTimeout(() => {
        document
          .getElementById("eyes")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
    return () => window.removeEventListener(EVENT_CREATOR_EYES, onEyes);
  }, [refresh]);

  function setPlayWeek(w: number) {
    const n = Math.max(0, Math.min(22, Math.floor(w)));
    setWeek(n);
    if (eyes !== "off") {
      void import("@/lib/creator-eyes").then((m) => {
        m.applyEyesWeek(n);
        setEyes(m.getCreatorEyesMode());
      });
    }
  }

  function enterEyes(mode: CreatorEyesMode, href: string) {
    markFoundrySessionActive();
    setCreatorEyesMode(mode, { weekNumber: week });
    setEyes(mode);
    router.push(href);
  }

  function exitEyes() {
    setCreatorEyesMode("off");
    setEyes("off");
    // Stay on Foundry (eyes desk) — never bounce Home after a preview
    try {
      router.replace("/founder#eyes");
      window.setTimeout(() => {
        document
          .getElementById("eyes")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      /* ignore */
    }
  }

  function runFirstHourPlayer() {
    markFoundrySessionActive();
    startFirstHourAsNewPlayer({
      sportId: getLeague()?.sportId === "nfl" ? "nfl" : "cfb",
    });
    setEyes("new_player");
    router.push("/");
  }

  function runFirstHourCommish() {
    markFoundrySessionActive();
    startFirstHourAsNewCommissioner({
      sportId: getLeague()?.sportId === "nfl" ? "nfl" : "cfb",
    });
    setEyes("new_commissioner");
    router.push("/commissioner?tab=card&first=1");
  }

  async function runLab(
    kind: "roster" | "post" | "score" | "both" | "board"
  ) {
    setLabBusy(true);
    setLabLog(null);
    setLabSteps([]);
    try {
      const res =
        kind === "roster"
          ? await founderEnsureFullBotRoster()
          : kind === "post"
            ? await founderPostWeek(week)
            : kind === "score"
              ? await founderScoreWeek(week)
              : kind === "board"
                ? await founderOpenLockedBoard(week)
                : await founderPostAndScoreWeek(week);
      setLabSteps(res.steps);
      setLabLog(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
      void refresh();
      if (kind === "board" && res.ok) {
        router.push(`/board?week=${week}`);
      }
      // After score: go Home so Gazette + cheevo modals (mounted in Nav) can fire
      if (
        res.ok &&
        (kind === "score" || kind === "both") &&
        typeof window !== "undefined"
      ) {
        window.setTimeout(() => {
          router.push("/");
        }, 400);
      }
    } catch (e) {
      setLabLog(e instanceof Error ? e.message : "Lab action failed");
    }
    setLabBusy(false);
  }

  function jumpPopup(
    kind: "ring" | "card" | "gazette" | "paper" | "cut" | "trophy" | "cold"
  ) {
    if (kind === "cold") {
      // Stay on Foundry — play broadcast in place (preview, no once-per-week burn)
      void import("@/lib/weekly-cold-open").then((m) => {
        m.requestWeeklyColdOpenPreview();
      });
      return;
    }
    void import("@/lib/creator-sandbox").then(async (sb) => {
      if (kind === "ring") {
        await sb.jumpRingCeremony();
        router.push("/");
        return;
      }
      if (kind === "card") {
        await sb.jumpCardPublished(week);
        router.push("/");
        return;
      }
      if (kind === "cut") {
        sb.jumpCutStoryDoor();
        router.push("/");
        return;
      }
      if (kind === "trophy") {
        sb.jumpTrophyStoryDoor();
        router.push("/");
        return;
      }
      if (kind === "paper") {
        // Real paper + cheevo path after a scored week (Foundry drama unlock)
        await sb.jumpGazettePaperAndCheevos();
        router.push("/");
        return;
      }
      sb.jumpGazetteShelfReveal();
      router.push("/");
    });
  }

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
              Foundry Hub
            </p>
            <h1 className="text-xl font-bold mt-0.5">Founder Dashboard</h1>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              First hour first. Then playground. Sticky ← Foundry bar stays on
              while you walk the app.
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

        {/* Quick: weekly cold open formatting preview */}
        <section className="rounded-2xl border-2 border-amber-400/45 bg-amber-500/10 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Weekly cold open · formatting check
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Play the Kahmann / Kalshi broadcast here — same layout players get
            after Aug 16. Preview does not burn the once-per-week flag.
          </p>
          <button
            type="button"
            onClick={() => jumpPopup("cold")}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-amber-400 text-black text-sm font-extrabold touch-manipulation active:scale-[0.99]"
          >
            ▶ Watch cold open
          </button>
        </section>

        {/* ========== CRITICAL: first hour ========== */}
        <section
          id="first-hour"
          className="rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 p-4 space-y-3 shadow-[0_0_32px_rgba(245,158,11,0.12)] scroll-mt-24"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
              Critical · first hour
            </p>
            <h2 className="text-base font-bold text-foreground mt-0.5">
              Hone the onboarding
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              If the first hour is busy or confusing, it&apos;s a real product
              issue. Walk these before anything else — quiet chrome, local
              demo card, one-tap back to Foundry.
            </p>
          </div>
          <button
            type="button"
            onClick={runFirstHourPlayer}
            className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-sky-400/50 bg-sky-500/15 text-left px-3.5 touch-manipulation"
          >
            <span className="block text-sm font-extrabold text-sky-100">
              Start new player from beginning →
            </span>
            <span className="block text-[11px] text-muted mt-0.5 leading-snug">
              Week 0 · no locked picks · what a joiner actually sees on Home +
              Picks
            </span>
          </button>
          <button
            type="button"
            onClick={runFirstHourCommish}
            className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-primary/45 bg-primary/10 text-left px-3.5 touch-manipulation"
          >
            <span className="block text-sm font-extrabold text-primary">
              Join as new commissioner →
            </span>
            <span className="block text-[11px] text-muted mt-0.5 leading-snug">
              Simple host · first card · the first-hour host path (not deep
              tools)
            </span>
          </button>
          {eyes !== "off" && (
            <button
              type="button"
              onClick={exitEyes}
              className="w-full py-2.5 rounded-lg border border-border text-xs font-bold text-muted"
            >
              Exit eyes · back to normal creator view
            </button>
          )}
        </section>

        {/* Fleet health — every room as the product grows */}
        <section
          id="fleet-health"
          className="rounded-2xl border-2 border-primary/35 bg-card p-4 space-y-3 scroll-mt-24"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                Fleet
              </p>
              <h2 className="text-sm font-semibold">All leagues health</h2>
              <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                Every room you&apos;re in — CFB, NFL, and later sports. Lights
                = empty / behind / live. Not just the active desk.
              </p>
            </div>
            <button
              type="button"
              disabled={fleetBusy}
              onClick={() => void refresh()}
              className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-50"
            >
              {fleetBusy ? "…" : "Refresh"}
            </button>
          </div>

          {fleetError && (
            <p className="text-xs text-danger">{fleetError}</p>
          )}
          {fleetBusy && !fleet && (
            <p className="text-xs text-muted">Probing every room…</p>
          )}

          {fleet && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <FleetStat label="Rooms" value={String(fleet.totals.rooms)} />
                <FleetStat
                  label="Humans"
                  value={String(fleet.totals.humans)}
                />
                <FleetStat
                  label="OK / watch"
                  value={`${fleet.totals.green} · ${fleet.totals.yellow + fleet.totals.red}`}
                />
                <FleetStat
                  label="Open lobby"
                  value={String(fleet.totals.openRooms)}
                />
              </div>

              {fleet.bySport.map((bucket) => (
                <div key={bucket.sportId} className="space-y-2">
                  <p className="text-[11px] font-bold text-foreground">
                    {bucket.emoji} {bucket.label} · {bucket.rooms.length} room
                    {bucket.rooms.length === 1 ? "" : "s"}
                  </p>
                  <ul className="space-y-2">
                    {bucket.rooms.map((r) => (
                      <RoomHealthCard
                        key={r.leagueId}
                        room={r}
                        busy={enterBusy === r.leagueId}
                        onEnter={() => void enterRoom(r.leagueId)}
                      />
                    ))}
                  </ul>
                </div>
              ))}

              <p className="text-[10px] text-muted">
                Probed{" "}
                {fleet.loadedAt
                  ? new Date(fleet.loadedAt).toLocaleTimeString()
                  : "—"}
                . Platform lights (website / DB / odds) are below.
              </p>
            </>
          )}

          {!fleetBusy && !fleet && !fleetError && (
            <p className="text-xs text-muted">No rooms yet.</p>
          )}
        </section>

        {/* ========== THE PLAYGROUND (everything simple) ========== */}
        <section className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-5 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Playground
            </p>
            <h2 className="text-base font-bold text-foreground mt-0.5">
              Play the whole product
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {leagueName ? (
                <>
                  Room: <strong className="text-foreground">{leagueName}</strong>
                  {roomPlayers != null ? ` · ${roomPlayers} players` : ""}
                  {activeWeek != null ? ` · cloud week ${activeWeek}` : ""}
                </>
              ) : (
                "Be commissioner of a league first, then use these buttons."
              )}
            </p>
          </div>

          {/* Shared week */}
          <label className="block text-xs text-muted">
            Week (everything below uses this)
            <input
              type="number"
              min={0}
              max={22}
              value={week}
              disabled={labBusy}
              onChange={(e) =>
                setPlayWeek(parseInt(e.target.value, 10) || 0)
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base font-mono font-bold text-foreground"
            />
          </label>

          {/* A — Make the room real */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              1 · Make the room
            </p>
            <button
              type="button"
              disabled={labBusy}
              onClick={() => void runLab("roster")}
              className="w-full py-3 min-h-[48px] rounded-xl border border-border bg-background text-sm font-bold disabled:opacity-50"
            >
              {labBusy ? "Working…" : "Fill bots + locker + crystal ball"}
            </button>
          </div>

          {/* B — Run a week */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              2 · Run week {week} ·{" "}
              <span className="text-amber-300">REAL ROOM</span> (writes standings)
            </p>
            <button
              type="button"
              disabled={labBusy}
              onClick={() => void runLab("both")}
              className="w-full py-4 min-h-[56px] rounded-xl bg-amber-400 text-black text-base font-black disabled:opacity-50"
            >
              {labBusy ? "Working…" : `⚡ Post + score week ${week}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={labBusy}
                onClick={() => void runLab("post")}
                className="py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
              >
                Post only
              </button>
              <button
                type="button"
                disabled={labBusy}
                onClick={() => void runLab("score")}
                className="py-3 min-h-[48px] rounded-xl border border-primary/50 text-primary text-sm font-bold disabled:opacity-50"
              >
                Score only
              </button>
            </div>
            <button
              type="button"
              disabled={labBusy}
              onClick={() => void runLab("board")}
              className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-sky-400/50 bg-sky-500/10 text-sm font-extrabold text-sky-100 disabled:opacity-50"
            >
              {labBusy
                ? "Working…"
                : `Open Board locked (not scored) · week ${week}`}
            </button>
            <p className="text-[10px] text-muted leading-relaxed">
              Fills bot slips (and yours if empty), freezes kickoffs in the past,
              and opens The Board so every side lists who picked whom — no score
              yet.
            </p>
            {labLog && (
              <p
                className={`text-xs font-semibold ${
                  labLog.startsWith("✅") ? "text-primary" : "text-danger"
                }`}
              >
                {labLog}
              </p>
            )}
            {labSteps.length > 0 && (
              <ul className="text-[10px] text-muted max-h-24 overflow-y-auto space-y-0.5 px-1">
                {labSteps.slice(-8).map((s, i) => (
                  <li key={`${i}-${s.slice(0, 20)}`}>· {s}</li>
                ))}
              </ul>
            )}
          </div>

          {/* C — Go look */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              3 · Go look (after post/score)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["/", "Home"],
                  ["/picks", "Picks"],
                  ["/board", "Board"],
                  ["/standings", "Standings"],
                  ["/gazette", "Gazette"],
                  ["/locker-room", "Locker"],
                ] as const
              ).map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="py-2.5 min-h-[44px] rounded-lg border border-border bg-background text-center text-xs font-bold text-foreground hover:border-primary/40"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* D — Eyes (mid/late season week knob — first hour is above) */}
          <div id="eyes" className="space-y-2 scroll-mt-24">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              4 · Wear their eyes at week {week} ·{" "}
              <span className="text-sky-300">PREVIEW only</span>
            </p>
            <p className="text-[10px] text-muted leading-relaxed">
              First-hour sims are in the amber box at the top. These jump to a
              chosen week after that.{" "}
              <strong className="text-sky-200">
                Eyes = any page, real league untouched
              </strong>{" "}
              (picks/cards local; score &amp; locker posts blocked until you
              Exit → Foundry).
            </p>
            {eyes !== "off" && (
              <div className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs">
                <p className="font-bold text-sky-100">
                  {creatorEyesLabel(eyes)} ON
                </p>
                <p className="text-muted mt-0.5">{creatorEyesBlurb(eyes)}</p>
                <button
                  type="button"
                  onClick={exitEyes}
                  className="mt-2 w-full py-2 rounded-lg bg-sky-400 text-black text-xs font-bold"
                >
                  Exit eyes
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => enterEyes("new_player", "/")}
                className="w-full py-3 min-h-[48px] rounded-xl border border-sky-400/40 text-sm font-bold text-left px-3 hover:bg-sky-500/10"
              >
                As new player →
                <span className="block text-[11px] font-normal text-muted">
                  Quiet chrome · lock picks on a local card for week {week}
                </span>
              </button>
              <button
                type="button"
                onClick={() => enterEyes("new_commissioner", "/commissioner")}
                className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 text-sm font-bold text-left px-3 hover:bg-primary/10"
              >
                As new commissioner →
                <span className="block text-[11px] font-normal text-muted">
                  Simple host · fill seats yes/no only
                </span>
              </button>
            </div>
          </div>

          {/* E — Popups */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              5 · Flash a moment
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => jumpPopup("cold")}
                className="py-2.5 rounded-lg border border-amber-400/40 bg-amber-500/10 text-xs font-semibold hover:bg-amber-500/15"
              >
                ▶ Watch cold open (Kahmann / Kalshi)
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("ring")}
                className="py-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-background"
              >
                Ring ceremony
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("card")}
                className="py-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-background"
              >
                Card just published
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("paper")}
                className="py-2.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-semibold hover:bg-primary/15"
              >
                Gazette paper + cheevos (after score)
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("gazette")}
                className="py-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-background"
              >
                Week-3 Gazette shelf unlock only
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("cut")}
                className="py-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-background"
              >
                Cut line door → Board
              </button>
              <button
                type="button"
                onClick={() => jumpPopup("trophy")}
                className="py-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-background"
              >
                Trophy / brackets door
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted leading-relaxed border-t border-border pt-3">
            <strong className="text-foreground">REAL ROOM</strong> = amber
            buttons (cloud standings).{" "}
            <strong className="text-foreground">PREVIEW</strong> = eyes mode
            (local picks only — stays quiet on purpose). Tip: ⚡ Post + score
            → auto-opens drama (Gazette + cheevos on Home). First-hour eyes
            still suppress popups so you can test the calm path.
          </p>
        </section>

        {/* Founder Binder — product law (not a user feature list) */}
        <section className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            Founder Binder
          </p>
          <h2 className="text-sm font-semibold">Easter eggs</h2>
          <p className="text-xs text-muted leading-relaxed">
            Easter eggs should reward curiosity, loyalty, and joy — not
            competition. They should make players smile, laugh, or feel
            appreciated, never make them feel like they missed out on an
            advantage. Discoverable, not announced. Never points, standings,
            competitive edge, or payment.
          </p>
        </section>

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

function FleetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wide text-muted font-bold">
        {label}
      </p>
      <p className="text-base font-black tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function RoomHealthCard({
  room,
  busy,
  onEnter,
}: {
  room: RoomHealth;
  busy: boolean;
  onEnter: () => void;
}) {
  return (
    <li
      className={`rounded-xl border px-3 py-2.5 ${
        room.isActive
          ? "border-primary/45 bg-primary/10"
          : "border-border/70 bg-background/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0" aria-hidden>
          {ROOM_DOT[room.light]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">
            {room.name}
            {room.isActive && (
              <span className="ml-1.5 text-[10px] uppercase text-primary font-extrabold">
                here
              </span>
            )}
            {room.isOpen && (
              <span className="ml-1.5 text-[9px] uppercase text-sky-300 font-bold">
                open
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">
            {room.summary}
          </p>
          <p className="text-[10px] text-muted/90 mt-1 font-mono">
            {room.code}
            {" · "}
            {room.humans}h
            {room.bots > 0 ? ` · ${room.bots}b` : ""}
            {room.active7d != null ? ` · ${room.active7d} active 7d` : ""}
            {room.role === "commissioner" ? " · host" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!room.isActive && (
            <button
              type="button"
              disabled={busy}
              onClick={onEnter}
              className="min-h-[36px] px-2.5 rounded-lg border border-primary/40 text-primary text-[11px] font-bold disabled:opacity-50"
            >
              {busy ? "…" : "Enter"}
            </button>
          )}
          {room.isActive && (
            <Link
              href="/standings"
              className="min-h-[36px] px-2.5 rounded-lg bg-primary text-black text-[11px] font-bold inline-flex items-center justify-center"
            >
              Table
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
