"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague } from "@/lib/league";
import { listSportPickerOptions, getSportPack } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  closeSportPoolPoll,
  countSourceLeagueHumans,
  createSportPoolPoll,
  loadOpenPollForLeague,
  loadPollVotes,
  spinUpLeagueFromPoll,
  sportPoolSqlHint,
  type SportPoolPoll,
  type SportPoolVote,
} from "@/lib/sport-pool";
import { switchToLeague } from "@/lib/session-restore";

/**
 * Commissioner: poll this room’s humans for a different sport, then
 * one-click create a league seating every yes.
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
  const [humanCount, setHumanCount] = useState(0);
  const [newCommId, setNewCommId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spun, setSpun] = useState<{
    code: string;
    leagueId: string;
    leagueName: string;
    seated: number;
    sportId: string;
  } | null>(null);
  const [sqlNeeded, setSqlNeeded] = useState(false);

  const refresh = useCallback(async () => {
    if (!league?.id) return;
    const humans = await countSourceLeagueHumans(league.id);
    setHumanCount(humans);

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
    const t = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const yeses = votes.filter((v) => v.response === "yes");
  const nos = votes.filter((v) => v.response === "no");
  const answered = votes.length;
  // Host auto-yes counts; "everyone" = all humans have a vote
  const allAnswered =
    humanCount > 0 && answered >= humanCount && humanCount === answered;

  async function sendPoll() {
    setBusy(true);
    setErr(null);
    setNote(null);
    setSqlNeeded(false);
    const pack = getSportPack(targetSport);
    const res = await createSportPoolPoll({
      targetSportId: targetSport,
      proposedName:
        proposedName.trim() ||
        `${league?.name || "War Room"} · ${pack.shortLabel}`,
      message:
        message.trim() ||
        `Do you want to play ${pack.label} in a new room with this crew?`,
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
      "Poll is live on Home for everyone in this room. You’re already counted as yes."
    );
    void refresh();
  }

  async function createFromYeses() {
    if (!poll) return;
    if (yeses.length < 1) {
      setErr("Need at least one yes (you’re auto-yes as host).");
      return;
    }
    if (
      !allAnswered &&
      !confirm(
        `${answered} of ${humanCount || "?"} have answered.\n\n` +
          `Create the ${getSportPack(poll.targetSportId).shortLabel} room now with ` +
          `${yeses.length} yes${yeses.length === 1 ? "" : "es"} (plus you if not already)?\n\n` +
          `People who haven’t voted yet won’t be seated.`
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await spinUpLeagueFromPoll({
      pollId: poll.id,
      newCommissionerId: newCommId || null,
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
    });
    setPoll(null);
    setNote(
      `Created ${res.leagueName} · ${res.seated} seated · code ${res.code}`
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
      setErr("League created — switch to it from Account if auto-switch failed.");
    }
  }

  if (!liveOthers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
        No other live sports to poll yet. When NFL and CFB both exist, you can
        spin the other from this room&apos;s pool.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          Player pool · new sport
        </p>
        <h3 className="text-base font-bold text-foreground mt-1">
          Ask the room, then open a new league
        </h3>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Poll everyone in <strong className="text-foreground">this</strong>{" "}
          room. When you&apos;re ready, one tap creates the new sport league and
          seats every <strong className="text-foreground">yes</strong>{" "}
          (you&apos;re always included).
        </p>
      </div>

      {sqlNeeded && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-3 text-xs text-danger leading-relaxed space-y-2">
          <p className="font-bold">One-time database setup required</p>
          <p>
            In Supabase → <strong className="text-foreground">SQL Editor</strong>{" "}
            → New query, paste the contents of{" "}
            <code className="text-foreground">supabase/sport-pool-polls.sql</code>{" "}
            from the project repo → Run. Then hard-refresh this page.
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
            Target sport
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
            Message (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              rows={2}
              placeholder={`Do you want to play ${getSportPack(targetSport).label}?`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || sqlNeeded}
            onClick={() => void sendPoll()}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            Send poll to the room
          </button>
        </div>
      )}

      {poll && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Open poll · {getSportPack(poll.targetSportId).emoji}{" "}
              {getSportPack(poll.targetSportId).shortLabel} · {poll.proposedName}
            </p>
            <p className="text-xs text-muted mt-1">
              <span className="text-primary font-bold">{yeses.length} yes</span>
              {" · "}
              <span className="text-muted">{nos.length} no</span>
              {" · "}
              <span className="text-foreground font-medium">
                {answered} of {humanCount || "?"} answered
              </span>
            </p>
            {allAnswered ? (
              <p className="text-xs text-primary font-bold mt-1.5">
                Everyone answered — one-click create is ready.
              </p>
            ) : (
              <p className="text-[11px] text-muted mt-1.5">
                You can create early with whoever said yes, or wait for the rest.
              </p>
            )}
          </div>

          {yeses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Will be seated ({yeses.length})
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

          <label className="block text-xs text-muted">
            New commissioner (optional)
            <select
              value={newCommId}
              onChange={(e) => setNewCommId(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="">Keep me as commissioner</option>
              {yeses.map((v) => (
                <option key={v.userId} value={v.userId}>
                  {v.displayName || "Player"} — hand them the gavel
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={busy || yeses.length < 1}
            onClick={() => void createFromYeses()}
            className={`w-full py-3.5 min-h-[52px] rounded-xl font-extrabold text-sm disabled:opacity-50 ${
              allAnswered
                ? "bg-primary text-black ring-2 ring-primary/40"
                : "bg-primary text-black"
            }`}
          >
            {yeses.length < 1
              ? "Waiting for yeses…"
              : allAnswered
                ? `Create ${getSportPack(poll.targetSportId).shortLabel} league · all ${yeses.length} yeses`
                : `Create ${getSportPack(poll.targetSportId).shortLabel} league with ${yeses.length} yes${yeses.length === 1 ? "" : "es"}`}
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
                setNote("Poll closed without creating a room.");
              })();
            }}
            className="w-full py-2 text-xs text-muted"
          >
            Close poll without creating
          </button>
        </div>
      )}

      {spun && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm space-y-2">
          <p className="font-bold text-primary">League created</p>
          <p className="text-foreground font-semibold">{spun.leagueName}</p>
          <p className="font-mono tracking-widest text-lg text-foreground">
            {spun.code}
          </p>
          <p className="text-xs text-muted">
            {spun.seated} seated · {getSportPack(spun.sportId).shortLabel}. Yeses
            are already in the room.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openNewRoom()}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            Open new room now →
          </button>
        </div>
      )}

      {note && <p className="text-xs text-primary">{note}</p>}
      {err && !sqlNeeded && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
