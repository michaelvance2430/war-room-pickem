"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import {
  loadLeagueRoster,
  removeLeagueMember,
  setMemberModeration,
  type LeagueRosterMember,
} from "@/lib/cloud";
import { getSession, isCommissioner, isStaff } from "@/lib/league";
import {
  loadLockerMessages,
  deleteLockerMessage,
  type LockerMessage,
} from "@/lib/locker-room";

/**
 * Troll control for commissioner + appointed moderators.
 * Mods: mute locker, delete posts, kick (same as remove).
 * Commissioner only: appoint/remove moderators.
 */
export default function ModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isCommish, setIsCommish] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [roster, setRoster] = useState<LeagueRosterMember[]>([]);
  const [messages, setMessages] = useState<LockerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    const [r, locker] = await Promise.all([
      loadLeagueRoster(),
      loadLockerMessages(40),
    ]);
    setRoster(r.filter((m) => !m.isBot));
    if (locker.ok) setMessages(locker.messages || []);
  }

  useEffect(() => {
    const session = getSession();
    setSelfId(session?.playerId || null);
    setIsCommish(isCommissioner());
    const staff = isStaff();
    setAllowed(staff);
    if (!staff) {
      setLoading(false);
      return;
    }
    reload().finally(() => setLoading(false));
  }, []);

  async function toggleMute(m: LeagueRosterMember) {
    if (m.role === "commissioner" || m.userId === selfId) return;
    const next = !m.lockerMuted;
    if (
      !confirm(
        next
          ? `Mute ${m.name} in Locker Room?\n\nThey can still make picks and view standings — just no posts.`
          : `Unmute ${m.name}?`
      )
    ) {
      return;
    }
    setBusyId(m.userId);
    setMsg(null);
    const res = await setMemberModeration({
      userId: m.userId,
      lockerMuted: next,
    });
    setBusyId(null);
    if (!res.ok) {
      setMsg(res.error || "Failed");
      return;
    }
    setMsg(next ? `Muted ${m.name}.` : `Unmuted ${m.name}.`);
    await reload();
  }

  async function toggleMod(m: LeagueRosterMember) {
    if (!isCommish || m.role === "commissioner" || m.userId === selfId) return;
    const next = !m.isModerator;
    if (
      !confirm(
        next
          ? `Make ${m.name} a moderator?\n\nThey can mute players and delete Locker posts. They cannot change league settings or pass commissioner.`
          : `Remove moderator from ${m.name}?`
      )
    ) {
      return;
    }
    setBusyId(m.userId);
    setMsg(null);
    const res = await setMemberModeration({
      userId: m.userId,
      isModerator: next,
    });
    setBusyId(null);
    if (!res.ok) {
      setMsg(res.error || "Failed");
      return;
    }
    setMsg(next ? `${m.name} is now a moderator.` : `${m.name} is no longer a mod.`);
    await reload();
  }

  async function kick(m: LeagueRosterMember) {
    if (m.role === "commissioner" || m.userId === selfId) return;
    if (
      !confirm(
        `Remove ${m.name} from the league?\n\nThey lose membership and picks for this league. They can rejoin with the code if a seat is open.`
      )
    ) {
      return;
    }
    setBusyId(m.userId);
    setMsg(null);
    const res = await removeLeagueMember(m.userId);
    setBusyId(null);
    if (!res.ok) {
      setMsg(res.error || "Failed to remove");
      return;
    }
    setMsg(`Removed ${m.name}.`);
    await reload();
  }

  async function nukePost(id: string, author: string) {
    if (!confirm(`Delete this post by ${author}?`)) return;
    setBusyId(id);
    const res = await deleteLockerMessage(id);
    setBusyId(null);
    if (!res.ok) {
      setMsg(res.error || "Could not delete");
      return;
    }
    setMsg("Post deleted.");
    await reload();
  }

  if (allowed === null || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center text-muted text-sm">
          Loading…
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center rounded-xl border border-border bg-card p-6">
            <h1 className="text-xl font-bold mb-2">Staff only</h1>
            <p className="text-sm text-muted">
              Only the commissioner or appointed moderators can open moderation
              tools.
            </p>
            <Link href="/" className="inline-block mt-4 text-sm text-primary">
              Home →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Moderation</h1>
          <p className="text-sm text-muted leading-relaxed">
            Troll control: mute Locker Room, delete posts, remove players.
            {isCommish
              ? " As commissioner you can also appoint moderators."
              : " You can mute and delete; only the commissioner appoints mods."}
          </p>
        </div>

        {msg && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {msg}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-1">Players</h2>
          <p className="text-xs text-muted mb-4">
            Mute = no Locker posts (picks still work). Kick = leave the league.
          </p>
          <ul className="divide-y divide-border">
            {roster.map((m) => {
              const isSelf = m.userId === selfId;
              const isComm = m.role === "commissioner";
              const busy = busyId === m.userId;
              return (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center gap-2 py-3"
                >
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.name}
                      {isComm && (
                        <span className="ml-1.5 text-[10px] text-primary">
                          Commish
                        </span>
                      )}
                      {m.isModerator && !isComm && (
                        <span className="ml-1.5 text-[10px] uppercase text-amber-300 border border-amber-400/40 px-1 rounded">
                          Mod
                        </span>
                      )}
                      {m.lockerMuted && (
                        <span className="ml-1.5 text-[10px] uppercase text-danger border border-danger/40 px-1 rounded">
                          Muted
                        </span>
                      )}
                      {isSelf && (
                        <span className="ml-1.5 text-[10px] text-muted">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted">{m.division}</div>
                  </div>
                  {!isComm && !isSelf && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleMute(m)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-card-hover disabled:opacity-50"
                      >
                        {m.lockerMuted ? "Unmute" : "Mute"}
                      </button>
                      {isCommish && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleMod(m)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-400/10 disabled:opacity-50"
                        >
                          {m.isModerator ? "Demote mod" : "Make mod"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void kick(m)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-danger/50 text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-1">Recent Locker posts</h2>
          <p className="text-xs text-muted mb-4">
            Delete anything that crosses the line. Full history on{" "}
            <Link href="/locker-room" className="text-primary hover:underline">
              Locker Room
            </Link>
            .
          </p>
          {messages.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((post) => (
                <li
                  key={post.id}
                  className="rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {post.authorName}
                      </p>
                      <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                        {post.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void nukePost(post.id, post.authorName)
                      }
                      className="shrink-0 text-[10px] text-danger hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-muted mt-6 leading-relaxed">
          Setup once: run{" "}
          <code className="text-foreground">supabase/moderation.sql</code> in
          Supabase if mute/mod buttons error.
        </p>
      </main>
    </div>
  );
}
