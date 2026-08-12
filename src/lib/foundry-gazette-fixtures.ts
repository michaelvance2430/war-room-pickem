/**
 * Foundry-only editorial fixtures.
 * Fictional names and scores exercise the real Gazette renderer without any
 * cloud reads/writes. They are layout/copy QA—not scoring-pipeline proof.
 */

import type { GazetteEdition, GazetteSideStory } from "./gazette";

export const FOUNDRY_GAZETTE_VERSION_COUNT = 18;

const NAMES = [
  "Brick Johnson",
  "Aunt Linda",
  "Captain Spreadsheet",
  "Coach Wi-Fi",
  "Two-Screen Tony",
  "The Intern",
  "Uncle Rico Jr.",
  "Saturday Susan",
  "Parlay Pete",
  "Halftime Harold",
  "Wrong-Way Randy",
  "Fourth-Down Fran",
  "Clipboard Carl",
  "Overtime Olivia",
  "Tailgate Terry",
  "Monday Mark",
  "Bye-Week Betty",
  "Review-Booth Ron",
] as const;

const FRONT_PAGES: GazetteSideStory[] = [
  { kicker: "Local", headline: "MAN REFRESHES STANDINGS 47 TIMES, CLAIMS IT WAS ‘ONE QUICK CHECK’", body: "Witnesses report the phone was never put down. Family members have requested a wellness check and the Wi-Fi password." },
  { kicker: "Community", headline: "AUNT LINDA DECLARES FILM STUDY ‘NEGATIVE ENERGY’", body: "The league's hottest analyst continues picking entirely by mascot and remains statistically annoying." },
  { kicker: "Business", headline: "GROUP CHAT ECONOMY COLLAPSES AFTER RECEIPTS RESURFACE", body: "Experts blame screenshots, selective memory, and one message sent at 2:14 a.m. that aged like unrefrigerated milk." },
  { kicker: "Science", headline: "RESEARCHERS CONFIRM YELLING ‘LOCK’ DOES NOT SAVE CARD", body: "A twelve-week study found the button remains necessary despite strong feelings and repeated assurances to the commissioner." },
  { kicker: "Culture", headline: "DOCUMENTARY ‘I ALMOST PICKED THEM’ SWEEPS IMAGINARY AWARDS", body: "The four-hour film contains no evidence, several reenactments, and a moving monologue about the pick that was never made." },
  { kicker: "Public safety", headline: "CITY ISSUES ADVISORY AFTER CONFIDENCE FIVE SEEN WANDERING ALONE", body: "Residents are advised not to approach. Authorities say it looked certain on Thursday and deeply suspicious by Saturday." },
  { kicker: "Weather", headline: "DIGNITY WARNING EXTENDED THROUGH MONDAY NIGHT", body: "Heavy shame is expected near the bottom of the standings with scattered excuses developing after the late window." },
  { kicker: "Lifestyle", headline: "LOCAL DAD BUILDS SECOND COMMAND CENTER, STILL PICKS WRONG TEAM", body: "The new setup includes six monitors, advanced metrics, and absolutely no measurable improvement." },
  { kicker: "Opinion", headline: "EDITORIAL BOARD ENDORSES TALKING TRASH BEFORE RESULTS", body: "Waiting until afterward is safer, but courage and judgment have never shared an office in this league." },
  { kicker: "Health", headline: "DOCTORS PRESCRIBE GRASS-TOUCHING AFTER THREE-POINT WEEK", body: "Treatment may include sunlight, hydration, and temporarily muting the person who won the crown." },
  { kicker: "Technology", headline: "ALGORITHM GAINS SENTIENCE, IMMEDIATELY FADES THE COMMISSIONER", body: "Engineers call the result disturbing, reproducible, and probably correct against the spread." },
  { kicker: "Education", headline: "NIGHT SCHOOL OPENS FOR PEOPLE WHO STILL MISUNDERSTAND CONFIDENCE", body: "Enrollment surged after multiple adults assigned five points to teams they described as ‘kind of a vibe.’" },
  { kicker: "Travel", headline: "TOILET BOWL SCOUTS BOOK EXTENDED STAY NEAR LEAGUE BASEMENT", body: "Sources say several prospects have already toured the facilities and asked about parking." },
  { kicker: "Food", headline: "TAILGATE DIP OUTPERFORMS HALF THE ROOM", body: "The dip showed composure, consistency, and better late-game decision-making. Recipe requests are under review." },
  { kicker: "Legal", headline: "PLAYER FILES APPEAL AGAINST BASIC ARITHMETIC", body: "Counsel argues the final score should reflect intent, vibes, and the fact that the losing pick ‘was close for a while.’" },
  { kicker: "Finance", headline: "CONFIDENCE MARKET CRASHES; EXCUSE FUTURES HIT RECORD HIGH", body: "Analysts recommend diversifying into denial before the Monday recap becomes public record." },
  { kicker: "Society", headline: "LEAGUE HOLDS MOMENT OF SILENCE FOR DELETED PREGAME TAKE", body: "The message was brave, loud, and removed seconds after the fourth quarter ended." },
  { kicker: "Odd news", headline: "DOG REFUSES BLAME FOR OWNER’S CARD", body: "In a prepared statement, the dog said: ‘I eat homework, not garbage.’ Negotiations with the milk-carton desk continue." },
] as const;

const PULLS = [
  "I had them the whole time.",
  "The process is innocent until proven guilty.",
  "Nobody remembers screenshots.",
  "That spread moved after I looked at it.",
  "I was one pick away from being right five times.",
  "The card saved. Spiritually.",
] as const;

function points(seed: number, offset: number, floor = 3, span = 22): number {
  return floor + ((seed * 7 + offset * 11) % span);
}

export function buildFoundryGazetteFixture(
  version: number,
  nonce = Date.now()
): GazetteEdition {
  const index = Math.max(0, Math.min(17, Math.floor(version) - 1));
  const seed = index + Math.abs(Math.floor(nonce / 1000));
  const crownName = NAMES[index];
  const shameName = NAMES[(index + 8) % NAMES.length];
  const rivalName = NAMES[(index + 1) % NAMES.length];
  const moverName = NAMES[(index + 5) % NAMES.length];
  const crownPts = points(seed, 1, 18, 18);
  const shamePts = points(seed, 2, 0, 9);
  const gap = 1 + ((seed + index) % 4);
  const lead = FRONT_PAGES[index];

  return {
    weekIndex: 1 + index,
    weekLabel: `Foundry Week ${1 + index}`,
    volumeLabel: `EDITORIAL SIMULATOR · Edition ${String(version).padStart(2, "0")} of 18 · regenerated ${new Date(nonce).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    crown: {
      names: [crownName],
      pts: crownPts,
      kind: "clear",
      headline: `${crownName.toUpperCase()} POSTS ${crownPts} AND REQUESTS IMMEDIATE STATUE`,
      deck: `${crownPts} fictional points on a fictional card. The confidence is real enough to be irritating.`,
    },
    shame: {
      names: [shameName],
      pts: shamePts,
      kind: "clear",
      headline: `${shameName.toUpperCase()} FINISHES WITH ${shamePts}; WIFI BLAMED`,
      deck: `Investigators found a saved card, a functioning connection, and no remaining excuses of value.`,
    },
    standingsDeadlock:
      index % 3 === 0
        ? {
            names: [crownName, rivalName],
            pts: 88 + index,
            kind: "tie",
            headline: `${crownName.toUpperCase()} AND ${rivalName.toUpperCase()} JAM THE TOP OF THE TABLE`,
            deck: "Same fictional season total. Entirely different explanations for how they got there.",
          }
        : null,
    noLock:
      index % 4 === 1
        ? {
            names: [NAMES[(index + 12) % NAMES.length]],
            pts: 0,
            kind: "clear",
            headline: "MILK CARTON DESK REQUESTS RECENT PHOTOGRAPH",
            deck: "Last seen promising to lock after dinner. Dinner has declined comment.",
          }
        : null,
    crystalBallMiss: null,
    swing: {
      names: [moverName],
      pts: points(seed, 4, 10, 16),
      kind: "clear",
      headline: `${moverName.toUpperCase()} CLIMBS FOUR SPOTS, DEMANDS NEW POWER RANKINGS`,
      deck: "One fictional heater was enough to relocate several people and all of their confidence.",
    },
    rivalryWatch: {
      names: [crownName, rivalName],
      pts: gap,
      kind: "clear",
      headline: `${crownName.toUpperCase()} AND ${rivalName.toUpperCase()} NOW SEPARATED BY ${gap}`,
      deck: `Closest fictional race in the room. One card can replace this rivalry with an entirely new argument.`,
    },
    chaosDetonation:
      index % 3 === 2
        ? {
            names: [NAMES[(index + 3) % NAMES.length]],
            pts: points(seed, 6, 8, 18),
            kind: "clear",
            headline: "CHAOS BUTTON PRESSED; ADULT SUPERVISION UNAVAILABLE",
            deck: "The random card is locked, doubled, and already being described as a calculated risk.",
          }
        : null,
    samePerson: false,
    masthead: "THE WAR ROOM DISPATCH",
    tagline: "Foundry editorial simulator · fictional people · real newspaper pressure",
    printedLine: "FOUNDRY ONLY · FICTIONAL EDITION · NEVER FILED TO A REAL LEAGUE",
    weather: {
      kicker: ["Pressure front", "Excuse index", "Room conditions"][index % 3],
      body: `High of ${70 + (seed % 25)}. Visibility low near the cut line. Strong takes moving in after dark.`,
    },
    classifieds: [
      `WANTED: one usable alibi for ${shameName}. Must survive screenshots.`,
      `FOR SALE: premium confidence, lightly used, no refunds after kickoff.`,
      `LOST: perspective. Last seen near the live standings refresh button.`,
    ],
    pullQuote: {
      text: `“${PULLS[index % PULLS.length]}”`,
      by: NAMES[(index + 4) % NAMES.length],
    },
    sideStories: [
      lead,
      FRONT_PAGES[(index + 7) % FRONT_PAGES.length],
    ],
    ritualName: ["Sunday Paper", "Monday Morning Edition", "Saturday Night Extra"][index % 3],
    sportId: index % 4 === 3 ? "nfl" : "cfb",
    stampLine: "FOUNDRY · FICTIONAL EXTRA",
    eventLine: "EDITORIAL SIMULATOR · NO CLOUD WRITES · NO REAL RESULTS",
    rareEgg:
      index % 6 === 5
        ? {
            headline: "EDITOR FINDS SECRET DOOR, IMMEDIATELY ASKS FOR SNACKS",
            deck: "No points were awarded. Morale improved slightly.",
          }
        : null,
    secretLetter: null,
    conferenceChampions:
      index === 17
        ? [
            {
              names: [crownName],
              pts: 144,
              kind: "clear",
              headline: `${crownName.toUpperCase()} CLINCHES THE FICTIONAL CONFERENCE`,
              deck: "Foundry engraving withheld because imaginary trophies still count as imaginary.",
            },
          ]
        : null,
  };
}
