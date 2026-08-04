"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { getSession, getLeague, isStaff } from "@/lib/league";
import { isSelfPlayer, selfNameClass } from "@/lib/self-highlight";
import {
  LOCKER_COOLDOWN_SEC,
  LOCKER_EMOJIS,
  LOCKER_MAX_CHARS,
  LOCKER_REACTION_EMOJIS,
  amILockerMuted,
  deleteLockerMessage,
  formatLockerTime,
  loadLockerMessages,
  postLockerMessage,
  toggleLockerReaction,
  type LockerMessage,
} from "@/lib/locker-room";
import { markLockerCaughtUp, markLockerSeen } from "@/lib/room-unseen";
import { loadLeagueRoster } from "@/lib/cloud";
import { refreshStaffSessionFlags } from "@/lib/cloud";
import {
  applyMention,
  filterMentionMembers,
  getActiveMention,
  splitMentions,
  type MentionMember,
} from "@/lib/locker-mentions";
import { isGuestMode } from "@/lib/guest-mode";
import {
  GUEST_LOCKER_POST_CODE,
  GUEST_LOCKER_POST_INVITE,
  GUEST_LOCKER_REACT_CODE,
  GUEST_LOCKER_REACT_INVITE,
} from "@/lib/guest-copy";
import GuestBlockInvitePanel from "@/components/GuestBlockInvite";

export default function LockerRoomPage() {
  const [messages, setMessages] = useState<LockerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [showGuestReactInvite, setShowGuestReactInvite] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [muted, setMuted] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const [roster, setRoster] = useState<MentionMember[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  /** Which message has the + emoji picker open */
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [reactBusyId, setReactBusyId] = useState<string | null>(null);
  const [reactError, setReactError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastPostAt = useRef(0);
  const listTopRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef(0);

  const reload = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setError(null);
    const res = await loadLockerMessages(100);
    if (!res.ok) {
      if (!opts?.quiet) setError(res.error || "Could not load");
      // Still clear badge — they opened the room
      markLockerSeen();
      return;
    }
    const list = res.messages || [];
    setMessages(list);
    if (res.weekLabel) setWeekLabel(res.weekLabel);
    setError(null);
    // Thread is oldest→newest; catch up on max createdAt (not list[0])
    markLockerCaughtUp(list);
  }, []);

  useEffect(() => {
    const session = getSession();
    setSelfId(session?.playerId || null);
    setStaff(isStaff());
    setLeagueName(getLeague()?.name || "");
    setGuest(isGuestMode());
    // Immediate clear on walk-in — don't wait for network or extra taps
    markLockerSeen();
    // Never leave Locker on Loading… forever (stuck network)
    const failSafe = window.setTimeout(() => setLoading(false), 4_000);
    void refreshStaffSessionFlags().then(() => setStaff(isStaff()));
    void amILockerMuted().then(setMuted);
    reload().finally(() => {
      window.clearTimeout(failSafe);
      setLoading(false);
    });
    void loadLeagueRoster().then((rows) => {
      setRoster(
        rows
          .filter((m) => !m.isBot)
          .map((m) => ({ userId: m.userId, name: m.name }))
      );
    });
    if (session?.playerId) {
      void import("@/lib/engagement").then((m) =>
        m.markEngagement(session.playerId!, "opened_locker")
      );
    }
    return () => window.clearTimeout(failSafe);
  }, [reload]);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const mentionSuggestions = mentionOpen
    ? filterMentionMembers(roster, mentionQuery, 6)
    : [];

  function syncMention(text: string, caret: number) {
    caretRef.current = caret;
    const active = getActiveMention(text, caret);
    if (!active) {
      setMentionOpen(false);
      setMentionQuery("");
      return;
    }
    setMentionOpen(true);
    setMentionQuery(active.query);
    setMentionIndex(0);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? caretRef.current ?? body.length;
    const end = el?.selectionEnd ?? start;
    setBody((prev) => {
      if (prev.length >= LOCKER_MAX_CHARS) return prev;
      const next = (prev.slice(0, start) + emoji + prev.slice(end)).slice(
        0,
        LOCKER_MAX_CHARS
      );
      const pos = Math.min(start + emoji.length, next.length);
      caretRef.current = pos;
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
      return next;
    });
  }

  function pickMention(member: MentionMember) {
    const caret = caretRef.current;
    const { text, caret: nextCaret } = applyMention(body, caret, member);
    const clipped = text.slice(0, LOCKER_MAX_CHARS);
    setBody(clipped);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = Math.min(nextCaret, clipped.length);
      el.setSelectionRange(pos, pos);
      caretRef.current = pos;
    });
  }

  function onTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen || mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex(
        (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickMention(mentionSuggestions[mentionIndex] || mentionSuggestions[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionOpen(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPostError(null);
    if (guest || isGuestMode()) {
      setPostError(GUEST_LOCKER_POST_CODE);
      return;
    }
    if (muted) {
      setPostError(
        "You’re muted in Locker Room. Talk to the commissioner if that’s a mistake."
      );
      return;
    }
    const now = Date.now();
    const wait = LOCKER_COOLDOWN_SEC * 1000 - (now - lastPostAt.current);
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
    setMentionOpen(false);
    if (selfId) {
      void import("@/lib/engagement").then((m) =>
        m.markEngagement(selfId, "posted_locker")
      );
    }
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

  async function onReact(messageId: string, emoji: string) {
    if (guest || isGuestMode()) {
      setShowGuestReactInvite(true);
      setReactError(GUEST_LOCKER_REACT_CODE);
      return;
    }
    if (muted) {
      setReactError("You’re muted — reactions are off too.");
      setPostError("You’re muted — reactions are off too.");
      return;
    }
    setReactBusyId(messageId);
    setReactError(null);
    setPostError(null);
    // Optimistic: show the emoji immediately so taps feel real
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const list = [...(m.reactions || [])];
        const i = list.findIndex((r) => r.emoji === emoji);
        if (i >= 0) {
          const cur = list[i]!;
          if (cur.mine) {
            if (cur.count <= 1) list.splice(i, 1);
            else list[i] = { ...cur, count: cur.count - 1, mine: false };
          } else {
            list[i] = { ...cur, count: cur.count + 1, mine: true };
          }
        } else {
          list.push({ emoji, count: 1, mine: true });
        }
        list.sort(
          (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)
        );
        return { ...m, reactions: list };
      })
    );
    setReactPickerFor(null); // picker closes as soon as you stamp
    const res = await toggleLockerReaction(messageId, emoji);
    setReactBusyId(null);
    if (!res.ok) {
      const msg = res.error || "Could not react";
      setReactError(msg);
      setPostError(msg);
      await reload({ quiet: true });
      return;
    }
    if (res.reactions) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: res.reactions! } : m
        )
      );
    }
    void reload({ quiet: true });
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
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        <div className="mb-4 shrink-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">Locker Room</h1>
      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-400/30">
              League chat
            </span>
      </div>
          <p className="text-sm text-muted">
            {leagueName ? (
              <>
                <span className="text-foreground font-medium">{leagueName}</span>
                {" · "}
              </>
            ) : null}
            This week's trash talk
            {weekLabel ? (
              <>
                {" "}
                · <span className="text-foreground/80">{weekLabel}</span>
              </>
            ) : null}
            . Board clears Monday ET.
            {staff && (
              <>
                {" "}
                <Link
                  href="/moderation"
                  className="text-amber-300 hover:underline"
                >
                  Mod tools →
                </Link>
              </>
            )}
          </p>
      <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer select-none text-primary/90 font-semibold hover:text-primary">
              How it works
            </summary>
      <p className="mt-1.5 leading-relaxed">
              {LOCKER_MAX_CHARS} char max ·{" "}
              <strong className="text-foreground">+</strong> on a post to react
              (stamps stack bottom-left) · type{" "}
              <strong className="text-foreground">@name</strong> to tag ·{" "}
              this week only · staff can delete or mute.
            </p>
      </details>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-4 shrink-0">
            {error}
          </div>
        )}

        {reactError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-4 shrink-0">
            {reactError}
          </div>
        )}

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
                First take of the week. Don&apos;t waste it. Try @someone.
              </p>
      </div>
          )}
          <ul className="divide-y divide-border/60">
            {messages.map((m) => {
              const mine = isSelfPlayer(m.userId, selfId);
              const parts = splitMentions(m.body, roster);
              const rx = m.reactions || [];
              const pickerOpen = reactPickerFor === m.id;
              return (
                <li
                  key={m.id}
                  className={`px-3 py-3 ${mine ? "bg-primary/5" : ""}`}
                >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span
                      className={selfNameClass(mine, "text-sm font-semibold")}
                    >
      <PlayerLink id={m.userId} name={m.authorName} />
                      {mine && <YouBadge />}
                    </span>
      <span className="text-[11px] text-muted shrink-0">
                      {formatLockerTime(m.createdAt)}
                    </span>
      </div>

                  {/* Chat box: body + stamps bottom-left, stack L→R */}
                  <div
                    className={`relative mt-1 rounded-2xl border px-3 pt-2.5 pb-2 ${
                      mine
                        ? "border-primary/30 bg-primary/10"
                        : "border-border bg-background/60"
                    }`}
                  >
      <p className="text-sm text-foreground/95 whitespace-pre-wrap break-words leading-relaxed">
                      {parts.map((p, i) =>
                        p.type === "mention" ? (
                          p.userId ? (
                            <PlayerLink
                              key={`${m.id}-m-${i}`}
                              id={p.userId}
                              name={p.value}
                              className="text-primary font-semibold hover:underline"
                            />
                          ) : (
                            <span
                              key={`${m.id}-m-${i}`}
                              className="text-primary font-semibold"
                            >
                              {p.value}
                            </span>
                          )
                        ) : (
                          <span key={`${m.id}-t-${i}`}>{p.value}</span>
                        )
                      )}
                    </p>

                    {/* Bottom of bubble: stamps L→R, then + */}
                    <div className="mt-2 flex flex-wrap items-center justify-start gap-1 min-h-[28px]">
                      {rx.map((r) => (
                        <button
                          key={`${m.id}-stamp-${r.emoji}`}
                          type="button"
                          disabled={!!muted || guest || reactBusyId === m.id}
                          onClick={() => {
                            if (muted) return;
                            void onReact(m.id, r.emoji);
                          }}
                          className={`inline-flex items-center gap-0.5 h-7 pl-1.5 pr-1.5 rounded-full border text-sm leading-none touch-manipulation ${
                            r.mine
                              ? "border-primary/55 bg-primary/20"
                              : "border-border/80 bg-card/90"
                          } disabled:opacity-60`}
                          title={
                            muted
                              ? `${r.emoji} × ${r.count}`
                              : r.mine
                                ? "Tap to remove your reaction"
                                : "Tap to add this reaction"
                          }
                        >
                          <span aria-hidden>{r.emoji}</span>
                          {r.count > 1 ? (
                            <span className="text-[10px] font-bold tabular-nums text-muted">
                              {r.count}
                            </span>
                          ) : null}
                        </button>
                      ))}

                      {!muted && !guest && (
                        <button
                          type="button"
                          disabled={reactBusyId === m.id}
                          onClick={() =>
                            setReactPickerFor((cur) =>
                              cur === m.id ? null : m.id
                            )
                          }
                          className={`inline-flex items-center justify-center h-7 w-7 rounded-full border text-sm font-bold touch-manipulation ${
                            pickerOpen
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-dashed border-border text-muted hover:border-primary/50 hover:text-foreground"
                          } disabled:opacity-50`}
                          title="Add reaction"
                          aria-label="Add reaction"
                          aria-expanded={pickerOpen}
                        >
                          +
                        </button>
                      )}

                      {(mine || staff) && (
                        <button
                          type="button"
                          onClick={() => void onDelete(m.id)}
                          className="ml-auto text-[10px] text-muted hover:text-danger min-h-[28px] px-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* + picker: pick one → stamps & closes */}
                    {pickerOpen && !muted && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
                        {LOCKER_REACTION_EMOJIS.map((em) => (
                          <button
                            key={`${m.id}-pick-${em}`}
                            type="button"
                            disabled={reactBusyId === m.id}
                            onClick={() => void onReact(m.id, em)}
                            className="h-10 w-10 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/10 text-lg leading-none touch-manipulation disabled:opacity-50"
                            title="Stamp this emoji"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
      </li>
              );
            })}
          </ul>
      <div ref={bottomRef} />
        </div>

        {guest ? (
          <div className="shrink-0 space-y-3">
            {showGuestReactInvite && (
              <GuestBlockInvitePanel invite={GUEST_LOCKER_REACT_INVITE} />
            )}
            <GuestBlockInvitePanel invite={GUEST_LOCKER_POST_INVITE} />
          </div>
        ) : muted ? (
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
            className="shrink-0 rounded-xl border border-border bg-card p-3 space-y-2 relative"
          >
            <div className="relative">
              {mentionOpen && mentionSuggestions.length > 0 && (
                <ul
                  className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-primary/40 bg-card shadow-xl z-20"
                  role="listbox"
                >
                  {mentionSuggestions.map((m, i) => (
                    <li key={m.userId}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === mentionIndex}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickMention(m);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm ${
                          i === mentionIndex
                            ? "bg-primary/15 text-primary font-semibold"
                            : "text-foreground hover:bg-card-hover"
                        }`}
                      >
                        @{m.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {mentionOpen &&
                mentionQuery.length > 0 &&
                mentionSuggestions.length === 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted shadow-xl z-20">
                    No one named “{mentionQuery}” in this league
                  </div>
                )}
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  const v = e.target.value.slice(0, LOCKER_MAX_CHARS);
                  setBody(v);
                  const caret = e.target.selectionStart ?? v.length;
                  syncMention(v, caret);
                }}
                onKeyUp={(e) => {
                  const el = e.currentTarget;
                  syncMention(el.value, el.selectionStart ?? el.value.length);
                }}
                onClick={(e) => {
                  const el = e.currentTarget;
                  syncMention(el.value, el.selectionStart ?? el.value.length);
                }}
                onKeyDown={onTextareaKeyDown}
                rows={3}
                maxLength={LOCKER_MAX_CHARS}
                placeholder="Talk your shit… @someone to call them out"
                className="w-full bg-background border border-border rounded-lg px-3 pt-2 pb-7 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {/* Char count: bottom-right of chat box, above emoji row */}
              <span
                className={`pointer-events-none absolute bottom-2 right-2.5 text-[11px] font-semibold tabular-nums ${
                  remaining < 30 ? "text-warning" : "text-muted"
                }`}
                aria-live="polite"
              >
                {remaining}
                {cooldownLeft > 0 ? ` · ${cooldownLeft}s` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {LOCKER_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => insertEmoji(em)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-background border border-border hover:border-primary/50 hover:bg-primary/10 text-base leading-none touch-manipulation"
                  title="Add emoji to your message"
                >
                  {em}
                </button>
              ))}
              <button
                type="submit"
                disabled={!canPost}
                className="ml-auto min-h-[36px] px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-40 touch-manipulation"
              >
                {posting ? "Sending…" : "Post"}
              </button>
            </div>
            {mentionOpen ? (
              <p className="text-[10px] text-muted">↑↓ Enter to @tag</p>
            ) : null}
            {postError &&
              postError !== GUEST_LOCKER_POST_CODE &&
              postError !== GUEST_LOCKER_REACT_CODE && (
                <p className="text-xs text-danger">{postError}</p>
              )}
            {postError === GUEST_LOCKER_POST_CODE && (
              <GuestBlockInvitePanel invite={GUEST_LOCKER_POST_INVITE} />
            )}
          </form>
        )}
      </main>
      </div>
  );
}
