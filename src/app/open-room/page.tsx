"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { seatPlayerInLeague } from "@/lib/open-room";
import { listLobbyLeaderboards, listLobbyRooms, requestPrivateRoomJoin, type LobbyCrewLeader, type LobbyPlayerLeader, type LobbyRoom } from "@/lib/lobby";

type Filter = "all" | "public" | "private";
const REFRESH_MS = 15_000;

function RoomCard({ room, busy, onAction }: { room: LobbyRoom; busy: boolean; onAction: (room: LobbyRoom) => void }) {
  const fill = Math.min(100, Math.max(3, (room.humanCount / room.maxHumanMembers) * 100));
  const pending = room.requestStatus === "pending";
  const label = room.isMember ? "ENTER ROOM" : room.isFull ? "ROOM FULL" : pending ? "REQUEST SENT" : room.accessMode === "private" ? "REQUEST ACCESS" : "JOIN NOW";
  return (
    <article className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/55 p-4 shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(34,197,94,.13),transparent_35%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${room.isFull ? "bg-red-500" : room.accessMode === "private" ? "bg-amber-300" : "bg-emerald-400 animate-pulse"}`} /><p className={`text-[10px] font-black uppercase tracking-[.2em] ${room.isFull ? "text-red-400" : room.accessMode === "private" ? "text-amber-300" : "text-emerald-300"}`}>{room.isFull ? "FULL" : room.accessMode}</p></div>
            <h2 className="mt-2 truncate text-lg font-black text-white">{room.name}</h2>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/40">{room.sportId.toUpperCase()} WAR ROOM</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-right"><p className="text-lg font-black tabular-nums text-white">{room.humanCount}/{room.maxHumanMembers}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/40">players</p></div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wider"><span className="text-white/45">Room capacity</span><span className={room.isFull ? "text-red-400" : "text-emerald-300"}>{room.isFull ? "No openings" : `${room.seatsLeft} open`}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full shadow-[0_0_16px_currentColor] ${room.isFull ? "bg-red-500 text-red-500" : room.accessMode === "private" ? "bg-amber-300 text-amber-300" : "bg-emerald-400 text-emerald-400"}`} style={{ width: `${fill}%` }} /></div>
        </div>
        <button type="button" disabled={busy || (!room.isMember && (room.isFull || pending))} onClick={() => onAction(room)} className={`mt-5 min-h-[48px] w-full rounded-xl border text-xs font-black tracking-[.14em] ${room.isFull && !room.isMember ? "cursor-not-allowed border-red-500/20 bg-red-500/5 text-red-400/55" : pending ? "cursor-wait border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400 text-black shadow-[0_0_24px_rgba(34,197,94,.18)] active:scale-[.99]"}`}>{busy ? "WORKING…" : label}</button>
      </div>
    </article>
  );
}

function Leaderboard({ title, eyebrow, rows, kind }: { title: string; eyebrow: string; rows: LobbyPlayerLeader[] | LobbyCrewLeader[]; kind: "players" | "crews" }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/60">
      <header className="border-b border-emerald-400/15 bg-emerald-400/[.06] px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[.24em] text-emerald-400">{eyebrow}</p><h2 className="mt-1 text-base font-black text-white">{title}</h2></header>
      <div className="divide-y divide-white/[.06]">
        {rows.length === 0 ? <p className="px-4 py-6 text-center text-xs text-white/40">First names hit this board as Cheevos land.</p> : rows.map((entry, index) => {
          const player = kind === "players" ? entry as LobbyPlayerLeader : null;
          const crew = kind === "crews" ? entry as LobbyCrewLeader : null;
          return <div key={`${index}-${player?.gameHandle || crew?.crewName}`} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-4 py-3"><span className={`text-sm font-black ${index < 3 ? "text-emerald-300" : "text-white/30"}`}>{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-black text-white">{player?.gameHandle || crew?.crewName}</p>{player && <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/35">{player.leagueName}</p>}</div><div className="text-right"><p className="text-sm font-black tabular-nums text-emerald-300">{player?.cheevoPoints ?? crew?.cheevoPoints}</p><p className="text-[8px] font-bold uppercase tracking-wider text-white/30">Cheevo pts</p></div></div>;
        })}
      </div>
    </section>
  );
}

export default function OpenRoomPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Player");
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [players, setPlayers] = useState<LobbyPlayerLeader[]>([]);
  const [crews, setCrews] = useState<LobbyCrewLeader[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [roomResult, boardResult] = await Promise.all([listLobbyRooms(), listLobbyLeaderboards()]);
    setRooms(roomResult.rooms); setPlayers(boardResult.players); setCrews(boardResult.crews);
    setNotice(roomResult.error || boardResult.error || null); setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) { setNotice("The Lobby is not configured yet."); setLoading(false); return; }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) { router.replace(`/login?next=${encodeURIComponent("/open-room")}`); return; }
      setUserId(user.id); setDisplayName(String(user.user_metadata?.display_name || "Player")); void refresh();
    });
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, router]);

  const visibleRooms = useMemo(() => rooms.filter((room) => filter === "all" || room.accessMode === filter), [rooms, filter]);

  async function act(room: LobbyRoom) {
    if (!userId) return;
    if (room.isMember) { router.push("/"); return; }
    if (room.isFull) return;
    setBusyId(room.id); setNotice(null);
    if (room.accessMode === "private") {
      const result = await requestPrivateRoomJoin(room.id);
      setNotice(result.ok ? `Request sent to ${room.name}. The commissioner can approve you now.` : result.error);
      await refresh(); setBusyId(null); return;
    }
    const result = await seatPlayerInLeague({ leagueId: room.id, userId, displayName });
    if (!result.ok) { setNotice(result.error); await refresh(); setBusyId(null); return; }
    router.push("/"); router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020806] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(34,197,94,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[110px]" />
      <div className="relative mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><BrandMark size={54} variant="force" className="rounded-xl shadow-[0_0_30px_rgba(34,197,94,.2)]" /><div><p className="text-[9px] font-black uppercase tracking-[.28em] text-emerald-400">War Room Network</p><h1 className="text-2xl font-black tracking-tight">THE LOBBY</h1></div></div><Link href="/" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70">HOME</Link></header>
        <section className="mt-7 rounded-2xl border border-emerald-400/25 bg-[linear-gradient(135deg,rgba(34,197,94,.12),rgba(0,0,0,.65))] p-5 shadow-[0_0_70px_rgba(34,197,94,.07)]">
          <p className="text-[10px] font-black uppercase tracking-[.24em] text-emerald-300">Find your next crew</p><h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">Public rooms. Private grudges. One live command center.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">Join an open room immediately or request clearance from a private room commissioner. Full rooms stay on the board—but nobody can poke their way in.</p>
          <div className="mt-5 flex flex-wrap gap-2">{(["all", "public", "private"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-[40px] rounded-lg border px-4 text-[10px] font-black uppercase tracking-[.16em] ${filter === item ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/10 bg-black/25 text-white/55"}`}>{item}</button>)}<Link href="/join?mode=join" className="ml-auto flex min-h-[40px] items-center rounded-lg border border-white/10 px-4 text-[10px] font-black uppercase tracking-[.16em] text-white/60">Have a code?</Link></div>
        </section>
        {notice && <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{notice}</div>}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.9fr]">
          <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-400">Live room feed</p><h2 className="mt-1 text-xl font-black">AVAILABLE WAR ROOMS</h2></div><span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Refreshes live</span></div>
            {loading ? <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center text-sm text-white/40">Scanning the network…</div> : visibleRooms.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-400/25 bg-black/40 p-8 text-center"><p className="font-black">No rooms are broadcasting yet.</p><p className="mt-2 text-sm text-white/45">Be the first commissioner to light one up.</p><Link href="/join?mode=create" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-emerald-400 px-5 text-xs font-black text-black">START A ROOM</Link></div> : <div className="grid gap-3 sm:grid-cols-2">{visibleRooms.map((room) => <RoomCard key={room.id} room={room} busy={busyId === room.id} onAction={(selected) => void act(selected)} />)}</div>}
          </section>
          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start"><Leaderboard title="Top 10 Players" eyebrow="Individual signal" rows={players} kind="players" /><Leaderboard title="Top 10 Crews" eyebrow="Combined firepower" rows={crews} kind="crews" /><p className="px-2 text-center text-[10px] leading-relaxed text-white/30">Boards use current game handles and room/crew names. Account emails never appear.</p></aside>
        </div>
      </div>
    </main>
  );
}
