/**
 * Ring Ceremony — living-history foundation for every sport pack.
 * Real opening window for the room; commissioner preview is personal only.
 */

import { weekWindowMs, firstSeasonWeek } from "@/lib/season-calendar";
import { getLeague } from "@/lib/league";

export const EVENT_RING_CEREMONY_PREVIEW = "warroom-ring-ceremony-preview";
export const RING_CEREMONY_SEEN_KEY = "warroom-ring-ceremony-seen-v4";
/** Commish personal: opt into auto-preview this browser only (never league-wide) */
export const RING_CEREMONY_COMMISH_PREVIEW_OPT =
  "warroom-ring-ceremony-commish-preview-opt";
/** Once per tab session when preview opt is on */
export const RING_CEREMONY_SESSION_PREVIEW =
  "warroom-ring-ceremony-session-preview-v1";

export type RingCeremonySport = "cfb" | "nfl" | "soccer_wwc" | "other";

export type RingCeremonyPack = {
  sport: RingCeremonySport;
  /** Top stamp */
  stamp: string;
  /** Main title under stamp */
  title: string;
  /** One-line stage energy */
  stageLine: string;
  /** Defending champ kicker */
  champKicker: string;
  /** Body under champ name */
  ringLease: string;
  /** Blurry stage figure caption (never a real-person photo) */
  stageFigureLabel: string;
  /** Hardware name on the prop */
  hardwareName: string;
  /** CTA primary */
  ctaHardware: string;
  /** CTA dismiss */
  ctaEnter: string;
  /** Confetti palette */
  confetti: string[];
  /** Accent for borders / glow */
  accent: string;
  accentSoft: string;
  /** Stage floor gradient */
  stageGradient: string;
  /** Trophy / ring emoji cluster */
  heroGlyph: string;
  /** Preview banner text */
  previewNote: string;
};

export function resolveRingSport(sportId?: string | null): RingCeremonySport {
  if (sportId === "nfl") return "nfl";
  if (sportId === "soccer_wwc") return "soccer_wwc";
  if (sportId === "cfb" || !sportId) return "cfb";
  return "other";
}

/** Sport-specific ceremony voice + palette — not a generic trophy pop. */
export function getRingCeremonyPack(
  sportId?: string | null
): RingCeremonyPack {
  const sport = resolveRingSport(sportId);

  if (sport === "nfl") {
    return {
      sport,
      stamp: "Opening night · Super Bowl energy",
      title: "The ring ceremony",
      stageLine:
        "Lights. Confetti. A blurry league-office silhouette at the mic. This is how Sundays begin.",
      champKicker: "Defending War Room champion",
      ringLease:
        "One-year lease. The late window is open. The silver stays with them until someone takes it on the field.",
      stageFigureLabel: "League office · stage mic",
      hardwareName: "Championship ring",
      ctaHardware: "View championship hardware",
      ctaEnter: "Hit the locker room",
      confetti: ["#C1121F", "#C5CCD3", "#F8FAFC", "#fbbf24", "#0B1426"],
      accent: "#C1121F",
      accentSoft: "rgba(193, 18, 31, 0.2)",
      stageGradient:
        "linear-gradient(180deg, #0B1426 0%, #151d2e 45%, #1a1020 100%)",
      heroGlyph: "💍🏈",
      previewNote:
        "Preview · you only (commissioner). League does not see this test.",
    };
  }

  if (sport === "soccer_wwc") {
    return {
      sport,
      stamp: "World Cup Extra · opening matchday",
      title: "The ceremony",
      stageLine:
        "Emerald heat. Gold confetti. Passport-stamp energy. The room opens with hardware.",
      champKicker: "Defending champion of the room",
      ringLease:
        "The cup energy stays with them until a new name is engraved. Short tournament. Long memory.",
      stageFigureLabel: "Pitch-side podium",
      hardwareName: "Room championship",
      ctaHardware: "Open the trophy case",
      ctaEnter: "Enter the clubhouse",
      confetti: ["#009C3B", "#FFDF00", "#002776", "#FFFFFF", "#34d399"],
      accent: "#FFDF00",
      accentSoft: "rgba(255, 223, 0, 0.18)",
      stageGradient:
        "linear-gradient(180deg, #002776 0%, #041a12 50%, #009C3B33 100%)",
      heroGlyph: "🏆💍",
      previewNote:
        "Preview · you only (commissioner). Not a league-wide launch.",
    };
  }

  // CFB / default — campus opening day
  return {
    sport: sport === "other" ? "other" : "cfb",
    stamp: "Opening day · campus night",
    title: "The ring ceremony",
    stageLine:
      "Night lights. Student-section volume. The defending champ walks the paper-bag red carpet.",
    champKicker: "Defending national champ of this room",
    ringLease:
      "Week 0 / openers energy. The ring is theirs until someone takes it — Saturdays will decide.",
    stageFigureLabel: "Campus stage · band energy",
    hardwareName: "Championship ring",
    ctaHardware: "View championship banner",
    ctaEnter: "Enter the War Room",
    confetti: ["#22c55e", "#fbbf24", "#f4f0e6", "#991b1b", "#a3e635"],
    accent: "#fbbf24",
    accentSoft: "rgba(251, 191, 36, 0.18)",
    stageGradient:
      "linear-gradient(180deg, #050805 0%, #0a1a0c 50%, #1a1208 100%)",
    heroGlyph: "💍🏆",
    previewNote:
      "Preview · you only (commissioner). Real ceremony still waits for opening week.",
  };
}

/**
 * Real ceremony window — sport calendar, not "any login".
 * CFB: Week 0 start → end of Week 1.
 * NFL: Week 1 start → end of Week 2.
 * WWC / other: first season week window + next.
 */
export function isOpeningCeremonyLive(
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  const sport = resolveRingSport(sportId ?? getLeague()?.sportId);
  if (sport === "nfl") {
    const w1 = weekWindowMs(1, "nfl");
    if (!w1 || nowMs < w1.startMs) return false;
    const w2 = weekWindowMs(2, "nfl");
    const endMs = w2?.endMs ?? w1.endMs;
    return nowMs <= endMs;
  }
  // CFB + default: Week 0 → Week 1
  const w0 = weekWindowMs(0, "cfb");
  if (!w0) return false;
  if (nowMs < w0.startMs) return false;
  const w1 = weekWindowMs(1, "cfb");
  const endMs = w1?.endMs ?? w0.endMs;
  return nowMs <= endMs;
}

/** Active league week still in opening stretch */
export function isOpeningActiveWeek(
  activeWeek: number,
  sportId?: string | null
): boolean {
  const sport = resolveRingSport(sportId);
  if (sport === "nfl") return activeWeek === 1 || activeWeek === 2;
  if (sport === "soccer_wwc") {
    const first = firstSeasonWeek(sportId);
    return activeWeek === first || activeWeek === first + 1;
  }
  return activeWeek === 0 || activeWeek === 1;
}

/** @deprecated use isOpeningCeremonyLive — kept for SeasonFinaleModal */
export function isOpeningWeekLive(nowMs = Date.now()): boolean {
  return isOpeningCeremonyLive(getLeague()?.sportId, nowMs);
}

export function ringCeremonySeenKey(
  leagueId: string,
  playerId: string,
  champYear: number
): string {
  return `${RING_CEREMONY_SEEN_KEY}:${leagueId}:${playerId}:${champYear}`;
}

export function getCommishPreviewOpt(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(RING_CEREMONY_COMMISH_PREVIEW_OPT) === "1";
  } catch {
    return false;
  }
}

export function setCommishPreviewOpt(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(RING_CEREMONY_COMMISH_PREVIEW_OPT, "1");
    else localStorage.removeItem(RING_CEREMONY_COMMISH_PREVIEW_OPT);
  } catch {
    /* ignore */
  }
}

/** Fire personal preview (commish UI). */
export function requestRingCeremonyPreview(opts?: { force?: boolean }) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_RING_CEREMONY_PREVIEW, {
        detail: { force: !!opts?.force },
      })
    );
  } catch {
    /* ignore */
  }
}
