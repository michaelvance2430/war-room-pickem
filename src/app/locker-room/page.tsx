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

const LOCKER_GIF_PREFIX = "WR_GIF|";

function normalizeLockerGif(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "giphy.com" || host === "www.giphy.com") {
      const id = url.pathname.split("-").pop()?.replace(/[^a-zA-Z0-9]/g, "");
      return id ? `https://media.giphy.com/media/${id}/giphy.gif` : null;
    }
    const trusted =
      host === "media.giphy.com" ||
      host === "i.giphy.com" ||
      host === "media.tenor.com" ||
      host === "c.tenor.com";
    return trusted ? url.toString() : null;
  } catch {
    return null;
  }
}

function lockerGifUrl(body: string): string | null {
  if (!body.startsWith(LOCKER_GIF_PREFIX)) return null;
  return normalizeLockerGif(body.slice(LOCKER_GIF_PREFIX.length));
}

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
  const [roster, setRoster] = useState<MentionMember[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  /** Which message has the + emoji picker open */
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [reactBusyId, setReactBusyId] = useState<string | null>(null);
  const [reactError, setReactError] = useState<string | null>(null);
  const [composerTray, setComposerTray] = useState<"emoji" | "gif" | null>(null);
  const [gifInput, setGifInput] = useState("");
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
    setComposerTray(null);
  }

  function attachGif() {
    const url = normalizeLockerGif(gifInput);
    if (!url) {
      setPostError("Paste a GIPHY or Tenor GIF link.");
      return;
    }
    setBody(`${LOCKER_GIF_PREFIX}${url}`);
    setGifInput("");
    setComposerTray(null);
    setPostError(null);
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
  const attachedGif = lockerGifUrl(body);
  const canPost =
    !muted &&
    body.trim().length > 0 &&
    body.length <= LOCKER_MAX_CHARS &&
    !posting &&
    cooldownLeft === 0;
  const isCfbSkin = (getLeague()?.sportId || "cfb") === "cfb";

  return (
    <div className={`min-h-screen flex flex-col ${isCfbSkin ? "cfb-locker-page" : ""}`}>
      <main className="cfb-locker-main flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        <div className="cfb-locker-header mb-4 shrink-0">
          <div className="cfb-locker-nameplate">
            <span>Home Locker</span>
            <h1>Locker Room</h1>
            <strong>{leagueName || "War Room"}</strong>
          </div>
          <p className="text-sm text-muted">
            This week&apos;s trash talk
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
          className="cfb-locker-thread flex-1 min-h-[280px] max-h-[min(55vh,520px)] overflow-y-auto rounded-xl border border-border bg-card mb-4"
        >
          {loading && (
            <p className="text-sm text-muted text-center py-12">Loading…</p>
          )}
          {!loading && messages.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <div className="text-3xl mb-2" aria-hidden>
                🏈
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
              const gifUrl = lockerGifUrl(m.body);
              const parts = gifUrl ? [] : splitMentions(m.body, roster);
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
                    className={`locker-message-card relative mt-1 border px-3 pt-2.5 pb-2 ${
                      mine
                        ? "is-mine border-primary/30 bg-primary/10"
                        : "border-border bg-background/60"
                    }`}
                  >
                    {gifUrl ? (
                      <div className="locker-gif-frame">
                        {/* Trusted GIPHY/Tenor media only; remote dimensions are unknown. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gifUrl} alt="GIF shared in the locker room" loading="lazy" />
                      </div>
                    ) : (
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
                    )}

                    {/* Bottom of bubble: stamps L→R, then + */}
                    <div className="mt-2 flex flex-wrap items-center justify-start gap-1 min-h-[28px]">
                      {rx.map((r) => (
                        <button
                          key={`${m.id}-stamp-${r.emoji}`}
                          type="button"
                          disabled={!!muted || reactBusyId === m.id}
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

                      {!muted && (
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
            className="cfb-locker-composer shrink-0 rounded-xl border border-border bg-card p-3 space-y-2 relative"
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
              {attachedGif ? (
                <div className="locker-gif-draft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachedGif} alt="GIF ready to send" />
                  <button
                    type="button"
                    onClick={() => setBody("")}
                    aria-label="Remove GIF"
                  >
                    ×
                  </button>
                  <span>GIF ready</span>
                </div>
              ) : (
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
                rows={2}
                maxLength={LOCKER_MAX_CHARS}
                placeholder="Talk your shit… @someone to call them out"
                className="w-full bg-background border border-border rounded-lg px-3 pt-2 pb-7 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              )}
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
            {composerTray && (
              <div className="locker-gear-tray">
                <div className="locker-gear-tabs" role="tablist" aria-label="Message extras">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composerTray === "emoji"}
                    onClick={() => setComposerTray("emoji")}
                  >
                    Emoji
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composerTray === "gif"}
                    onClick={() => setComposerTray("gif")}
                  >
                    GIF
                  </button>
                </div>
                {composerTray === "emoji" ? (
                  <div className="locker-emoji-grid">
                    {LOCKER_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertEmoji(em)}
                        title="Add emoji"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="locker-gif-tool">
                    <input
                      value={gifInput}
                      onChange={(e) => setGifInput(e.target.value)}
                      placeholder="Paste GIPHY or Tenor link"
                      inputMode="url"
                    />
                    <button type="button" onClick={attachGif}>Attach</button>
                    <p>Find a GIF in GIPHY or Tenor, copy its link, then paste it here.</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerTray((cur) => (cur ? null : "emoji"))}
                className={`locker-plus-button ${composerTray ? "is-open" : ""}`}
                aria-label="Add emoji or GIF"
                aria-expanded={!!composerTray}
              >
                +
              </button>
              <span className="text-xs text-muted">Message the room</span>
              <button
                type="submit"
                disabled={!canPost}
                className="ml-auto min-h-[42px] px-5 py-2 rounded-lg bg-primary text-black text-sm font-bold disabled:opacity-40 touch-manipulation"
              >
                {posting ? "Sending…" : "Send"}
              </button>
            </div>
            {mentionOpen ? (
              <p className="text-[10px] text-muted">↑↓ Enter to @tag</p>
            ) : null}
            {postError ? (
              <p className="text-xs text-danger">{postError}</p>
            ) : null}
          </form>
        )}
      </main>
      </div>
  );
}
