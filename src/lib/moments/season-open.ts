/**
 * Season Opening Moment — first official War Room Moment.
 *
 * Product goal: years from now players say "War Room is open."
 * Not: "The animation played."
 *
 * Law: Practice exists until football exists.
 * Do not optimize for visual spectacle. Optimize for emotional memory.
 */

import { getLeague, getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { isBoredPracticeActive, isBoredPracticeUrl } from "@/lib/bored-practice";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { isOnboardingActive } from "@/lib/onboarding/engine";
import { SEASON_DISPLAY_YEAR } from "@/lib/season-countdown";
import { hasSeenSeasonOpenWelcome, markSeasonOpenWelcomeSeen } from "@/lib/season-countdown";
import { isFoundryBackstageUser } from "@/lib/foundry-preview";
import { trackMoment } from "./analytics";
import {
  claimMoment,
  clearMomentClaim,
  isMomentClaimed,
} from "./claims";
import { seasonOpenMomentIdForSport } from "./registry";
import {
  EVENT_SEASON_OPEN_PREVIEW,
  type MomentClaimIdentity,
  type MomentSportId,
} from "./types";

export type SeasonOpenSpeech = {
  id: string;
  kicker: string;
  line: string;
};

/** CFB — Saturday / campus / rivalry energy (short; memory > spectacle) */
const CFB_SPEECHES: SeasonOpenSpeech[] = [
  {
    id: "cfb_gameday",
    kicker: "Saturday is back",
    line: "Campuses are loud. Rivalries are loaded. Your room is open.",
  },
  {
    id: "cfb_tailgate",
    kicker: "The season just walked in",
    line: "Tailgate energy. Fight-song nerves. Don’t ghost Week 0.",
  },
  {
    id: "cfb_doors",
    kicker: "Doors are open",
    line: "College football is here. The card is real. The excuses start now.",
  },
  {
    id: "cfb_august",
    kicker: "August finally means something",
    line: "The wait is over. Lock something. Chirp someone. Be in the room.",
  },
  {
    id: "cfb_padawan",
    kicker: "No more pretend",
    line: "Practice was the dress rehearsal. This is the season.",
  },
  {
    id: "cfb_room",
    kicker: "Your league is awake",
    line: "Same friends. New year. First bad pick of the season loading…",
  },
  {
    id: "cfb_tradition",
    kicker: "War Room is open",
    line: "Not a notification. A season. Act like it.",
  },
  {
    id: "cfb_quiet",
    kicker: "Football is finally back",
    line: "The calendar flipped. Your dignity has approximately three hours left.",
  },
];

/** NFL — prime time / lights / Opening Weekend */
const NFL_SPEECHES: SeasonOpenSpeech[] = [
  {
    id: "nfl_kickoff",
    kicker: "Kickoff is here",
    line: "Lights are on. Opening Weekend is real. Your card matters now.",
  },
  {
    id: "nfl_primetime",
    kicker: "Primetime is open",
    line: "National TV energy. Late windows. Don’t sleep on Thursday.",
  },
  {
    id: "nfl_stadium",
    kicker: "Stadium lights",
    line: "The league is live. The room is watching. Make a pick.",
  },
  {
    id: "nfl_opening",
    kicker: "Opening Weekend",
    line: "No more preseason noise. Real football. Real standings. Real chirps.",
  },
  {
    id: "nfl_doors",
    kicker: "Doors are open",
    line: "The NFL season just started in this room. Don’t ghost Week 1.",
  },
  {
    id: "nfl_tradition",
    kicker: "War Room is open",
    line: "Not a software update. A season with your people.",
  },
  {
    id: "nfl_quiet",
    kicker: "Football is finally back",
    line: "Prime time. Full pads. Your first lock of the year is waiting.",
  },
  {
    id: "nfl_no_pretend",
    kicker: "No more pretend",
    line: "Practice is done. The season is the tutorial now.",
  },
];

export const PRACTICE_OVER_LINES = {
  primary: "Practice is over.",
  secondary: "The season is here.",
} as const;

export function getSeasonKey(): string {
  return SEASON_DISPLAY_YEAR;
}

export function resolveSeasonOpenSport(
  sportId?: string | null
): MomentSportId {
  return sportId === "nfl" ? "nfl" : "cfb";
}

export function pickSeasonOpenSpeech(
  sport: MomentSportId,
  seed: string
): SeasonOpenSpeech {
  const bank = sport === "nfl" ? NFL_SPEECHES : CFB_SPEECHES;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return bank[h % bank.length]!;
}

export function buildSeasonOpenClaimIdentity(opts: {
  userId: string;
  leagueId: string;
  sportId: MomentSportId;
  seasonKey?: string;
}): MomentClaimIdentity {
  return {
    momentId: seasonOpenMomentIdForSport(opts.sportId),
    userId: opts.userId,
    leagueId: opts.leagueId,
    sportId: opts.sportId,
    seasonKey: opts.seasonKey || getSeasonKey(),
  };
}

export type SeasonOpenEligibility =
  | { ok: true; identity: MomentClaimIdentity; sport: MomentSportId }
  | { ok: false; reason: string };

/**
 * Production eligibility for Season Opening.
 * Preview bypasses claim + calendar via requestSeasonOpenPreview.
 */
export function evaluateSeasonOpenEligibility(
  opts?: { pathname?: string; nowMs?: number }
): SeasonOpenEligibility {
  if (typeof window === "undefined") {
    return { ok: false, reason: "ssr" };
  }
  if (isGuestMode()) {
    return { ok: false, reason: "guest" };
  }
  if (isBoredPracticeActive() || isBoredPracticeUrl(window.location.search)) {
    return { ok: false, reason: "practice" };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("@/lib/creator-eyes") as typeof import("@/lib/creator-eyes");
    if (eyes.isCreatorEyesActive()) {
      return { ok: false, reason: "creator_eyes" };
    }
  } catch {
    /* ok */
  }
  if (isOnboardingActive()) {
    return { ok: false, reason: "onboarding" };
  }

  const session = getSession();
  if (!session?.playerId || !session.leagueId) {
    return { ok: false, reason: "no_session" };
  }

  const league = getLeague();
  const sport = resolveSeasonOpenSport(league?.sportId);
  const now = opts?.nowMs ?? Date.now();

  // Official start of the sport's pick'em week — Practice dies here too.
  if (!hasOpeningWeekStarted(sport, now)) {
    return { ok: false, reason: "preseason" };
  }

  const path = opts?.pathname ?? window.location.pathname;
  // Land on Home — tradition opens the front door, not a deep link.
  if (path !== "/" && path !== "") {
    return { ok: false, reason: "not_home" };
  }

  const identity = buildSeasonOpenClaimIdentity({
    userId: session.playerId,
    leagueId: session.leagueId,
    sportId: sport,
  });

  // Legacy splash key — treat as already claimed (no double season-open)
  if (hasSeenSeasonOpenWelcome(session.leagueId)) {
    if (!isMomentClaimed(identity)) {
      claimMoment(identity, { speechId: "legacy_migrate" });
    }
    return { ok: false, reason: "legacy_seen" };
  }

  if (isMomentClaimed(identity)) {
    return { ok: false, reason: "claimed" };
  }

  return { ok: true, identity, sport };
}

export type SeasonOpenShowPayload = {
  preview: boolean;
  sport: MomentSportId;
  leagueName: string;
  speech: SeasonOpenSpeech;
  identity: MomentClaimIdentity | null;
  seasonKey: string;
};

/** Begin ceremony — claims (unless preview). */
export function beginSeasonOpenShow(opts?: {
  preview?: boolean;
}): SeasonOpenShowPayload | null {
  const preview = !!opts?.preview;
  const session = getSession();
  const league = getLeague();
  const sport = resolveSeasonOpenSport(league?.sportId);
  const leagueName = league?.name?.trim() || "the War Room";
  const seasonKey = getSeasonKey();

  if (preview) {
    if (!isFoundryBackstageUser(session?.playerId)) {
      trackMoment({
        momentId: seasonOpenMomentIdForSport(sport),
        event: "blocked",
        reason: "preview_not_creator",
      });
      return null;
    }
    const seed = `${session?.playerId || "mike"}:${Date.now()}`;
    const speech = pickSeasonOpenSpeech(sport, seed);
    trackMoment({
      momentId: seasonOpenMomentIdForSport(sport),
      event: "preview",
      sportId: sport,
      speechId: speech.id,
      preview: true,
    });
    return {
      preview: true,
      sport,
      leagueName,
      speech,
      identity: null,
      seasonKey,
    };
  }

  const elig = evaluateSeasonOpenEligibility();
  if (!elig.ok) {
    trackMoment({
      momentId: seasonOpenMomentIdForSport(sport),
      event: "blocked",
      sportId: sport,
      reason: elig.reason,
    });
    return null;
  }

  const speech = pickSeasonOpenSpeech(
    elig.sport,
    `${elig.identity.userId}:${elig.identity.leagueId}:${elig.identity.seasonKey}`
  );

  const owned = claimMoment(elig.identity, { speechId: speech.id });
  if (!owned) {
    trackMoment({
      momentId: elig.identity.momentId,
      event: "blocked",
      sportId: elig.sport,
      reason: "race_claimed",
    });
    return null;
  }

  // Keep legacy key in sync so old SeasonOpenWelcome never double-fires
  markSeasonOpenWelcomeSeen(elig.identity.leagueId);

  trackMoment({
    momentId: elig.identity.momentId,
    event: "claimed",
    sportId: elig.sport,
    speechId: speech.id,
  });

  return {
    preview: false,
    sport: elig.sport,
    leagueName,
    speech,
    identity: elig.identity,
    seasonKey,
  };
}

export function completeSeasonOpenShow(opts: {
  preview: boolean;
  momentId: string;
  sport: MomentSportId;
  speechId: string;
  skipped?: boolean;
}) {
  trackMoment({
    momentId: opts.momentId,
    event: opts.skipped ? "skipped" : "completed",
    sportId: opts.sport,
    speechId: opts.speechId,
    preview: opts.preview,
  });
}

export function requestSeasonOpenPreview(): void {
  if (typeof window === "undefined") return;
  if (!isFoundryBackstageUser()) return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_SEASON_OPEN_PREVIEW));
  } catch {
    /* ok */
  }
}

/** Foundry: reset local claim for current session league/sport/season */
export function resetSeasonOpenClaimForFoundry(): {
  ok: boolean;
  message: string;
} {
  const session = getSession();
  if (!session?.playerId || !session.leagueId) {
    return { ok: false, message: "No session" };
  }
  if (!isFoundryBackstageUser(session.playerId)) {
    return { ok: false, message: "Creator only" };
  }
  const sport = resolveSeasonOpenSport(getLeague()?.sportId);
  const identity = buildSeasonOpenClaimIdentity({
    userId: session.playerId,
    leagueId: session.leagueId,
    sportId: sport,
  });
  clearMomentClaim(identity);
  try {
    const { seasonOpenWelcomeStorageKey } = require("@/lib/season-countdown") as typeof import("@/lib/season-countdown");
    localStorage.removeItem(seasonOpenWelcomeStorageKey(session.leagueId));
  } catch {
    /* ok */
  }
  return { ok: true, message: "Season Opening claim cleared (local)" };
}

export { EVENT_SEASON_OPEN_PREVIEW };
