"use client";

/**
 * I’m Bored — temporary fun lobby.
 * Not Practice Mode. No picks. No scores. Just mess around.
 * Weekly league trash talk stays on /locker-room.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLeague, getSession } from "@/lib/league";
import {
  FUN_ROOMS,
  getFunRoom,
  loadFunLobbyMessages,
  pickRandomFunRoom,
  postFunLobbyMessage,
} from "@/lib/fun-lobby";
import { LOCKER_MAX_CHARS, type LockerMessage } from "@/lib/locker-room";

export default function BoredPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-muted">
          Opening lobby…
        </div>
      }
    >
      <BoredLobby />
    </Suspense>
  );
}

function BoredLobby() {
  const router = useRouter();
  const search = useSearchParams();
  const roomParam = search.get("room");
  const [roomId, setRoomId] = useState(() =>
    roomParam && FUN_ROOMS.some((r) => r.id === roomParam)
      ? roomParam
      : pickRandomFunRoom().id
  );
  const room = getFunRoom(roomId);
  const [messages, setMessages] = useState<LockerMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    const res = await loadFunLobbyMessages(roomId, 80);
    if (!res.ok) {
      setError(res.error || "Couldn’t load lobby");
      setMessages([]);
    } else {
      setError(null);
      setMessages(res.messages || []);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    const league = getLeague();
    setLeagueName(league?.name?.trim() || "");
    if (!getSession()?.playerId) {
      router.replace("/login");
      return;
    }
    // Kill any leftover Practice Mode state — product retired
    void import("@/lib/bored-practice").then((m) => {
      try {
        if (m.isBoredPracticeActive()) m.exitBoredPracticeToLive();
      } catch {
        /* ok */
      }
    });
    setLoading(true);
    void refresh();
    const t = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(t);
  }, [refresh, router, roomId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, roomId]);

  function switchRoom(id: string) {
    setRoomId(id);
    setLoading(true);
    router.replace(`/bored?room=${id}`);
  }

  async function onPost() {
    setPosting(true);
    setError(null);
    const res = await postFunLobbyMessage(roomId, body);
    if (!res.ok) {
      setError(res.error || "Post failed");
    } else {
      setBody("");
      if (res.message) {
        setMessages((prev) => [...prev, res.message!]);
      } else {
        void refresh();
      }
    }
    setPosting(false);
  }

  const remaining = LOCKER_MAX_CHARS - body.length;
  const canPost =
    body.trim().length > 0 &&
    body.length <= LOCKER_MAX_CHARS &&
    !posting;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        <div className="mb-4 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-1">
                I&apos;m Bored
              </p>
              <h1 className="text-2xl font-black text-foreground leading-tight">
                {room.emoji} {room.name}
              </h1>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                {room.blurb}
                {leagueName ? (
                  <>
                    {" "}
                    · same friends as{" "}
                    <span className="text-foreground/90">{leagueName}</span>
                  </>
                ) : null}
                . Not weekly trash talk.
              </p>
            </div>
            <Link
              href="/locker-room"
              className="shrink-0 text-xs font-bold text-primary min-h-[40px] px-2 py-2 hover:underline"
            >
              League chat →
            </Link>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FUN_ROOMS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => switchRoom(r.id)}
                className={`min-h-[36px] px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                  r.id === roomId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {r.emoji} {r.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger mb-3 shrink-0">
            {error}
          </div>
        )}

        <div
          ref={listRef}
          className="flex-1 min-h-[280px] max-h-[min(55vh,520px)] overflow-y-auto rounded-xl border border-dashed border-muted/40 bg-black/30 mb-4 px-3 py-3 space-y-3"
        >
          {loading && (
            <p className="text-sm text-muted text-center py-12">Loading lobby…</p>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted text-center py-12 leading-relaxed px-4">
              Empty room. Say something dumb. Nobody&apos;s keeping score.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-bold text-primary">{m.authorName}</span>
              <span className="text-muted text-[10px] ml-2">
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <p className="text-foreground/95 mt-0.5 leading-relaxed whitespace-pre-wrap">
                {m.body}
              </p>
            </div>
          ))}
        </div>

        <div className="shrink-0 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, LOCKER_MAX_CHARS))}
            rows={3}
            placeholder={`Post in ${room.name}…`}
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground resize-none min-h-[88px]"
          />
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-[11px] ${
                remaining < 20 ? "text-warning" : "text-muted"
              }`}
            >
              {remaining}
            </p>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => void onPost()}
              className="min-h-[48px] px-5 rounded-xl bg-primary text-black text-sm font-extrabold disabled:opacity-50"
            >
              {posting ? "Sending…" : "Send"}
            </button>
          </div>
          <Link
            href="/"
            className="block text-center text-xs font-semibold text-muted hover:text-foreground py-2"
          >
            Leave lobby → Home
          </Link>
        </div>
      </main>
    </div>
  );
}
