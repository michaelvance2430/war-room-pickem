# P0 UX Audit — Consistent Chrome

**Status:** Audit + normalize (2026-08-03)  
**Principle:** Consistency builds confidence. Switching sports should feel like changing channels—not opening a different app.

---

## Product distinction (frozen)

| Layer | May differ? | Why |
|-------|-------------|-----|
| **App shell** (nav items, header height, spacing, hierarchy) | **No** | Frame of the product |
| **Sport atmosphere** (background wash, accent color) | **Yes** | Field energy |
| **League identity** (name, tagline, emoji personality) | **Yes** | “Vonnagio Family Vacay” vs “Saturday Situation Room” |
| **Role content** (host hero vs player “You’re in”) | **Yes** | Job differs; shell stays same |
| **Guest / Practice overlays** | **Yes** (contract chrome) | Identity bands; base nav still same |

---

## Audit matrix

### Global Nav (`Nav.tsx` + `AppShell`)

| Dimension | CFB | NFL | Guest | Practice | Player | Host (League) |
|-----------|-----|-----|-------|----------|--------|---------------|
| Phone tabs | Home · Picks · Standings · Locker · More | Same | Same | Same | Same | Same + League when ops |
| Desktop primary | Same set (early vs full) | Same | Same | Same | Same | League when ops |
| **earlyNav** shrinks links | After first-lock unlock | Same logic | Same | Same | Same | Same |
| Header height | h-14 | h-14 | h-14 | h-14 | h-14 | h-14 |
| Sticky | yes | yes | yes | yes | yes | yes |

**Intentional difference:** `earlyNav` (first-hour / first-lock chrome) reduces destinations — **not sport-based**.  
**Intentional:** Hosts/deputies get **League** destination.  
**Accidental (was):** Nav brand block: NFL shows 3 stacked lines (War Room / Pro Football / Sunday); CFB shows War Room + league name only — **normalized** to parallel structure.

### Home masthead

| Mode | Component | When |
|------|-----------|------|
| Full room | `HomeSportHeader` | `!firstWeekChrome` |
| First hour | `HomeRoomContext` | `firstWeekChrome` |

**Intentional:** First-hour uses quieter room plaque; not a different app.  
**Accidental (was):** `HomeSportHeader` NFL path used dual brand marks + different chip layout vs CFB pill — **normalized** to shared structure: crest + sport chip + room title + tagline.

### Home job hero (`HomeWeekHero`)

| Role | Eyebrow / job |
|------|----------------|
| Player waiting | “You’re in” |
| Host no card | Commish / publish job |

**Intentional content difference** — same hero card chrome, different copy/CTA. Keep.

### Guest / Practice overlays

| Overlay | Position | Affects base nav? |
|---------|----------|-------------------|
| Guest · exploring | Sticky above header | No |
| Practice Mode | Sticky above shell | No |
| Foundry session | Bottom | No |

**OK** — contract chrome on top of **same** app frame.

---

## Findings summary

| Finding | Severity | Action |
|---------|----------|--------|
| Nav sport brand hierarchy differed (NFL 3-line vs CFB) | High | Normalize |
| HomeSportHeader NFL dual-logo vs CFB chip | High | Normalize structure |
| earlyNav / firstWeekChrome differ by progress | Low | Keep (product) |
| Host vs player Home hero | Low | Keep (job content) |
| League tagline personality | None | Keep |
| “Commish tools” link on HomeRoomContext | Med | Rename → **League** (destination language) |
| Atmosphere gradients by sport | None | Keep |

---

## Product principle

> **Consistency builds confidence. Players should never wonder if they're in a different version of War Room.**

League personality ≠ app shell drift.
