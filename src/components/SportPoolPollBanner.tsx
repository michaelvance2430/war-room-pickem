"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import { getSportPack } from "@/lib/sports/registry";
import {
  castSportPoolVote,
  loadOpenPollForLeague,
  myVoteForPoll,
  type SportPoolPoll,
} from "@/lib/sport-pool";

/**
 * Home banner: “Want to play [sport] in a new room?” for open pool polls.
 */
export default function SportPoolPollBanner() {
  const [poll, setPoll] = useState<SportPoolPoll | null>(null);
  const [myVote, setMyVote] = useState<"yes" | "no" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    const league = getLeague();
    const session = getSession();
    if (!league?.id || !session?.playerId) {
      setPoll(null);
      return;
    }
    const { poll: p } = await loadOpenPollForLeague(league.id);
    // Hide "start another sport" if they already play that sport elsewhere
    if (p?.targetSportId) {
      try {
        const { fetchMyMemberships } = await import("@/lib/session-restore");
        const ms = await fetchMyMemberships();
        const already = ms.some(
          (m) =>
            (m.sportId || "cfb").toLowerCase() ===
            (p.targetSportId || "").toLowerCase()
        );
        if (already) {
          setPoll(null);
          return;
        }
      } catch {
        /* show poll if memberships fail */
      }
    }
    setPoll(p);
    if (p) {
      const v = await myVoteForPoll(p.id);
      setMyVote(v);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (hidden || !poll) return null;

  const pack = getSportPack(poll.targetSportId);
  const sportLabel = pack.label;

  async function vote(response: "yes" | "no") {
    setBusy(true);
    setErr(null);
    const res = await castSportPoolVote({ pollId: poll!.id, response });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || "Could not save");
      return;
    }
    setMyVote(response);
  }

  return (
    <div className="mb-5 rounded-xl border-2 border-primary/45 bg-primary/10 px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
        New sport pool
      </p>
      <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
        Want to play {sportLabel}
        {poll.proposedName ? (
          <>
            {" "}
            in <span className="text-primary">{poll.proposedName}</span>
          </>
        ) : null}
        ?
      </h2>
      {poll.message ? (
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          {poll.message}
        </p>
      ) : (
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          Your host is building a new room from this league&apos;s player pool.
          Say yes and you&apos;re on the spin-up list.
        </p>
      )}

      {myVote ? (
        <p className="text-sm font-semibold text-primary mt-3">
          You said{" "}
          {myVote === "yes"
            ? "YES — you’re on the list"
            : "no — you’re sitting this one out"}
          . Change your mind anytime while the poll is open.
        </p>
      ) : null}

      {err && <p className="text-xs text-danger mt-2">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void vote("yes")}
          className="flex-1 py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50 touch-manipulation"
        >
          Yes — count me in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void vote("no")}
          className="flex-1 py-3 min-h-[48px] rounded-xl border border-border text-sm font-medium disabled:opacity-50 touch-manipulation"
        >
          Not this time
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="sm:w-auto px-3 py-2 text-xs text-muted touch-manipulation"
        >
          Hide
        </button>
      </div>
    </div>
  );
}
