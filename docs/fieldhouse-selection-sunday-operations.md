# Fieldhouse Selection Sunday operations

This workflow builds the platform-owned NCAAM or NCAAW tournament field. It does not publish or modify production by itself.

1. Create a human-editable scaffold:

   `node scripts/generate-fieldhouse-official-field.mjs --scaffold ncaam 2027 /tmp/ncaam-2027-input.json`

2. Replace every placeholder team ID and name. Each region must have exactly 16 seed slots. A direct seed uses `team`; an Opening Round seed uses two teams under `opening`. Across all four regions there must be exactly 12 Opening Round slots, but the distribution does not have to be three per region.

3. Generate the bracket once to obtain its stable game IDs:

   `node scripts/generate-fieldhouse-official-field.mjs /tmp/ncaam-2027-input.json /tmp/ncaam-2027-draft.json`

4. Add official timestamps to `gameTimes` using those game IDs. Add provider IDs to `oddsEventIds` when available. Team names remain the scoring fallback when an Odds API event ID is not yet known.

5. Require all Opening Round and First Round times before the field is considered publish-ready:

   `node scripts/generate-fieldhouse-official-field.mjs /tmp/ncaam-2027-input.json /tmp/ncaam-2027-ready.json --publish-ready`

6. In the owner-only Fieldhouse control, import the generated file as a draft. Inspect all regions, seeds, opening feeders, game times, and Final Four paths. Publish only after that review. Publishing is a deliberate separate action and opens the same field for every league in that sport.

7. When later-round broadcast times or Odds API event IDs become official, regenerate the same file and use **Sync Times + Event IDs**. That operation cannot replace the bracket graph or any player receipt, and it refuses to move a game time after that game has started.

The generator rejects placeholders in a publish-ready file, duplicate team IDs or names, missing seeds, the wrong number of opening games, disconnected sources, malformed dates, and any graph that is not exactly 76 teams and 75 decisions. The database repeats the placeholder, blank-ID, and duplicate-name checks so a manually edited file cannot bypass them.
