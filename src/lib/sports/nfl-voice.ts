/**
 * NFL / pro football voice — distinct heartbeat from CFB.
 * Primetime, red zone, scripts, late windows, Sunday night energy.
 * Dual-sport players should never hear campus jokes recycled on Sunday.
 * Same sass rules: witty, never bigoted.
 */

import type { Player } from "@/lib/types";

type HN = (name: string, pts: number) => string;
type DK = (pts: number) => string;

/** Gazette A1 crowns — Sunday film room energy, not campus chaos */
export const NFL_CROWN_HEADLINES: HN[] = [
  (n, pts) => `${n.toUpperCase()} OWNS THE LATE WINDOW — ${pts}`,
  (n, pts) => `PRIMETIME BELONGS TO ${n.toUpperCase()} (${pts} PTS)`,
  (n, pts) => `${n.toUpperCase()} SCRIPTED THE BOARD FOR ${pts}`,
  (n, pts) => `RED ZONE CLINIC: ${n.toUpperCase()} STACKS ${pts}`,
  (n, pts) => `${n.toUpperCase()} MADE SUNDAY LOOK EASY — ${pts}`,
  (n, pts) => `FILM DON'T LIE: ${n.toUpperCase()} AT ${pts}`,
  (n, pts) => `${n.toUpperCase()} COVERED LIKE THEY HAD THE CALL SHEET — ${pts}`,
  (n, pts) => `NATIONAL TV ENERGY: ${n.toUpperCase()} DROPS ${pts}`,
  (n, pts) => `${n.toUpperCase()} HIT EVERY WINDOW — TOTAL ${pts}`,
  (n, pts) => `BEST BET AND BEYOND: ${n.toUpperCase()} CASHS ${pts}`,
  (n, pts) => `${n.toUpperCase()} LEFT THE LEAGUE IN TWO-MINUTE DRILL (${pts})`,
  (n, pts) => `SUNDAY CROWN: ${n.toUpperCase()} WITH A CRISP ${pts}`,
  (n, pts) => `${n.toUpperCase()} TREATED SPREADS LIKE BLOCKING SCHEMES — ${pts}`,
  (n, pts) => `LIGHTS · CAMERA · ${n.toUpperCase()} · ${pts} PTS`,
  (n, pts) => `${n.toUpperCase()} IS UNDEFEATED AT RUINING YOUR SLATE (${pts})`,
  (n, pts) => `PLAYOFF AURA IN WEEK CLOTHES: ${n.toUpperCase()} — ${pts}`,
  (n, pts) => `${n.toUpperCase()} JUST DROPPED A PRIMETIME MASTERCLASS (${pts})`,
  (n, pts) => `THE BOARD SALUTES ${n.toUpperCase()} — ${pts} ON THE CARD`,
  // WTF / surreal desk
  (n, pts) =>
    `LOCAL MAN DISCOVERS SPREADS ARE FAKE; ${n.toUpperCase()} POSTS ${pts} ANYWAY`,
  (n, pts) =>
    `NFL FINES ${n.toUpperCase()} FOR EXCESSIVE DOMINANCE (${pts} PTS) — APPEAL PENDING`,
];

export const NFL_CROWN_DECKS: DK[] = [
  (pts) =>
    `${pts} on Sunday. Not a fluke — a problem for the rest of the room.`,
  (pts) =>
    `A ${pts}-point clinic. Everyone else is still in the red zone of excuses.`,
  (pts) => `${pts}. The standings just got a primetime special.`,
  (pts) =>
    `Late window cooked. ${pts} is the box score the group chat deserved.`,
  (pts) => `${pts} points. Fade them next week at your own peril.`,
  (pts) =>
    `Confidence looked like a script. ${pts} was the final score of the argument.`,
  (pts) => `${pts}. Championship path just underlined a name in crimson.`,
  (pts) => `Somebody check the replay. ${pts} still stands.`,
  (pts) => `${pts} and zero apologies. Film session is going to be loud.`,
  (pts) => `Best Bet sang. The rest of the card harmonized. ${pts}.`,
  (pts) =>
    `${pts} pts — the kind of Sunday that makes rivalries personal.`,
  (pts) =>
    `Toilet Bowl scouts looked away. ${pts} is the wrong end of the film.`,
  (pts) =>
    `${pts}. Scientists at the league office have opened a small, worried folder.`,
  (pts) =>
    `Broadcast cut to commercial mid-celebration. Still ${pts}. Math is undefeated.`,
];

export const NFL_SHAME_HEADLINES: HN[] = [
  (n, pts) => `${n.toUpperCase()} THREE-AND-OUT ALL CARD — ${pts}`,
  (n, pts) => `PICK-SIX ENERGY: ${n.toUpperCase()} AT ${pts}`,
  (n, pts) => `${n.toUpperCase()} GOT SCRIPTED INTO A ${pts}`,
  (n, pts) => `FALSE START, WHOLE SLATE: ${n.toUpperCase()} (${pts})`,
  (n, pts) => `${n.toUpperCase()} LEFT IT IN THE RED ZONE — TOTAL ${pts}`,
  (n, pts) => `BLOWN COVERAGE: ${n.toUpperCase()} POSTS ${pts}`,
  (n, pts) => `${n.toUpperCase()} TURNOVER ON DOWNS (${pts} PTS)`,
  (n, pts) => `DELAY OF GAME: ${n.toUpperCase()} STILL AT ${pts}`,
  (n, pts) =>
    `${n.toUpperCase()} GOT OUT-SCHEMED BY A SPREADSHEET — ${pts}`,
  (n, pts) =>
    `INTENTIONAL GROUNDING OF DIGNITY: ${n.toUpperCase()} (${pts})`,
  (n, pts) =>
    `${n.toUpperCase()} SPECIAL TEAMS'D THE WHOLE WEEK — ${pts}`,
  (n, pts) => `CLOCK HIT ZERO ON ${n.toUpperCase()} AT ${pts}`,
  (n, pts) =>
    `${n.toUpperCase()} NEEDS A CHALLENGE FLAG AND A HUG (${pts})`,
  (n, pts) =>
    `DROPPED PASS OF THE WEEK: ${n.toUpperCase()}'S CARD (${pts})`,
  (n, pts) =>
    `${n.toUpperCase()} IN THE PREVENT DEFENSE OF LIFE — ${pts}`,
  (n, pts) =>
    `TOILET BOWL FILM ROOM CIRCLES ${n.toUpperCase()} (${pts})`,
  (n, pts) =>
    `${n.toUpperCase()} CALLED A TIMEOUT TOO LATE — ${pts} PTS`,
  (n, pts) =>
    `SUNDAY NIGHTMARE: ${n.toUpperCase()} WITH A CRISP ${pts}`,
  // WTF / surreal desk
  (n, pts) =>
    `${n.toUpperCase()} LEGALLY CHANGED NAME TO "ALMOST COVERED" AFTER ${pts}`,
  (n, pts) =>
    `BREAKING: ${n.toUpperCase()}'S CARD WAS HAUNTED — ONLY EXPLANATION FOR ${pts}`,
];

export const NFL_SHAME_DECKS: DK[] = [
  (pts) =>
    `${pts} points. That's not a drive — that's a three-and-out with commentary.`,
  (pts) =>
    `A ${pts}-spot. The late window closed. The excuses did not.`,
  (pts) =>
    `${pts}. Best Bet is on injured reserve. Possibly the whole card.`,
  (pts) => `Film don't lie. ${pts} is the lowlight package.`,
  (pts) =>
    `${pts} points. Touch grass. Then touch a better dog next Sunday.`,
  (pts) =>
    `Red zone trips: zero. Dignity: also zero. Total: ${pts}.`,
  (pts) =>
    `${pts}. Someone check if they locked. Someone check if they meant to.`,
  (pts) =>
    `That ${pts} is doing numbers — wrong side of the box score.`,
  (pts) =>
    `${pts}. Toilet Bowl just added them to the depth chart.`,
  (pts) => `Prevent defense all week. Manifested ${pts}. Art, in a way.`,
  (pts) => `${pts} points and a dream. The dream got sacked.`,
  (pts) =>
    `If this card were a two-minute drill, the clock hit zero at ${pts}.`,
  (pts) =>
    `${pts}. At one point the referees reviewed the card for a personal foul on reality.`,
  (pts) =>
    `We checked for a glitch. There was no glitch. Just ${pts} and a long silence.`,
];

export const NFL_EDITION_TAGLINES: string[] = [
  "All the news between the first whistle and the late window",
  "Primetime ink · Toilet Bowl footnotes · no campus filler",
  "Printed after Sunday. Feelings still loading Monday.",
  "If you locked, you played. If you didn't, you spectated yourself into a zero.",
  "Special Sunday edition: somebody covered. Somebody got covered.",
  "Not responsible for red-zone decisions or group-chat volume",
  "We report the board. You rewrite the narrative.",
  "Same War Room. Different day of the week. Louder commercials in your head.",
  "Confidence is a formation. Most of you lined up wrong.",
  "Free with every scored week · tips optional · dignity not included",
];

export const NFL_WEATHER_BOXES: { kicker: string; body: string }[] = [
  {
    kicker: "Sunday forecast",
    body: "High: confidence. Low: dignity. Wind from the red zone. Chance of late-window chaos: 100%.",
  },
  {
    kicker: "Primetime conditions",
    body: "Scattered Best Bets. Heavy script talk. Overnight: film and regret.",
  },
  {
    kicker: "Gridiron weather",
    body: "Slick decisions. Fog of spreads. Brief sun if the dog cashed. Pack layers of excuses.",
  },
];

export const NFL_PULL_QUOTES: ((ctx: {
  crown: string;
  shame: string;
  pts: number;
}) => { text: string; by: string })[] = [
  (c) => ({
    text: `"Any given Sunday."`,
    by: c.shame || "The bottom of the board",
  }),
  (c) => ({
    text: `"Trust the process."`,
    by: `${c.crown}, currently the process`,
  }),
  (c) => ({
    text: `"We're right there."`,
    by: `Someone at ${c.pts} who is not, in fact, right there`,
  }),
  (c) => ({
    text: `"Next man up."`,
    by: "The cut line, staring at the Toilet Bowl",
  }),
  (c) => ({
    text: `"I saw the matrix. It was just spreads with better lighting."`,
    by: c.crown || "Someone who cashed the late window",
  }),
  (c) => ({
    text: `"The dog spoke to me. I should not have listened."`,
    by: c.shame || "Best Bet, currently on IR",
  }),
];

export const NFL_CLASSIFIEDS: ((ctx: {
  crown: string;
  shame: string;
  league: string;
  pts: number;
}) => string)[] = [
  (c) =>
    `WANTED: one clean Sunday. Last seen near ${c.crown}'s card. Reward: silence in the chat.`,
  (c) =>
    `LOST: red-zone dignity. If found, return to ${c.shame || "the cut line"}. No questions.`,
  (c) =>
    `FOR SALE: hot takes, barely used. ${c.league} primetime desk. Pay in Locker reactions.`,
  (c) =>
    `NOTICE: film room reviewed ${c.crown}'s week. Decision stands. (${c.pts} pts.)`,
  (c) =>
    `HELP WANTED: someone to explain how ${c.shame || "half the room"} scored that. Experience with self-owns preferred.`,
  (c) =>
    `REWARD: one (1) free conscience if you can prove ${c.crown} used legal means for ${c.pts} pts. No psychics.`,
  (c) =>
    `MISSING: the plot. Last seen leaving ${c.league} after the late window. If found, do not approach ${c.shame || "the cut line"}.`,
];

export type NflSideCtx = {
  crown: string;
  shame: string;
  league: string;
  pts: number;
  weekLabel: string;
};

export const NFL_SIDE_STORIES: ((ctx: NflSideCtx) => {
  kicker: string;
  headline: string;
  body: string;
})[] = [
  (ctx) => ({
    kicker: "Primetime desk",
    headline: "LATE WINDOW DECIDES THE NARRATIVE (AGAIN)",
    body: `${ctx.crown} cashed ${ctx.pts}. The rest of ${ctx.league} is still arguing about one possession and a ghost Best Bet. Classic Sunday.`,
  }),
  (ctx) => ({
    kicker: "Film room",
    headline: "SCRIPT TALK REACHES CRITICAL MASS",
    body: `Someone said the word “script.” Someone else said “any given.” ${ctx.shame ? `${ctx.shame} said nothing useful.` : "The board said enough."} ${ctx.weekLabel} will not be taking questions.`,
  }),
  (ctx) => ({
    kicker: "Also true",
    headline: "BEST BETS: LOVED, HATED, NEVER IGNORED",
    body: `Doubled down or doubled over. ${ctx.crown} looks smart. Everyone else is in prevent defense of their ego.`,
  }),
  (ctx) => ({
    kicker: "Cut line watch",
    headline: "TOILET BOWL SCOUTS LOVE A SLOW START",
    body: `Bottom half still has a path. It's just uglier. ${ctx.pts} at the top doesn't care about your feelings.`,
  }),
  // Super out-there / WTF desk — pure absurdist Sunday energy
  (ctx) => ({
    kicker: "Unconfirmed · very loud",
    headline: `SKYWRITER HIRED TO APOLOGIZE FOR ${ctx.crown.toUpperCase()}'S CARD`,
    body: `A plane over the metro allegedly dragged a banner reading “SORRY ABOUT THE ${ctx.pts}.” FAA has no comment. ${ctx.league} group chat has 400. ${ctx.shame ? `${ctx.shame} tried to book a counter-flight.` : "No counter-flight available."}`,
  }),
  (ctx) => ({
    kicker: "Science desk",
    headline: "PHYSICISTS BAFFLED BY SPREAD THAT SHOULD NOT EXIST",
    body: `${ctx.weekLabel} produced a result so wrong it briefly reverse-engineered confidence. Lab notes just say “${ctx.crown}: ${ctx.pts}” and then a coffee ring. Peer review is the Locker Room.`,
  }),
  (ctx) => ({
    kicker: "Crime blotter",
    headline: "BEST BET STOLEN; SUSPECT DESCRIBED AS “FULL OF HOPE”",
    body: `Witnesses saw someone double-or-nothing their dignity near the red zone. Recovered items: zero covers, one monologue. ${ctx.shame ? `${ctx.shame} remains a person of interest.` : "Investigation ongoing."}`,
  }),
];

/** Ghosted the card — pro week, not Saturday milk-carton campus bit */
export const NFL_NO_LOCK_HEADLINES: ((names: string) => string)[] = [
  (n) => `INACTIVE LIST: ${n.toUpperCase()} NEVER LOCKED`,
  (n) => `DID NOT REPORT: ${n.toUpperCase()} MISSED THE WINDOW`,
  (n) => `ZERO AND A DNQ: ${n.toUpperCase()} GHOSTED KICKOFF`,
  (n) => `PRACTICE SQUAD ENERGY: ${n.toUpperCase()} SKIPPED THE CARD`,
  (n) => `SUNDAY NO-SHOW: ${n.toUpperCase()} LEFT IT BLANK`,
  (n) => `DEACTIVATED: ${n.toUpperCase()} DID NOT SAVE`,
  (n) => `WAIVED FROM THE WEEK: ${n.toUpperCase()} NEVER LOCKED`,
  (n) => `SCRATCHED FROM THE SLATE: ${n.toUpperCase()}`,
];

export const NFL_NO_LOCK_DECKS: ((count: number) => string)[] = [
  (c) =>
    c === 1
      ? "One player never locked. That's a zero. No makeups. The late window does not care."
      : `${c} players never locked. Group inactive list. Fair is fair. Film will remember.`,
  (c) =>
    c === 1
      ? "Spectated themselves into a zero. Primetime still happened without them."
      : `${c} names on the inactive list. Zero points. Zero excuses that work.`,
  () =>
    "If you can argue about the script, you can hit Save. They chose neither.",
];

type SwingHN = (name: string, delta: number, label: string) => string;
type SwingDK = (delta: number, rank: number, label: string) => string;

export const NFL_SWING_UP_HEADLINES: SwingHN[] = [
  (n, d) => `${n.toUpperCase()} CLIMBS ${d} — DEPTH CHART SHUFFLE`,
  (n, d) => `MOVER ALERT: ${n.toUpperCase()} UP ${d} AFTER THE LATE WINDOW`,
  (n, d) => `${n.toUpperCase()} JUMPED ${d} SPOTS — FILM LOOKS DIFFERENT`,
  (n, d) => `PLAYOFF PATH JUST GOT REALER: ${n.toUpperCase()} (+${d})`,
  (n, d) => `${n.toUpperCase()} SURGED ${d}. THE BOARD FELT THAT.`,
];

export const NFL_SWING_UP_DECKS: SwingDK[] = [
  (d, rank) =>
    `Up ${d}. Now sitting ${rank}. That's not noise — that's a statement Sunday.`,
  (d, rank) =>
    `Climbed ${d} to rank ${rank}. Rest of the room is still in two-minute drill.`,
  (d) => `+${d} on the table. Momentum is a real formation. Use it next week.`,
];

export const NFL_SWING_DOWN_HEADLINES: SwingHN[] = [
  (n, d) => `${n.toUpperCase()} DROPS ${d} — FREE FALL SUNDAY`,
  (n, d) => `BLOWN COVERAGE IN THE STANDINGS: ${n.toUpperCase()} (-${d})`,
  (n, d) => `${n.toUpperCase()} SLID ${d} SPOTS. FILM IS NOT KIND.`,
  (n, d) => `CUT LINE LOOMS: ${n.toUpperCase()} FELL ${d}`,
  (n, d) => `${n.toUpperCase()} LOST ${d} — TOILET BOWL SCOUTS NOTETAKING`,
];

export const NFL_SWING_DOWN_DECKS: SwingDK[] = [
  (d, rank) =>
    `Down ${d} to rank ${rank}. The prevent defense of the season just failed.`,
  (d, rank) =>
    `Fell ${d}. Now ${rank}. Challenge flag denied. Next Sunday is mandatory.`,
  (d) => `-${d} on the graph. That's a ski jump without the soft landing.`,
];

/** Home lock nudges — pro week, not Saturday campus */
export const NFL_LOCK_ROASTS = [
  "Sunday is coming. Your card is not. Lock it like someone who understands kickoff times.",
  "Primetime doesn't wait for your vibe check. Lock the slate.",
  "A professional would have locked already. Be professional. Or at least look like one.",
  "Red zone of adulting: take the meds, lock the picks, then talk trash.",
  "The late window is not your friend. Lock before the early window laughs at you.",
  "Standings run on points, not podcasts. Lock the card.",
  "If you can argue about the script, you can hit Save. Do that second thing.",
  "Future you on Monday morning is watching. Don't be a zero with opinions.",
  "This is your coordinator. He wants the card in before the two-minute warning of life.",
  "Hydrate. Lock. Then Locker Room. In that order, champ.",
  // WTF lock nudges
  "Your unpicked card is currently astral projecting. Ground it. Hit Save.",
  "A raccoon in a headset just asked if you're locking. Don't make the raccoon wait.",
];

export const NFL_LATE_LOCK_ROASTS = [
  "Kickoff hit. You never locked. That's a 0 and a personal foul on your calendar.",
  "Card's frozen. You scored zero. Film session is going to be quiet and ugly.",
  "Too late. The window closed. Zero points. Don't ghost next Sunday.",
];

/**
 * Dense ticker lines — same data hooks as CFB, completely different lexicon.
 * Dual-sport players should not recognize the same jokes.
 */
export function buildNflHotTakes(players: Player[]): string[] {
  if (!players.length) {
    return [
      "Primetime wire is quiet… too quiet. Invite the chaos.",
      "No standings yet — confidence still undefeated in theory only.",
    ];
  }

  const takes: string[] = [];
  // Lazy import pattern avoided — fun-board imports us; keep stats local
  const sorted = [...players]
    .filter((p) => !p.isMock)
    .sort((a, b) => {
      const d = b.totalPoints - a.totalPoints;
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });

  takes.push("Hot take: the late window exists to humble you personally.");
  takes.push(
    "Hot take: Best Bet is not a personality. It's double-or-nothing with witnesses."
  );
  takes.push(
    "Hot take: “Any given Sunday” is not an excuse for a three-and-out card."
  );
  takes.push(
    "Hot take: if your card needs a skywriter apology, you might be cooking too hard."
  );
  takes.push(
    "Hot take: the dog that “spoke to you” was just the line. Lines lie. Often."
  );
  takes.push(
    "Hot take: we ran the tape backward and your zero still happened. Haunted."
  );

  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  if (top && bottom && top.id !== bottom.id) {
    takes.push(
      `${top.name} owns the board at ${top.totalPoints}. ${bottom.name} is staring up from ${bottom.totalPoints} — depth chart energy.`
    );
    const gap = top.totalPoints - bottom.totalPoints;
    if (gap >= 20) {
      takes.push(
        `Gap alert: ${gap} pts from 1st to last. Bring a ladder. Or a challenge flag.`
      );
    }
  }
  if (top) {
    takes.push(
      `Film room notes: ${top.name} leads at ${top.totalPoints}. Fade them only if you enjoy being wrong on national-TV energy.`
    );
  }
  if (bottom && bottom.id !== top?.id) {
    takes.push(
      `${bottom.name} is one clean Sunday from relevance — or one more from lore.`
    );
  }

  for (const p of sorted) {
    const streak = p.currentStreak || 0;
    if (streak >= 3) {
      takes.push(
        `${p.name} is on a W${streak} heater. That's not a script. That's a problem.`
      );
    }
    if (streak <= -3) {
      takes.push(
        `${p.name} is on an L${Math.abs(streak)} skid. Send better dogs and a film study.`
      );
    }
    if ((p.perfectWeeks || 0) >= 1) {
      takes.push(
        `${p.name} has ${p.perfectWeeks} clean Sunday${p.perfectWeeks! > 1 ? "s" : ""} on the résumé. Primetime résumé padding.`
      );
    }
    if ((p.bestBetTotal || 0) >= 3) {
      const pct = Math.round((p.bestBetHits / p.bestBetTotal) * 100);
      if (pct >= 60) {
        takes.push(
          `${p.name} is a Best Bet assassin (${p.bestBetHits}/${p.bestBetTotal}, ${pct}%). Call sheet energy.`
        );
      } else if (pct <= 30) {
        takes.push(
          `${p.name}'s Best Bet is on IR (${p.bestBetHits}/${p.bestBetTotal}). Fraud watch active.`
        );
      }
    }
    if ((p.propTotal || 0) >= 3) {
      const pp = Math.round((p.propHits / p.propTotal) * 100);
      if (pp >= 70) {
        takes.push(
          `${p.name} is a prop merchant (${p.propHits}/${p.propTotal}). Crystal ball unclear, ledger clear.`
        );
      }
    }
    const weeks = p.weeklyPoints || [];
    const last = weeks.length ? weeks[weeks.length - 1] : null;
    if (last === 0) {
      takes.push(
        `${p.name} put up a zero last week. That's not a strategy. That's a three-and-out of the soul.`
      );
    }
    if (last != null && last >= 18) {
      takes.push(
        `${p.name} cooked for ${last} last Sunday. Someone check the replay booth.`
      );
    }
  }

  takes.push(
    "Hot take: if you didn't lock, you didn't play. Spectating yourself is free and shameful."
  );
  takes.push(
    "Hot take: Toilet Bowl still matters. Mid-pack is just longer suffering."
  );

  const seen = new Set<string>();
  const unique = takes.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  if (unique.length < 4) {
    unique.push(
      "Lock before kickoff or the ticker will remember your zero.",
      "Toilet Bowl scouting report: always accepting applications.",
      "Confidence 5 is a formation. Most of you lined up wrong."
    );
  }

  return unique.slice(0, 24);
}

/** Ticker chrome label */
export const NFL_TICKER_LABEL = "Primetime wire";

/** Standings swing badges — pro lexicon (not campus) */
export function nflSwingText(
  key:
    | "mid"
    | "rocket"
    | "heater"
    | "climb"
    | "trapdoor"
    | "dropped"
    | "slip"
): string {
  switch (key) {
    case "mid":
      return "STUCK IN TRAFFIC";
    case "rocket":
      return "PRIMETIME LIFT";
    case "heater":
      return "SCRIPTING WINS";
    case "climb":
      return "MOVING UP";
    case "trapdoor":
      return "BLOWN COVERAGE";
    case "dropped":
      return "THREE-AND-OUT";
    case "slip":
      return "LOSING GROUND";
  }
}

export const NFL_HOME_TAGLINE_DEFAULT =
  "Sundays. Spreads. Tailgates. Just the room and the late window.";

/** Commissioner presets when the league sport is NFL */
export const NFL_HOME_TAGLINE_PRESETS: {
  id: string;
  label: string;
  text: string;
}[] = [
  {
    id: "good-teams",
    label: NFL_HOME_TAGLINE_DEFAULT,
    text: NFL_HOME_TAGLINE_DEFAULT,
  },
  {
    id: "picks-points",
    label: "Spreads. Windows. Witnesses.",
    text: "Spreads. Windows. Witnesses.",
  },
  {
    id: "half-flushed",
    label: "Half the room makes the bracket. Half learns the Toilet Bowl.",
    text: "Half the room makes the bracket. Half learns the Toilet Bowl.",
  },
  {
    id: "cut-dont-care",
    label: "Championship path or Toilet Bowl. The cut doesn't care about your script.",
    text: "Championship path or Toilet Bowl. The cut doesn't care about your script.",
  },
  {
    id: "custom",
    label: "Write my own…",
    text: "",
  },
];
