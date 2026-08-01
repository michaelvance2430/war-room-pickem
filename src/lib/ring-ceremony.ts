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
  /** Top stamp — short, human */
  stamp: string;
  /** Main title under stamp */
  title: string;
  /** One-line stage energy — talk like a friend in the group chat */
  stageLine: string;
  /** Defending champ kicker */
  champKicker: string;
  /** Body under champ name — flex energy, not corporate */
  ringLease: string;
  /** When the viewer IS the defending champ */
  youWonLine: string;
  /** When someone else won — roast-adjacent respect */
  theyWonLine: string;
  /** Blurry stage figure caption (never a real-person photo) */
  stageFigureLabel: string;
  /** Hardware name on the prop */
  hardwareName: string;
  /** CTA primary — trophy room */
  ctaHardware: string;
  /** Share CTA */
  ctaShare: string;
  /** CTA dismiss */
  ctaEnter: string;
  /** Confetti palette */
  confetti: string[];
  /** Accent for borders / glow */
  accent: string;
  accentSoft: string;
  /** Stage floor gradient */
  stageGradient: string;
  /** @deprecated emoji fallback — UI uses SportChampionshipTrophy */
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

/** Sport-specific ceremony voice + palette — friend-group energy, not a press release. */
export function getRingCeremonyPack(
  sportId?: string | null,
  opts?: { threePeat?: boolean }
): RingCeremonyPack {
  const sport = resolveRingSport(sportId);
  const threePeat = !!opts?.threePeat;

  if (sport === "nfl") {
    return {
      sport,
      stamp: threePeat ? "Opening night · dynasty" : "Opening night",
      title: threePeat ? "Still their house" : "Last year's champ walks first",
      stageLine: threePeat
        ? "Three years in a row. The trophy is basically renting a locker with their name on it."
        : "Lights up. Phones out. This is the flex that starts every Sunday season.",
      champKicker: threePeat
        ? "Three-peat champ — still wearing it"
        : "Defending champion",
      ringLease: threePeat
        ? "Nobody's taking this without a knife fight on the card. Until then? It's theirs. Loudly."
        : "They own the hardware until someone rips it off them. Late windows. No mercy. Take a picture.",
      youWonLine:
        "That's YOU on the hardware. Screenshot this. Text the group chat. Make them mad before kickoff.",
      theyWonLine:
        "This is the person everyone's hunting. Bow once, then try to steal it all year.",
      stageFigureLabel: "Stage lights · big moment",
      hardwareName: threePeat
        ? "Dynasty championship trophy"
        : "Championship trophy",
      ctaHardware: "See the trophy room",
      ctaShare: "Share this flex",
      ctaEnter: "Alright, let's play",
      confetti: threePeat
        ? ["#fbbf24", "#C1121F", "#F8FAFC", "#f59e0b", "#C5CCD3", "#0B1426"]
        : ["#C1121F", "#C5CCD3", "#F8FAFC", "#fbbf24", "#0B1426"],
      accent: threePeat ? "#fbbf24" : "#C1121F",
      accentSoft: threePeat
        ? "rgba(251, 191, 36, 0.22)"
        : "rgba(193, 18, 31, 0.2)",
      stageGradient:
        "linear-gradient(180deg, #0B1426 0%, #151d2e 45%, #1a1020 100%)",
      heroGlyph: "🏈",
      previewNote: "Preview only — your roommates don't see this test.",
    };
  }

  if (sport === "soccer_wwc") {
    return {
      sport,
      stamp: "Opening matchday",
      title: "Last champ gets the walk-out",
      stageLine:
        "Gold confetti. Big cup energy. This is how the room remembers who finished on top.",
      champKicker: "Defending champion",
      ringLease:
        "Their name's on the hardware. Short tournament. Long bragging rights. Steal it or watch them celebrate again.",
      youWonLine:
        "That's your name on the cup. Share it. Frame it. Let the group chat cope.",
      theyWonLine:
        "That's the target on their back. Respect the hardware — then try to take it.",
      stageFigureLabel: "Pitch lights · ceremony",
      hardwareName: "Championship cup",
      ctaHardware: "Open the trophy case",
      ctaShare: "Share this flex",
      ctaEnter: "Let's go",
      confetti: ["#009C3B", "#FFDF00", "#002776", "#FFFFFF", "#34d399"],
      accent: "#FFDF00",
      accentSoft: "rgba(255, 223, 0, 0.18)",
      stageGradient:
        "linear-gradient(180deg, #002776 0%, #041a12 50%, #009C3B33 100%)",
      heroGlyph: "🏆",
      previewNote: "Preview only — not a league-wide drop.",
    };
  }

  // CFB / default
  return {
    sport: sport === "other" ? "other" : "cfb",
    stamp: threePeat ? "Opening day · dynasty" : "Opening day",
    title: threePeat ? "Three-peat. Still their crystal." : "Raise the crystal",
    stageLine: threePeat
      ? "Three straight titles. The band's tired of playing their walk-up song. Everyone else is tired of hearing it."
      : "Night game energy. Whole room watching. This is the moment before someone tries to knock them off.",
    champKicker: threePeat
      ? "Three-peat national champ of this room"
      : "Defending national champ",
    ringLease: threePeat
      ? "They're not giving that crystal back politely. Saturdays decide. Until then — make 'em eat it."
      : "That's the big hardware. Theirs until the board says otherwise. Screenshot. Roast. Repeat.",
    youWonLine:
      "That's YOUR crystal. Share it before someone pretends they never saw it.",
    theyWonLine:
      "Remember the face. All year long, you're trying to take that crystal home.",
    stageFigureLabel: "Campus night · big stage",
    hardwareName: threePeat
      ? "Dynasty national championship crystal"
      : "National championship crystal",
    ctaHardware: "See the trophy room",
    ctaShare: "Share this flex",
    ctaEnter: "Let's go Saturdays",
    confetti: threePeat
      ? ["#fbbf24", "#22c55e", "#f4f0e6", "#f59e0b", "#991b1b", "#a3e635"]
      : ["#22c55e", "#fbbf24", "#f4f0e6", "#991b1b", "#a3e635"],
    accent: "#fbbf24",
    accentSoft: "rgba(251, 191, 36, 0.18)",
    stageGradient:
      "linear-gradient(180deg, #050805 0%, #0a1a0c 50%, #1a1208 100%)",
    heroGlyph: "🏆",
    previewNote: "Preview only — real night still waits for opening week.",
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
