"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";
import { CAREER_RANKS, resolveCareerRank, type CareerRankProgress } from "@/lib/career-ranks";
import { getRecordedCareerRankId, recordCareerRankFloor } from "@/lib/career-rank-promotions";
import { getLocalEquippedBadgeId } from "@/lib/equipped-title-store";
import { listLeagueSeasonCounts } from "@/lib/league-seasons";
import { getSportsPlayed } from "@/lib/sports-played";
import { loadWeaponServiceSummary } from "@/lib/weapon-service-record";

export default function ProfileRankPlacard({ player }: { player: Player }) {
  const [rank, setRank] = useState<CareerRankProgress>(() => resolveCareerRank({ achievementPoints: 0, seasons: 0, sports: 1 }));
  const [points, setPoints] = useState(0);
  const [seasons, setSeasons] = useState(0);
  const [sports, setSports] = useState(1);
  const [tacticalNukes, setTacticalNukes] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([import("@/lib/badges"), loadWeaponServiceSummary(player.id)]).then(([{ getAchievementPoints, withPermanentBadges }, service]) => {
      if (cancelled) return;
      const achievementPoints = getAchievementPoints(withPermanentBadges(player));
      const completedSeasons = listLeagueSeasonCounts(player.id).reduce((sum, room) => sum + room.seasons, 0);
      const sportsPlayed = Math.max(1, getSportsPlayed(player.id).length);
      const nukeCount = service.tacticalNukes;
      setPoints(achievementPoints);
      setSeasons(completedSeasons);
      setSports(sportsPlayed);
      setTacticalNukes(nukeCount);
      const recordedRankId = getRecordedCareerRankId(player.id);
      const equippedRankId = getLocalEquippedBadgeId(player.id)?.startsWith("rank_") ? getLocalEquippedBadgeId(player.id) : null;
      const minimumRankId = [recordedRankId, equippedRankId]
        .filter((id): id is string => !!id)
        .sort((a, b) => CAREER_RANKS.findIndex((rank) => rank.id === b) - CAREER_RANKS.findIndex((rank) => rank.id === a))[0] || null;
      const resolved = resolveCareerRank({ achievementPoints, seasons: completedSeasons, sports: sportsPlayed, tacticalNukes: nukeCount, minimumRankId });
      recordCareerRankFloor(player.id, resolved.current.id);
      setRank(resolved);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [player]);

  const next = rank.next;
  const pointQualified = !next || points >= next.achievementPoints;
  const seasonQualified = !next || seasons >= next.seasons;
  const sportQualified = !next || sports >= next.sports;
  const nukeQualified = !next || tacticalNukes >= next.tacticalNukes;
  const status = !next ? "MAXIMUM RANK"
    : pointQualified && seasonQualified && sportQualified && nukeQualified ? "PROMOTABLE"
      : !pointQualified ? "PROMOTION POINTS REQUIRED"
        : !seasonQualified ? "TIME IN SERVICE REQUIRED"
          : !sportQualified ? "MULTISPORT QUALIFICATION REQUIRED"
            : "NUCLEAR QUALIFICATION REQUIRED";

  return <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="w-[118px] overflow-hidden rounded-xl border border-amber-300/45 bg-[linear-gradient(145deg,rgba(120,53,15,.32),rgba(0,0,0,.72))] p-3 text-center shadow-[inset_0_0_24px_rgba(251,191,36,.08)] sm:w-[132px]" aria-label={`Career rank ${rank.current.name}. Open promotion board.`}>
      <p className="text-[8px] font-black uppercase tracking-[.2em] text-amber-300">Career Rank</p>
      <p className="mt-1 break-words text-2xl font-black leading-none text-amber-100">{rank.current.abbreviation}</p>
      <p className="mt-1 break-words text-[9px] font-bold leading-tight text-amber-200/75">{rank.current.name}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/70"><span className="block h-full rounded-full bg-amber-300" style={{ width: `${rank.progress * 100}%` }}/></div>
      <p className="mt-1 break-words text-[8px] font-bold text-white/45">{rank.next ? `${points} AP · ${rank.pointsToNext} to ${rank.next.abbreviation}` : `${points} AP · MAX RANK`}</p>
      <p className="mt-2 text-[7px] font-black uppercase tracking-[.16em] text-amber-300/70">Promotion board ▾</p>
    </button>
    {open && <section className="absolute right-0 top-[calc(100%+8px)] w-[min(310px,calc(100vw-24px))] overflow-hidden rounded-2xl border-2 border-amber-300/50 bg-[#07110a] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,.75)]">
      <p className="text-[8px] font-black uppercase tracking-[.22em] text-amber-300">Promotion Board · Next Grade</p>
      <div className="mt-2 flex min-w-0 items-end justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-xl font-black">{next?.abbreviation || rank.current.abbreviation}</h3><p className="break-words text-[10px] font-bold text-white/55">{next?.name || rank.current.name}</p></div><span className={`max-w-[132px] shrink-0 break-words rounded border px-2 py-1 text-center text-[8px] font-black ${status === "PROMOTABLE" || status === "MAXIMUM RANK" ? "border-emerald-300/50 text-emerald-300" : "border-red-400/50 text-red-300"}`}>{status}</span></div>
      <div className="mt-4 space-y-2"><Qualification label="Promotion points" value={`${points} / ${next?.achievementPoints ?? points} AP`} qualified={pointQualified}/><Qualification label="Time in service" value={`${seasons} / ${next?.seasons ?? seasons} seasons`} qualified={seasonQualified}/><Qualification label="Campaign breadth" value={`${sports} / ${next?.sports ?? sports} sports`} qualified={sportQualified}/>{next?.tacticalNukes ? <Qualification label="Nuclear qualification" value={`${tacticalNukes} / ${next.tacticalNukes} Tactical Nuke called`} qualified={nukeQualified}/> : null}</div>
      <p className="mt-3 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/45">Points prove performance. Seasons prove staying power. Senior grades require service across multiple War Room sports. Colonel requires documented nuclear judgment.</p>
      <Link href="/career-progression" onClick={() => setOpen(false)} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-amber-300 px-4 text-sm font-black text-black"><span>Career Progression</span><span aria-hidden>→</span></Link>
    </section>}
  </div>;
}

function Qualification({ label, value, qualified }: { label: string; value: string; qualified: boolean }) {
  return <div className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 ${qualified ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/10 bg-black/25"}`}><div className="min-w-0"><p className="break-words text-[8px] font-black uppercase tracking-[.14em] text-white/45">{label}</p><p className="mt-0.5 break-words text-[10px] font-bold">{value}</p></div><span className={`shrink-0 text-[8px] font-black ${qualified ? "text-emerald-300" : "text-amber-300"}`}>{qualified ? "QUALIFIED" : "PENDING"}</span></div>;
}
