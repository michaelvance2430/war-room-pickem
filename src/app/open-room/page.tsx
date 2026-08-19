"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { seatPlayerInLeague } from "@/lib/open-room";
import {
  listLobbyLeaderboards,
  listLobbyRooms,
  requestPrivateRoomJoin,
  type LobbyCrewLeader,
  type LobbyPlayerLeader,
  type LobbyRoom,
} from "@/lib/lobby";

type RoomType = "public" | "private";
const REFRESH_MS = 15_000;

function PlayerBoard({ rows }: { rows: LobbyPlayerLeader[] }) {
  const top = rows.slice(0, 10);
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-lime-300/25 bg-[#03100c]/90 shadow-[0_24px_90px_rgba(0,0,0,.7),0_0_45px_rgba(74,222,128,.08)]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(132,204,22,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(132,204,22,.08)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime-300/15 blur-[70px]" />
      <header className="relative flex items-end justify-between gap-3 border-b border-lime-300/15 px-5 py-5 sm:px-7">
        <div><p className="text-[9px] font-black uppercase tracking-[.32em] text-lime-300">Live Cheevo voltage</p><h2 className="mt-1 text-xl font-black tracking-[-.03em] text-white sm:text-2xl">TOP 10 PLAYERS</h2></div>
        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 text-right"><p className="text-[8px] font-black uppercase tracking-[.18em] text-cyan-200">One player · one rank</p></div>
      </header>
      {top.length === 0 ? (
        <p className="relative px-5 py-10 text-center text-sm text-white/45">The board lights up as Cheevos land.</p>
      ) : (
        <div className="relative p-4 sm:p-6">
          <div className="grid grid-cols-3 items-end gap-2">
            {podium.map((player, index) => (
              <article key={player.gameHandle} className={`relative overflow-hidden rounded-2xl border px-2 py-4 text-center ${index === 0 ? "order-2 min-h-[150px] border-lime-300/50 bg-lime-300/[.12] shadow-[0_0_30px_rgba(163,230,53,.12)]" : index === 1 ? "order-1 min-h-[126px] border-cyan-200/25 bg-cyan-200/[.06]" : "order-3 min-h-[112px] border-amber-300/25 bg-amber-300/[.06]"}`}>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black ${index === 0 ? "border-lime-300/50 bg-lime-300 text-black" : "border-white/15 bg-white/[.06] text-white"}`}>{index + 1}</span>
                <p className="mt-3 flex min-h-[2.35rem] items-center justify-center break-words text-[11px] font-black leading-[1.05] text-white sm:text-sm">{player.gameHandle}</p>
                <p className="mt-3 text-xl font-black tabular-nums text-lime-300">{player.cheevoPoints}</p>
                <p className="text-[7px] font-black uppercase tracking-[.17em] text-white/35">Cheevo pts</p>
              </article>
            ))}
          </div>
          {rest.length > 0 && <div className="mt-3 overflow-hidden rounded-2xl border border-white/[.07] bg-black/30 divide-y divide-white/[.06]">
            {rest.map((player, index) => <div key={player.gameHandle} className="grid grid-cols-[30px_1fr_auto] items-center gap-3 px-4 py-3"><span className="text-xs font-black text-white/30">{index + 4}</span><p className="truncate text-sm font-black text-white">{player.gameHandle}</p><p className="text-sm font-black tabular-nums text-lime-300">{player.cheevoPoints} <span className="text-[7px] uppercase tracking-wider text-white/30">pts</span></p></div>)}
          </div>}
        </div>
      )}
    </section>
  );
}

function CrewBoard({ rows }: { rows: LobbyCrewLeader[] }) {
  const top = rows.slice(0, 5);
  const ceiling = Math.max(1, ...top.map((crew) => crew.cheevoPoints));
  return (
    <section className="overflow-hidden rounded-[26px] border border-cyan-300/15 bg-black/65 shadow-[0_22px_70px_rgba(0,0,0,.5)] backdrop-blur-md">
      <header className="flex items-end justify-between border-b border-white/[.07] px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">Crew power rankings</p><h2 className="mt-1 text-xl font-black text-white">TOP 5 CREWS</h2></div><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.8)]" /></header>
      <div className="p-4">
        {top.length === 0 ? <p className="py-6 text-center text-sm text-white/40">Crews hit this board together.</p> : <div className="space-y-3">{top.map((crew, index) => <div key={crew.crewName} className="grid grid-cols-[24px_1fr_auto] items-center gap-3"><span className={`text-sm font-black ${index === 0 ? "text-cyan-200" : "text-white/25"}`}>{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-black text-white">{crew.crewName}</p><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.45)]" style={{ width: `${Math.max(8, crew.cheevoPoints / ceiling * 100)}%` }} /></div></div><p className="text-sm font-black tabular-nums text-cyan-200">{crew.cheevoPoints}</p></div>)}</div>}
      </div>
    </section>
  );
}

function RoomDoor({ type, rooms, active, onClick }: { type: RoomType; rooms: LobbyRoom[]; active: boolean; onClick: () => void }) {
  const open = rooms.filter((room) => !room.isFull).length;
  const seats = rooms.reduce((total, room) => total + room.seatsLeft, 0);
  const isPublic = type === "public";
  return (
    <button type="button" aria-expanded={active} onClick={onClick} className={`group relative min-h-[154px] overflow-hidden rounded-[24px] border p-5 text-left transition active:scale-[.99] ${active ? isPublic ? "border-lime-300/70 bg-lime-300/[.12] shadow-[0_0_35px_rgba(163,230,53,.12)]" : "border-amber-300/60 bg-amber-300/[.1] shadow-[0_0_35px_rgba(252,211,77,.1)]" : "border-white/10 bg-black/55 hover:border-white/25"}`}>
      <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-[55px] ${isPublic ? "bg-lime-300/15" : "bg-amber-300/15"}`} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between"><div><p className={`text-[9px] font-black uppercase tracking-[.24em] ${isPublic ? "text-lime-300" : "text-amber-300"}`}>{isPublic ? "Instant access" : "Commissioner clearance"}</p><h3 className="mt-2 text-xl font-black uppercase text-white">{type} rooms</h3></div><span className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl ${active ? "rotate-90" : ""} ${isPublic ? "border-lime-300/30 text-lime-300" : "border-amber-300/30 text-amber-300"} transition`}>→</span></div>
        <div className="mt-5 flex gap-5 text-[10px] font-black uppercase tracking-wider text-white/35"><span><b className="mr-1 text-base text-white">{open}</b> open</span><span><b className="mr-1 text-base text-white">{seats}</b> seats</span></div>
      </div>
    </button>
  );
}

function RoomCard({ room, busy, onAction }: { room: LobbyRoom; busy: boolean; onAction: (room: LobbyRoom) => void }) {
  const fill = Math.min(100, Math.max(3, room.humanCount / room.maxHumanMembers * 100));
  const pending = room.requestStatus === "pending";
  const label = room.isMember ? "ENTER ROOM" : room.isFull ? "ROOM FULL" : pending ? "REQUEST SENT" : room.accessMode === "private" ? "REQUEST TO JOIN" : "JOIN ROOM";
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#050b09]/90 p-4 shadow-[0_14px_50px_rgba(0,0,0,.45)]">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${room.isFull ? "bg-red-400" : room.accessMode === "private" ? "bg-amber-300" : "animate-pulse bg-lime-300"}`} /><p className={`text-[9px] font-black uppercase tracking-[.2em] ${room.isFull ? "text-red-400" : room.accessMode === "private" ? "text-amber-300" : "text-lime-300"}`}>{room.isFull ? "At capacity" : room.accessMode}</p></div><h3 className="mt-2 truncate text-lg font-black text-white">{room.name}</h3><p className="mt-1 text-[10px] font-black uppercase tracking-[.14em] text-white/30">{room.sportId} War Room</p></div><div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-right"><p className="text-lg font-black tabular-nums">{room.humanCount}/{room.maxHumanMembers}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/30">players</p></div></div>
      <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[.07]"><div className={`h-full rounded-full ${room.isFull ? "bg-red-400" : room.accessMode === "private" ? "bg-amber-300" : "bg-lime-300"}`} style={{ width: `${fill}%` }} /></div><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Room capacity · {room.isFull ? "full" : `${room.seatsLeft} open`}</span></div>
      <button type="button" disabled={busy || (!room.isMember && (room.isFull || pending))} onClick={() => onAction(room)} className={`mt-4 min-h-[46px] w-full rounded-xl border text-[10px] font-black tracking-[.16em] ${room.isFull && !room.isMember ? "cursor-not-allowed border-red-400/20 bg-red-400/[.05] text-red-300/45" : pending ? "cursor-wait border-amber-300/25 bg-amber-300/[.08] text-amber-200" : room.accessMode === "private" ? "border-amber-300/35 bg-amber-300 text-black" : "border-lime-300/40 bg-lime-300 text-black shadow-[0_0_22px_rgba(163,230,53,.12)]"}`}>{busy ? "WORKING…" : label}</button>
    </article>
  );
}

export default function OpenRoomPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Player");
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [players, setPlayers] = useState<LobbyPlayerLeader[]>([]);
  const [crews, setCrews] = useState<LobbyCrewLeader[]>([]);
  const [selectedType, setSelectedType] = useState<RoomType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [roomResult, boardResult] = await Promise.all([listLobbyRooms(), listLobbyLeaderboards()]);
    setRooms(roomResult.rooms); setPlayers(boardResult.players); setCrews(boardResult.crews);
    setNotice(roomResult.error || boardResult.error || null); setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) { setNotice("The Muster is not configured yet."); setLoading(false); return; }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) { router.replace(`/login?next=${encodeURIComponent("/open-room")}`); return; }
      setUserId(user.id); setDisplayName(String(user.user_metadata?.display_name || "Player")); void refresh();
    });
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, router]);

  const publicRooms = useMemo(() => rooms.filter((room) => room.accessMode === "public"), [rooms]);
  const privateRooms = useMemo(() => rooms.filter((room) => room.accessMode === "private"), [rooms]);
  const selectedRooms = selectedType === "public" ? publicRooms : selectedType === "private" ? privateRooms : [];

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
    <main className="relative min-h-screen overflow-hidden bg-[#010604] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1050px] bg-[url('/lobby/muster-command-center.jpg')] bg-cover bg-top opacity-55" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(1,6,4,.18),rgba(1,6,4,.72)_520px,#010604_1050px)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(132,204,22,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(132,204,22,.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><BrandMark size={50} variant="force" className="rounded-xl shadow-[0_0_30px_rgba(163,230,53,.2)]" /><div><p className="text-[8px] font-black uppercase tracking-[.34em] text-lime-300">War Room Network</p><h1 className="mt-1 text-[1.7rem] font-black uppercase leading-none tracking-[-.04em]">THE MUSTER</h1></div></div><Link href="/" className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[9px] font-black tracking-[.16em] text-white/70 backdrop-blur-md">HOME</Link></header>

        <section className="pb-6 pt-10 text-center"><p className="text-[10px] font-black uppercase tracking-[.36em] text-lime-300">This is where rivalries begin</p><h2 className="mx-auto mt-3 max-w-2xl text-4xl font-black leading-[.92] tracking-[-.055em] sm:text-6xl">FIND YOUR CREW.<br /><span className="text-transparent [-webkit-text-stroke:1px_rgba(190,242,100,.8)]">MAKE YOUR NAME.</span></h2><p className="mx-auto mt-4 max-w-lg text-sm font-medium leading-relaxed text-white/55">See who owns the board. Find an open War Room. Claim your seat before somebody else does.</p></section>

        <div className="space-y-4"><PlayerBoard rows={players} /><CrewBoard rows={crews} /></div>

        <section className="mt-8">
          <div className="mb-4 text-center"><p className="text-[9px] font-black uppercase tracking-[.3em] text-lime-300">Choose your door</p><h2 className="mt-1 text-2xl font-black uppercase tracking-[-.03em]">FIND A WAR ROOM</h2><p className="mt-2 text-xs text-white/40">Join public competition now—or ask a private crew for clearance.</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><RoomDoor type="public" rooms={publicRooms} active={selectedType === "public"} onClick={() => setSelectedType(selectedType === "public" ? null : "public")} /><RoomDoor type="private" rooms={privateRooms} active={selectedType === "private"} onClick={() => setSelectedType(selectedType === "private" ? null : "private")} /></div>
          {selectedType && <div className="mt-4 rounded-[26px] border border-white/10 bg-black/45 p-3 backdrop-blur-md"><div className="mb-3 flex items-center justify-between px-2 py-1"><div><p className="text-[8px] font-black uppercase tracking-[.24em] text-white/35">Live room feed</p><h3 className="mt-1 text-lg font-black uppercase">{selectedType} rooms</h3></div><span className="text-[9px] font-black uppercase tracking-wider text-white/30">Refreshes live</span></div>
            {loading ? <div className="p-10 text-center text-sm text-white/40">Scanning the network…</div> : selectedRooms.length === 0 ? <div className="rounded-2xl border border-dashed border-lime-300/20 p-8 text-center"><p className="font-black">No {selectedType} rooms are broadcasting yet.</p><p className="mt-2 text-sm text-white/40">Be the first commissioner to light one up.</p><Link href="/join?mode=create" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-lime-300 px-5 text-xs font-black text-black">START A ROOM</Link></div> : <div className="grid gap-3 sm:grid-cols-2">{selectedRooms.map((room) => <RoomCard key={room.id} room={room} busy={busyId === room.id} onAction={(selected) => void act(selected)} />)}</div>}
          </div>}
          <Link href="/join?mode=join" className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/[.03] text-[10px] font-black uppercase tracking-[.18em] text-white/55">Already have an invite code?</Link>
        </section>

        {notice && <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{notice}</div>}
        <p className="mt-6 text-center text-[9px] font-bold leading-relaxed text-white/25">Leaderboards show current game handles and crew names only. Account emails never appear.</p>
      </div>
    </main>
  );
}
