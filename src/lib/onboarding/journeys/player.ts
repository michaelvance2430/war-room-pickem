/**
 * Journey B — New Player
 * Goal felt: "I can't wait until Week 1."
 * Blueprint: docs/NEW-PLAYER-ONBOARDING-REDESIGN.md
 */

import type { OnboardingJourney } from "../types";

export const playerJourney: OnboardingJourney = {
  id: "player",
  name: "First week as a player",
  successFeeling: "I can't wait until Week 1.",
  steps: [
    {
      id: "welcome",
      goal: "Welcome safely into the room",
      layout: "fullscreen",
      conversation: {
        kicker: "Welcome",
        title: "Welcome to War Room.",
        speak:
          "This isn't a public pick'em widget. It's a private room with your people.",
        whyCare:
          "Before you compete for real, we'll run a quick practice season. About 3 minutes. Nothing here affects your league. You can't mess anything up.",
        practiceBanner: true,
        celebrate: "none",
      },
      action: {
        label: "Start practice →",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Skip for now", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "mission",
    },
    {
      id: "mission",
      goal: "Understand the weekly job",
      layout: "fullscreen",
      conversation: {
        kicker: "The weekly job",
        title: "This is where every week begins.",
        speak:
          "You'll predict winners before kickoff. Beat your friends. Climb the standings. Win the season.",
        whyCare:
          "The picks are just the excuse — the room is the product. First, one practice card so Week 1 feels familiar.",
        practiceBanner: true,
        celebrate: "none",
      },
      action: {
        label: "Show me the weekly job →",
        advancesOnClick: true,
      },
      successCondition: { type: "always" },
      nextStep: "open_picks",
    },
    {
      id: "open_picks",
      goal: "Open My Picks (practice)",
      layout: "coach",
      conversation: {
        kicker: "Step 1 · Practice",
        title: "Open My Picks",
        speak:
          "This is where every week begins. Open your practice card — same buttons you'll use when the commissioner opens the real week.",
        whyCare: "Nothing here is live. Training League only.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ You're on My Picks. Practice only.",
        explainAfter: "Next: fill the card — sides, confidence, Best Bet, prop.",
        nextHint: "Build your practice card",
      },
      action: {
        label: "Open practice card →",
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
        kicker: "Step 2 · Build the card",
        title: "Build your practice card",
        speak:
          "For each game: pick a side. Rank confidence 1–5 (each number once — your 5 is your loudest take). Mark one Best Bet. Answer the prop.",
        whyCare:
          "That's the whole weekly motion. Practice teaches it without risk.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ Card looks full.",
        explainAfter: "One more step: lock it in.",
        nextHint: "Hit Save / Lock",
      },
      action: {
        label: "I'm on My Picks",
        href: "/picks",
      },
      // Prefer auto when picks filled; manual backup so they never feel stuck
      successCondition: { type: "sessionFlag", key: "warroom-tut-picks-filled" },
      secondaryAction: {
        label: "I've filled the card →",
      },
      nextStep: "lock_picks",
    },
    {
      id: "lock_picks",
      goal: "Save / lock practice picks",
      layout: "coach",
      conversation: {
        kicker: "Step 3 · Lock it in",
        title: "Hit Save / Lock",
        speak:
          "That's the finish line for the week. On a live week you can still edit until first kickoff — then the card freezes.",
        whyCare: "Same muscle memory you'll use for blood when the season opens.",
        practiceBanner: true,
        celebrate: "peak",
        celebrateCopy:
          "✅ Nice! You locked in your first picks.\n\nYou're not just making picks. You're joining a room where every week ends with bragging rights, rivalries, and stories.\n\nNothing here affected your league.",
        explainAfter: "You just did the real weekly job.",
        nextHint: "Peek the clubhouse",
      },
      action: {
        label: "Open My Picks",
        resolveHref: "tutorialPicks",
      },
      successCondition: { type: "sessionFlag", key: "warroom-tut-picks-saved" },
      secondaryAction: {
        label: "I locked my picks →",
      },
      nextStep: "peek_standings",
    },
    {
      id: "peek_standings",
      goal: "See Standings with context",
      layout: "coach",
      conversation: {
        kicker: "The clubhouse",
        title: "Next: Standings",
        speak:
          "This isn't a silent scoreboard. It's the table you trash-talk about all week — where you pass your brother or your boss.",
        whyCare: "Rivalries live here. Correct picks move you closer to owning the room.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ You've seen Standings.",
        nextHint: "Locker Room next",
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
      goal: "See Locker Room with context",
      layout: "coach",
      conversation: {
        kicker: "The clubhouse",
        title: "Next: Locker Room",
        speak:
          "Every league has personalities. This is where yours comes alive — trash talk, alibis, glory.",
        whyCare: "Spreadsheets don't do this. War Room does.",
        practiceBanner: true,
        celebrate: "micro",
        celebrateCopy: "✓ You've seen the Locker.",
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
      goal: "Finish with confidence for Week 1",
      layout: "fullscreen",
      conversation: {
        kicker: "You're ready",
        title: "You're ready.",
        speak:
          "You know how War Room works. Your commissioner will open the real week when it's time.",
        whyCare:
          "When Week 1 arrives — trust yourself. You've already done this once.\n\nWelcome to the War Room.",
        celebrate: "peak",
        celebrateCopy:
          "🏆 You're ready.\n\nWhen Week 1 arrives — trust yourself. You've already done this once.\n\nWelcome to the War Room.",
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
