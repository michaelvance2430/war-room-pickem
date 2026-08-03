# Stabilization & cleanup plan

**Checkpoint:** `stable-p0-2026-08-03` / branch `checkpoint/stable-p0-2026-08-03`  
**Commit:** `340431a60b3394c70d80fcfc331b1df65c3a1a1d`  
**Verified production deploy:** `dpl_95U8CFAMdfmRqJxAqEX8y5V2S3Wu`  
**Status:** Production P0 verification **PASS**. No production changes until Mike confirms core regression.

---

## Production verification (PASS)

| Check | Result |
|-------|--------|
| React #418 | Gone |
| DeferredChrome safe mode | Active (not mounted / not imported in prod) |
| Standings | Responsive |
| Profile open | Quick |
| Profile markers | module-top → render-enter → effect-enter → interactive |
| Complete freeze | None |
| Giant profile-nav longtask | None |
| current_week dedupe | Healthy |

---

## Hard rules (until explicitly lifted)

1. **Do not** re-enable `RoomDeferredChrome` / `DeferredChromeGate` production load.
2. **Do not** restore eager heavy profile details (badges, trophy case, résumé, season plot on first paint).
3. **Do not** remove containment (PlayerLink nav guard, identity-first profile, dynamic details).
4. **Do not** ship production app changes until Mike signs off the **core regression checklist** below.
5. Stabilization only — **no new feature work** on main without a separate decision.

---

## Included commits (containment stack)

| SHA | Summary |
|-----|---------|
| `2d3e94a` | fix(data): dedupe active week + stop PlayerLink fanout |
| `79004d8`…`f584483` | Perf probes / profile-route markers (temporary) |
| `0f802f4` | fix(profile): prevent duplicate nav + defer heavy work |
| `f4db6fd` | fix(runtime): disable deferred chrome emergency freeze path |
| `340431a` | fix(hydration): make shell first render deterministic |

Earlier related: `0797a33` sport-theme recursion, schema drift docs/SQL (not auto-run).

---

## Cleanup plan (later — not yet)

### 1. Remove temporary performance logging (later, not yet)

**Keep for now** so regressions can be re-verified with `warroom-runtime-debug=1`.

When Mike green-lights cleanup:

| Area | Files (approx.) | Action |
|------|-----------------|--------|
| Profile route markers | `runtime-iso.ts` (`wrProfileRoute`), `PlayerLink`, profile page, `AppShell`, `Nav`, `ThemeDecorGate`, `RoomDeferredChrome`, `SmoothRuntime` | Strip or gate permanently behind debug only (already mostly gated) |
| Event-loop probe | `event-loop-probe.ts`, install from `SmoothRuntime` | Remove or leave opt-in only |
| Board / standings phase marks | `board/page.tsx`, `standings/page.tsx` | Remove `mark` / per-await noise |
| Isolation flags | `runtime-iso` iso flags for profileMinimal etc. | Keep iso for deferred reintro; drop unused flags |
| Docs of diagnosis | Keep `docs/*` history; mark obsolete probes | Archive status to “resolved” |

**Do not** remove logging in the same PR that re-enables DeferredChrome or heavy profile.

### 2. Fix remaining fast 404s (e.g. `league_first_joins`)

| Item | Notes |
|------|--------|
| Evidence | Schema drift / missing tables or RPCs → PostgREST 404 (fast, not slow) |
| Docs already | `docs/PRODUCTION-SCHEMA-DRIFT.md`, `supabase/FIX-PRODUCTION-SCHEMA-DRIFT.sql` |
| Plan | Human runs SQL on production Supabase; verify Network tab no 404 spam for `league_first_joins` and other listed objects |
| Code | Prefer soft-fail (already often empty catch); avoid hard dependency on missing columns |
| Out of scope until regression | No broad query redesign |

### 3. Core regression checklist (Mike must run / confirm)

Run on **production** after any future change; baseline = this checkpoint.

**Auth / shell**

- [ ] Hard refresh Home — no #418; room paints
- [ ] Nav works: Home, Picks, Standings, Board, Locker, Account
- [ ] No whole-app freeze; longtask &lt; 500 ms; timer-lag &lt; 1500 ms (with debug on)
- [ ] Console: `[WR-DEFERRED] production safe mode — disabled` once

**Core desks**

- [ ] **Picks** — card loads or empty state; can save/lock if card live
- [ ] **Standings** — list responsive; names clickable
- [ ] **Board** — loads without multi-second hang
- [ ] **Locker** — opens; can read posts
- [ ] **Commissioner** — opens (if commish)
- [ ] **Account** — profile fields load

**Profile containment**

- [ ] One click → one navigation (no triple click-received)
- [ ] Identity (name/avatar) visible quickly
- [ ] “Load profile details” present; not auto-mounting heavy shelves
- [ ] If “Player not found”: note separately (identity resolve) — not a freeze

**Data health**

- [ ] Network: `current_week` not storming
- [ ] Note remaining 404s (`league_first_joins`, etc.) — fix under §2

**Paths**

- [ ] Home → Standings → Profile  
- [ ] Home → Picks → Standings → Profile  

### 4. Reintroduce DeferredChrome children (separate branch only)

**Branch naming:** e.g. `experiment/deferred-chrome-reintro`

| Step | Rule |
|------|------|
| 0 | Base off `stable-p0-2026-08-03` |
| 1 | Gate remains; add **one** child at a time (e.g. RoomDataHydrator only) |
| 2 | Measure: longtasks, timer-lag, route click → interactive |
| 3 | Pass criteria: no longtask &gt; 500 ms on Home/Standings/Profile hop; no freeze |
| 4 | Fail → revert that child; document |
| 5 | Wave1 modals only after hydrator proven |
| 6 | Wave2 ceremonies/eggs/video last |

**Never** re-enable full `RoomDeferredChrome` tree in one PR to main.

### 5. Restore profile sections (separate branch, measured)

**Branch naming:** e.g. `experiment/profile-sections-reintro`

| Order (suggested) | Section | Measure before making default |
|-------------------|---------|-------------------------------|
| 1 | Trophy case only | import + render self-time |
| 2 | Season plot | same |
| 3 | Football résumé | same |
| 4 | Badges / BadgeShelf | **last** — catalog eval cost |
| 5 | Auto-open details | only if each section &lt; budget |

Keep: PlayerLink nav guard; identity-first first paint; no `getPlayerBadges` in initial render until measured.

---

## Suggested next actions (no code until Mike OK)

1. Mike runs **§3 core regression** and confirms.  
2. Ops: apply schema SQL for **§2** 404s when ready.  
3. Engineers: open cleanup PRs for **§1** only after regression green.  
4. Side-branch experiments for **§4** and **§5** only.

---

## Rollback

```text
git checkout stable-p0-2026-08-03
# or
git checkout checkpoint/stable-p0-2026-08-03
```

Redeploy that ref on Vercel if main regresses.
