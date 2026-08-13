export const COMMISSIONER_PLUS_PRICE = "$19.99";

export const COMMISSIONER_PLUS_SEASON_PASSES = [
  {
    id: "football",
    title: "Football Season",
    sports: "College Football + NFL",
    status: "First planned pass",
  },
  {
    id: "basketball",
    title: "Basketball Season",
    sports: "College Basketball + March Madness + NBA + WNBA",
    status: "Planned with basketball launch",
  },
] as const;

export const COMMISSIONER_PLUS_PILLARS = [
  {
    number: "01",
    eyebrow: "Run the room",
    title: "Automation",
    summary: "War Room handles the repetitive work. You keep command.",
    features: [
      "Scheduled weekly card publishing",
      "Automatic incomplete-card reminders before lock",
      "Scheduled commissioner announcements",
      "Participation and missing-picks reports",
      "Guided regular-season and postseason transitions",
      "One-touch crew invitation into the next sport",
    ],
  },
  {
    number: "02",
    eyebrow: "Make it unmistakably yours",
    title: "League Identity",
    summary: "Give the room a look, voice, and host identity people recognize.",
    features: [
      "Premium league themes and seasonal skins",
      "Custom league crest, cover image, and accent colors",
      "Branded invitation landing page",
      "Expanded league motto and presentation controls",
      "Commissioner host profile and league history",
      "Reusable identity across every league in the purchased sports season",
    ],
  },
  {
    number: "03",
    eyebrow: "Make the season feel enormous",
    title: "Bigger Moments",
    summary: "Turn milestones, disasters, and championships into league events.",
    features: [
      "Premium season-opening and championship ceremonies",
      "Custom league awards alongside War Room hardware",
      "Expanded Dispatch sections and commissioner notes",
      "Custom rivalry and grudge-match spotlights",
      "Enhanced Crown, Shame, promotion, and elimination presentations",
      "Shareable season-finale package for the entire league",
    ],
  },
  {
    number: "04",
    eyebrow: "Keep the crew's history",
    title: "League Legacy",
    summary: "Every season becomes part of a permanent room record.",
    features: [
      "Advanced multi-season league archive",
      "Commissioner, champion, and rivalry timelines",
      "Full historical standings and postseason brackets",
      "Downloadable league season book",
      "This Day in Your War Room history",
      "Crew continuity records across every War Room sport",
    ],
  },
] as const;
