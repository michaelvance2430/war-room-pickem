"use client";

/**
 * Soft dual-sport / Crew mentality on Home — never a lecture.
 * Only shows when useful (multi-chapter or next sport available).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession, isActuallyCommissioner } from "@/lib/league";
import {
  crewIsDualSport,
  ensureCrewForLeague,
  EVENT_CREW,
  getCrewForLeague,
  isCrewStoryRevealed,
  nextLiveSportChapter,
  sportChapterLabel,
} from "@/lib/crew";
import { getSportPack } from "@/lib/sports/registry";

export default function HomeCrewWhisper() {
  const [line, setLine] = useState<string | null>(null);
  const [href, setHref] = useState("/crew");
  const [cta, setCta] = useState("Crew");

  function refresh() {
        const league = getLeague();
    const session = getSession();
    if (!league?.id) {
      setLine(null);
      return;
    }
    const { crew } = ensureCrewForLeague({
      leagueId: league.id,
      leagueName: league.name || "War Room",
      sportId: league.sportId,
      createdBy: session?.playerId,
      foundedAt: league.createdAt,
    });
    const revealed = isCrewStoryRevealed(league.id, session?.playerId);
    const dual = crewIsDualSport(crew.id);
    const next = nextLiveSportChapter(crew.id, league.sportId);
    const sport = sportChapterLabel(league.sportId || "cfb");

    if (dual) {
      setLine(
        `Your Crew runs CFB and NFL — same friends, two desks. Switch rooms anytime.`
      );
      setHref("/crew");
      setCta("Crew");
      return;
    }

    if (revealed && next) {
      const pack = getSportPack(next);
      setLine(
        `Chapter open for ${sport}. Same Crew can add ${pack.shortLabel} when you want — not a new group.`
      );
      setHref("/crew");
      setCta("Crew");
      return;
    }

    if (revealed) {
      setLine(
        `${crew.name} · story is live. Finish seasons, add sports — same people.`
      );
      setHref("/crew");
      setCta("Timeline");
      return;
    }

    // Pre-finale: almost nothing — one optional whisper for multi-sport hosts
    if (isActuallyCommissioner() && next) {
      const pack = getSportPack(next);
      setLine(
        `Playing ${sport} now. When the group wants ${pack.shortLabel}, keep the same people — sport pool under Commish.`
      );
      setHref("/commissioner");
      setCta("Commish");
      return;
    }

    setLine(null);
  }

  useEffect(() => {
    refresh();
    window.addEventListener(EVENT_CREW, refresh);
    return () => window.removeEventListener(EVENT_CREW, refresh);
  }, []);

  if (!line) return null;

  return (
    <section className="mb-4 rounded-xl border border-border/80 bg-card/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted leading-snug flex-1 min-w-[12rem]">
        {line}
      </p>
      <Link
        href={href}
        className="text-xs font-bold text-primary shrink-0"
      >
        {cta} →
      </Link>
    </section>
  );
}
