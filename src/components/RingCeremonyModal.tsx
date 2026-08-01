"use client";

/**
 * Ring Ceremony — sport-specific opening ritual.
 * Real launch: opening week only, once per player · champ year.
 * Preview: commissioner only, never forces the whole league.
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
  type RingCeremonyPack,
} from "@/lib/ring-ceremony";

export { isOpeningWeekLive, isOpeningCeremonyLive };

type Champ = {
  year: number;
  name: string;
  userId: string | null;
};

function ConfettiField({ colors }: { colors: string[] }) {
  const bits = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 3) % 100}%`,
      delay: `${(i % 12) * 0.12}s`,
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
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

/** Stylized blurry stage figure — not a real-person likeness. */
function StageFigure({
  pack,
  label,
}: {
  pack: RingCeremonyPack;
  label: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[200px] h-28 flex items-end justify-center">
      {/* Spotlights */}
      <div
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-40 h-24 opacity-40"
        style={{
          background: `radial-gradient(ellipse at center, ${pack.accent}66 0%, transparent 70%)`,
        }}
      />
      {/* Podium */}
      <div
        className="absolute bottom-0 w-28 h-6 rounded-sm border border-white/10"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
      {/* Blurry suited silhouette */}
      <div className="relative z-[1] mb-4 flex flex-col items-center">
        <div
          className="w-14 h-14 rounded-full border border-white/20"
          style={{
            background:
              "linear-gradient(160deg, #4a5568 0%, #1a202c 55%, #0f1419 100%)",
            filter: "blur(2.5px)",
            boxShadow: `0 0 24px ${pack.accentSoft}`,
          }}
        />
        <div
          className="w-16 h-12 -mt-1 rounded-t-lg border border-white/10"
          style={{
            background:
              "linear-gradient(180deg, #2d3748 0%, #1a202c 100%)",
            filter: "blur(3px)",
          }}
        />
        {/* Mic stand */}
        <div className="absolute bottom-2 left-1/2 w-0.5 h-10 bg-white/30 -translate-x-1/2" />
        <div className="absolute bottom-11 left-1/2 w-3 h-3 rounded-full bg-white/40 -translate-x-1/2 blur-[1px]" />
      </div>
      <p className="absolute -bottom-5 left-0 right-0 text-center text-[9px] uppercase tracking-[0.14em] text-white/50 font-bold">
        {label}
      </p>
    </div>
  );
}

export default function RingCeremonyModal() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [champ, setChamp] = useState<Champ | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);

  const pack = useMemo(() => getRingCeremonyPack(sportId), [sportId]);

  const openWith = useCallback(
    (c: Champ, lgName: string, sid: string | null | undefined, isPrev: boolean) => {
      setChamp(c);
      setLeagueName(lgName);
      setSportId(sid || null);
      setPreview(isPrev);
      setOpen(true);
    },
    []
  );

  const tryRealCeremony = useCallback(async () => {
    const league = getLeague();
    const session = getSession();
    if (!session?.playerId || !league?.id) return false;

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

    const key = ringCeremonySeenKey(league.id, session.playerId, d.year);
    if (localStorage.getItem(key) === "1") return false;

    openWith(d, league.name || "War Room", sid, false);
    return true;
  }, [openWith]);

  const tryCommishPreview = useCallback(
    async (force: boolean) => {
      if (!isActuallyCommissioner()) return false;
      const league = getLeague();
      const session = getSession();
      if (!session?.playerId || !league?.id) return false;

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
      const champ: Champ = d || {
        year: new Date().getFullYear() - 1,
        name: "Last Season's Champ",
        userId: null,
      };

      try {
        sessionStorage.setItem(RING_CEREMONY_SESSION_PREVIEW, "1");
      } catch {
        /* ignore */
      }

      openWith(champ, league.name || "War Room", sid, true);
      return true;
    },
    [openWith]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // Real ceremony first (all members when window is live)
        const real = await tryRealCeremony();
        if (cancelled || real) return;

        // Commish opt-in preview — personal only
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
      const session = getSession();
      if (!preview && league?.id && session?.playerId && champ) {
        localStorage.setItem(
          ringCeremonySeenKey(league.id, session.playerId, champ.year),
          "1"
        );
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open || !champ) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-ceremony-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 shadow-2xl"
        style={{
          borderColor: `${pack.accent}88`,
          background: pack.stageGradient,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ConfettiField colors={pack.confetti} />

        {/* Stage lights bar */}
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${pack.accent}, ${pack.confetti[1] || pack.accent}, transparent)`,
          }}
        />

        <div className="relative z-[2] p-5 sm:p-6 space-y-4 text-white">
          {preview && (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-center text-amber-200/90 bg-amber-500/15 border border-amber-400/30 rounded-lg px-2 py-1.5">
              {pack.previewNote}
            </p>
          )}

          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-center"
            style={{ color: pack.accent }}
          >
            {pack.stamp}
          </p>

          <div className="text-center pt-1">
            <div className="text-4xl sm:text-5xl mb-1" aria-hidden>
              {pack.heroGlyph}
            </div>
            <h2
              id="ring-ceremony-title"
              className="text-2xl font-black tracking-tight"
            >
              {pack.title}
            </h2>
            <p className="text-sm text-white/60 mt-1">{leagueName}</p>
            <p className="text-xs text-white/50 mt-2 leading-relaxed max-w-sm mx-auto">
              {pack.stageLine}
            </p>
          </div>

          <StageFigure pack={pack} label={pack.stageFigureLabel} />

          <div
            className="rounded-xl border px-4 py-4 text-center mt-6"
            style={{
              borderColor: `${pack.accent}66`,
              background: pack.accentSoft,
            }}
          >
            <p className="text-[10px] uppercase tracking-wider text-white/55 font-bold">
              {pack.champKicker} · {champ.year}
            </p>
            {champ.userId ? (
              <Link
                href={`/profile/${champ.userId}`}
                className="text-2xl font-black block mt-1 hover:underline"
                style={{ color: pack.accent }}
                onClick={dismiss}
              >
                {champ.name}
              </Link>
            ) : (
              <p
                className="text-2xl font-black mt-1"
                style={{ color: pack.accent }}
              >
                {champ.name}
              </p>
            )}
            <p className="text-xs text-white/65 mt-2 leading-relaxed">
              {pack.ringLease}
            </p>
            <p className="text-[10px] text-white/40 mt-2 uppercase tracking-wide">
              {pack.hardwareName}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
