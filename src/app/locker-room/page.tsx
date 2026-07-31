"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { getSession, getLeague, isStaff } from "@/lib/league";
import { isSelfPlayer, selfNameClass } from "@/lib/self-highlight";
import {
  LOCKER_COOLDOWN_SEC,
  LOCKER_EMOJIS,
  LOCKER_MAX_CHARS,
  amILockerMuted,
  deleteLockerMessage,
  formatLockerTime,
  loadLockerMessages,
  postLockerMessage,
  type LockerMessage,
} from "@/lib/locker-room";
import { markLockerSeen } from "@/lib/room-unseen";
import { refreshStaffSessionFlags } from "@/lib/cloud";

export default function LockerRoomPage() {
  const [messages, setMessages] = useState<LockerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [muted, setMuted] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastPostAt = useRef(0);
  const listTopRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setError(null);
    const res = await loadLockerMessages(100);
    if (!res.ok) {
      if (!opts?.quiet) setError(res.error || "Could not load");
      return;
    }
    const list = res.messages || [];
    setMessages(list);
    if (res.weekLabel) setWeekLabel(res.weekLabel);
    setError(null);
    // Opening Locker clears "unseen" for Home / nav (watermark = newest post or now)
    const newest = list[0]?.createdAt;
    markLockerSeen({ atIso: newest });
  }, []);

  useEffect(() => {
    const session = getSession();
    setSelfId(session?.playerId || null);
    setStaff(isStaff());
    setLeagueName(getLeague()?.name || "");
    void refreshStaffSessionFlags().then(() => setStaff(isStaff()));
    void amILockerMuted().then(setMuted);
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Poll for new takes (simple; no Realtime required)
  useEffect(() => {
    const t = setInterval(() => {
      void reload({ quiet: true });
    }, 12000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setTimeout(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownLeft]);

  useEffect(() => {
    // Stick near bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function insertEmoji(emoji: string) {
    setBody((prev) => {
      if (prev.length >= LOCKER_MAX_CHARS) return prev;
      const next = prev + emoji;
      return next.slice(0, LOCKER_MAX_CHARS);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPostError(null);
    if (muted) {
      setPostError(
        "You’re muted in Locker Room. Talk to the commissioner if that’s a mistake."
      );
      return;
    }
    const now = Date.now();
    const wait =
      LOCKER_COOLDOWN_SEC * 1000 - (now - lastPostAt.current);
    if (wait > 0) {
      setCooldownLeft(Math.ceil(wait / 1000));
      setPostError(`Slow down — ${Math.ceil(wait / 1000)}s cooldown.`);
      return;
    }
    setPosting(true);
    const text = body;
    const res = await postLockerMessage(text);
    setPosting(false);
    if (!res.ok) {
      setPostError(res.error || "Failed to post");
      if (/muted/i.test(res.error || "")) setMuted(true);
      return;
    }
    lastPostAt.current = Date.now();
    setCooldownLeft(LOCKER_COOLDOWN_SEC);
    setBody("");
    // Show your post immediately (then reconcile with server)
    if (res.message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.message!.id)) return prev;
        return [...prev, res.message!];
      });
    }
    await reload({ quiet: true });
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this message?")) return;
    const res = await deleteLockerMessage(id);
    if (!res.ok) {
      setPostError(res.error || "Could not delete");
      return;
    }
    await reload({ quiet: true });
  }

  const remaining = LOCKER_MAX_CHARS - body.length;
  const canPost =
    !muted &&
    body.trim().length > 0 &&
    body.length <= LOCKER_MAX_CHARS &&
    !posting &&
    cooldownLeft === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        <div className="mb-4 shrink-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">Locker Room</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-400/30">
              Trash talk
            </span>
          </div>
          <p className="text-sm text-muted">
            {leagueName ? (
              <>
                <span className="text-foreground font-medium">{leagueName}</span>
                {" · "}
              </>
            ) : null}
            Drop hot takes ({LOCKER_MAX_CHARS} char max).{" "}
            <strong className="text-foreground">This week only</strong>
            {weekLabel ? (
              <>
                {" "}
                <span className="text-foreground/80">({weekLabel})</span>
              </>
            ) : null}
            — board clears every Monday ET for a fresh week. Staff can delete
            posts and mute.
            {staff && (
              <>
                {" "}
                <Link href="/moderation" className="text-amber-300 hover:underline">
                  Mod tools →
                </Link>
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-4 shrink-0">
            {error}
          </div>
        )}

        {/* Feed */}
        <div
          ref={listTopRef}
          className="flex-1 min-h-[280px] max-h-[min(55vh,520px)] overflow-y-auto rounded-xl border border-border bg-card mb-4"
        >
          {loading && (
            <p className="text-sm text-muted text-center py-12">Loading…</p>
          )}
          {!loading && messages.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <div className="text-3xl mb-2" aria-hidden>
                🏈💀
              </div>
              <p className="text-sm font-medium">Quiet in here</p>
              <p className="text-xs text-muted mt-1">
                First take of the week. Don’t waste it.
              </p>
            </div>
          )}
          <ul className="divide-y divide-border/60">
            {messages.map((m) => {
              const mine = isSelfPlayer(m.userId, selfId);
              return (
                <li
                  key={m.id}
                  className={`px-3 py-3 ${mine ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className={selfNameClass(mine, "text-sm font-semibold")}>
                      <PlayerLink id={m.userId} name={m.authorName} />
                      {mine && <YouBadge />}
                    </span>
                    <span className="text-[11px] text-muted shrink-0">
                      {formatLockerTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/95 whitespace-pre-wrap break-words leading-relaxed">
                    {m.body}
                  </p>
                  {(mine || staff) && (
                    <button
                      type="button"
                      onClick={() => void onDelete(m.id)}
                      className="text-[10px] text-muted hover:text-danger mt-1"
                    >
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        {muted ? (
          <div className="shrink-0 rounded-xl border border-danger/40 bg-danger/10 px-4 py-4 text-sm">
            <p className="font-semibold text-danger mb-1">You’re muted</p>
            <p className="text-muted text-xs leading-relaxed">
              A moderator turned off Locker Room posting for you. You can still
              make picks and view standings. If this is a mistake, message the
              commissioner.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="shrink-0 rounded-xl border border-border bg-card p-3 space-y-2"
          >
            <div className="flex flex-wrap gap-1.5">
              {LOCKER_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => insertEmoji(em)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-background border border-border hover:border-primary/50 hover:bg-primary/10 text-base leading-none"
                  title="Add emoji"
                >
                  {em}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) =>
                setBody(e.target.value.slice(0, LOCKER_MAX_CHARS))
              }
              rows={3}
              maxLength={LOCKER_MAX_CHARS}
              placeholder="Talk your shit… (Best Bet locks, dogs that covered, Toilet Bowl prophecy)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs ${
                  remaining < 30 ? "text-warning" : "text-muted"
                }`}
              >
                {remaining} left
                {cooldownLeft > 0 ? ` · wait ${cooldownLeft}s` : ""}
              </span>
              <button
                type="submit"
                disabled={!canPost}
                className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-40"
              >
                {posting ? "Sending…" : "Post"}
              </button>
            </div>
            {postError && (
              <p className="text-xs text-danger">{postError}</p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
