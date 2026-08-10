"use client";

import { useEffect, useState } from "react";
import WarRoomArsenalIcon, { type ArsenalIconKind } from "@/components/WarRoomArsenalIcon";

type ArsenalState = { nukes: number; deadHand: boolean; jdam: boolean; hellfire: boolean };
const EMPTY: ArsenalState = { nukes: 0, deadHand: false, jdam: false, hellfire: false };

function readArsenal(): ArsenalState {
  try {
    const walk = JSON.parse(localStorage.getItem("warroom-foundry-walkthrough-v1") || "null") as { tacticalNukeWeeks?: unknown[]; mapsEvent?: { protocol?: string } } | null;
    const cfb = JSON.parse(localStorage.getItem("warroom-foundry-cfb-act-three-v2") || "null") as { nuclear?: { active?: boolean } } | null;
    const nfl = JSON.parse(localStorage.getItem("warroom-foundry-nfl-maps-v1") || "null") as { original?: unknown } | null;
    return { nukes: new Set(Array.isArray(walk?.tacticalNukeWeeks) ? walk.tacticalNukeWeeks : []).size, deadHand: !!cfb?.nuclear?.active, jdam: !!nfl?.original, hellfire: walk?.mapsEvent?.protocol === "hellfire" };
  } catch { return EMPTY; }
}

export default function ProfileArsenal({ isSelf }: { isSelf: boolean }) {
  const [state, setState] = useState<ArsenalState>(EMPTY);
  useEffect(() => {
    if (!isSelf) return;
    const refresh = () => setState(readArsenal());
    refresh(); window.addEventListener("storage", refresh); window.addEventListener("warroom-foundry-walkthrough", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("warroom-foundry-walkthrough", refresh); };
  }, [isSelf]);
  return <section className="mb-6 overflow-hidden rounded-2xl border-2 border-slate-500/50 bg-[radial-gradient(circle_at_top,#172033,#05070b_70%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,.35)]" aria-label="Profile Arsenal">
    <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.22em] text-amber-300">Profile Arsenal</p><h2 className="break-words text-xl font-black">AUTHORIZED SYSTEMS</h2></div><div className="shrink-0"><WarRoomArsenalIcon kind="maps" size={58}/></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><System kind="nuke" name="Tactical Nuke" status={isSelf ? `${state.nukes} called · ${Math.max(0, 2 - state.nukes)}/2 ready` : "Service record classified"} active={state.nukes > 0}/><System kind="dead_hand" name="Dead Hand" status={state.deadHand ? "AUTHORIZED" : "Not yet called"} active={state.deadHand}/><System kind="jdam" name="JDAM" status={state.jdam ? "AUTHORIZED" : "Not yet called"} active={state.jdam}/><System kind="hellfire" name="Hellfire" status={state.hellfire ? "AUTHORIZED" : "Not yet called"} active={state.hellfire}/></div>
    <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">The rack is always visible. Authorization becomes part of the service record.</p>
  </section>;
}

function System({ kind, name, status, active }: { kind: ArsenalIconKind; name: string; status: string; active: boolean }) {
  return <article className={`min-w-0 rounded-xl border p-2 text-center ${active ? "border-amber-300/55 bg-amber-300/10" : "border-slate-700 bg-black/35"}`}><div className="flex justify-center"><WarRoomArsenalIcon kind={kind} size={54}/></div><h3 className="mt-1 break-words text-[10px] font-black">{name}</h3><p className={`mt-1 break-words text-[8px] font-bold ${active ? "text-amber-200" : "text-slate-500"}`}>{status}</p></article>;
}
