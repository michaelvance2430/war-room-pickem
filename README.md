# War Room Pick'Em

College Football Pick'Em with divisions, confidence scoring, Best Bets, props, Power Rankings, and dual single-elimination brackets.

**Theme:** Fun. Shit-talking. Camaraderie. Toilet Bowl energy that stays intuitive.

## Rules

### Weekly Card (Commissioner sets)
- 5 games Against The Spread
- Confidence points 1–5 (each number used once)
- One Best Bet → correct = 2× confidence points
- One Prop (serious or chaotic) → 3 points if correct

### Structure
- Up to 50 players → 4 equal divisions
- Regular season: cumulative points + separate Power Rankings
- Cut: bottom 50% **inside each division**

### Postseason (both Single Elimination)
**Championship Bracket (Top 50%)**
- Seeded by points
- Division winners locked as seeds 1–4
- Higher weekly score advances

**Toilet Bowl (Bottom 50%)**
- Worst regular-season record = #1 seed (easiest path)
- Same weekly card
- Maximum chaos allowed

### Power Rankings
Answers “Who is actually playing the best right now?”
Weights recent form (last 4 weeks), ATS%, streak, weekly average, strength of opponents.

## Running locally
```bash
cd war-room-pickem
npm install
npm run dev
```

## Current Pages
- `/` — Home / War Room overview
- `/picks` — Full interactive weekly pick sheet (confidence + Best Bet + prop)
- `/standings` — Placeholder
- `/power-rankings` — Placeholder
- `/championship` — Placeholder
- `/toilet-bowl` — Placeholder
- `/commissioner` — Basic tools overview

## Status
- ✅ Project scaffold + dark theme (green + purple Toilet Bowl accent)
- ✅ Shared navigation
- ✅ Home page
- ✅ Fully interactive Pick Sheet (Week 1 mock data)
- ⏳ Standings, Power Rankings, Brackets, real Commissioner tools next
