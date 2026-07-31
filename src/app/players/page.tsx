"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import PlayerLink from "@/components/PlayerLink";
import { getSession, getLeague, isOps, isCommissioner } from "@/lib/league";
import {
  loadLeagueRoster,
  updateMemberDivision,
  removeLeagueMember,
  autoBalanceDivisions,
  refreshStaffSessionFlags,
  LeagueRosterMember,
} from "@/lib/cloud";
import { Division } from "@/lib/types";
import {
  MAX_LEAGUE_PLAYERS,
  capacityLabel,
  isLeagueFull,
  seatsRemaining,
} from "@/lib/league-limits";
import { DIVISIONS } from "@/lib/divisions";
import { formatLastSeen, isRecentlyActive } from "@/lib/last-seen";

export default function PlayersPage() {
  const [players, setPlayers] = useState<LeagueRosterMember[]>([]);
  const [isCommish, setIsCommish] = useState(false);
  /** Commissioner or deputy — can move people between divisions */
  const [canManageDivs, setCanManageDivs] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [leagueCode, setLeagueCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function reload() {
    setError(null);
    await refreshStaffSessionFlags();
    const session = getSession();
    const league = getLeague();
    setIsCommish(isCommissioner());
    setCanManageDivs(isOps());
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
    if (!canManageDivs || busy) return;
    setBusy(true);
    setError(null);
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

  async function removeMember(
    member: LeagueRosterMember,
    opts?: { fromBotList?: boolean }
  ) {
    if (!isCommish || busy) return;
    const isBot = !!member.isBot;
    const msg = isBot
      ? `Remove bot "${member.name}"?\n\nFrees 1 seat so a friend can join (league cap ${MAX_LEAGUE_PLAYERS}).`
      : `Remove "${member.name}" from the league?\n\nThey can rejoin later with the code if a seat is open.`;
    if (!confirm(msg)) return;

    setBusy(true);
    setRemovingId(member.userId);
    setError(null);
    // Optimistic
    setPlayers((prev) => prev.filter((p) => p.userId !== member.userId));
    const result = await removeLeagueMember(member.userId);
    if (!result.ok) {
      setError(result.error || "Failed to remove");
      await reload();
    } else {
      flashSaved();
      if (opts?.fromBotList || isBot) {
        // keep list in sync after seat free
        await reload();
      }
    }
    setRemovingId(null);
    setBusy(false);
  }

  async function handleAutoBalance() {
    if (!canManageDivs || busy) return;
    if (
      !confirm(
        "Reassign all players evenly across North / South / East / West?\n\n" +
          "This is saved to the league — it sticks when you switch leagues and come back."
      )
    ) {
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
      /* ignore */
    }
  }

  const bots = players.filter((p) => p.isBot);
  const humans = players.filter((p) => !p.isBot);
  const openSeats = seatsRemaining(players.length);

  const byDivision = DIVISIONS.map((d) => ({
    division: d,
    list: players
      .filter((p) => p.division === d)
      .sort((a, b) => {
        // Humans first, then bots; alpha within
        if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
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
                : `${capacityLabel(players.length)} · ${humans.length} real · ${bots.length} bot${bots.length === 1 ? "" : "s"} · ${openSeats} open`}
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
            Friends join with this code. Cap is {MAX_LEAGUE_PLAYERS}. If the
            league is full of bots, remove specific bots below to free seats.
          </p>
          {!loading && isLeagueFull(players.length) && (
            <p className="text-xs text-warning mb-3 border border-warning/30 rounded-lg px-3 py-2 bg-warning/10">
              League full ({MAX_LEAGUE_PLAYERS}/{MAX_LEAGUE_PLAYERS}).
              {bots.length > 0
                ? " Remove a bot below to free a seat for a friend."
                : " Remove a player or start a second league."}
            </p>
          )}
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

        {/* Commissioner: kick bots one-by-one to free seats */}
        {isCommish && !loading && bots.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <h2 className="font-semibold text-primary">
                  Bots — free a seat for a friend
                </h2>
                <p className="text-xs text-muted mt-1 max-w-xl">
                  Tap <strong className="text-foreground">Remove bot</strong> on
                  anyone you don&apos;t need. That opens 1 of {MAX_LEAGUE_PLAYERS}{" "}
                  seats. Friend joins with the code. Real players are listed in
                  divisions below — only bots appear here.
                </p>
              </div>
              <span className="text-xs text-muted shrink-0">
                {bots.length} bot{bots.length === 1 ? "" : "s"} · {openSeats} open
              </span>
            </div>
            <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card overflow-hidden">
              {bots
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((b) => (
                  <li
                    key={b.userId}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Avatar name={b.name} avatarUrl={b.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <PlayerLink id={b.userId} name={b.name} />
                        <span className="ml-2 text-[10px] uppercase text-muted border border-border px-1 rounded">
                          Bot
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {b.division} · {b.totalPoints} pts
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeMember(b, { fromBotList: true })}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-danger/50 text-danger hover:bg-danger/10 disabled:opacity-50 font-medium"
                    >
                      {removingId === b.userId ? "…" : "Remove bot"}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {canManageDivs && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-xs text-muted max-w-md">
              New joiners land in the least-full division automatically. You
              (commish/deputy) can move anyone or rebalance the whole room.
            </p>
            <button
              type="button"
              onClick={() => void handleAutoBalance()}
              disabled={busy || players.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
            >
              Auto-balance divisions
            </button>
          </div>
        )}

        {!canManageDivs && !loading && (
          <p className="text-xs text-muted mb-4">
            Divisions are assigned when you join. Only the commissioner or a
            deputy can move people — you can&apos;t change your own.
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
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card-hover group ${
                        p.isBot ? "opacity-90" : ""
                      }`}
                    >
                      <Avatar
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        size="sm"
                        userId={p.userId}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          <PlayerLink id={p.userId} name={p.name} />
                          {p.isBot ? (
                            <span className="ml-1.5 text-[10px] uppercase text-muted border border-border px-1 rounded">
                              Bot
                            </span>
                          ) : null}
                          {p.userId === selfId && (
                            <span className="text-primary text-xs ml-1">
                              (You)
                            </span>
                          )}
                          {p.role === "commissioner" && !p.isBot && (
                            <span className="text-primary text-xs ml-1">
                              Commish
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted flex flex-wrap items-center gap-x-1.5">
                          <span>{p.totalPoints} pts</span>
                          {!p.isBot && (
                            <>
                              <span className="text-border">·</span>
                              <span
                                className={
                                  isRecentlyActive(p.lastSeenAt)
                                    ? "text-primary"
                                    : ""
                                }
                                title={
                                  p.lastSeenAt
                                    ? `Last in: ${new Date(p.lastSeenAt).toLocaleString()}`
                                    : "No last-seen yet (open app after SQL)"
                                }
                              >
                                {formatLastSeen(p.lastSeenAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {canManageDivs ? (
                        <select
                          value={p.division}
                          disabled={busy}
                          onChange={(e) =>
                            void changeDivision(
                              p.userId,
                              e.target.value as Division
                            )
                          }
                          className="text-xs bg-background border border-border rounded px-1 py-0.5 max-w-[4.5rem]"
                          title="Change division (ops only)"
                        >
                          {DIVISIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] text-muted shrink-0">
                          {p.division}
                        </span>
                      )}
                      {isCommish &&
                        p.role !== "commissioner" &&
                        p.userId !== selfId && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeMember(p)}
                            className={`text-xs shrink-0 disabled:opacity-30 ${
                              p.isBot
                                ? "px-2 py-0.5 rounded border border-danger/40 text-danger font-medium"
                                : "text-danger opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            }`}
                            title={p.isBot ? "Remove bot" : "Remove player"}
                          >
                            {p.isBot
                              ? removingId === p.userId
                                ? "…"
                                : "Remove"
                              : "✕"}
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
