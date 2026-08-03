/**
 * Journey B — New Player (immersion redesign)
 * Feel IN War Room — Home is the front door. Coach guides; app is the hero.
 */

import type { OnboardingJourney } from "../types";

export const playerJourney: OnboardingJourney = {
  id: "player",
  name: "First week as a player",
  successFeeling: "I can't wait until Week 1.",
  steps: [
    {
      id: "welcome",
      goal: "Land inside War Room on Home, safely",
      layout: "fullscreen",
      conversation: {
        kicker: "Welcome",
        title: "Welcome to War Room.",
        speak:
          "You're in the room — not a simulator. Before real Week 1, one quick practice run on the real app.",
        whyCare:
          "About 3 minutes. Nothing here affects your league. You can't mess anything up.",
        practiceBanner: true,
        celebrate: "none",
        pointAt: "home",
      },
      action: {
        label: "I'm in — show me around →",
        resolveHref: "home",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Skip for now", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "open_picks",
    },
    {
      id: "open_picks",
      goal: "Drive to My Picks from inside the app",
      layout: "coach",
      conversation: {
        kicker: "Nice — you're home",
        title: "This is where every week begins.",
        speak:
          "Tap My Picks. That's where you'll lock a card before kickoff — every week.",
        whyCare: "Practice card only. Same buttons as the real week.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ Nice. You're on My Picks.",
        explainAfter: "This is the weekly job. Fill the card — then lock it.",
        nextHint: "Pick sides, confidence, Best Bet, prop",
        pointAt: "picks",
      },
      action: {
        label: "Open My Picks →",
        resolveHref: "tutorialPicks",
        advancesOnClick: true,
      },
      successCondition: { type: "pathname", includes: "/picks" },
      nextStep: "fill_picks",
    },
    {
      id: "fill_picks",
      goal: "Fill the practice card",
      layout: "coach",
      conversation: {
        kicker: "You're driving",
        title: "Build the card.",
        speak:
          "Pick a side on each game. Rank confidence 1–5 (each once — your 5 is your loudest take). One Best Bet. Answer the prop.",
        whyCare: "You're not watching a tutorial — you're doing the real motion.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ Card looks full. Nice.",
        explainAfter: "One more tap — lock it in.",
        nextHint: "Hit Save / Lock",
        pointAt: "picks",
      },
      action: {
        label: "I'm filling the card",
        href: "/picks",
      },
      successCondition: { type: "sessionFlag", key: "warroom-tut-picks-filled" },
      secondaryAction: { label: "I've filled it →" },
      nextStep: "lock_picks",
    },
    {
      id: "lock_picks",
      goal: "Lock practice picks — earned peak",
      layout: "coach",
      conversation: {
        kicker: "Finish line",
        title: "Hit Save / Lock.",
        speak:
          "That's the weekly finish line. On a live week you can still edit until first kickoff.",
        whyCare: "Same muscle memory for when the season is real.",
        practiceBanner: true,
        celebrate: "peak",
        celebrateCopy:
          "✅ Nice — you locked your first card.\n\nYou're not just making picks. You're joining a room where every week ends with bragging rights, rivalries, and stories.\n\nNothing here affected your league.",
        explainAfter: "Let me show you something cool.",
        nextHint: "Peek Standings",
        pointAt: "picks",
      },
      action: {
        label: "Back to My Picks",
        resolveHref: "tutorialPicks",
      },
      successCondition: { type: "sessionFlag", key: "warroom-tut-picks-saved" },
      secondaryAction: { label: "I locked it →" },
      nextStep: "peek_standings",
    },
    {
      id: "peek_standings",
      goal: "See Standings inside the room",
      layout: "coach",
      conversation: {
        kicker: "Something cool",
        title: "This is where rivalries live.",
        speak:
          "Open Standings — not a silent scoreboard. The table you trash-talk about all week.",
        whyCare: "Your buddy is going to hate losing to you here.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ That's the board you'll fight over all season.",
        explainAfter: "One more door — where the room talks.",
        nextHint: "Open Locker Room",
        pointAt: "standings",
      },
      action: {
        label: "Open Standings →",
        href: "/standings",
        advancesOnClick: true,
      },
      successCondition: { type: "pathname", includes: "/standings" },
      nextStep: "peek_locker",
    },
    {
      id: "peek_locker",
      goal: "See Locker Room inside the room",
      layout: "coach",
      conversation: {
        kicker: "The room talks here",
        title: "Locker Room.",
        speak:
          "Every league has personalities. This is where yours comes alive.",
        whyCare: "Spreadsheets don't do this. War Room does.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ You've seen where the stories start.",
        explainAfter: "You're ready for the real week when it opens.",
        nextHint: "Finish",
        pointAt: "locker",
      },
      action: {
        label: "Open Locker Room →",
        href: "/locker-room",
        advancesOnClick: true,
      },
      successCondition: { type: "pathname", includes: "/locker-room" },
      nextStep: "youre_ready",
    },
    {
      id: "youre_ready",
      goal: "Single emotional finish",
      layout: "fullscreen",
      conversation: {
        kicker: "Welcome",
        title: "You're ready.",
        speak:
          "You know the weekly job. When Week 1 opens — trust yourself. You've already done this once.",
        whyCare: "Welcome to the War Room.",
        // Single peak only — no second modal that repeats the same line
        celebrate: "none",
        practiceBanner: false,
      },
      action: {
        label: "Take me home →",
        href: "/",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Done", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: null,
    },
  ],
};
