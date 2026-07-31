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

## Next phases

2. CFB fully behind pack interface (calendar/scoring/copy entry points)  
3. Second live pack (NFL or Women’s World Cup event)  
4. Profile hardware tagged by `sport_id`  

## Rule of thumb

Same clubhouse. Different fields. Commissioner picks sport at create; lock after first scored week (future).
