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
 * Soft Home invite: optional next sport chapter. No pressure, no FOMO.
 * Dismiss forever (per poll) or ignore — all valid.
 */

const DISMISS_KEY = "warroom-sport-pool-dismiss-v1";

function readDismissed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, boolean>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function markDismissed(pollId: string) {
  try {
    const m = readDismissed();
    m[pollId] = true;
    localStorage.setItem(DISMISS_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function isDismissed(pollId: string): boolean {
  return !!readDismissed()[pollId];
}

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
    if (!p) {
      setPoll(null);
      return;
    }
    if (isDismissed(p.id)) {
      setPoll(null);
      return;
    }
    // Already play that sport elsewhere — no need to invite again
    if (p.targetSportId) {
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
        /* show invite if memberships fail */
      }
    }
    setPoll(p);
    const v = await myVoteForPoll(p.id);
    setMyVote(v);
  }, []);

  useEffect(() => {
    void refresh();
    // Quiet refresh — not a nag timer
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (hidden || !poll) return null;

  const pack = getSportPack(poll.targetSportId);
  const sportLabel = pack.shortLabel || pack.label;

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

  function dismissForever() {
    if (poll?.id) markDismissed(poll.id);
    setHidden(true);
  }

  return (
    <div className="mb-5 rounded-xl border border-border/70 bg-card/80 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Optional · no pressure
        </p>
        <button
          type="button"
          onClick={dismissForever}
          className="shrink-0 text-[11px] text-muted hover:text-foreground touch-manipulation px-1"
          title="Hide this invite for good"
        >
          Not interested · hide
        </button>
      </div>
      <h2 className="text-base font-semibold text-foreground leading-snug">
        Open door: {sportLabel}
        {poll.proposedName ? (
          <>
            {" "}
            <span className="text-muted font-medium">
              ({poll.proposedName})
            </span>
          </>
        ) : null}
      </h2>
      {poll.message ? (
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          {poll.message}
        </p>
      ) : (
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          A soft invite from your host — same friends, new desk if you want.
          Saying no or ignoring this is completely fine. This room keeps going
          either way.
        </p>
      )}

      {myVote ? (
        <p className="text-sm text-foreground/90 mt-3 leading-relaxed">
          {myVote === "yes"
            ? "You’re interested — if a room opens, you’ll have a seat. Change anytime while this is open."
            : "Noted — you’re sitting this one out. No hard feelings. Change your mind anytime while open."}
        </p>
      ) : (
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Yes / no / hide — all valid. Nobody gets moved against their will.
        </p>
      )}

      {err && <p className="text-xs text-danger mt-2">{err}</p>}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void vote("yes")}
          className={`flex-1 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation ${
            myVote === "yes"
              ? "bg-primary/20 border border-primary/40 text-primary"
              : "bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25"
          }`}
        >
          {myVote === "yes" ? "Interested ✓" : "I’m interested"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void vote("no")}
          className={`flex-1 py-2.5 min-h-[44px] rounded-xl border text-sm font-medium disabled:opacity-50 touch-manipulation ${
            myVote === "no"
              ? "border-border bg-background text-muted"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          {myVote === "no" ? "Sitting out ✓" : "I’ll pass"}
        </button>
      </div>
    </div>
  );
}
