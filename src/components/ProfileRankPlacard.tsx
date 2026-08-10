"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/lib/types";
import { resolveCareerRank, type CareerRankProgress } from "@/lib/career-ranks";
import { listLeagueSeasonCounts } from "@/lib/league-seasons";
import { getSportsPlayed } from "@/lib/sports-played";

export default function ProfileRankPlacard({ player }: { player: Player }) {
  const [rank, setRank] = useState<CareerRankProgress>(() => resolveCareerRank({ achievementPoints: 0, seasons: 0, sports: 1 }));
  const [points, setPoints] = useState(0);
  const [seasons, setSeasons] = useState(0);
  const [sports, setSports] = useState(1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@/lib/badges").then(({ getAchievementPoints, withPermanentBadges }) => {
      if (cancelled) return;
      const achievementPoints = getAchievementPoints(withPermanentBadges(player));
      const completedSeasons = listLeagueSeasonCounts(player.id).reduce((sum, room) => sum + room.seasons, 0);
      const sportsPlayed = Math.max(1, getSportsPlayed(player.id).length);
      setPoints(achievementPoints);
      setSeasons(completedSeasons);
      setSports(sportsPlayed);
      setRank(resolveCareerRank({ achievementPoints, seasons: completedSeasons, sports: sportsPlayed }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [player]);

  const next = rank.next;
  const pointQualified = !next || points >= next.achievementPoints;
  const seasonQualified = !next || seasons >= next.seasons;
  const sportQualified = !next || sports >= next.sports;
  const status = !next ? "MAXIMUM RANK" : pointQualified && seasonQualified && sportQualified ? "PROMOTABLE" : !pointQualified ? "PROMOTION POINTS REQUIRED" : !seasonQualified ? "TIME IN SERVICE REQUIRED" : "MULTISPORT QUALIFICATION REQUIRED";

  return <div className="absolute right-5 top-5 z-10"><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="w-[132px] rounded-xl border border-amber-300/45 bg-[linear-gradient(145deg,rgba(120,53,15,.32),rgba(0,0,0,.72))] p-3 text-center shadow-[inset_0_0_24px_rgba(251,191,36,.08)]" aria-label={`Career rank ${rank.current.name}. Open promotion board.`}><p className="text-[8px] font-black uppercase tracking-[.2em] text-amber-300">Career Rank</p><p className="mt-1 text-2xl font-black leading-none text-amber-100">{rank.current.abbreviation}</p><p className="mt-1 text-[9px] font-bold leading-tight text-amber-200/75">{rank.current.name}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/70"><span className="block h-full rounded-full bg-amber-300" style={{ width: `${rank.progress * 100}%` }}/></div><p className="mt-1 text-[8px] font-bold text-white/45">{rank.next ? `${points} AP · ${rank.pointsToNext} to ${rank.next.abbreviation}` : `${points} AP · MAX RANK`}</p><p className="mt-2 text-[7px] font-black uppercase tracking-[.16em] text-amber-300/70">Promotion board ▾</p></button>{open && <section className="absolute right-0 top-[calc(100%+8px)] w-[min(310px,calc(100vw-40px))] rounded-2xl border-2 border-amber-300/50 bg-[#07110a] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,.75)]"><p className="text-[8px] font-black uppercase tracking-[.22em] text-amber-300">Promotion Board · Next Grade</p><div className="mt-2 flex items-end justify-between gap-3"><div><h3 className="text-xl font-black">{next?.abbreviation || rank.current.abbreviation}</h3><p className="text-[10px] font-bold text-white/55">{next?.name || rank.current.name}</p></div><span className={`rounded border px-2 py-1 text-[8px] font-black ${status === "PROMOTABLE" || status === "MAXIMUM RANK" ? "border-emerald-300/50 text-emerald-300" : "border-red-400/50 text-red-300"}`}>{status}</span></div><div className="mt-4 space-y-2"><Qualification label="Promotion points" value={`${points} / ${next?.achievementPoints ?? points} AP`} qualified={pointQualified}/><Qualification label="Time in service" value={`${seasons} / ${next?.seasons ?? seasons} seasons`} qualified={seasonQualified}/><Qualification label="Campaign breadth" value={`${sports} / ${next?.sports ?? sports} sports`} qualified={sportQualified}/></div><p className="mt-3 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/45">Points prove performance. Seasons prove staying power. Senior grades require service across multiple War Room sports.</p></section>}</div>;
}

function Qualification({ label, value, qualified }: { label: string; value: string; qualified: boolean }) {
  return <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${qualified ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/10 bg-black/25"}`}><div><p className="text-[8px] font-black uppercase tracking-[.14em] text-white/45">{label}</p><p className="mt-0.5 text-[10px] font-bold">{value}</p></div><span className={`text-[8px] font-black ${qualified ? "text-emerald-300" : "text-amber-300"}`}>{qualified ? "QUALIFIED" : "PENDING"}</span></div>;
}
