"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { listSportPickerOptions, getSportPack } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  closeSportPoolPoll,
  createSportPoolPoll,
  loadOpenPollForLeague,
  loadPollVotes,
  spinUpLeagueFromPoll,
  type SportPoolPoll,
  type SportPoolVote,
} from "@/lib/sport-pool";

/**
 * Commissioner: poll this room’s humans for a different sport, then spin up.
 */
export default function SportPoolCommishPanel() {
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
  const [newCommId, setNewCommId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spunCode, setSpunCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!league?.id) return;
    const { poll: p, error } = await loadOpenPollForLeague(league.id);
    if (error && !p) setErr(error);
    setPoll(p);
    if (p) {
      const { votes } = await loadPollVotes(p.id);
      setVotes(votes);
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

  async function sendPoll() {
    setBusy(true);
    setErr(null);
    setNote(null);
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
      setErr(res.error);
      return;
    }
    setPoll(res.poll);
    setNote("Poll is live — players see it on Home.");
    void refresh();
  }

  async function spinUp() {
    if (!poll) return;
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
      setErr(res.error);
      return;
    }
    setSpunCode(res.code);
    setNote(
      `Created ${res.leagueName} (${res.sportId}) · code ${res.code} · ${res.seated} seated.`
    );
    setPoll(null);
    void refresh();
  }

  if (!liveOthers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
        No other live sports to poll yet. When NFL/CFB both exist, you can spin
        the other from this room&apos;s pool.
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
          Query everyone in <strong className="text-foreground">this</strong>{" "}
          league. Who clicks yes gets seated in a new room of a different sport.
          You can keep the gavel or assign a new commissioner from the yes list.
        </p>
      </div>

      {!poll && !spunCode && (
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
            disabled={busy}
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
              Open poll · {getSportPack(poll.targetSportId).shortLabel} ·{" "}
              {poll.proposedName}
            </p>
            <p className="text-xs text-muted mt-1">
              <span className="text-primary font-bold">{yeses.length} yes</span>
              {" · "}
              <span className="text-muted">{nos.length} no</span>
              {" · "}
              host always seats themselves too
            </p>
          </div>

          {yeses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Said yes
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
            onClick={() => void spinUp()}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-sm disabled:opacity-50"
          >
            {yeses.length < 1
              ? "Waiting for at least one yes…"
              : `Open ${getSportPack(poll.targetSportId).shortLabel} league with ${yeses.length} yes${yeses.length === 1 ? "" : "es"}`}
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
                setNote("Poll closed.");
              })();
            }}
            className="w-full py-2 text-xs text-muted"
          >
            Close poll without creating
          </button>
        </div>
      )}

      {spunCode && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm">
          <p className="font-bold text-primary">League created</p>
          <p className="text-foreground mt-1 font-mono tracking-widest text-lg">
            {spunCode}
          </p>
          <p className="text-xs text-muted mt-1">
            Share the code or switch accounts into that room. Yeses are already
            seated.
          </p>
        </div>
      )}

      {note && <p className="text-xs text-primary">{note}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
