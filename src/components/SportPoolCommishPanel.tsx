"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague } from "@/lib/league";
import { listSportPickerOptions, getSportPack } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  closeSportPoolPoll,
  countSourceLeagueHumans,
  crewContinuityThreshold,
  createSportPoolPoll,
  defaultSportPoolMessage,
  doesCrewContinue,
  loadOpenPollForLeague,
  loadPollVotes,
  spinUpLeagueFromPoll,
  sportPoolSqlHint,
  type SportPoolPoll,
  type SportPoolVote,
} from "@/lib/sport-pool";
import { switchToLeague } from "@/lib/session-restore";

/**
 * Commissioner asks the current league who wants to play another sport.
 * Only yeses get seats. The host remains commissioner of the new league
 * (spin_up_sport_pool_league seats host + yes-voters only — no handoff picker).
 */
export default function SportPoolCommishPanel() {
  const router = useRouter();
  const league = getLeague();
  const currentSport = league?.sportId || "cfb";
  const liveOthers = listSportPickerOptions().filter(
    (s) => s.status === "live" && s.id !== currentSport
  );

  const [targetSport, setTargetSport] = useState<SportId>(
    (liveOthers[0]?.id as SportId) || "nfl"
  );
  const [proposedName, setProposedName] = useState("");
  const [message, setMessage] = useState("");
  const [poll, setPoll] = useState<SportPoolPoll | null>(null);
  const [votes, setVotes] = useState<SportPoolVote[]>([]);
  const [voterTotal, setVoterTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spun, setSpun] = useState<{
    code: string;
    leagueId: string;
    leagueName: string;
    seated: number;
    sportId: string;
    crewContinues: boolean;
  } | null>(null);
  const [sqlNeeded, setSqlNeeded] = useState(false);

  const refresh = useCallback(async () => {
    if (!league?.id) return;
    setVoterTotal(await countSourceLeagueHumans(league.id));

    const { poll: p, error } = await loadOpenPollForLeague(league.id);
    if (error && /sport-pool-polls\.sql|SQL Editor/i.test(error)) {
      setSqlNeeded(true);
      setErr(error);
    } else if (error && !p) {
      setErr(error);
    } else {
      setSqlNeeded(false);
      if (!error) setErr(null);
    }
    setPoll(p);
    if (p) {
      const { votes: v } = await loadPollVotes(p.id);
      setVotes(v);
    } else {
      setVotes([]);
    }
  }, [league?.id]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const yeses = votes.filter((v) => v.response === "yes");
  const nos = votes.filter((v) => v.response === "no");
  const answered = votes.length;
  const sourceMemberCount = poll?.sourceMemberCount || voterTotal;
  const crewThreshold = crewContinuityThreshold(sourceMemberCount);
  const crewContinues = doesCrewContinue(sourceMemberCount, yeses.length);
  // Interest signal only — never a “must answer” meter
  const interestNote =
    yeses.length === 0
      ? "Waiting for someone besides you to display questionable judgment."
      : yeses.length < 3
        ? "A few brave souls have volunteered."
        : "Now this is becoming a problem worth creating.";

  async function sendPoll() {
    setBusy(true);
    setErr(null);
    setNote(null);
    setSqlNeeded(false);
    const pack = getSportPack(targetSport);
    const defaultMsg = defaultSportPoolMessage(pack.shortLabel);
    const res = await createSportPoolPoll({
      targetSportId: targetSport,
      proposedName:
        proposedName.trim() ||
        `${league?.name || "War Room"} · ${pack.shortLabel}`,
      message: message.trim() || defaultMsg,
    });
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    setPoll(res.poll);
    setNote(
      "The question is live on every player’s Home screen. You’re already counted in."
    );
    void refresh();
  }

  async function createFromYeses() {
    if (!poll) return;
    if (yeses.length < 1) {
      setErr(
        "Need at least one interested person. You’re already counted in."
      );
      return;
    }
    const pack = getSportPack(poll.targetSportId);
    const ok = confirm(
      `Create the ${pack.shortLabel} league with ${yeses.length} players?\n\n` +
        `• You are commissioner\n` +
        `• Everyone who tapped “I’m in” is added automatically\n` +
        `• Everyone else stays in the ${getSportPack(currentSport).shortLabel} league\n` +
        `• Nobody is removed or moved`
    );
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await spinUpLeagueFromPoll({
      pollId: poll.id,
      leagueNameOverride: proposedName.trim() || poll.proposedName,
    });
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    setSpun({
      code: res.code,
      leagueId: res.leagueId,
      leagueName: res.leagueName,
      seated: res.seated,
      sportId: res.sportId,
      crewContinues: res.crewContinues,
    });
    setPoll(null);
    setNote(
      `${res.leagueName} created with ${res.seated} players.`
    );
    void refresh();
  }

  async function openNewRoom() {
    if (!spun?.leagueId) return;
    setBusy(true);
    const ok = await switchToLeague(spun.leagueId);
    setBusy(false);
    if (ok) {
      router.push("/");
      router.refresh();
      window.location.href = "/";
    } else {
      setErr(
        "League created — open it from Account → Your leagues if switching failed."
      );
    }
  }

  if (!liveOthers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted leading-relaxed">
        No other sports are live yet. When another sport opens, this is where
        you&apos;ll ask the league who wants in.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Another sport
        </p>
        <h3 className="text-base font-bold text-foreground mt-1">
          Ask this league who wants in
        </h3>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          Pick the sport and ask once. Players answer on Home. When you&apos;re
          ready, one button creates the new league and adds everyone who tapped{" "}
          <strong className="text-foreground">I&apos;m in</strong>. This league
          stays exactly where it is.
        </p>
      </div>

      {sqlNeeded && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-3 text-xs text-danger leading-relaxed space-y-2">
          <p className="font-bold">One-time database setup required</p>
          <p>
            In Supabase → <strong className="text-foreground">SQL Editor</strong>{" "}
            → New query, paste{" "}
            <code className="text-foreground">supabase/sport-pool-polls.sql</code>{" "}
            → Run. Then hard-refresh.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(sportPoolSqlHint());
              setNote("Hint copied — open the .sql file in the repo for the full script.");
            }}
            className="text-[11px] font-semibold underline"
          >
            Copy setup hint
          </button>
        </div>
      )}

      {!poll && !spun && (
        <div className="space-y-3">
          <label className="block text-xs text-muted">
            New sport
            <select
              value={targetSport}
              onChange={(e) => setTargetSport(e.target.value as SportId)}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {liveOthers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            New league name
            <input
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder={`${league?.name || "War Room"} · ${getSportPack(targetSport).shortLabel}`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Message to the league
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={defaultSportPoolMessage(
                getSportPack(targetSport).shortLabel
              )}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || sqlNeeded}
            onClick={() => void sendPoll()}
            className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 bg-primary/15 text-primary font-bold text-sm disabled:opacity-50 hover:bg-primary/25"
          >
            Ask the league
          </button>
          <p className="text-[11px] text-muted leading-relaxed">
            This appears on each player&apos;s Home screen. Only “I&apos;m in” gets a
            seat in the new league.
          </p>
        </div>
      )}

      {poll && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Question open · {getSportPack(poll.targetSportId).emoji}{" "}
              {getSportPack(poll.targetSportId).shortLabel} · {poll.proposedName}
            </p>
            <p className="text-xs text-muted mt-1.5">
              <span className="text-primary font-semibold">
                {yeses.length} in
              </span>
              {nos.length > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">{nos.length} out</span>
                </>
              )}
              {answered > 0 && voterTotal > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">
                    {answered} responded (of {voterTotal} in room)
                  </span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              {interestNote}
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              Crew carries forward at {crewThreshold} of {sourceMemberCount || "—"}.{" "}
              {crewContinues
                ? "Crew secured."
                : `${Math.max(0, crewThreshold - yeses.length)} more needed.`}
            </p>
          </div>

          {yeses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Going ({yeses.length})
              </p>
              <p className="text-[11px] text-muted mb-1.5 leading-relaxed">
                These players will be added automatically. Only you see this
                list; nobody sees who declined.
              </p>
              <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                {yeses.map((v) => (
                  <li key={v.userId} className="text-foreground">
                    {v.displayName || v.userId.slice(0, 8)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={busy || yeses.length < 1}
            onClick={() => void createFromYeses()}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            {yeses.length < 1
              ? "Waiting for interest…"
              : crewContinues
                ? `Create ${getSportPack(poll.targetSportId).shortLabel} league · ${yeses.length} players · Crew continues`
                : `Create ${getSportPack(poll.targetSportId).shortLabel} league · ${yeses.length} players`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                await closeSportPoolPoll(poll.id);
                setBusy(false);
                setPoll(null);
                setNote("Invite closed. No new room — this season continues as usual.");
              })();
            }}
            className="w-full py-2 text-xs text-muted hover:text-foreground"
          >
            Close question without creating the league
          </button>
        </div>
      )}

      {spun && (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-3 text-sm space-y-2">
          <p className="font-bold text-primary">New league created</p>
          <p className="text-foreground font-semibold">{spun.leagueName}</p>
          <p className="font-mono tracking-widest text-lg text-foreground">
            {spun.code}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {spun.seated} players added · you&apos;re commissioner ·{" "}
            {getSportPack(spun.sportId).shortLabel}. The original league is unchanged.
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {spun.crewContinues
              ? "Crew continues. Time does not reset it."
              : "Crew threshold was not met; this league starts its own history."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openNewRoom()}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            Go to new league →
          </button>
        </div>
      )}

      {note && <p className="text-xs text-primary leading-relaxed">{note}</p>}
      {err && !sqlNeeded && (
        <p className="text-xs text-danger leading-relaxed">{err}</p>
      )}
    </div>
  );
}
