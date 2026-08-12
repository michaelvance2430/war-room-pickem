# The Dispatch — AI newsroom architecture

## Product rule

War Room owns the facts. AI owns the phrasing.

The first regular issue covers Week 1 and drops when Week 2 opens. CFB Week 0
does not publish a Dispatch. Every later scored card may publish one archived,
immutable issue.

## Safe weekly pipeline

1. Commissioner or deputy scores the week through the existing authoritative
   scoring path.
2. Server-side code builds a `DispatchFactPacket` from rows the league already
   owns:
   - `week_results` + `game_results`: official results and final scores
   - `memberships.weekly_points`: crown, shame, ties, and standings movement
   - locked picks: Best Bet hits, misses, no-locks, and confidence disasters
   - `weapon_service_events` / locked chaos state: Tactical Nuke, Dead Hand,
     JDAM, or Hellfire authorization and outcome
   - `locker_messages` + reactions: repeated themes and highly reacted moments
3. Locker posts are filtered before model input. Reaction markers, media URLs,
   deleted/moderated posts, contact information, and direct verbatim quotes are
   excluded. The packet carries a short theme summary and source message IDs.
4. A server-only OpenAI Responses API call receives only that packet plus the
   War Room voice guide. The API key never reaches the browser.
5. Structured Outputs constrain the response to `DispatchAiDraft`: one lead,
   briefs, Locker roasts, and a `sourceFactIds` list for every story.
6. `validateDispatchAiDraft` rejects any uncited story or unknown fact ID.
7. Deterministic copy remains the fallback. A timeout, refusal, malformed
   response, moderation failure, or validation failure must never block scoring
   or publication.
8. The accepted draft is merged into the existing edition payload and archived
   once. Regeneration is Foundry-only until a human review workflow exists.

## Voice and privacy law

- Funny, specific, and league-native; never fabricate a score, quote, injury,
  accusation, weapon use, or player action.
- Locker Room material is paraphrased, not quoted, unless a future explicit
  “eligible for The Dispatch” control is added.
- No slurs, sexual content involving minors, private contact details, medical
  claims, or real-world allegations.
- Social share cards use the approved story text, but never expose raw Locker
  messages or message IDs.
- AI writes no database facts and grants no points, trophies, ranks, or awards.

## Recommended implementation sequence

1. Build and test the deterministic fact-packet collector in Foundry.
2. Add a server-only `/api/dispatch/draft` endpoint with league membership and
   staff authorization checks.
3. Call the OpenAI Responses API with Structured Outputs and `store: false`.
4. Add a Foundry “AI newsroom proof” panel showing facts beside generated copy.
5. Run a full CFB and NFL season in Foundry and audit every cited story.
6. Enable production generation after scoring, with deterministic fallback and
   cost/latency logging.

Official OpenAI guidance: use the Responses API for new integrations and use
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
with a strict JSON schema. Structured output guarantees the shape, not the truth
of the prose; our citation validator and fact packet remain mandatory. Keep the
key server-side and separate staging from production, following the
[API deployment checklist](https://developers.openai.com/api/docs/guides/deployment-checklist).
