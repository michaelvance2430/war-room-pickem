# Multi-sport development

## Lanes

| Lane | Branch / deploy | Rule |
|------|-----------------|------|
| **Live CFB** | `main` + tag `cfb-v1-freeze` | Friend season. Bugfix only. |
| **Multi-sport** | `dev` | Sport packs, picker, schema experiments. |

## Phase 1 (done on `dev`)

- [x] `dev` branch + `cfb-v1-freeze` tag  
- [x] `src/lib/sports/` registry + pack metadata  
- [x] `supabase/sport-id.sql` — `leagues.sport_id` + `sport_settings`  
- [x] Create league: sport picker (CFB live; others coming soon)  
- [x] Local `League.sportId` + cloud sync when column exists  

## Your setup checklist

1. **Vercel**  
   - Production: deploy from `main` only  
   - Preview: enable for `dev` (or a separate “War Room Dev” project)  
2. **Supabase**  
   - Prefer a **dev** project for multi-sport migrations  
   - Run `supabase/sport-id.sql` on that project  
   - Do **not** experiment on prod mid-Saturday  
3. **Work only on `dev`** for multi-sport PRs; merge to `main` on planned cutovers  

## Live for App Store direction

| Sport | Status |
|-------|--------|
| **CFB** | Live — green War Room default |
| **NFL** | Live — navy/crimson default (holidays still available) |
| **WWC Brazil 2027** | Coming soon (theme + passport parked) |
| Others | Coming soon |

### Permanent rule: holidays on every sport

Every pack (CFB, NFL, WWC, future) **always** gets commissioner holiday backgrounds:

| Layer | What |
|-------|------|
| **Sport default** | Pack skin only (`data-sport`) — CFB green, NFL navy/crimson, … |
| **Holiday** | Shared catalog in `season-theme.ts` — Halloween, Thanksgiving, Christmas, New Year, **+ more later** |
| **Scope** | Whole app / every page for the league |
| **Override** | Holiday wins over sport default when selected |

Do not ship a sport without this picker working. Add new seasons in `SEASON_THEME_PRESETS` + CSS (+ optional decor component).

## Next phases

3. NFL Gazette flavor (Sunday paper) without clutter  
4. CFB/NFL pack interface cleanup (calendar, odds adapters)  
5. Un-pin WWC when 2027 is product-ready  
6. Profile hardware tagged by `sport_id`  

## Rule of thumb

Same clubhouse. Different fields. Commissioner picks sport at create; lock after first scored week (future).
