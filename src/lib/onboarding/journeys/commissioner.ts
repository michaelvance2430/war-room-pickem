/**
 * Journey A — New Commissioner (immersion: host voice, Home front door)
 */

import type { OnboardingJourney } from "../types";

export const commissionerJourney: OnboardingJourney = {
  id: "commissioner",
  name: "First league as host",
  successFeeling: "I can run this league.",
  steps: [
    {
      id: "welcome",
      goal: "Welcome host on Home energy",
      layout: "fullscreen",
      conversation: {
        kicker: "You're the host",
        title: "You're running the room.",
        speak:
          "Friends don't need another spreadsheet. They need bragging rights, rivalries, and a paper when the week dies.",
        whyCare:
          "Three jobs: invite the crew, wake the room with a card, know how scoring works. You can't break the league from here.",
        celebrate: "none",
        pointAt: "home",
      },
      action: {
        label: "Let's go — Home →",
        resolveHref: "home",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Skip for now", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "invite",
    },
    {
      id: "invite",
      goal: "Share invite from Home",
      layout: "coach",
      conversation: {
        kicker: "Every great league starts with one message",
        title: "Invite your people.",
        speak:
          "This is the easiest part. Copy the invite. Drop it in the group chat. The fun starts when the first person joins.",
        whyCare: "An empty room isn't broken — it's waiting for your crew.",
        celebrate: "micro",
        celebrateCopy: "✓ Nice. The room is waiting for friends.",
        explainAfter: "Next: wake the room — publish a card so they can pick.",
        nextHint: "Publish the first card",
        pointAt: "home",
      },
      action: {
        label: "I'm on Home — I'll share →",
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
      goal: "Publish first week — room comes alive",
      layout: "coach",
      conversation: {
        kicker: "The room isn't alive yet",
        title: "Publish the first card.",
        speak:
          "Pull Odds → pick 5 → Publish. That's the moment everyone starts checking their phones.",
        whyCare:
          "Until you publish, My Picks stays empty and they think the room is broken.",
        celebrate: "peak",
        celebrateCopy:
          "🎉 The room is alive.\n\nYour first week is LIVE. Players can lock picks now.\n\nText the crew once — then see what they see.",
        explainAfter: "Friends can open My Picks.",
        nextHint: "Know the host loop",
        pointAt: "commissioner",
      },
      action: {
        label: "Open Build Card →",
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
      goal: "Know scoring without forced action",
      layout: "coach",
      conversation: {
        kicker: "When the games die",
        title: "You write the ending.",
        speak:
          "Enter Results → winners → Score. Standings move. The paper cooks. That's the host loop every week.",
        whyCare: "You don't need to score right now — just know the door.",
        celebrate: "micro",
        celebrateCopy: "✓ You know the host loop.",
        explainAfter: "Invite. Publish. Score. You've walked it.",
        pointAt: "commissioner",
      },
      action: {
        label: "Peek Results →",
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
      goal: "Single host finish",
      layout: "fullscreen",
      conversation: {
        kicker: "Welcome, host",
        title: "You can run this league.",
        speak:
          "Invite. Publish. Score. When friends text “is the league open?” — you’ll know exactly what to do.",
        whyCare: "Welcome to the War Room.",
        celebrate: "none",
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
