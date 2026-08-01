"use client";

/**
 * Ring Ceremony — sport-specific opening flex.
 * Real launch: opening week only, once per player · champ year.
 * Preview: commissioner only, never forces the whole league.
 *
 * Huge moment: real trophy art, human copy, share the hardware.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getLeague, getSession, isActuallyCommissioner } from "@/lib/league";
import {
  loadLeagueActiveWeek,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { loadLeagueTrophies } from "@/lib/trophies";
import { getDefendingChampion } from "@/lib/player-history";
import {
  EVENT_RING_CEREMONY_PREVIEW,
  getCommishPreviewOpt,
  getRingCeremonyPack,
  isOpeningActiveWeek,
  isOpeningCeremonyLive,
  isOpeningWeekLive,
  ringCeremonySeenKey,
  RING_CEREMONY_SESSION_PREVIEW,
} from "@/lib/ring-ceremony";
import {
  consecutiveChampionshipStreak,
  hasThreePeat,
  noteChampionshipYears,
} from "@/lib/easter-eggs";
import SportChampionshipTrophy, {
  trophyHardwareLabel,
} from "@/components/SportChampionshipTrophy";
import TrophyShareButton from "@/components/TrophyShareButton";

export { isOpeningWeekLive, isOpeningCeremonyLive };

type Champ = {
  year: number;
  name: string;
  userId: string | null;
};

function ConfettiField({ colors }: { colors: string[] }) {
  const bits = useMemo(() => {
    return Array.from({ length: 56 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 3) % 100}%`,
      delay: `${(i % 12) * 0.1}s`,
      duration: `${2.4 + (i % 5) * 0.35}s`,
      size: 6 + (i % 5) * 2,
      color: colors[i % colors.length],
      rot: (i * 47) % 360,
    }));
  }, [colors]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      aria-hidden
    >
      {bits.map((b) => (
        <span
          key={b.id}
          className="ring-confetti-bit absolute top-[-12%]"
          style={{
            left: b.left,
            width: b.size,
            height: b.size * (0.6 + (b.id % 3) * 0.2),
            background: b.color,
            animationDelay: b.delay,
            animationDuration: b.duration,
            transform: `rotate(${b.rot}deg)`,
            borderRadius: b.id % 3 === 0 ? "50%" : "2px",
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

export default function RingCeremonyModal() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [champ, setChamp] = useState<Champ | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);
  const [threePeat, setThreePeat] = useState(false);

  const pack = useMemo(
    () => getRingCeremonyPack(sportId, { threePeat }),
    [sportId, threePeat]
  );

  const session = typeof window !== "undefined" ? getSession() : null;
  const isYou =
    !!champ &&
    !!session?.playerId &&
    ((champ.userId && champ.userId === session.playerId) ||
      (!!session.playerName &&
        session.playerName.toLowerCase().trim() ===
          champ.name.toLowerCase().trim()));

  const openWith = useCallback(
    (
      c: Champ,
      lgName: string,
      sid: string | null | undefined,
      isPrev: boolean,
      isThreePeat = false
    ) => {
      setChamp(c);
      setLeagueName(lgName);
      setSportId(sid || null);
      setPreview(isPrev);
      setThreePeat(isThreePeat);
      setOpen(true);
    },
    []
  );

  const tryRealCeremony = useCallback(async () => {
    const league = getLeague();
    const sess = getSession();
    if (!sess?.playerId || !league?.id) return false;

    const sid = league.sportId || "cfb";
    if (!isOpeningCeremonyLive(sid)) return false;

    const activeWeek = await loadLeagueActiveWeek();
    if (!isOpeningActiveWeek(activeWeek, sid)) return false;

    try {
      const scored = await listScoredWeekNumbers();
      const cut = sid === "nfl" ? 3 : 2;
      if (scored.some((w) => w >= cut)) return false;
    } catch {
      /* ignore */
    }

    const trophies = await loadLeagueTrophies();
    const d = getDefendingChampion(trophies);
    if (!d) return false;

    const key = ringCeremonySeenKey(league.id, sess.playerId, d.year);
    if (localStorage.getItem(key) === "1") return false;

    let isThree = false;
    try {
      const champYears = trophies
        .filter(
          (t) =>
            t.trophyType === "championship" &&
            ((d.userId && t.winnerUserId === d.userId) ||
              t.winnerName === d.name)
        )
        .map((t) => t.seasonYear);
      isThree = consecutiveChampionshipStreak(champYears) >= 3;
      if (d.userId) {
        noteChampionshipYears(d.userId, champYears);
        if (hasThreePeat(d.userId)) isThree = true;
      }
    } catch {
      /* ok */
    }

    openWith(d, league.name || "War Room", sid, false, isThree);
    return true;
  }, [openWith]);

  const tryCommishPreview = useCallback(
    async (force: boolean) => {
      if (!isActuallyCommissioner()) return false;
      const league = getLeague();
      const sess = getSession();
      if (!sess?.playerId || !league?.id) return false;

      if (!force && !getCommishPreviewOpt()) return false;

      if (!force) {
        try {
          if (sessionStorage.getItem(RING_CEREMONY_SESSION_PREVIEW) === "1") {
            return false;
          }
        } catch {
          /* ignore */
        }
      }

      const sid = league.sportId || "cfb";
      const trophies = await loadLeagueTrophies();
      const d = getDefendingChampion(trophies);
      const champRow: Champ = d || {
        year: new Date().getFullYear() - 1,
        name: "Last Season's Champ",
        userId: null,
      };

      try {
        sessionStorage.setItem(RING_CEREMONY_SESSION_PREVIEW, "1");
      } catch {
        /* ignore */
      }

      let isThree = false;
      if (d) {
        const champYears = trophies
          .filter(
            (t) =>
              t.trophyType === "championship" &&
              ((d.userId && t.winnerUserId === d.userId) ||
                t.winnerName === d.name)
          )
          .map((t) => t.seasonYear);
        isThree = consecutiveChampionshipStreak(champYears) >= 3;
      }

      openWith(champRow, league.name || "War Room", sid, true, isThree);
      return true;
    },
    [openWith]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const real = await tryRealCeremony();
        if (cancelled || real) return;
        await tryCommishPreview(false);
      } catch {
        /* ignore */
      }
    }

    const t = setTimeout(() => {
      if (!cancelled) void boot();
    }, 750);

    function onPreview(e: Event) {
      const ce = e as CustomEvent<{ force?: boolean }>;
      void tryCommishPreview(!!ce.detail?.force);
    }
    window.addEventListener(EVENT_RING_CEREMONY_PREVIEW, onPreview);

    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener(EVENT_RING_CEREMONY_PREVIEW, onPreview);
    };
  }, [tryRealCeremony, tryCommishPreview]);

  function dismiss() {
    try {
      const league = getLeague();
      const sess = getSession();
      if (!preview && league?.id && sess?.playerId && champ) {
        localStorage.setItem(
          ringCeremonySeenKey(league.id, sess.playerId, champ.year),
          "1"
        );
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open || !champ) return null;

  const flexLine = isYou ? pack.youWonLine : pack.theyWonLine;
  const hardware = trophyHardwareLabel(sportId, threePeat);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/88 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-ceremony-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 shadow-2xl"
        style={{
          borderColor: `${pack.accent}99`,
          background: pack.stageGradient,
          boxShadow: `0 0 80px ${pack.accentSoft}, 0 25px 50px rgba(0,0,0,0.55)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ConfettiField colors={pack.confetti} />

        {/* Stage lights */}
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${pack.accent}, ${pack.confetti[1] || pack.accent}, transparent)`,
          }}
        />

        <div className="relative z-[2] p-5 sm:p-6 space-y-3 text-white">
          {preview && (
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-center text-amber-200/90 bg-amber-500/15 border border-amber-400/30 rounded-lg px-2 py-1.5">
              {pack.previewNote}
            </p>
          )}

          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em] text-center"
            style={{ color: pack.accent }}
          >
            {pack.stamp}
          </p>

          {/* THE HARDWARE */}
          <div className="flex flex-col items-center pt-1 pb-1">
            <SportChampionshipTrophy
              sport={sportId}
              size={168}
              threePeat={threePeat}
              animate
            />
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold mt-1">
              {hardware}
            </p>
          </div>

          <div className="text-center">
            <h2
              id="ring-ceremony-title"
              className="text-2xl sm:text-[1.65rem] font-black tracking-tight leading-tight"
            >
              {pack.title}
            </h2>
            <p className="text-sm text-white/55 mt-1 font-medium">{leagueName}</p>
            <p className="text-[13px] text-white/70 mt-2.5 leading-relaxed max-w-sm mx-auto">
              {pack.stageLine}
            </p>
          </div>

          {/* Champ plaque — the flex */}
          <div
            className="rounded-2xl border-2 px-4 py-5 text-center relative overflow-hidden"
            style={{
              borderColor: `${pack.accent}88`,
              background: `linear-gradient(165deg, ${pack.accentSoft}, rgba(0,0,0,0.35))`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${pack.accent}55, transparent 60%)`,
              }}
            />
            <p className="relative text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">
              {pack.champKicker} · {champ.year}
            </p>
            {champ.userId ? (
              <Link
                href={`/profile/${champ.userId}`}
                className="relative text-3xl sm:text-4xl font-black block mt-1.5 hover:underline leading-none"
                style={{ color: pack.accent }}
                onClick={dismiss}
              >
                {champ.name}
              </Link>
            ) : (
              <p
                className="relative text-3xl sm:text-4xl font-black mt-1.5 leading-none"
                style={{ color: pack.accent }}
              >
                {champ.name}
              </p>
            )}
            {isYou && (
              <p
                className="relative mt-2 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                style={{
                  color: pack.accent,
                  borderColor: `${pack.accent}66`,
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                That&apos;s you
              </p>
            )}
            <p className="relative text-[13px] text-white/80 mt-3 leading-relaxed font-medium">
              {flexLine}
            </p>
            <p className="relative text-xs text-white/55 mt-2 leading-relaxed">
              {pack.ringLease}
            </p>
          </div>

          {/* Share is the moment */}
          <div className="rounded-xl border border-white/15 bg-black/25 px-3 py-3 space-y-2">
            <p className="text-[11px] text-center text-white/60 leading-snug">
              {isYou
                ? "Drop this in the group chat before anyone pretends they never saw it."
                : "Send it. Tag them. Start the season loud."}
            </p>
            <div className="flex justify-center">
              <TrophyShareButton
                trophy={{
                  kind: "championship",
                  seasonYear: champ.year,
                  winnerName: champ.name,
                  leagueName,
                  subtitle: pack.champKicker,
                  sportId: sportId || undefined,
                }}
                label={pack.ctaShare}
                className="!bg-white !text-black !border-0 !font-extrabold min-h-[48px] px-6 w-full sm:w-auto justify-center"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Link
              href="/trophy-room"
              onClick={dismiss}
              className="w-full py-3.5 rounded-xl font-bold text-center min-h-[52px] flex items-center justify-center text-black"
              style={{ background: pack.accent }}
            >
              {pack.ctaHardware}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl border border-white/20 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 min-h-[48px]"
            >
              {pack.ctaEnter}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
