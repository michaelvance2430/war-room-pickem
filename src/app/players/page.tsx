"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import { getSession, getLeague } from "@/lib/league";
import {
  loadLeagueRoster,
  updateMemberDivision,
  removeLeagueMember,
  autoBalanceDivisions,
  LeagueRosterMember,
} from "@/lib/cloud";
import { Division } from "@/lib/types";

const DIVISIONS: Division[] = ["North", "South", "East", "West"];

export default function PlayersPage() {
  const [players, setPlayers] = useState<LeagueRosterMember[]>([]);
  const [isCommish, setIsCommish] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [leagueCode, setLeagueCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reload() {
    setError(null);
    const session = getSession();
    const league = getLeague();
    setIsCommish(!!session?.isCommissioner);
    setSelfId(session?.playerId || null);
    setLeagueCode(league?.code || "");
    setLeagueName(league?.name || "");

    if (!session?.leagueId) {
      setPlayers([]);
      setError("No league selected. Go home and join or create a league.");
      setLoading(false);
      return;
    }

    const roster = await loadLeagueRoster();
    setPlayers(roster);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function changeDivision(userId: string, division: Division) {
    if (!isCommish || busy) return;
    setBusy(true);
    setError(null);
    // Optimistic UI
    setPlayers((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, division } : p))
    );
    const result = await updateMemberDivision(userId, division);
    if (!result.ok) {
      setError(result.error || "Failed to update division");
      await reload();
    } else {
      flashSaved();
    }
    setBusy(false);
  }

  async function removePlayer(userId: string) {
    if (!isCommish || busy) return;
    if (!confirm("Remove this player from the league?")) return;
    setBusy(true);
    setError(null);
    const result = await removeLeagueMember(userId);
    if (!result.ok) {
      setError(result.error || "Failed to remove player");
    } else {
      flashSaved();
      await reload();
    }
    setBusy(false);
  }

  async function handleAutoBalance() {
    if (!isCommish || busy) return;
    if (!confirm("Reassign all players evenly across North / South / East / West?")) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await autoBalanceDivisions();
    if (!result.ok) {
      setError(result.error || "Auto-balance failed");
    } else {
      flashSaved();
      await reload();
    }
    setBusy(false);
  }

  async function copyCode() {
    if (!leagueCode) return;
    try {
      await navigator.clipboard.writeText(leagueCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const byDivision = DIVISIONS.map((d) => ({
    division: d,
    list: players.filter((p) => p.division === d),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Players & Divisions</h1>
            <p className="text-sm text-muted">
              {loading
                ? "Loading…"
                : (() => {
                    const bots = players.filter((p) => p.isBot).length;
                    const humans = players.length - bots;
                    return `${players.length} total · ${humans} real · ${bots} trial bot${bots === 1 ? "" : "s"}`;
                  })()}
              {leagueName ? ` • ${leagueName}` : ""}
            </p>
          </div>
          {saved && <span className="text-sm text-primary">Saved</span>}
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-6">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-1">Invite players</h2>
          <p className="text-sm text-muted mb-3">
            Friends create an account, then join with this league code. Trial
            bots (if seeded) show a <strong className="text-foreground">Trial</strong>{" "}
            tag and are split across divisions — scroll each column.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 font-mono text-lg tracking-widest text-center sm:text-left">
              {leagueCode || "———"}
            </div>
            <button
              type="button"
              onClick={copyCode}
              disabled={!leagueCode}
              className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dim disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
        </div>

        {isCommish && (
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleAutoBalance}
              disabled={busy || players.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
            >
              Auto-balance divisions
            </button>
          </div>
        )}

        {!isCommish && !loading && (
          <p className="text-xs text-muted mb-4">
            Only the commissioner can change divisions or remove players.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted py-8 text-center">Loading roster…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {byDivision.map(({ division, list }) => (
              <div
                key={division}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="font-semibold">{division}</span>
                  <span className="text-xs text-muted">{list.length}</span>
                </div>
                <div className="p-2 space-y-1 min-h-[120px]">
                  {list.length === 0 && (
                    <p className="text-xs text-muted px-2 py-3">Empty</p>
                  )}
                  {list.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card-hover group"
                    >
                      <Avatar
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {p.name}
                          {p.isBot ? (
                            <span className="ml-2 text-[10px] uppercase text-muted border border-border px-1 rounded">
                              Trial
                            </span>
                          ) : null}
                          {p.userId === selfId && (
                            <span className="text-primary text-xs ml-1">(You)</span>
                          )}
                          {p.role === "commissioner" && (
                            <span className="text-primary text-xs ml-1">Commish</span>
                          )}
                        </div>
                        <div className="text-xs text-muted">{p.totalPoints} pts</div>
                      </div>
                      {isCommish ? (
                        <select
                          value={p.division}
                          disabled={busy}
                          onChange={(e) =>
                            changeDivision(p.userId, e.target.value as Division)
                          }
                          className="text-xs bg-background border border-border rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          {DIVISIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {isCommish &&
                        p.role !== "commissioner" &&
                        p.userId !== selfId && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removePlayer(p.userId)}
                            className="text-xs text-danger opacity-0 group-hover:opacity-100 disabled:opacity-30"
                          >
                            ✕
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
