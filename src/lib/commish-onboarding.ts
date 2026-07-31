/**
 * First-time commissioner guidance — setup spine until first week is scored.
 */

const KEY = "warroom-commish-setup-v1";

export type CommishSetupFlags = {
  hostScreenSeen?: boolean;
  inviteCopied?: boolean;
  firstCardPublished?: boolean;
  practiceWeekDone?: boolean;
  graduated?: boolean;
};

type Store = Record<string, CommishSetupFlags>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getCommishSetup(leagueId: string): CommishSetupFlags {
  if (!leagueId) return {};
  return readAll()[leagueId] || {};
}

export function patchCommishSetup(
  leagueId: string,
  patch: Partial<CommishSetupFlags>
) {
  if (!leagueId) return;
  const all = readAll();
  all[leagueId] = { ...(all[leagueId] || {}), ...patch };
  writeAll(all);
}

export function markHostScreenSeen(leagueId: string) {
  patchCommishSetup(leagueId, { hostScreenSeen: true });
}

export function markInviteCopied(leagueId: string) {
  patchCommishSetup(leagueId, { inviteCopied: true });
}

export function markFirstCardPublished(leagueId: string) {
  patchCommishSetup(leagueId, { firstCardPublished: true });
}

export function markPracticeWeekDone(leagueId: string) {
  patchCommishSetup(leagueId, { practiceWeekDone: true });
}

export function markCommishGraduated(leagueId: string) {
  patchCommishSetup(leagueId, { graduated: true });
}

/**
 * First-time mode until they've scored a real week (or we mark graduated).
 * scoredWeeks from cloud wins over local flags.
 */
export function isFirstTimeCommish(opts: {
  leagueId: string;
  scoredWeekCount: number;
}): boolean {
  if (!opts.leagueId) return false;
  if (opts.scoredWeekCount > 0) {
    markCommishGraduated(opts.leagueId);
    return false;
  }
  const f = getCommishSetup(opts.leagueId);
  if (f.graduated) return false;
  return true;
}

/** Deep link that lands friends on join with code pre-filled. */
export function buildInviteJoinUrl(opts: {
  code: string;
  appUrl?: string;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const base =
    opts.appUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base || !code) return code ? `/join?code=${encodeURIComponent(code)}` : "";
  return `${base.replace(/\/$/, "")}/join?code=${encodeURIComponent(code)}`;
}

export type InviteFlavor =
  | "warroom"
  | "groupchat"
  | "dad"
  | "boomer"
  | "genx"
  | "xennial"
  | "millennial"
  | "chaos";

/**
 * Entertaining invite copy for texts/iMessage/Discord — every generation in 2026.
 * Deep link first so one tap opens join with code filled in.
 * Random flavor when flavor is omitted or "random" (fresh every share).
 * ANY league member can send these — not just the commissioner.
 */
export function buildInviteShareText(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
  /** Who’s sending — “Mike pulled you in” energy */
  inviterName?: string;
  flavor?: InviteFlavor | "random";
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const name = (opts.leagueName || "War Room").trim();
  const who = (opts.inviterName || "").trim();
  const joinUrl = buildInviteJoinUrl({ code, appUrl: opts.appUrl });
  const linkBlock = joinUrl ? `👉 ${joinUrl}` : code ? `Code: ${code}` : "";
  const codeLine = code ? `(Code if needed: ${code})` : "";

  const flavors: InviteFlavor[] = [
    "warroom",
    "groupchat",
    "dad",
    "boomer",
    "genx",
    "xennial",
    "millennial",
    "chaos",
  ];
  let flavor: InviteFlavor =
    opts.flavor && opts.flavor !== "random" ? opts.flavor : "warroom";
  if (!opts.flavor || opts.flavor === "random") {
    flavor = flavors[Math.floor(Math.random() * flavors.length)];
  }

  // Keep blank lines (""): they make SMS/iMessage readable. Only drop null.
  const by: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      "War Room Pick'em = college football with YOUR people.",
      "5 confidence picks · one Best Bet · one prop · standings that don't lie.",
      "Championship for the top. Toilet Bowl for the rest (still a trophy).",
      "",
      "No fantasy draft. No waivers. No app that wants your life.",
      "Just Saturdays and opinions.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap → account if you need one → you're in. Don't ghost Saturday.",
    ],
    groupchat: [
      "STOP SCROLLING 🛑",
      "",
      who
        ? `${who} just put you in ${name}.`
        : `You've been voluntold for ${name}.`,
      "",
      "It's our CFB pick'em league — the one that will live in this chat all fall.",
      "Every week: 5 games, confidence 1–5, Best Bet, prop.",
      "Winner gets glory. Last place gets the Toilet Bowl and permanent meme status.",
      "",
      "ONE TAP (code already in the link):",
      linkBlock,
      codeLine,
      "",
      "30 seconds. Zero excuses next Saturday. Do it now before you forget 😤",
    ],
    dad: [
      `Subject: Important football business (${name})`,
      "",
      who
        ? `${who} invited you. Don't make this weird.`
        : "You've been invited. Don't make this weird.",
      "",
      "War Room Pick'em = college football against the spread with the group.",
      "Pick games. Talk trash. Check the board after kickoff.",
      "There's a Toilet Bowl so the bottom half still has something to play for (and something to roast).",
      "",
      "How to join (easier than setting the DVR):",
      linkBlock,
      codeLine,
      "",
      "Click link → account if needed → done.",
      "See you Saturday. Love you. Don't reply-all if this is email.",
    ],
    boomer: [
      `Hello — you're invited to our football league: ${name}.`,
      "",
      "This is college football pick'em with friends. No gambling required. No complicated fantasy draft.",
      "",
      "What you do each week:",
      "1) Open the link below",
      "2) Pick 5 games (who covers the spread)",
      "3) Lock before kickoff",
      "4) Watch standings update after the games",
      "",
      "Tap this link — it opens with our league code already filled in:",
      linkBlock,
      codeLine,
      "",
      "If you can open a text message, you can do this.",
      "Call me if you get stuck. Looking forward to having you in the group!",
    ],
    genx: [
      who
        ? `${who} is not asking. You're in ${name}.`
        : `Plot twist: you're in ${name} now.`,
      "",
      "Remember when Saturday meant actual football opinions and nobody was \"building a brand\"?",
      "This is that. On your phone. With a scoreboard that keeps receipts.",
      "",
      "CFB pick'em. Confidence points. Best Bet. Props. Toilet Bowl for the cursed half of the room.",
      "No NFT. No crypto. No \"engage with our content.\" Just the group being wrong together.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up Saturdays. That's the whole product — we kept it simple on purpose.",
    ],
    xennial: [
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember hanging at somebody's place, pizza boxes, arguing about the line until kickoff?",
      "We ported that energy to 2026 — without the weird apps that want your kidney data.",
      "",
      "War Room: CFB pick'em · confidence · Best Bet · props · Gazette headlines · real standings.",
      "Championship banner if you're good. Toilet Bowl if you're content.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Saturday. That's it. That's the product.",
    ],
    millennial: [
      "ok so hear me out 🏈",
      "",
      who
        ? `${who} is dragging you into ${name} and honestly? correct decision.`
        : `you've been summoned to ${name}.`,
      "",
      "it's college football pick'em with the group — not another \"download this app and also our sister apps\" situation.",
      "5 picks a week. confidence points. one Best Bet. one prop. standings that will absolutely live rent-free in the group chat.",
      "top half: championship energy. bottom half: Toilet Bowl (still a trophy, still a personality).",
      "",
      "tap this (code's already in it):",
      linkBlock,
      codeLine,
      "",
      "seriously 30 seconds. then we can all be wrong about Alabama together. do it before the ADHD fairies take this text away ✨",
    ],
    chaos: [
      "🚨 GROUP CHAT EMERGENCY 🚨",
      "",
      `${name} needs bodies.`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's college football. It's legal-ish trash talk.",
      "You will either win a title OR star in the Toilet Bowl.",
      "Both are content. Both go in the Gazette. Both will be brought up at Thanksgiving.",
      "",
      "ONE TAP. NO EXCUSES. NO \"I'll do it later\":",
      linkBlock,
      codeLine,
      "",
      "If you don't join we're putting you on the milk carton in next week's headlines.",
      "THIS IS NOT A DRILL. (ok it is a little bit of a drill. still join.)",
    ],
  };

  return by[flavor]
    .filter((line) => line != null)
    .join("\n");
}

const PENDING_CODE_KEY = "warroom-pending-join-code";

/** Persist code across login → join (deep link). */
export function stashPendingJoinCode(code: string) {
  if (typeof window === "undefined") return;
  const c = (code || "").trim().toUpperCase();
  if (!c) return;
  try {
    sessionStorage.setItem(PENDING_CODE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function takePendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const c = sessionStorage.getItem(PENDING_CODE_KEY);
    if (c) sessionStorage.removeItem(PENDING_CODE_KEY);
    return c ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function peekPendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PENDING_CODE_KEY)?.toUpperCase() || null;
  } catch {
    return null;
  }
}

/**
 * One-tap invite: native share sheet when available, else copy.
 * Returns what happened for UI toast.
 */
export async function shareLeagueInvite(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
  inviterName?: string;
  flavor?: InviteFlavor | "random";
}): Promise<"shared" | "copied" | "failed"> {
  const text = buildInviteShareText({
    ...opts,
    flavor: opts.flavor ?? "random",
  });
  const url = buildInviteJoinUrl(opts);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `War Room: ${opts.leagueName}`,
        text,
        url: url || undefined,
      });
      return "shared";
    }
  } catch (e: unknown) {
    // User cancelled share — not a hard fail
    if (e instanceof Error && /Abort|cancel/i.test(e.message)) {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
