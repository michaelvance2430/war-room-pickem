/**
 * Sarcastic home nudge when you still haven't locked picks.
 * Light shit-talk — meds / adulting energy, not cruelty.
 * CFB vs NFL banks stay separate so dual-sport players don't hear the same bit twice.
 */

import { getLeague } from "./league";
import {
  NFL_LATE_LOCK_ROASTS,
  NFL_LOCK_ROASTS,
} from "./sports/nfl-voice";

const ROASTS = [
  "Reminder from the War Room: take your meds and lock your picks. In that order.",
  "A mature adult would have locked already. Be the mature adult. Or at least fake it.",
  "Your group chat is waiting. Your Best Bet is not going to lock itself, champ.",
  "This is your mother. She says lock your picks and text her back.",
  "Pre-kickoff amnesia is not a medical condition. Lock the card.",
  "Standings don't run on vibes. Lock picks like someone who pays bills on time.",
  "You're one Save away from dignity. Don't ghost Saturday like a child.",
  "Take a breath. Hydrate. Lock. Then talk shit in the Locker — in that order.",
  "If you can open TikTok, you can finish a 5-game card. Prove us wrong.",
  "Future you will thank present you. Present you is currently a liability.",
];

const LATE_ROASTS = [
  "First kickoff hit. You never locked. That's a 0 and a character flaw. See you next week.",
  "Card's frozen. You scored zero. Consider this your adulting progress report.",
  "Too late. The meds didn't take. Zero points. Don't ghost the next card.",
];

function hashPick(seed?: string): number {
  let h = 0;
  const s = seed || String(Date.now());
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function pickLockRoast(seed?: string): string {
  const h = hashPick(seed);
  if (getLeague()?.sportId === "nfl") {
    return NFL_LOCK_ROASTS[h % NFL_LOCK_ROASTS.length];
  }
  return ROASTS[h % ROASTS.length];
}

export function pickLateLockRoast(seed?: string): string {
  const h = hashPick(seed);
  if (getLeague()?.sportId === "nfl") {
    return NFL_LATE_LOCK_ROASTS[h % NFL_LATE_LOCK_ROASTS.length];
  }
  return LATE_ROASTS[h % LATE_ROASTS.length];
}
