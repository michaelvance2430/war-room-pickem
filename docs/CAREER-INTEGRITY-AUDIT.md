# Career Integrity Audit (P0 — Pre-Public Launch)

**Status:** OPEN — product decision elevated 2026-08-04  
**Owner:** Mike (product) · Engineering executes write-path quarantine  
**Related:** `docs/PROFILE-FREEZE-POSTMORTEM.md`, `docs/WAR-ROOM-FOUNDRY.md`, Constitution trust rules  

---

## Why this is bigger than a UI bug

War Room only works if **hardware has credibility**.

Violations already observed in testing (examples of the class of bug):

1. **Points surviving simulation** — practice/sim state bleeding into what looks like real progress.  
2. **Hardware from a fake / test league** (e.g. Village Nerd) landing on a career-looking profile.

Those make people question **every** achievement.

---

## Principle

> **Commissioners create experiences. They do not create history.**

> **The league belongs to the community, not the commissioner.**

> **Nothing earned in War Room should disappear because one person clicked a button.**

A commissioner may:

* Build cards  
* Publish weeks  
* Score **manual props** (when the product requires human input)  
* Close the **season** (system closeout / trophy ceremony — not free-form erase)  
* Edit **league settings** (name, theme, schedule prefs — not careers)  
* Voluntarily pass the keys  
* **Request** league retirement (future) — never unilaterally delete production history  

A commissioner may **never**:

* Manufacture career accomplishments  
* Hard-delete a production league that has community history  
* Erase trophies, Gazette, standings, or career progression by a single click  

**Profiles are sacred. Leagues are sacred.**

---

## Foundry vs Career (hard separation)

```text
Production league (mode = production)
        |
        | may earn
        v
   Career / Museum / Hardware / Titles / Gazette archives
```

```text
Foundry / Sandbox / Development league
        |
        | NEVER writes
        v
   Career (or any permanent player legacy)
```

Foundry **may** create:

* Fake trophies  
* Fake Gazette  
* Fake standings  

…only as **disposable lab artifacts**. They **disappear** when testing ends. They never touch career stores.

---

## League mode (required flag)

Preferred model (name TBD in schema work):

```text
league.mode = production | sandbox | development
```

or boolean:

```text
league.is_test = true
```

**Rule:** if `mode != production` (or `is_test`):

| Surface | Permanent write? |
|---------|------------------|
| Trophies / hardware | **NO** |
| Career stats | **NO** |
| Achievements / cheevos | **NO** |
| Museum entries | **NO** |
| Gazette archives | **NO** |
| Profile history / résumé | **NO** |
| Streaks (career) | **NO** |
| Equipable titles earned | **NO** |

Nothing permanent. Ever.

Every writer checks the flag. No exceptions for “just this one trophy.”

---

## Chain of custody (hardware)

Every trophy answers: **Where did this come from?**

Example (stored; not necessarily shown to users):

```text
Village Nerd
2026
CFB

Source:
League Close

Verified:
YES

League:
Saturday Situation Room

Season:
2026
```

Ledger fields (minimum):

```text
trophy_type / label
season_year
sport_id
source: league_close | week_score | system_auto | …
verified: boolean
league_id
league_name (snapshot at award time)
awarded_at
```

User-facing can stay beautiful. Trust lives in the ledger.

---

## Commissioner permissions (launch audit)

### Commissioners CAN

| Action | Notes |
|--------|--------|
| Build Week | Card construction |
| Publish Week | Opens picks |
| Score manual props | Only where system cannot auto-score |
| Close League | Triggers **system** closeout — not free-form awards |
| Edit league settings | Identity, theme, ops — not careers |

### Commissioners CANNOT

| Action | Why |
|--------|-----|
| Award hardware by hand | Manufactures history |
| Grant achievements | Same |
| Edit career stats | Same |
| Create Gazette history | Archives must be earned |
| Modify museum | Same |
| Create titles | Same |
| Modify streaks | Same |
| Change standings manually | Standings are computed |
| Trigger celebration systems arbitrarily | Celebrations follow real earns |
| **Delete a production league** | Community owns history — not one host click |
| Retire a league alone | Future: community vote only |

Everything permanent happens only from **validated game results** (or documented system closeout rules).

### League delete / retirement (audit)

| Type | Delete? | Notes |
|------|---------|--------|
| Foundry / sandbox / `is_test` | Yes (disposable) | Never wrote career |
| Production · empty solo (no other humans, no scores, no play) | Soft escape only | Abandoned empty room — no community history |
| Production · any community history | **Never hard-delete** | Pass keys; later: Request Retirement vote |
| Approved community retirement | Close + **preserve forever** | Not implement yet |

**Code bar (now):** `evaluateLeagueDelete` / `deleteLeague` must not allow nuking rooms with other players or any scored/played history.

---

## Profile is sacred

When someone opens a profile they should think:

> “Everything I’m looking at was earned.”

Not:

> “Maybe the commissioner clicked something.”

That is the long-term brand of War Room hardware.

---

## Milestone: Career Integrity Audit

### Scope — every system that can write to:

* Hardware / trophies  
* Achievements / cheevos / permanent badges  
* Titles  
* Career stats  
* Museum  
* Gazette archives  
* Historical seasons  
* Profile progression / streaks  

### Question for every write

> **Can this happen from Foundry, simulation, or free-form commissioner action?**

If **yes** → **fix it** (gate on `production`, route through result pipeline, or make disposable).

### Delivery checklist (engineering)

- [ ] Schema: `league.mode` / `is_test` (or equivalent) + backfill existing leagues as `production`  
- [ ] Inventory all trophy insert/update paths  
- [ ] Inventory permanent badge / career bank paths  
- [ ] Inventory Gazette archive writers  
- [ ] Inventory museum / prior-season writers  
- [ ] Foundry / sandbox: hard no-op on career tables  
- [ ] Commissioner UI: remove any “award / grant” affordances  
- [ ] Close League: system-only engraving from scored truth  
- [ ] Profile / Trophy Room: never show unverified lab hardware as career  
- [ ] Regression: sim week → prove career tables unchanged  
- [x] Production hard-delete blocked when other humans or any season history exist  
- [ ] League mode flag fully gates disposable vs production  
- [ ] Request League Retirement + community vote (design later)  

---

## Relationship to existing docs

| Doc | Overlap |
|-----|---------|
| Constitution — never invent history | Same trust spine; this audit enforces **writers** |
| Foundry contract | Lab must not leak into career |
| Never Invent Achievement audit | UI empty states; this covers **write integrity** |
| Profile freeze postmortem | Separate (runtime); career integrity is product trust |

---

## One line

> A sports app that prevents pick-cheating is common.  
> An app that **protects a player’s legacy from commissioners and labs** is rare — and that’s War Room’s weight.

If War Room becomes known as the app where **every trophy was genuinely earned**, the profile system has weight. Ten championship plaques five years from now only mean something if everyone knows they survived the same rules as everyone else’s — not a commissioner click in a lab. That trust keeps rivalries meaningful across seasons.
