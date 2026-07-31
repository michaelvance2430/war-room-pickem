"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import PlayerLink from "@/components/PlayerLink";
import {
  crystalBallLockLabel,
  crystalBallTeams,
  crownNationalChampion,
  loadCrystalBall,
  saveCrystalBallPick,
  type CrystalBallState,
} from "@/lib/crystal-ball";
import { getLeague, getSession } from "@/lib/league";

export default function CrystalBallPage() {
  const [state, setState] = useState<CrystalBallState | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isCommish, setIsCommish] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [crownTeam, setCrownTeam] = useState("");
  const [crowning, setCrowning] = useState(false);

  const teams = useMemo(() => crystalBallTeams(), []);

  async function reload() {
    const s = await loadCrystalBall();
    setState(s);
    setSelected(s.myTeam);
    setLoading(false);
  }

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setSelfId(session?.playerId || null);
    if (league?.settings?.crystalBallEnabled === false) {
      setDisabled(true);
      setLoading(false);
      return;
    }
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.conference.toLowerCase().includes(q)
    );
  }, [teams, query]);

  async function lockPick() {
    if (!selected || saving) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await saveCrystalBallPick(selected);
    setSaving(false);
    if (!res.ok) {
      setErr(res.error || "Could not save");
      return;
    }
    setMsg(
      res.cloud
        ? `Locked in: ${selected}. Zero points. Maximum smugness potential.`
        : `Locked in locally: ${selected}. (Run crystal-ball.sql in Supabase so the whole league can see it.)`
    );
    await reload();
  }

  async function crown() {
    if (!crownTeam || crowning) return;
    if (
      !confirm(
        `Crown ${crownTeam} as national champion and hand out Witch/Wizard badges?`
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
        <Nav />
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

  if (loading || !state) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted">
          Gazing into the orb…
        </main>
      </div>
    );
  }

  const myAchievements = state.achievements.filter((a) => a.userId === selfId);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Crystal Ball</h1>
            <span className="text-xs px-2 py-0.5 rounded-full border border-primary/40 text-primary">
              0 pts
            </span>
            {state.locked ? (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted">
                LOCKED
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                Open
              </span>
            )}
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Before the first kickoff, pick who wins the{" "}
            <strong className="text-foreground">national championship</strong>.
            No standings points. If you&apos;re right, you get a sarcastic
            achievement and eternal bragging rights.
          </p>
        </div>

        {/* Must-read lock notice */}
        <div
          className={`mb-6 rounded-xl border-2 px-4 py-3 ${
            state.locked
              ? "border-border bg-card"
              : "border-primary bg-primary/15"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary mb-1.5">
            {state.locked ? "Locked — no changes" : "Do not skip"}
          </p>
          <p className="text-sm sm:text-base font-bold text-foreground leading-snug">
            {state.locked ? (
              <>
                Crystal Ball is sealed as of{" "}
                <span className="text-primary">{state.lockLabel}</span>. You
                cannot change your national champion pick. No exceptions.
              </>
            ) : (
              <>
                Your pick locks at{" "}
                <span className="text-primary">
                  12:00 noon ET, Saturday, August 29, 2026
                </span>{" "}
                (Week 0). After that you{" "}
                <span className="underline decoration-2">cannot change it</span>
                . No take-backs. Make your pick before then.
              </>
            )}
          </p>
          <p className="text-xs text-muted mt-2 font-medium">
            Deadline: {state.lockLabel}.{" "}
            <Link href="/rules" className="text-primary hover:underline">
              Full rules
            </Link>
          </p>
        </div>

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

        {/* Your pick */}
        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-1">Your national champ</h2>
          <p className="text-xs text-muted mb-3">
            {state.locked
              ? state.myTeam
                ? `You rode with ${state.myTeam}. The orb is sealed.`
                : "You never picked. The witches are disappointed."
              : "Search FBS teams. One pick. Change it until lock."}
          </p>

          {!state.locked && (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team or conference…"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="max-h-56 overflow-y-auto space-y-1 mb-4 border border-border rounded-lg p-2">
                {filtered.slice(0, 80).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelected(t.name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex justify-between gap-2 ${
                      selected === t.name
                        ? "bg-primary/15 border border-primary/40 text-primary"
                        : "hover:bg-card-hover border border-transparent"
                    }`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted shrink-0">
                      {t.conference}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted p-2">No teams match.</p>
                )}
              </div>
              <button
                type="button"
                disabled={!selected || saving}
                onClick={() => void lockPick()}
                className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
              >
                {saving
                  ? "Sealing…"
                  : state.myTeam
                    ? `Update pick${selected ? `: ${selected}` : ""}`
                    : `Lock pick${selected ? `: ${selected}` : ""}`}
              </button>
            </>
          )}

          {state.locked && state.myTeam && (
            <p className="text-sm font-semibold text-foreground">
              {state.myTeam}
            </p>
          )}
        </section>

        {/* League board */}
        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">
            League board ({state.picks.length})
          </h2>
          {state.picks.length === 0 ? (
            <p className="text-sm text-muted">
              Nobody has peered into the future yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {state.picks.map((p) => {
                const hit =
                  state.champion &&
                  p.teamName.toLowerCase() === state.champion.toLowerCase();
                const ach = state.achievements.find(
                  (a) => a.userId === p.userId && a.code === "crystal_ball_correct"
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
            <p className="text-[11px] text-muted mt-3">
              Using device storage until{" "}
              <code className="text-foreground">crystal-ball.sql</code> is run
              in Supabase (so everyone shares one board).
            </p>
          )}
        </section>

        {/* Commissioner crown */}
        {isCommish && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="font-semibold text-primary mb-1">
              Commissioner · Crown champion
            </h2>
            <p className="text-xs text-muted mb-3">
              After the title game, set the real national champion. Correct
              Crystal Ball picks get{" "}
              <strong className="text-foreground">Village Witch / Wizard Nerd</strong>{" "}
              — still zero points.
            </p>
            <select
              value={crownTeam}
              onChange={(e) => setCrownTeam(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Select champion…</option>
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
            <p className="text-[11px] text-muted mt-2">
              Lock time reference: {crystalBallLockLabel()}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
