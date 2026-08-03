# House Dragon — Legendary award (Marilynnsmum)

**Status:** Shipped in app code  
**Badge key:** `house_dragon_legendary`  
**Rarity:** Legendary · career-only (does not pad season cheevo race / standings)

## Pre-implementation report

### 1. Resolved user ID

Could **not** resolve live UUID via this environment (Supabase **anon** key; RLS returns empty profiles).

Grant path:

1. **Preferred:** UUID pin in `HOUSE_DRAGON_USER_IDS` when known  
2. **Active:** exact normalized display name `marilynnsmum` only  
   (`normalizeDisplayKey("Marilynnsmum") === "marilynnsmum"`)

**Ambiguity:** Any account that sets display name exactly to Marilynnsmum (after strip) would match. Fill `HOUSE_DRAGON_USER_IDS` after service-role lookup to pin permanently.

### 2. Achievement model

| Piece | Location |
|-------|----------|
| Catalog | `src/lib/badges.ts` · `BADGE_CATALOG` |
| Permanent grants | `permanent-badges.ts` · localStorage `warroom-permanent-badges` · keyed by **user_id + badge_id** (set membership) |
| Career bank | `career-cheevo.ts` · once per badge id |
| Lore seeds | `legacy-badge-grants.ts` · name/UUID match on load |
| Reveal queue | `badge-celebration.ts` · `queuePendingBadgeCelebration` |
| Modal | `BadgeUnlockModal.tsx` · production-mounted in `layout.tsx` |

### 3. One-time reveal

- Award + `queuePendingBadgeCelebration` on grant  
- Re-queue if already permanent but not in celebrated list  
- `markBadgesCelebrated` on acknowledge only  
- Pending lore bypasses pre-lock calm so login can show after training  

### 4. Training / priority

`BadgeUnlockModal` waits for:

- Session player  
- Not pre-lock calm (unless pending lore / Foundry)  
- `canShowBadgeCelebrations`  
- Rules seen (fallback timer)  
- Gazette done event can force  

OnboardingHost / DeferredChrome ceremonies are separate; badge modal is z-110.

### 5. Special Moments

**Skipped.** No safe, deduplicated league-visible Moments feed for custom lore awards. Report: integrate later if Moments catalog supports badge events.

### 6. Files changed

- `src/lib/badges.ts` — def + evaluate + hide locked for others  
- `src/lib/legacy-badge-grants.ts` — House Dragon seed  
- `src/lib/season-mode.ts` — sandbox-protected  
- `src/lib/equipable-titles.ts` — optional title  
- `src/components/BadgeUnlockModal.tsx` — custom copy/CTA  
- `src/app/layout.tsx` — mount badge modal outside DeferredChrome  

No competitive tables, no standings, no week data.

## Verify (manual)

1. Log in as Marilynnsmum → Home after training → legendary modal  
2. Trophy case / profile shows House Dragon · Legendary  
3. Other accounts: no locked House Dragon tile  
4. Refresh / logout: no duplicate grant  
5. Standings points unchanged (careerOnly)  
6. Button “Long may House Dragon reign.” acknowledges once  

## Follow-up for Mike

With service role SQL:

```sql
select id, display_name from profiles
where lower(regexp_replace(display_name, '[^a-zA-Z0-9]', '', 'g')) = 'marilynnsmum';
```

Paste UUID into `HOUSE_DRAGON_USER_IDS` in `legacy-badge-grants.ts`.
