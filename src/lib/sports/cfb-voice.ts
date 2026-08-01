/**
 * CFB / campus voice — distinct heartbeat from NFL.
 * Saturdays, ranked chaos, student section energy, portal memes.
 * Dual-sport players should never hear primetime jokes recycled on campus.
 * Same sass rules: witty, never bigoted.
 */

import type { Player } from "@/lib/types";

/**
 * Dense ticker lines for college leagues.
 * Same data hooks as NFL; completely different lexicon.
 */
export function buildCfbHotTakes(players: Player[]): string[] {
  if (!players.length) {
    return [
      "Campus wire is quiet… too quiet. Invite the chaos.",
      "No standings yet — confidence still undefeated in theory only.",
      "Saturday hasn't started roasting you yet. Give it time.",
    ];
  }

  const takes: string[] = [];
  const sorted = [...players]
    .filter((p) => !p.isMock)
    .sort((a, b) => {
      const d = b.totalPoints - a.totalPoints;
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });

  // Always-on campus flavor (not the NFL late-window bank)
  takes.push("Hot take: Saturdays don't care about your Sunday script.");
  takes.push(
    "Hot take: Best Bet bravely or Best Bet fraudulently — the student section will decide."
  );
  takes.push(
    "Hot take: “any given Saturday” is not a personality. Lock the card."
  );
  takes.push(
    "Hot take: if your dog “spoke to you,” it was the line. Lines lie. Often. In the portal too."
  );
  takes.push(
    "Hot take: ranked or unranked, zero points still looks the same on the milk carton."
  );
  takes.push(
    "Hot take: confidence 5 on a 3-score dog is campus chaos, not a plan."
  );

  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  if (top && bottom && top.id !== bottom.id) {
    takes.push(
      `${top.name} runs the board at ${top.totalPoints}. ${bottom.name} is staring up from ${bottom.totalPoints} — depth chart of shame.`
    );
    const gap = top.totalPoints - bottom.totalPoints;
    if (gap >= 20) {
      takes.push(
        `Gap alert: ${gap} pts from 1st to last. Bring a ladder. Or a transfer portal brochure.`
      );
    }
  }
  if (top) {
    takes.push(
      `AP poll of this room: ${top.name} leads at ${top.totalPoints}. Fade them only if you enjoy being wrong on national-signing-day energy.`
    );
  }
  if (bottom && bottom.id !== top?.id) {
    takes.push(
      `${bottom.name} is one clean Saturday from relevance — or one more from lore.`
    );
  }

  for (const p of sorted) {
    const streak = p.currentStreak || 0;
    if (streak >= 3) {
      takes.push(
        `${p.name} is on a W${streak} heater. That's not a fluke. That's a problem for the field.`
      );
    }
    if (streak <= -3) {
      takes.push(
        `${p.name} is on an L${Math.abs(streak)} skid. Send snacks, better dogs, and a bye week.`
      );
    }
    if ((p.perfectWeeks || 0) >= 1) {
      takes.push(
        `${p.name} has ${p.perfectWeeks} perfect-ish Saturday${p.perfectWeeks! > 1 ? "s" : ""} on the résumé. Show-off energy.`
      );
    }
    if ((p.bestBetTotal || 0) >= 3) {
      const pct = Math.round((p.bestBetHits / p.bestBetTotal) * 100);
      if (pct >= 60) {
        takes.push(
          `${p.name} is a Best Bet assassin (${p.bestBetHits}/${p.bestBetTotal}, ${pct}%). Campus legend track.`
        );
      } else if (pct <= 30) {
        takes.push(
          `${p.name}'s Best Bet is on fraud watch (${p.bestBetHits}/${p.bestBetTotal}). Brown paper bag season.`
        );
      }
    }
    if ((p.propTotal || 0) >= 3) {
      const pp = Math.round((p.propHits / p.propTotal) * 100);
      if (pp >= 70) {
        takes.push(
          `${p.name} is a prop merchant (${p.propHits}/${p.propTotal}). Crystal ball unclear, ledger clear.`
        );
      }
    }
    const weeks = p.weeklyPoints || [];
    const last = weeks.length ? weeks[weeks.length - 1] : null;
    if (last === 0) {
      takes.push(
        `${p.name} put up a zero last card. That is not a strategy. That is a cry for help from the student section.`
      );
    }
    if (last != null && last >= 18) {
      takes.push(
        `${p.name} cooked for ${last} last Saturday. Someone check the smoke alarms in the dorm.`
      );
    }
  }

  takes.push(
    "Hot take: if you didn't lock, you didn't play. Spectating yourself is free and shameful."
  );
  takes.push(
    "Hot take: Toilet Bowl still matters. Mid-pack is just longer suffering with worse tailgates."
  );
  takes.push(
    "Hot take: Week 0 energy is real. So is getting smoked before Labor Day."
  );

  const seen = new Set<string>();
  const unique = takes.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  if (unique.length < 4) {
    unique.push(
      "Lock before kickoff or the campus wire will remember your zero.",
      "Toilet Bowl scouting report: always accepting applications.",
      "Confidence 5 is a love language. Also a crime scene."
    );
  }

  return unique.slice(0, 24);
}

/** Ticker chrome label */
export const CFB_TICKER_LABEL = "Campus wire";

/** Standings swing badges — campus lexicon */
export function cfbSwingText(
  key:
    | "mid"
    | "rocket"
    | "heater"
    | "climb"
    | "trapdoor"
    | "dropped"
    | "slip"
): string {
  switch (key) {
    case "mid":
      return "MID AS HELL";
    case "rocket":
      return "ROCKET SHIP";
    case "heater":
      return "ON A HEATER";
    case "climb":
      return "CLIMBING";
    case "trapdoor":
      return "TRAPDOOR";
    case "dropped":
      return "DROPPED THE BALL";
    case "slip":
      return "SLIPPING";
  }
}
