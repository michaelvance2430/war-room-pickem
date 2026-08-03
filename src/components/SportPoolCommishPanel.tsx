"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague } from "@/lib/league";
import { listSportPickerOptions, getSportPack } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  closeSportPoolPoll,
  countSourceLeagueVoters,
  createSportPoolPoll,
  loadOpenPollForLeague,
  loadPollVotes,
  seedBotSportPoolVotes,
  spinUpLeagueFromPoll,
  sportPoolSqlHint,
  type SportPoolPoll,
  type SportPoolVote,
} from "@/lib/sport-pool";
import { switchToLeague } from "@/lib/session-restore";

/**
 * Commish: soft invite for a next-sport chapter (community-led).
 * Only yeses get seats. No pressure, no auto-transfer, source room stays.
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
  const [botCount, setBotCount] = useState(0);
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
    const counts = await countSourceLeagueVoters(league.id);
    setVoterTotal(counts.total);
    setBotCount(counts.bots);

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
  const humansApprox = Math.max(0, voterTotal - botCount);
  // Interest signal only — never a “must answer” meter
  const interestNote =
    yeses.length === 0
      ? "No interest yet — totally fine. Leave the door open or close it."
      : yeses.length < 3
        ? "A few people are curious. Open a room when it feels right — or wait."
        : "Solid interest. Open the chapter when the community feels ready.";

  async function sendPoll() {
    setBusy(true);
    setErr(null);
    setNote(null);
    setSqlNeeded(false);
    const pack = getSportPack(targetSport);
    const defaultMsg =
      `Optional: anyone interested in ${pack.shortLabel} with this crew? ` +
      `No pressure — pass or ignore is fine. This room keeps going either way.`;
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
      botCount > 0
        ? "Invite is live (soft). You’re marked interested so you can practice. Bots can answer for preseason tests only."
        : "Invite is live on Home — optional, dismissible. You’re counted as interested as host."
    );
    void refresh();
  }

  async function botsAnswer() {
    if (!poll) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await seedBotSportPoolVotes(poll.id);
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    if (res.bots < 1) {
      setNote("No trial bots in this room — optional for practice only.");
    } else {
      setNote(
        `Practice: bots simulated ${res.yes} interested · ${res.no} pass. Humans still choose freely.`
      );
    }
    void refresh();
  }

  async function createFromYeses() {
    if (!poll) return;
    if (yeses.length < 1) {
      setErr(
        "Need at least one interested person (you’re counted as host). Don’t force the room."
      );
      return;
    }
    const pack = getSportPack(poll.targetSportId);
    const ok = confirm(
      `Open a ${pack.shortLabel} chapter for people who opted in?\n\n` +
        `• ${yeses.length} interested → get a seat\n` +
        `• Pass / no answer → stay only in this room (no move, no shame)\n` +
        `• This ${getSportPack(currentSport).shortLabel} room keeps going\n\n` +
        `Community-led — only yeses join the new desk.`
    );
    if (!ok) return;

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
      `Chapter open: ${res.leagueName} · ${res.seated} opted-in · code ${res.code}`
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
        "Room created — open it from Account → Your leagues if switch failed."
      );
    }
  }

  if (!liveOthers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted leading-relaxed">
        No other live sports to invite yet. When CFB and NFL are both live, you
        can softly poll this room for a next chapter — never forced.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Community-led · optional chapter
        </p>
        <h3 className="text-base font-bold text-foreground mt-1">
          Soft invite — same Crew, new desk if they want
        </h3>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          Ask who&apos;s interested in another sport.{" "}
          <strong className="text-foreground">Nobody is moved</strong> out of
          this room. Only people who say yes get a seat in the new one. Pass,
          silence, and hide are all fine — this season keeps going either way.
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
            Sport to invite (not replace this room)
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
            Name if a room opens
            <input
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder={`${league?.name || "War Room"} · ${getSportPack(targetSport).shortLabel}`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Invite wording (optional — keep it soft)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={`Optional: anyone interested in ${getSportPack(targetSport).shortLabel}? No pressure.`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || sqlNeeded}
            onClick={() => void sendPoll()}
            className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 bg-primary/15 text-primary font-bold text-sm disabled:opacity-50 hover:bg-primary/25"
          >
            Share soft invite with the room
          </button>
          <p className="text-[11px] text-muted leading-relaxed">
            Shows a quiet Home card. People can pass, hide forever, or ignore.
            You&apos;ll only seat interest — never the whole roster by default.
          </p>
        </div>
      )}

      {poll && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Invite open · {getSportPack(poll.targetSportId).emoji}{" "}
              {getSportPack(poll.targetSportId).shortLabel} · {poll.proposedName}
            </p>
            <p className="text-xs text-muted mt-1.5">
              <span className="text-primary font-semibold">
                {yeses.length} interested
              </span>
              {nos.length > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">{nos.length} passed</span>
                </>
              )}
              {answered > 0 && humansApprox > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">
                    {answered} responded (of ~{voterTotal || "?"} in room
                    {botCount > 0 ? `, incl. ${botCount} bots` : ""})
                  </span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              {interestNote} Silence is not a no and not a yes — just silence.
            </p>
          </div>

          {yeses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Interested · would get a seat ({yeses.length})
              </p>
              <p className="text-[11px] text-muted mb-1.5">
                Host-only list. We don&apos;t publish who passed.
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
            Commissioner for the new desk (optional)
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
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            {yeses.length < 1
              ? "Waiting for interest…"
              : `Open ${getSportPack(poll.targetSportId).shortLabel} chapter for ${yeses.length} interested`}
          </button>
          {botCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void botsAnswer()}
              className="w-full py-2.5 min-h-[44px] rounded-xl border border-border bg-background text-sm font-medium text-muted disabled:opacity-50"
            >
              Practice: bots simulate answers
            </button>
          )}
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
            Close invite without opening a room
          </button>
        </div>
      )}

      {spun && (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-3 text-sm space-y-2">
          <p className="font-bold text-primary">Chapter opened</p>
          <p className="text-foreground font-semibold">{spun.leagueName}</p>
          <p className="font-mono tracking-widest text-lg text-foreground">
            {spun.code}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {spun.seated} people who opted in are seated ·{" "}
            {getSportPack(spun.sportId).shortLabel}. Everyone else stays only in
            this room — nothing was forced.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openNewRoom()}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            Open new desk →
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
