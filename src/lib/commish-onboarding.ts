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
  | "xennial"
  | "chaos";

/**
 * Entertaining invite copy for group texts — boomers through millennials.
 * Link first so one tap opens join with code filled in.
 * Random flavor when flavor is omitted (fresh every share).
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
  const codeLine = code ? `(Code if you need it: ${code})` : "";

  const flavors: InviteFlavor[] = [
    "warroom",
    "groupchat",
    "dad",
    "boomer",
    "xennial",
    "chaos",
  ];
  let flavor: InviteFlavor =
    opts.flavor && opts.flavor !== "random" ? opts.flavor : "warroom";
  if (!opts.flavor || opts.flavor === "random") {
    flavor = flavors[Math.floor(Math.random() * flavors.length)];
  }

  const by: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      "It's college football pick'em with your actual people — confidence picks, a Best Bet, a weekly prop, and a Toilet Bowl bracket for the back half of the room.",
      "",
      "No fantasy drafts. No waivers. Just Saturdays and opinions.",
      "",
      linkBlock,
      codeLine,
      "",
      "Make an account if you need one. Lock picks before first kickoff.",
      "Don't ghost Saturday.",
    ],
    groupchat: [
      "STOP SCROLLING.",
      "",
      who
        ? `${who} put you in ${name} — our CFB pick'em league.`
        : `You've been added to ${name} (CFB pick'em).`,
      "",
      "Every week: 5 games, confidence 1–5, one Best Bet, one prop.",
      "Winner gets glory. Last place gets the Toilet Bowl and permanent group-chat content.",
      "",
      "Link (code already filled in):",
      linkBlock,
      codeLine,
      "",
      "30 seconds to join. Zero excuses next Saturday.",
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
      "There's even a Toilet Bowl so the bottom half still has something to play for.",
      "",
      linkBlock,
      codeLine,
      "",
      "Click the link → account if needed → join. See you Saturday.",
    ],
    boomer: [
      `You're invited to ${name}.`,
      "",
      "College football pick'em with friends. Simple:",
      "• Pick 5 games a week",
      "• Lock before kickoff",
      "• Standings update after the games",
      "",
      "Tap this link (it opens with our code ready):",
      linkBlock,
      codeLine,
      "",
      "If you can open email, you can do this.",
    ],
    xennial: [
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember when friends watched games together and argued?",
      "This is that — on your phone — with a scoreboard that keeps receipts.",
      "",
      "CFB pick'em. Confidence points. Best Bet. Props. Gazette headlines.",
      "Championship for the top half. Toilet Bowl for the rest of us.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Saturday. That's the whole product.",
    ],
    chaos: [
      "GROUP CHAT EMERGENCY",
      "",
      `${name} needs bodies.`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's college football. It's legal-ish trash talk.",
      "You'll either win a title or star in the Toilet Bowl. Both are content.",
      "",
      "ONE TAP:",
      linkBlock,
      codeLine,
      "",
      "If you don't join, we're putting you on the milk carton in the Gazette.",
    ],
  };

  return by[flavor]
    .filter((line) => line != null && line !== "")
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
