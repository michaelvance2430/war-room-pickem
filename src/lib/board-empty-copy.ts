/**
 * Empty Board — nothing public yet.
 * One job: reveal locked cards after kickoff. No tour, no CTAs.
 * Voice: War Room — fun, dry, a little mean. Not corporate.
 *
 * Index = week number:
 *   CFB: 0–18 (openers → CFP title)
 *   NFL: 1–22 (RS 1–18 → WC → Div → Conf → Super Bowl)
 *
 * Weeks 0–4: vault / classified energy (actually about the Board).
 * Week 5+: completely unhinged made-up “facts.” Accuracy is not the point.
 * Enough unique takes through Super Bowl (22). Loops only past that.
 */

export type BoardEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

/** Rotating empty-state takes — index = week number (0…22+). */
export const BOARD_EMPTY_TAKES: BoardEmptyTake[] = [
  // ── 0–4: still about the Board ───────────────────────────────────
  {
    // Week 0 (CFB openers)
    emoji: "🔒",
    title: "Still classified.",
    body: "Picks stay secret until the first whistle. Come back after kickoff when the whole room gets exposed.",
  },
  {
    // Week 1
    emoji: "🤐",
    title: "Nobody's naked yet.",
    body: "The vault is shut. First kickoff is when the blinds open and the excuses start writing themselves.",
  },
  {
    // Week 2
    emoji: "🕵️",
    title: "Recon only. No intel.",
    body: "Everyone's cards are still under the table. Whistle blows — then we see who actually believed their own take.",
  },
  {
    // Week 3
    emoji: "🕶️",
    title: "Dark room. No receipts.",
    body: "Picks don't exist in public until kickoff. Until then it's pure vibes and pure denial.",
  },
  {
    // Week 4
    emoji: "📦",
    title: "Sealed for shipping.",
    body: "The Board doesn't open early. First kickoff is the box cutter — and somebody's getting unboxed.",
  },

  // ── 5–18: random invented facts (CFB RS/CFP + NFL RS) ────────────
  {
    // Week 5
    emoji: "🐿️",
    title: "Fun fact (probably false).",
    body: "Squirrels invented the nickel defense in 1983 and never got credit. The Board is empty either way.",
  },
  {
    // Week 6
    emoji: "🍌",
    title: "Banana fact.",
    body: "A banana is a berry. A strawberry isn't. Your picks are neither. Wait for kickoff.",
  },
  {
    // Week 7
    emoji: "🦈",
    title: "Ocean science (disputed).",
    body: "Sharks can smell insecurity from three counties away. That's why this page is blank right now.",
  },
  {
    // Week 8
    emoji: "🧀",
    title: "Cheese update.",
    body: "There are more kinds of cheese than people in this league who will admit a bad pick. Vault's still locked.",
  },
  {
    // Week 9
    emoji: "🛰️",
    title: "Space briefing.",
    body: "The moon is roughly the size of a large grocery store if you squint and lie. Cards still secret.",
  },
  {
    // Week 10
    emoji: "🦆",
    title: "Duck math.",
    body: "Ducks can't echo. That's why they never call their own bluffs. You shouldn't either until kickoff.",
  },
  {
    // Week 11
    emoji: "🧱",
    title: "Architecture note.",
    body: "The Great Wall is not visible from space, but bad confidence rankings absolutely are. Not yet though.",
  },
  {
    // Week 12
    emoji: "🍕",
    title: "Pizza intelligence.",
    body: "Hawaii is not a pizza topping; it's a threat. The Board remains sealed until first kickoff.",
  },
  {
    // Week 13
    emoji: "🧠",
    title: "Brain fact (unverified).",
    body: "Your brain uses 20% of your calories and 0% of them on locking early. Come back after the whistle.",
  },
  {
    // Week 14
    emoji: "🦩",
    title: "Flamingo report.",
    body: "Flamingos are pink because they eat shrimp and bad decisions. This page eats silence.",
  },
  {
    // Week 15
    emoji: "🧊",
    title: "Ice lore.",
    body: "No two ice cubes are alike, which is also true of terrible Best Bets. Still nothing to show.",
  },
  {
    // Week 16
    emoji: "🎸",
    title: "Music history.",
    body: "The guitar was invented to settle arguments. It failed. Kickoff settles this one.",
  },
  {
    // Week 17
    emoji: "🐙",
    title: "Octopus files.",
    body: "Octopuses have three hearts and still better judgment than half this room. Board's empty.",
  },
  {
    // Week 18 — CFB title / NFL final RS
    emoji: "🌵",
    title: "Desert bulletin.",
    body: "Cacti can survive years without water. You cannot survive a week without excuses. Wait for kickoff.",
  },

  // ── 19–22: NFL playoffs → Super Bowl (still pure nonsense) ───────
  {
    // Week 19 — Wild Card
    emoji: "🃏",
    title: "Wild Card anthropology.",
    body: "Wild cards were invented by a raccoon in 1970 who refused to go home. Still no picks on this page.",
  },
  {
    // Week 20 — Divisional
    emoji: "📐",
    title: "Divisional geometry.",
    body: "A division is just a group chat with helmets. Kickoff is when the mute button fails. Board sealed.",
  },
  {
    // Week 21 — Conference
    emoji: "🏆",
    title: "Conference mythology.",
    body: "Conference championships are decided by which logo looks better on a mug. Science pending. Cards hidden.",
  },
  {
    // Week 22 — Super Bowl
    emoji: "🏈",
    title: "Super Bowl lore (fabricated).",
    body: "The first Super Bowl was won by a coin that refused to land. Your picks still aren't public. Whistle first.",
  },

  // ── Bonus beyond Super Bowl (loop fodder / future weirdness) ─────
  {
    emoji: "🪙",
    title: "Coin theory.",
    body: "Heads never existed until someone needed a coin flip. Your picks don't exist publicly yet either.",
  },
  {
    emoji: "🦕",
    title: "Paleontology drop.",
    body: "Dinosaurs never watched football, which is why they went extinct. Scientists hate this fact.",
  },
  {
    emoji: "📡",
    title: "Radio silence.",
    body: "Wi-Fi stands for “waiting is fine, idiot.” Citation needed. Cards still classified.",
  },
  {
    emoji: "🐸",
    title: "Amphibian news.",
    body: "Frogs absorb water through their skin. You absorb regret through The Board. Later.",
  },
  {
    emoji: "🧲",
    title: "Physics (adjacent).",
    body: "Magnets don't work on wood, pride, or locked cards. First kickoff is the only force that matters.",
  },
  {
    emoji: "🍿",
    title: "Snack doctrine.",
    body: "Popcorn was invented so people had something to do with their hands while being wrong. Soon.",
  },
  {
    emoji: "🧂",
    title: "Seasoning intel.",
    body: "Salt was once currency. Saltiness is still free. Spend some after the picks go public.",
  },
];

/**
 * Week-keyed empty take.
 * Week 0 → index 0 … Week 22 (Super Bowl) → index 22.
 * Negative / non-finite week falls back to 0. List loops past Super Bowl.
 */
export function boardEmptyTakeAt(week?: number): BoardEmptyTake {
  const n = BOARD_EMPTY_TAKES.length;
  if (n === 0) {
    return {
      emoji: "🔒",
      title: "Still classified.",
      body: "Picks stay secret until the first whistle.",
    };
  }
  const w = Number(week);
  const index = Number.isFinite(w) ? Math.trunc(w) : 0;
  return BOARD_EMPTY_TAKES[((index % n) + n) % n]!;
}
