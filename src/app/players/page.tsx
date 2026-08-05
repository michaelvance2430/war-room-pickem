"use client";

import { useState, useEffect } from "react";
import Avatar from "@/components/Avatar";
import PlayerLink from "@/components/PlayerLink";
import { getSession, getLeague, isOps, isCommissioner } from "@/lib/league";
import {
  loadLeagueRoster,
  loadLeagueRosterFreshForced,
  updateMemberDivision,
  removeLeagueMember,
  autoBalanceDivisions,
  previewAutoBalanceDivisions,
  isDivisionAutoBalanceLocked,
  refreshStaffSessionFlags,
  EVENT_ROSTER_DIVISIONS_UPDATED,
  LeagueRosterMember,
} from "@/lib/cloud";
import { Division } from "@/lib/types";
import {
  MAX_LEAGUE_PLAYERS,
  capacityLabel,
  isLeagueFull,
  seatsRemaining,
} from "@/lib/league-limits";
import {
  DIVISIONS,
  divisionDisplayLabel,
  divisionFullLabel,
} from "@/lib/divisions";
import { formatLastSeen, lastSeenToneClass } from "@/lib/last-seen";
import InviteFriends from "@/components/InviteFriends";
import { isPreseasonCommishToolsAllowed } from "@/lib/season-mode";
import { getBlueFalconCount, hydrateBlueFalconFromCloud } from "@/lib/blue-falcon";
import { hasOfficialScoredWeek } from "@/lib/season-scored";

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
  /** True while Auto Balance mutation + post-save refresh is in flight */
  const [balancing, setBalancing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** userId → Blue Falcon Count for kick risk */
  const [falconByUser, setFalconByUser] = useState<Record<string, number>>({});
  /** Hide season pts until first official score — never invent achievement */
  const [showSeasonPts, setShowSeasonPts] = useState(false);
  /** Auto Balance locked after first published kickoff */
  const [autoBalanceLock, setAutoBalanceLock] = useState<{
    locked: boolean;
    reason?: string;
  }>({ locked: false });
  const [balanceNote, setBalanceNote] = useState<string | null>(null);
  /** Writes may have landed; re-read failed — offer Retry Refresh */
  const [needsRetryRefresh, setNeedsRetryRefresh] = useState(false);
  const preseasonKickOk = isPreseasonCommishToolsAllowed();

  async function hydrateFalcons(roster: LeagueRosterMember[]) {
    const falcon: Record<string, number> = {};
    await Promise.all(
      roster
        .filter((m) => !m.isBot && m.userId)
        .map(async (m) => {
          try {
            falcon[m.userId] = await hydrateBlueFalconFromCloud(m.userId);
          } catch {
            falcon[m.userId] = getBlueFalconCount(m.userId);
          }
        })
    );
    setFalconByUser(falcon);
  }

  /**
   * Replace client roster immediately from an authoritative snapshot
   * (post Auto Balance). Division columns recompute from this state.
   */
  function applyAuthoritativeRoster(roster: LeagueRosterMember[]) {
    setPlayers(roster);
    setNeedsRetryRefresh(false);
  }

  async function reload(opts?: { forceFresh?: boolean }) {
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

    const [roster, scored, balLock] = await Promise.all([
      opts?.forceFresh ? loadLeagueRosterFreshForced() : loadLeagueRoster(),
      hasOfficialScoredWeek(),
      isDivisionAutoBalanceLocked(session.leagueId).catch(() => ({
        locked: false as boolean,
        reason: undefined as string | undefined,
      })),
    ]);
    applyAuthoritativeRoster(roster);
    setShowSeasonPts(scored);
    setAutoBalanceLock({
      locked: !!balLock.locked,
      reason: balLock.reason,
    });
    await hydrateFalcons(roster);
    setLoading(false);
  }

  async function retryRosterRefresh() {
    if (busy || balancing) return;
    setBusy(true);
    setError(null);
    setBalanceNote(null);
    try {
      const roster = await loadLeagueRosterFreshForced();
      if (!roster.length) {
        setError(
          "Roster refresh returned empty. Check your connection and try again."
        );
        setNeedsRetryRefresh(true);
      } else {
        applyAuthoritativeRoster(roster);
        setBalanceNote(
          `Roster refreshed from cloud (${roster.length} members).`
        );
        await hydrateFalcons(roster);
        flashSaved();
      }
    } catch {
      setError("Roster refresh failed. Tap Retry Refresh again.");
      setNeedsRetryRefresh(true);
    }
    setBusy(false);
  }

  useEffect(() => {
    let cancelled = false;
    const disarm = (() => {
      try {
        const { armLoadingFailSafe } =
          require("@/lib/boot-safety") as typeof import("@/lib/boot-safety");
        return armLoadingFailSafe(setLoading, 6_000);
      } catch {
        return () => {};
      }
    })();
    void reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      disarm();
    };
  }, []);

  // Same-device: other mounts that emit division updates (defensive)
  useEffect(() => {
    function onRosterDivisions(ev: Event) {
      const detail = (ev as CustomEvent).detail as
        | { leagueId?: string; roster?: LeagueRosterMember[] | null }
        | undefined;
      const lid = getSession()?.leagueId;
      if (!lid || !detail?.leagueId || detail.leagueId !== lid) return;
      if (detail.roster && Array.isArray(detail.roster) && detail.roster.length) {
        applyAuthoritativeRoster(detail.roster);
      }
    }
    window.addEventListener(EVENT_ROSTER_DIVISIONS_UPDATED, onRosterDivisions);
    return () => {
      window.removeEventListener(
        EVENT_ROSTER_DIVISIONS_UPDATED,
        onRosterDivisions
      );
    };
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
    const bf = falconByUser[member.userId] ?? getBlueFalconCount(member.userId);
    const msg = isBot
      ? `Remove bot "${member.name}"?\n\nFrees 1 seat so a friend can join (league cap ${MAX_LEAGUE_PLAYERS}).`
      : preseasonKickOk
        ? `Kick "${member.name}" before the season starts?\n\n` +
          `Blue Falcon Count: ${bf}\n` +
          (bf > 0
            ? "High risk — they quit other rooms mid-season. Preseason is the time to protect the unit.\n\n"
            : "Clean Blue Falcon record so far.\n\n") +
          "They can rejoin later with the code if a seat is open."
        : `Remove "${member.name}" from the league?\n\n` +
          `Blue Falcon Count: ${bf}\n` +
          "Season is live — only kick if you must. They can rejoin with the code if a seat is open.";
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
    // In-flight guard: busy OR balancing blocks double-tap
    if (!canManageDivs || busy || balancing) return;
    setBusy(true);
    setBalancing(true);
    setError(null);
    setBalanceNote(null);
    setNeedsRetryRefresh(false);

    const preview = await previewAutoBalanceDivisions();
    if (!preview.ok) {
      setError(preview.error || "Could not preview Auto Balance");
      if (preview.locked) {
        setAutoBalanceLock({ locked: true, reason: preview.error });
      }
      setBalancing(false);
      setBusy(false);
      return;
    }

    if (preview.alreadyBalanced || (preview.moveCount ?? 0) === 0) {
      setBalanceNote(
        `Already balanced and verified: ${preview.afterLabel || "—"}. No players moved.`
      );
      // Reconcile from cloud without pointless reshuffle
      try {
        const fresh = await loadLeagueRosterFreshForced();
        if (fresh.length) applyAuthoritativeRoster(fresh);
      } catch {
        /* keep current */
      }
      setBalancing(false);
      setBusy(false);
      return;
    }

    const confLines = [
      "Auto Balance (minimum moves)",
      "",
      `Roster: ${preview.total ?? "?"} memberships`,
      `Current: ${preview.beforeLabel}`,
      `Planned: ${preview.afterLabel}`,
      `Players who will move: ${preview.moveCount}`,
      "",
      "Moves only the fewest memberships needed to balance the four groups.",
      preview.sportId === "nfl"
        ? "NFL: AFC/NFC conference totals will also differ by at most 1."
        : "Each group will differ by at most 1 player.",
      "Result is verified from Supabase after save — success only if counts prove balanced.",
      "",
      "Continue?",
    ];
    if (!confirm(confLines.join("\n"))) {
      setBalancing(false);
      setBusy(false);
      return;
    }

    const result = await autoBalanceDivisions();

    if (result.ok) {
      // Prefer mutation-returned authoritative roster (same as post-save verify).
      // Never wait for logout / hard refresh / router alone.
      if (result.roster && result.roster.length > 0) {
        applyAuthoritativeRoster(result.roster);
        void hydrateFalcons(result.roster);
      } else {
        try {
          const fresh = await loadLeagueRosterFreshForced();
          if (fresh.length) {
            applyAuthoritativeRoster(fresh);
            void hydrateFalcons(fresh);
          } else {
            setNeedsRetryRefresh(true);
            setError(
              "Balance saved, but roster refresh returned empty. Tap Retry Refresh."
            );
            setBalancing(false);
            setBusy(false);
            return;
          }
        } catch {
          setNeedsRetryRefresh(true);
          setError(
            "Balance saved, but roster refresh failed. Tap Retry Refresh."
          );
          setBalancing(false);
          setBusy(false);
          return;
        }
      }

      if (result.alreadyBalanced) {
        setBalanceNote(
          `Already balanced and verified: ${result.verifiedLabel || "—"}.`
        );
      } else {
        setBalanceNote(
          `Balanced and verified: ${result.verifiedLabel || "—"}${
            result.moveCount != null ? ` (${result.moveCount} moved).` : "."
          }`
        );
        flashSaved();
      }
    } else if (result.savedButRefreshFailed) {
      setError(result.error || "Saved, but refresh failed.");
      setNeedsRetryRefresh(true);
      // Do not claim balanced; do not invent columns
    } else {
      setError(result.error || "Auto-balance failed");
      // Restore / show authoritative truth when available
      if (result.roster && result.roster.length > 0) {
        applyAuthoritativeRoster(result.roster);
        void hydrateFalcons(result.roster);
      } else {
        try {
          const fresh = await loadLeagueRosterFreshForced();
          if (fresh.length) applyAuthoritativeRoster(fresh);
        } catch {
          setNeedsRetryRefresh(true);
        }
      }
    }

    setBalancing(false);
    setBusy(false);
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

        {isCommish && preseasonKickOk && !loading && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">
              Preseason · high-risk kick window
            </p>
      <p className="text-xs text-muted leading-relaxed">
              Before kickoff you can remove anyone who looks like a{" "}
              <strong className="text-foreground">Blue Falcon</strong> (quit
              other leagues mid-season). Check their count on their profile or
              next to their name. Protect the room — once the season is live,
              kicks should be rare.
            </p>
      </div>
        )}

        {!loading && isLeagueFull(players.length) && (
          <p className="text-xs text-warning mb-3 border border-warning/30 rounded-lg px-3 py-2 bg-warning/10">
            League full ({MAX_LEAGUE_PLAYERS}/{MAX_LEAGUE_PLAYERS}).
            {bots.length > 0
              ? " Remove a bot below to free a seat for a friend."
              : " Remove a player or start a second league."}
          </p>
        )}
        {leagueCode && (
          <InviteFriends
            leagueName={leagueName || "War Room"}
            code={leagueCode}
            leagueId={getLeague()?.id}
            className="mb-6"
          />
        )}

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
                        {divisionDisplayLabel(
                          b.division,
                          getLeague()?.sportId
                        )}
                        {showSeasonPts ? ` · ${b.totalPoints} pts` : ""}
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
              {balancing
                ? "Balancing divisions… saving assignments and refreshing the roster."
                : autoBalanceLock.locked
                  ? autoBalanceLock.reason ||
                    "Divisions are locked because the season has started. Manual moves still work if you must."
                  : "New joiners land in the least-full division automatically. Auto Balance moves the fewest players needed to even the four groups (verified after save)."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {needsRetryRefresh && (
                <button
                  type="button"
                  onClick={() => void retryRosterRefresh()}
                  disabled={busy || balancing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/50 text-amber-200 hover:text-foreground disabled:opacity-50"
                >
                  Retry Refresh
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleAutoBalance()}
                disabled={
                  busy ||
                  balancing ||
                  players.length === 0 ||
                  autoBalanceLock.locked
                }
                aria-busy={balancing}
                title={
                  autoBalanceLock.locked
                    ? autoBalanceLock.reason || "Season started - locked"
                    : balancing
                      ? "Auto Balance in progress"
                      : "Minimum-move Auto Balance"
                }
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
              >
                {balancing ? "Balancing…" : "Auto-balance divisions"}
              </button>
            </div>
          </div>
        )}

        {balanceNote && (
          <p className="text-xs text-primary font-semibold mb-3">
            {balanceNote}
          </p>
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
                  <span className="font-semibold">
                    {divisionFullLabel(division, getLeague()?.sportId)}
                  </span>
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
                          {!p.isBot &&
                            (falconByUser[p.userId] ?? 0) > 0 && (
                              <span
                                className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 rounded"
                                title={`Blue Falcon Count: ${falconByUser[p.userId]} — quit leagues mid-season`}
                              >
                                BF {falconByUser[p.userId]}
                              </span>
                            )}
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
                          {showSeasonPts ? (
                            <span>{p.totalPoints} pts</span>
                          ) : (
                            <span>Joined · undefeated</span>
                          )}
                          {!p.isBot && (
                            <>
                              <span className="text-border">·</span>
      <span
                                className={lastSeenToneClass(p.lastSeenAt)}
                                title={
                                  p.lastSeenAt
                                    ? `Last in: ${new Date(p.lastSeenAt).toLocaleString()}`
                                    : "Not seen in the app yet"
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
                          className="text-xs bg-background border border-border rounded px-1 py-0.5 max-w-[6.5rem]"
                          title="Change division (ops only)"
                        >
                          {DIVISIONS.map((d) => (
                            <option key={d} value={d}>
                              {divisionDisplayLabel(
                                d,
                                getLeague()?.sportId
                              )}
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
                            title={
                              p.isBot
                                ? "Remove bot"
                                : preseasonKickOk
                                  ? "Kick before season (check Blue Falcon Count)"
                                  : "Remove player"
                            }
                          >
                            {p.isBot
                              ? removingId === p.userId
                                ? "…"
                                : "Remove"
                              : preseasonKickOk
                                ? "Kick"
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
