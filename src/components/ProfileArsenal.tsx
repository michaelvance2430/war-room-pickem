"use client";

import { useEffect, useState } from "react";
import WarRoomArsenalIcon, { type ArsenalIconKind } from "@/components/WarRoomArsenalIcon";
import { EMPTY_WEAPON_SERVICE_SUMMARY, loadWeaponServiceSummary, type WeaponServiceSummary } from "@/lib/weapon-service-record";

export default function ProfileArsenal({ playerId }: { playerId: string }) {
  const [service, setService] = useState<WeaponServiceSummary>(EMPTY_WEAPON_SERVICE_SUMMARY);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void loadWeaponServiceSummary(playerId).then((summary) => { if (!cancelled) setService(summary); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);
  return <section className="mb-6 overflow-hidden rounded-2xl border-2 border-slate-500/50 bg-[radial-gradient(circle_at_top,#172033,#05070b_70%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,.35)]" aria-label="Profile Arsenal">
    <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.22em] text-amber-300">Profile Arsenal</p><h2 className="break-words text-xl font-black">WEAPONS SERVICE RECORD</h2><p className="mt-1 text-[9px] font-bold text-slate-400">{loading ? "Pulling permanent orders…" : `${service.total} career authorization${service.total === 1 ? "" : "s"} · ${service.campaigns} campaign${service.campaigns === 1 ? "" : "s"}`}</p></div><div className="shrink-0"><WarRoomArsenalIcon kind="maps" size={58}/></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><System kind="nuke" name="Tactical Nuke" count={service.tacticalNukes}/><System kind="dead_hand" name="Dead Hand" count={service.deadHands}/><System kind="jdam" name="JDAM" count={service.jdams}/><System kind="hellfire" name="Hellfire" count={service.hellfires}/></div>
    <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Rehearsal is temporary. Production becomes history.</p>
  </section>;
}

function System({ kind, name, count }: { kind: ArsenalIconKind; name: string; count: number }) {
  const active = count > 0;
  return <article className={`min-w-0 rounded-xl border p-2 text-center ${active ? "border-amber-300/55 bg-amber-300/10 shadow-[inset_0_0_22px_rgba(251,191,36,.08)]" : "border-slate-700 bg-black/35"}`}><div className="flex justify-center"><WarRoomArsenalIcon kind={kind} size={54}/></div><h3 className="mt-1 break-words text-[10px] font-black">{name}</h3><p className={`mt-1 break-words text-[8px] font-bold ${active ? "text-amber-200" : "text-slate-500"}`}>{active ? `${count} CAREER CALL${count === 1 ? "" : "S"}` : "NOT YET CALLED"}</p></article>;
}
