# FIFA Women's World Cup Brazil 2027™ — Achievements

**Philosophy:** Different soul from CFB.

| CFB | World Cup |
|-----|-----------|
| Weekly consistency | Magic |
| Rivalries | Nations |
| Long seasons | Cinderella runs |
| Grind | Penalty / knockout pressure |
| Yearly loops | Four-year memories |

**Presentation:** Not bronze/silver/gold football badges — **collectible passport stamps** (visa, globe, ticket, lion crest, Brazil seal, gold trophy).

**Scope:** `sportId: soccer_wwc` only. CFB catalog stays separate.

**Surface discipline (see `docs/DESIGN-PRINCIPLES.md`):**  
Catalog can grow to hundreds. **Day-1 UI must not show 80 locked stamps.**  
Default passport view = **Recently stamped** + **Next goal** (one progress line). Full stamp book is discovery (“Explore passport”).

## Counts

| Tier | Count | Stamp vibe |
|------|-------|------------|
| Common | 35 | Visa / ticket / globe |
| Rare | 25 | Lion / stadium |
| Epic | 15 | Trophy seal / Brazil |
| Legendary | 5 | Gold trophy / immortals |

Full requirements live in `src/lib/sports/wwc-achievements.ts`.

## Evaluation status

Many stamps need tournament structure (groups, knockouts, confederation tags, VAR/stoppage props).  
**Shipped now:** catalog + passport UI + evaluators for early “join / kickoff / lock habit” stamps.  
**Later:** group stage completion, nation/confederation correctness, shootouts, multi-year legendaries.
