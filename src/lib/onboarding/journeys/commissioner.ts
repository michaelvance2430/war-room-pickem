/**
 * Journey A — New Commissioner (Scrub #2: host conversation, not a manual)
 *
 * Emotional goal: "Wow... I can actually run this."
 * NOT: "I know the three jobs."
 *
 * Rules:
 * - One action at a time
 * - Always one "Start Here"
 * - Coach stays with you
 * - No scoring / advanced until after a practice week is live
 * - Foundry never appears in this copy
 */

import type { OnboardingJourney } from "../types";

export const commissionerJourney: OnboardingJourney = {
  id: "commissioner",
  name: "First hour as host",
  successFeeling: "Wow... I can actually run this.",
  steps: [
    {
      id: "welcome",
      goal: "Welcome as a host — promise company, not a syllabus",
      layout: "fullscreen",
      conversation: {
        kicker: "Hey, host",
        title: "This is your room.",
        speak:
          "I'm staying with you. Not a manual — just the next thing, one step at a time. You can't break the league from here.",
        whyCare: "A few minutes. Then you'll know you can actually run this.",
        celebrate: "none",
        startHere: true,
        pointAt: "home",
      },
      action: {
        label: "Start here — walk me in →",
        resolveHref: "home",
        advancesOnClick: true,
      },
      secondaryAction: { label: "I'll explore on my own", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "invite",
    },
    {
      id: "invite",
      goal: "One action: get a friend in the door",
      layout: "coach",
      conversation: {
        kicker: "Still with you",
        title: "Get one friend in the door.",
        speak:
          "That's the whole job right now. Tap Share invite — drop it in the group chat. Empty room isn't broken. It's waiting.",
        celebrate: "micro",
        celebrateCopy: "✓ Nice. Someone's about to walk in.",
        explainAfter:
          "Next we wake the room with one practice week. Same moves you'll use all season.",
        nextHint: "Share invite on Home",
        startHere: true,
        pointAt: "home",
      },
      action: {
        label: "Start here · Share invite",
        href: "/#invite-friends",
        advancesOnClick: true,
      },
      secondaryAction: {
        label: "I shared it →",
      },
      successCondition: { type: "sessionFlag", key: "warroom-invite-shared" },
      nextStep: "build_week",
    },
    {
      id: "build_week",
      goal: "One action: publish a practice week so the room is alive",
      layout: "coach",
      conversation: {
        kicker: "Still with you",
        title: "Build one practice week.",
        speak:
          "Open Commish → Pull Odds → pick 5 → Publish. One card. That's it. Friends can lock picks after this.",
        whyCare:
          "Practice week energy — you're learning the real host move, not reading about it.",
        celebrate: "peak",
        celebrateCopy:
          "🎉 You just ran a week.\n\nThe room is alive. Players can open My Picks.\n\nWow… you can actually run this.",
        explainAfter: "That's the hard part. You're the host now.",
        nextHint: "Open Commish · Build Card",
        startHere: true,
        pointAt: "commissioner",
      },
      action: {
        label: "Start here · Build the card →",
        resolveHref: "commissionerCard",
        advancesOnClick: true,
      },
      successCondition: { type: "event", name: "warroom-card-published" },
      secondaryAction: {
        label: "I published it →",
      },
      // Scoring deliberately NOT next — delay until after practice week exists
      nextStep: "youre_ready",
    },
    {
      id: "youre_ready",
      goal: "Single emotional finish — confidence, not curriculum",
      layout: "fullscreen",
      conversation: {
        kicker: "You did it",
        title: "You can run this.",
        speak:
          "Invite. Card. Room alive. When friends text “is the league open?” — you already know what to do. Scoring waits until the games die. We'll do that together then.",
        whyCare: "Welcome to the War Room, host.",
        celebrate: "none",
        startHere: true,
      },
      action: {
        label: "Start here · Take me home →",
        href: "/",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Done", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: null,
    },
  ],
};
