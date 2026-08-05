"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import {
  crystalBallLockLabel,
  crystalBallTeams,
  crownNationalChampion,
  loadCrystalBall,
  peekLocalCrystalBall,
  saveCrystalBallPick,
  type CrystalBallState,
} from "@/lib/crystal-ball";
import { getLeague, getSession } from "@/lib/league";
import {
  formatCountdownToDeadline,
  type LeagueLockCountdown,
} from "@/lib/dates";
import { getNflTeamByName, nflTeamAbbr } from "@/lib/teams/nfl-catalog";
import {
  matchCfbTeamConfident,
  type CanonicalTeam,
} from "@/lib/teams/cfb-catalog";

function emptyShell(sportId?: string | null): CrystalBallState {
  const nfl = sportId === "nfl";
  return {
    myTeam: null,
    picks: [],
    lockedCount: 0,
    champion: null,
    achievements: [],
    locked: false,
    lockLabel: crystalBallLockLabel(sportId),
    lockAtMs: nfl ? null : null,
    kickoffKnown: false,
    cloud: false,
  };
}

function tickMsFor(lockAt: number | null, now: number): number {
  if (!lockAt) return 60_000;
  const rem = lockAt - now;
  if (rem <= 0) return 15_000;
  if (rem < 10 * 60_000) return 1_000;
  if (rem < 60 * 60_000) return 5_000;
  if (rem < 24 * 60 * 60_000) return 30_000;
  return 60_000;
}

function TeamCrest({
  team,
  name,
  large,
  sportId,
}: {
  team: CanonicalTeam | null;
  name: string;
  large?: boolean;
  sportId?: string | null;
}) {
  const primary = team?.colors.primary || "#22c55e";
  const secondary = team?.colors.secondary || "#0a0a0a";
  const abbr =
    sportId === "nfl" && team
      ? nflTeamAbbr(team)
      : team
        ? team.name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase()
        : name.slice(0, 3).toUpperCase();
  const size = large ? "w-28 h-28 text-2xl" : "w-14 h-14 text-sm";
  const glow =
    sportId === "nfl"
      ? "shadow-[0_0_32px_rgba(193,18,31,0.3)]"
      : "shadow-[0_0_32px_rgba(34,197,94,0.25)]";
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-black tracking-tight shrink-0 ${glow} border-2`}
      style={{
        background: `linear-gradient(145deg, ${primary} 0%, ${secondary || primary} 100%)`,
        borderColor: primary,
        color: "#fff",
        textShadow: "0 1px 2px rgba(0,0,0,0.55)",
      }}
      aria-hidden
    >
      {abbr}
    </div>
  );
}

function resolveTeamCatalog(
  name: string | null | undefined,
  sportId: string | null | undefined
): CanonicalTeam | null {
  if (!name) return null;
  if (sportId === "nfl") return getNflTeamByName(name);
  return matchCfbTeamConfident(name);
}

export default function CrystalBallPage() {
  const sportId = getLeague()?.sportId || "cfb";
  const nfl = sportId === "nfl";
  const teams = useMemo(() => crystalBallTeams(sportId), [sportId]);

  const [state, setState] = useState<CrystalBallState>(() => {
    try {
      return peekLocalCrystalBall();
    } catch {
      return emptyShell(sportId);
    }
  });
  const [syncing, setSyncing] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return peekLocalCrystalBall().myTeam;
    } catch {
      return null;
    }
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isCommish, setIsCommish] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [crownTeam, setCrownTeam] = useState("");
  const [crowning, setCrowning] = useState(false);
  /** Change mode after a sealed pick (both sports) — zero mutation until save */
  const [changing, setChanging] = useState(false);
  /** Client clock for countdown — start null to avoid hydration mismatch */
  const [now, setNow] = useState<number | null>(null);

  const reload = useCallback(async (opts?: { bustCache?: boolean }) => {
    setSyncing(true);
    try {
      if (opts?.bustCache) {
        try {
          const { invalidateCloudWeekCaches } = await import("@/lib/cloud");
          const league = getLeague();
          invalidateCloudWeekCaches(league?.id || null);
        } catch {
          /* ignore */
        }
      }
      const s = await loadCrystalBall();
      setState(s);
      if (!changing) setSelected(s.myTeam);
      // Auto-exit change mode if lock hit while editing
      if (s.locked) setChanging(false);
    } finally {
      setSyncing(false);
    }
  }, [changing]);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setSelfId(session?.playerId || null);
    if (league?.settings?.crystalBallEnabled === false) {
      setDisabled(true);
      setSyncing(false);
      return;
    }
    void reload();
  }, [reload]);

  // Live countdown + auto-lock transition
  useEffect(() => {
    if (typeof window === "undefined") return;
    setNow(Date.now());
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (cancelled) return;
      const t = Date.now();
      setNow(t);
      const lockAt = state.lockAtMs;
      // Cross deadline while page open → re-resolve authoritative lock
      if (lockAt && t >= lockAt && !state.locked) {
        void reload({ bustCache: true });
      }
      timeoutId = setTimeout(schedule, tickMsFor(lockAt, t));
    }
    schedule();
    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [state.lockAtMs, state.locked, reload]);

  // Focus / visibility → refresh deadline (slate may have changed)
  useEffect(() => {
    function onFocus() {
      void reload({ bustCache: true });
    }
    function onVis() {
      if (document.visibilityState === "visible") {
        void reload({ bustCache: true });
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.conference.toLowerCase().includes(q)
    );
  }, [teams, query]);

  const countdown: LeagueLockCountdown | null = useMemo(() => {
    if (now == null) return null;
    return formatCountdownToDeadline(state.lockAtMs, now);
  }, [state.lockAtMs, now]);

  // Authoritative lock: server flag OR deadline crossed (fail closed past known deadline)
  const liveLocked =
    state.locked ||
    (countdown != null && !countdown.unknown && countdown.locked) ||
    (now != null &&
      state.lockAtMs != null &&
      state.lockAtMs > 0 &&
      now >= state.lockAtMs);

  async function lockPick() {
    if (!selected || saving) return;
    if (liveLocked) {
      setErr(
        nfl
          ? "Locked at kickoff. No take-backs."
          : `${state.lockLabel || "Crystal Ball is locked"}. No take-backs.`
      );
      setChanging(false);
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await saveCrystalBallPick(selected);
    setSaving(false);
    if (!res.ok) {
      setErr(res.error || "Could not save");
      return;
    }
    try {
      sessionStorage.setItem("warroom-tut-cb-selected", "1");
      const { advancePlayerTutorialTo, isPlayerTutorialActive } = await import(
        "@/lib/player-tutorial"
      );
      if (isPlayerTutorialActive()) {
        advancePlayerTutorialTo("open_picks");
      }
    } catch {
      /* ignore */
    }
    setChanging(false);
    setMsg(
      res.cloud
        ? `Your pick is in: ${selected}.`
        : `Saved on this device: ${selected}.${
            res.cloudError
              ? ` Cloud: ${res.cloudError.slice(0, 80)}`
              : " Cloud not confirmed."
          }`
    );
    await reload();
  }

  function startChange() {
    if (liveLocked) return;
    setChanging(true);
    setSelected(state.myTeam);
    setQuery("");
    setErr(null);
    setMsg(null);
  }

  function cancelChange() {
    setChanging(false);
    setSelected(state.myTeam);
    setQuery("");
    setErr(null);
  }

  async function crown() {
    if (!crownTeam || crowning) return;
    if (
      !confirm(
        nfl
          ? `Crown ${crownTeam} as Super Bowl champion and hand out Witch/Wizard badges?`
          : `Crown ${crownTeam} as national champion and hand out Witch/Wizard badges?`
      )
    ) {
      return;
    }
    setCrowning(true);
    setErr(null);
    const res = await crownNationalChampion(crownTeam);
    setCrowning(false);
    if (!res.ok) {
      setErr(res.error || "Crown failed");
      return;
    }
    setMsg(
      `Crowned ${crownTeam}. ${res.winners ?? 0} player(s) earned Village Witch / Wizard Nerd.`
    );
    await reload();
  }

  if (disabled) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold mb-2">Crystal Ball is off</h1>
          <p className="text-sm text-muted mb-6">
            Your commissioner disabled this feature for the league.
          </p>
          {isCommish ? (
            <Link
              href="/commissioner"
              className="text-sm text-primary hover:underline"
            >
              Turn it on in Commissioner → Settings
            </Link>
          ) : (
            <Link href="/picks" className="text-sm text-primary hover:underline">
              Back to My Picks
            </Link>
          )}
        </main>
      </div>
    );
  }

  const myAchievements = state.achievements.filter((a) => a.userId === selfId);
  const sealedTeam = state.myTeam;
  const sealedCatalog = resolveTeamCatalog(sealedTeam, sportId);
  /** A: no pick, window open → full picker */
  const showOpenPicker = !sealedTeam && !changing && !liveLocked;
  /** B: pick saved, not locked, not changing → minimal sealed */
  const showSealedOpen = !!sealedTeam && !changing && !liveLocked;
  /** C: locked with or without pick */
  const showLocked = liveLocked;
  /** Change mode (pre-lock only) */
  const showChangeMode = !!sealedTeam && changing && !liveLocked;

  function lockCountdownCopy(): string {
    if (liveLocked) {
      if (nfl) return "Locked at kickoff.";
      if (state.lockAtMs && state.lockAtMs > 0) {
        try {
          return `Locked ${new Date(state.lockAtMs).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}.`;
        } catch {
          return state.lockLabel || "Crystal Ball is locked.";
        }
      }
      return state.lockLabel || "Crystal Ball is locked.";
    }
    if (nfl) {
      if (!state.kickoffKnown || !state.lockAtMs) {
        return "Locks at Week 1's first kickoff. Countdown appears when the Week 1 card is published.";
      }
      if (countdown && !countdown.unknown && countdown.headline) {
        return `Locks in ${countdown.headline}`;
      }
      return "Locks at Week 1's first kickoff.";
    }
    // CFB
    if (countdown && !countdown.unknown && countdown.headline) {
      return `Locks in ${countdown.headline}`;
    }
    return state.lockLabel
      ? `Locks: ${state.lockLabel}`
      : "Locks at the Crystal Ball deadline.";
  }

  const prideLabel = nfl ? "Super Bowl pick" : "Crystal Ball pick";

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">
              {nfl ? "Super Bowl Crystal Ball" : "Crystal Ball"}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full border border-primary/40 text-primary">
              0 pts
            </span>
            {liveLocked ? (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted">
                LOCKED
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                Open
              </span>
            )}
            {syncing && (
              <span className="text-[10px] text-muted font-medium animate-pulse">
                Gazing into the orb…
              </span>
            )}
          </div>
          {showOpenPicker && (
            <p className="text-sm text-muted leading-relaxed">
              Pick who wins the{" "}
              <strong className="text-foreground">
                {nfl ? "Super Bowl" : "national championship"}
              </strong>
              . Separate from your favorite team.{" "}
              <strong className="text-foreground">Secret until freeze</strong>.
              Zero standings points.
            </p>
          )}
        </div>

        {showOpenPicker && (
          <div className="mb-6 rounded-xl border-2 border-primary bg-primary/15 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary mb-1.5">
              Secret until freeze
            </p>
            <p className="text-sm font-bold text-foreground leading-snug">
              {nfl ? (
                <>
                  Locks at{" "}
                  <span className="text-primary">Week 1&apos;s first kickoff</span>
                  — not your NFL team allegiance.
                </>
              ) : (
                <>
                  Locks at the{" "}
                  <span className="text-primary">Crystal Ball deadline</span>{" "}
                  (or Week 0 kickoff/score, whichever is earlier). Not your CFB
                  team allegiance.
                </>
              )}
            </p>
            <p
              className="text-xs text-muted mt-2 font-medium"
              suppressHydrationWarning
            >
              {lockCountdownCopy()}
            </p>
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
            {msg}
          </div>
        )}

        {myAchievements.length > 0 && (
          <div className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-primary font-bold mb-2">
              Your artifact
            </p>
            {myAchievements.map((a) => (
              <div key={a.code}>
                <p className="font-semibold text-foreground">🧙 {a.title}</p>
                <p className="text-sm text-muted mt-1">{a.flavor}</p>
              </div>
            ))}
          </div>
        )}

        {state.champion && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              Crowned champion
            </p>
            <p className="text-lg font-bold text-primary">{state.champion}</p>
          </div>
        )}

        {/* ── C: LOCKED permanent result ── */}
        {showLocked && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-3">
              CRYSTAL BALL LOCKED
            </p>
            {sealedTeam ? (
              <>
                <div className="flex justify-center mb-4">
                  <TeamCrest
                    team={sealedCatalog}
                    name={sealedTeam}
                    large
                    sportId={sportId}
                  />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
                  {sealedTeam}
                </h2>
                <p className="mt-2 text-base font-semibold text-foreground">
                  Your pick is locked.
                </p>
                <p className="mt-3 text-sm text-muted" suppressHydrationWarning>
                  {lockCountdownCopy()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Crystal Ball is locked. You never sealed a pick.
              </p>
            )}
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-primary text-black text-sm font-bold touch-manipulation"
            >
              Back to Home
            </Link>
          </section>
        )}

        {/* ── B: saved, unlocked, minimal sealed ── */}
        {showSealedOpen && sealedTeam && (
          <section className="rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 mb-6 text-center">
            <div className="flex justify-center mb-4">
              <TeamCrest
                team={sealedCatalog}
                name={sealedTeam}
                large
                sportId={sportId}
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
              {sealedTeam}
            </h2>
            <p className="mt-2 text-sm font-semibold text-primary">
              Your pick is in.
            </p>
            <p
              className="mt-4 text-sm font-medium tabular-nums text-foreground"
              suppressHydrationWarning
            >
              {lockCountdownCopy()}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={startChange}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-border text-sm font-semibold touch-manipulation"
              >
                Change My Pick
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-xl bg-primary text-black text-sm font-bold touch-manipulation"
              >
                Back to Home
              </Link>
            </div>
          </section>
        )}

        {/* ── Change mode (pre-lock only) ── */}
        {showChangeMode && sealedTeam && (
          <section className="rounded-xl border border-border bg-card p-5 mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary mb-2">
              Change {prideLabel}
            </p>
            <div className="flex items-center gap-3 mb-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5">
              <TeamCrest
                team={sealedCatalog}
                name={sealedTeam}
                sportId={sportId}
              />
              <div className="min-w-0 text-left">
                <p className="text-xs text-muted">Current prediction</p>
                <p className="font-bold text-foreground truncate">{sealedTeam}</p>
              </div>
            </div>
            <p className="text-xs text-muted mb-3">
              Pick a replacement. Nothing changes until you save. Keep Current
              Pick exits with zero mutation.
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team or conference…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3 min-h-[44px]"
            />
            <div className="max-h-56 overflow-y-auto space-y-1 mb-4 border border-border rounded-lg p-2">
              {(nfl ? filtered : filtered.slice(0, 80)).map((t) => {
                const cat = resolveTeamCatalog(t.name, sportId);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelected(t.name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 min-h-[44px] ${
                      selected === t.name
                        ? "bg-primary/15 border border-primary/40 text-primary"
                        : "hover:bg-card-hover border border-transparent"
                    }`}
                  >
                    <span
                      className="w-2 h-7 rounded-full shrink-0"
                      style={{
                        backgroundColor: cat?.colors.primary || "#22c55e",
                      }}
                      aria-hidden
                    />
                    <span className="font-medium flex-1">{t.name}</span>
                    <span className="text-xs text-muted shrink-0">
                      {t.conference}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted p-2">No teams match.</p>
              )}
            </div>
            <button
              type="button"
              disabled={
                !selected || saving || selected === sealedTeam || liveLocked
              }
              onClick={() => void lockPick()}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50 min-h-[48px]"
            >
              {saving
                ? "Saving…"
                : selected && selected !== sealedTeam
                  ? `Confirm: ${selected}`
                  : "Select a different team"}
            </button>
            <button
              type="button"
              onClick={cancelChange}
              disabled={saving}
              className="w-full mt-2 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground min-h-[48px]"
            >
              Keep Current Pick
            </button>
          </section>
        )}

        {/* ── A: open first pick ── */}
        {showOpenPicker && (
          <section className="rounded-xl border border-border bg-card p-5 mb-6">
            <h2 className="font-semibold mb-1">
              {nfl ? "Your Super Bowl pick" : "Your national champ"}
            </h2>
            <p className="text-xs text-muted mb-3">
              {nfl
                ? "Who wins the Super Bowl? Separate from your favorite NFL team."
                : "Who wins the national championship? Separate from your CFB team allegiance."}
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team or conference…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3 min-h-[44px]"
            />
            <div className="max-h-56 overflow-y-auto space-y-1 mb-4 border border-border rounded-lg p-2">
              {(nfl ? filtered : filtered.slice(0, 80)).map((t) => {
                const cat = resolveTeamCatalog(t.name, sportId);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setSelected(t.name);
                      try {
                        sessionStorage.setItem("warroom-tut-cb-selected", "1");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 min-h-[44px] ${
                      selected === t.name
                        ? "bg-primary/15 border border-primary/40 text-primary"
                        : "hover:bg-card-hover border border-transparent"
                    }`}
                  >
                    <span
                      className="w-2 h-7 rounded-full shrink-0"
                      style={{
                        backgroundColor: cat?.colors.primary || "#22c55e",
                      }}
                      aria-hidden
                    />
                    <span className="font-medium flex-1">{t.name}</span>
                    <span className="text-xs text-muted shrink-0">
                      {t.conference}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted p-2">No teams match.</p>
              )}
            </div>
            <button
              type="button"
              disabled={!selected || saving || liveLocked}
              onClick={() => void lockPick()}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50 min-h-[48px]"
            >
              {saving
                ? "Sealing…"
                : `Save pick${selected ? `: ${selected}` : ""}`}
            </button>
            <p
              className="text-xs text-muted mt-3 text-center"
              suppressHydrationWarning
            >
              {lockCountdownCopy()}
            </p>
          </section>
        )}

        {/* League board — secret until freeze, then permanent record */}
        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-1">
            {liveLocked ? "League record" : "League board (sealed)"}
          </h2>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            {liveLocked
              ? "Crystal Ball is frozen. This is who picked what — permanent room history."
              : `${state.lockedCount} sealed · names and teams stay hidden until kickoff freezes the orb. You’ll only see your own pick below until then.`}
          </p>
          {!liveLocked ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                <span className="text-2xl font-black text-primary tabular-nums">
                  {state.lockedCount}
                </span>{" "}
                {state.lockedCount === 1 ? "player has" : "players have"} a
                secret pick in.
              </p>
              {state.myTeam ? (
                <p className="text-sm rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-0.5">
                    Your secret
                  </span>
                  <span className="font-semibold">{state.myTeam}</span>
                  <span className="text-muted text-xs block mt-1">
                    Only you can see this until freeze.
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted">
                  You haven&apos;t sealed a pick yet. The room can&apos;t see
                  anyone&apos;s team until the deadline.
                </p>
              )}
            </div>
          ) : state.picks.length === 0 ? (
            <p className="text-sm text-muted">
              Board is frozen but empty — nobody locked a prophecy.
            </p>
          ) : (
            <ul className="space-y-2">
              {state.picks.map((p) => {
                const hit =
                  state.champion &&
                  p.teamName.toLowerCase() === state.champion.toLowerCase();
                const ach = state.achievements.find(
                  (a) =>
                    a.userId === p.userId && a.code === "crystal_ball_correct"
                );
                return (
                  <li
                    key={p.userId}
                    className={`flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border last:border-0 pb-2 ${
                      hit ? "text-primary" : ""
                    }`}
                  >
                    <span className="font-medium">
                      <PlayerLink id={p.userId} name={p.displayName} />
                      {p.userId === selfId && (
                        <span className="text-xs text-muted ml-1">(you)</span>
                      )}
                    </span>
                    <span className="text-muted">
                      {p.teamName}
                      {hit && " · 🧙"}
                      {ach && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary border border-primary/30 px-1.5 py-0.5 rounded">
                          {ach.title}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {!state.cloud && (
            <p className="text-[11px] text-warning mt-3 leading-relaxed">
              Cloud board offline
              {state.cloudError ? ` — ${state.cloudError.slice(0, 100)}` : ""}.
              Your pick is on this device. Run{" "}
              <code className="text-foreground">crystal-ball.sql</code> in
              Supabase so the shared secret/record works for everyone.
            </p>
          )}
        </section>

        {isCommish && !nfl && (
          <section className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-xs text-muted leading-relaxed">
              When the National Championship is final and the last league week is
              scored, open Home and press{" "}
              <strong className="text-foreground">BEGIN TROPHY CEREMONY</strong>.
              Crystal Ball winners are crowned automatically — zero standings
              points, permanent pride.
            </p>
          </section>
        )}
        {isCommish && nfl && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="font-semibold text-primary mb-1">
              Commissioner · Crown Super Bowl champion
            </h2>
            <p className="text-xs text-muted mb-3">
              After the Super Bowl, set the real champion. Correct Crystal Ball
              picks get{" "}
              <strong className="text-foreground">
                Village Witch / Wizard Nerd
              </strong>{" "}
              — still zero points.
            </p>
            <select
              value={crownTeam}
              onChange={(e) => setCrownTeam(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Select Super Bowl champ…</option>
              {teams.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.conference})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!crownTeam || crowning}
              onClick={() => void crown()}
              className="w-full py-2.5 rounded-xl border border-primary text-primary font-semibold text-sm hover:bg-primary/10 disabled:opacity-50"
            >
              {crowning ? "Crowning…" : "Crown & grant achievements"}
            </button>
          </section>
        )}
        {isCommish && !nfl && <FoundryEmergencyCrownCfb />}
      </main>
    </div>
  );
}

function FoundryEmergencyCrownCfb() {
  const [show, setShow] = useState(false);
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const teams = useMemo(() => crystalBallTeams("cfb"), []);

  useEffect(() => {
    void import("@/lib/foundry-preview").then((m) => {
      setShow(m.isFoundryBackstageUser() && m.isFoundrySessionSticky());
    });
  }, []);

  if (!show) return null;

  async function emergencyCrown() {
    if (!team || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await crownNationalChampion(team);
    setBusy(false);
    setMsg(
      res.ok
        ? `Foundry emergency crown: ${team} · ${res.winners ?? 0} winner(s)`
        : res.error || "Crown failed"
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1">
        Foundry only · emergency crown
      </p>
      <p className="text-[11px] text-muted mb-2">
        Prefer Trophy Ceremony. This is recovery if automation is blocked.
      </p>
      <select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-2"
      >
        <option value="">Select champion…</option>
        {teams.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!team || busy}
        onClick={() => void emergencyCrown()}
        className="w-full py-2 rounded-lg border border-warning/50 text-warning text-xs font-bold disabled:opacity-50"
      >
        {busy ? "Crowning…" : "Emergency crown (Foundry)"}
      </button>
      {msg && <p className="text-[11px] text-muted mt-2">{msg}</p>}
    </section>
  );
}
