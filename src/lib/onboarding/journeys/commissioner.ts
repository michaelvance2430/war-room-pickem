/**
 * Journey A — New Commissioner
 * Goal felt: "I can run this league."
 */

import type { OnboardingJourney } from "../types";

export const commissionerJourney: OnboardingJourney = {
  id: "commissioner",
  name: "First league as host",
  successFeeling: "I can run this league.",
  steps: [
    {
      id: "welcome",
      goal: "Welcome the host",
      layout: "fullscreen",
      conversation: {
        kicker: "You're the host",
        title: "You're running the room.",
        speak:
          "Friends don't need another spreadsheet. They need a place with bragging rights, rivalries, and a paper when the week dies.",
        whyCare:
          "We'll walk three jobs: invite the crew, publish a week, know how scoring works. About 3 minutes. You can't break the league from here.",
        celebrate: "none",
      },
      action: {
        label: "Let's run the room →",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Skip for now", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "invite",
    },
    {
      id: "invite",
      goal: "Share the invite",
      layout: "coach",
      conversation: {
        kicker: "Job 1 of 3 · Invite",
        title: "Share your invite",
        speak:
          "One link with the code filled in. Drop it in the group chat — that's how the room fills.",
        whyCare:
          "An empty room isn't a broken app. It's waiting for your people.",
        celebrate: "micro",
        celebrateCopy: "✓ Invite ready. Send it when you are.",
        explainAfter: "Next job: publish a week so they have something to pick.",
        nextHint: "Publish a card",
      },
      action: {
        label: "Open Home to share →",
        href: "/",
        advancesOnClick: true,
      },
      secondaryAction: {
        label: "I've shared (or I'll do it later) →",
      },
      successCondition: { type: "manual" },
      nextStep: "publish",
    },
    {
      id: "publish",
      goal: "Publish first week card",
      layout: "coach",
      conversation: {
        kicker: "Job 2 of 3 · Publish",
        title: "Publish this week's card",
        speak:
          "Pull Odds → pick 5 games → Publish. Until you publish, My Picks stays empty and they think the room is broken.",
        whyCare:
          "This is the moment the week becomes real — friends can lock, trash talk, and compete.",
        celebrate: "peak",
        celebrateCopy:
          "🎉 Your first week is officially LIVE.\n\nPlayers can now begin making picks.\n\nText the crew once more — then check what they see.",
        explainAfter: "Friends can open My Picks and lock now.",
        nextHint: "Know how scoring works",
      },
      action: {
        label: "Pull Odds & publish →",
        resolveHref: "commissionerCard",
        advancesOnClick: true,
      },
      successCondition: { type: "event", name: "warroom-card-published" },
      secondaryAction: {
        label: "I've published (or will soon) →",
      },
      nextStep: "score_hint",
    },
    {
      id: "score_hint",
      goal: "Understand scoring (no full score required)",
      layout: "coach",
      conversation: {
        kicker: "Job 3 of 3 · Score later",
        title: "When the games die",
        speak:
          "Enter Results → fill winners → Score. Standings update. The paper cooks. That's the host loop every week.",
        whyCare:
          "You don't need to score right now — just know the door. The room waits for this moment.",
        celebrate: "micro",
        celebrateCopy: "✓ You know the host loop.",
      },
      action: {
        label: "Peek Results tab →",
        resolveHref: "commissionerResults",
        advancesOnClick: true,
      },
      secondaryAction: {
        label: "Got it → finish",
      },
      successCondition: { type: "manual" },
      nextStep: "youre_ready",
    },
    {
      id: "youre_ready",
      goal: "Host confidence finish",
      layout: "fullscreen",
      conversation: {
        kicker: "You're ready",
        title: "You can run this league.",
        speak:
          "Invite. Publish. Score. That's the job — and you've already walked it.",
        whyCare:
          "When friends text 'is the league open?' — you'll know exactly what to do.\n\nWelcome to the War Room, host.",
        celebrate: "peak",
        celebrateCopy:
          "🏆 You can run this league.\n\nInvite. Publish. Score.\n\nWelcome to the War Room.",
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
