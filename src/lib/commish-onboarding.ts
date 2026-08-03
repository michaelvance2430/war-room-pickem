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
  // Onboarding conversation engine — one-action success for "invite"
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("warroom-invite-shared", "1");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("warroom-invite-shared"));
      window.dispatchEvent(new CustomEvent("warroom-onboarding"));
    }
  } catch {
    /* ok */
  }
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
  | "chaos"
  | "primetime"
  | "tailgate"
  | "redzone";

/**
 * Resolve CFB vs NFL for invites — never guess wrong.
 * Prefer explicit sportId → active league → localStorage league row.
 * Defaults to cfb only as last resort.
 */
export function resolveInviteSportId(
  explicit?: string | null
): "cfb" | "nfl" {
  const norm = (s: string | null | undefined): "cfb" | "nfl" | null => {
    const x = (s || "").toLowerCase().trim();
    if (!x) return null;
    if (x === "nfl" || x === "pro" || x === "pro_football") return "nfl";
    if (
      x === "cfb" ||
      x === "ncaaf" ||
      x === "college" ||
      x === "college_football"
    )
      return "cfb";
    // Other packs (wwc, etc.) fall through — treat as non-NFL
    if (x.includes("nfl")) return "nfl";
    if (x.includes("cfb") || x.includes("ncaa")) return "cfb";
    return null;
  };

  const fromArg = norm(explicit);
  if (fromArg) return fromArg;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    const fromLeague = norm(getLeague()?.sportId);
    if (fromLeague) return fromLeague;
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("warroom-league");
      if (raw) {
        const j = JSON.parse(raw) as { sportId?: string };
        const fromLs = norm(j?.sportId);
        if (fromLs) return fromLs;
      }
    } catch {
      /* ignore */
    }
  }

  return "cfb";
}

/**
 * Entertaining invite copy for texts/iMessage/Discord — every generation in 2026.
 * Deep link first so one tap opens join with code filled in.
 * Random flavor when flavor is omitted or "random" (fresh every share).
 * ANY league member can send these — not just the commissioner.
 *
 * CRITICAL: sportId must match the room. NFL never gets CFB copy (and reverse).
 */
export function buildInviteShareText(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
  /** Who’s sending — “Mike pulled you in” energy */
  inviterName?: string;
  flavor?: InviteFlavor | "random";
  /** cfb | nfl — dual-sport invites must not sound like campus when it's Sunday */
  sportId?: string | null;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const name = (opts.leagueName || "War Room").trim();
  const who = (opts.inviterName || "").trim();
  const joinUrl = buildInviteJoinUrl({ code, appUrl: opts.appUrl });
  const linkBlock = joinUrl ? `👉 ${joinUrl}` : code ? `Code: ${code}` : "";
  const codeLine = code ? `(Code if needed: ${code})` : "";
  const sportId = resolveInviteSportId(opts.sportId);
  const nfl = sportId === "nfl";
  // Always explicit — dual-sport invites must not be ambiguous
  const sportBanner = nfl
    ? "🏈 LEAGUE TYPE: NFL — pro football pick'em"
    : "🏟️ LEAGUE TYPE: CFB — college football pick'em";

  const flavors: InviteFlavor[] = [
    "warroom",
    "groupchat",
    "dad",
    "boomer",
    "genx",
    "xennial",
    "millennial",
    "chaos",
    "primetime",
    "tailgate",
    "redzone",
  ];
  let flavor: InviteFlavor =
    opts.flavor && opts.flavor !== "random" ? opts.flavor : "warroom";
  if (!opts.flavor || opts.flavor === "random") {
    // NFL: weight the new Sunday-flavored templates a bit more often
    if (nfl) {
      const nflWeighted: InviteFlavor[] = [
        ...flavors,
        "primetime",
        "tailgate",
        "redzone",
        "chaos",
        "groupchat",
      ];
      flavor =
        nflWeighted[Math.floor(Math.random() * nflWeighted.length)];
    } else {
      flavor = flavors[Math.floor(Math.random() * flavors.length)];
    }
  }

  // Keep blank lines (""): they make SMS/iMessage readable. Only drop null.
  // Every flavor must name CFB or NFL (not just "football").
  const byCfb: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      sportBanner,
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      `War Room Pick'em · CFB (college football) with YOUR people.`,
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
      sportBanner,
      "STOP SCROLLING 🛑",
      "",
      who
        ? `${who} just put you in ${name}.`
        : `You've been voluntold for ${name}.`,
      "",
      "It's our CFB (college football) pick'em league — not NFL — and it'll live in this chat all fall.",
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
      sportBanner,
      `Subject: CFB league invite — ${name}`,
      "",
      who
        ? `${who} invited you. Don't make this weird.`
        : "You've been invited. Don't make this weird.",
      "",
      "War Room Pick'em = CFB (college football) against the spread with the group.",
      "This is NOT the NFL room — Saturdays, campus, the whole thing.",
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
      sportBanner,
      `Hello — you're invited to our CFB (college football) league: ${name}.`,
      "",
      "This is college football pick'em with friends — CFB, not the NFL. No gambling required. No complicated fantasy draft.",
      "",
      "What you do each week:",
      "1) Open the link below",
      "2) Pick 5 CFB games (who covers the spread)",
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
      sportBanner,
      who
        ? `${who} is not asking. You're in ${name}.`
        : `Plot twist: you're in ${name} now.`,
      "",
      "Remember when Saturday meant actual CFB opinions and nobody was \"building a brand\"?",
      "This is that. On your phone. With a scoreboard that keeps receipts.",
      "",
      "CFB (college football) pick'em — not NFL. Confidence points. Best Bet. Props. Toilet Bowl for the cursed half of the room.",
      "No NFT. No crypto. No \"engage with our content.\" Just the group being wrong together.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up Saturdays. That's the whole product — we kept it simple on purpose.",
    ],
    xennial: [
      sportBanner,
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember hanging at somebody's place, pizza boxes, arguing about the CFB line until kickoff?",
      "We ported that energy to 2026 — without the weird apps that want your kidney data.",
      "",
      "War Room: CFB (college football) pick'em · confidence · Best Bet · props · Gazette headlines · real standings.",
      "Championship banner if you're good. Toilet Bowl if you're content.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Saturday. That's it. That's the product.",
    ],
    millennial: [
      sportBanner,
      "ok so hear me out 🏈",
      "",
      who
        ? `${who} is dragging you into ${name} and honestly? correct decision.`
        : `you've been summoned to ${name}.`,
      "",
      "it's CFB (college football) pick'em with the group — not NFL, not another \"download this app and also our sister apps\" situation.",
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
      sportBanner,
      "🚨 GROUP CHAT EMERGENCY 🚨",
      "",
      `${name} needs bodies. (CFB league — college football, not NFL.)`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's CFB. It's legal-ish trash talk.",
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
    primetime: [
      sportBanner,
      "📺 PRIMETIME PICK'EM (still CFB)",
      "",
      who
        ? `${who} wants you in ${name} for college Saturdays.`
        : `${name} is live — college Saturdays only.`,
      "",
      "CFB (college football) — not the NFL. Night games. Big brands. Bigger regrets.",
      "5 confidence picks · Best Bet · prop · Gazette headlines.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap in before kickoff. Campus energy only.",
    ],
    tailgate: [
      sportBanner,
      "🌭 TAILGATE ENERGY — CFB ONLY",
      "",
      who
        ? `${who} is grilling spots in ${name}.`
        : `There's a seat in ${name}. Bring opinions.`,
      "",
      "College football pick'em (CFB, not NFL). Confidence ranks. Toilet Bowl for the cursed half.",
      "No fantasy draft. Just Saturdays and the group chat.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join. Trash talk. Repeat every Saturday.",
    ],
    redzone: [
      sportBanner,
      "🚨 RED ZONE ALERT — CFB ROOM",
      "",
      `${name} is taking college football seriously (well… sort of).`,
      who ? `From: ${who}` : null,
      "",
      "This is CFB pick'em — campus, not the NFL. One card a week. Standings that keep receipts.",
      "",
      linkBlock,
      codeLine,
      "",
      "You're either in or you're in the milk carton. CFB only.",
    ],
  };

  const byNfl: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      sportBanner,
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      "War Room Pick'em · NFL (pro football) with YOUR people.",
      "5 confidence picks · one Best Bet · one prop · standings that don't lie.",
      "Championship for the top. Toilet Bowl for the rest (still a trophy).",
      "",
      "No fantasy draft. No waivers. No app that wants your life.",
      "Just Sundays, late windows, and opinions.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap → account if you need one → you're in. Don't ghost Sunday.",
    ],
    groupchat: [
      sportBanner,
      "STOP SCROLLING 🛑",
      "",
      who
        ? `${who} just put you in ${name}.`
        : `You've been voluntold for ${name}.`,
      "",
      "It's our NFL pick'em league — pro football, not college — and it'll live in this chat all season.",
      "Every week: 5 games, confidence 1–5, Best Bet, prop.",
      "Winner gets glory. Last place gets the Toilet Bowl and permanent meme status.",
      "",
      "ONE TAP (code already in the link):",
      linkBlock,
      codeLine,
      "",
      "30 seconds. Zero excuses next Sunday. Do it now before you forget 😤",
    ],
    dad: [
      sportBanner,
      `Subject: NFL league invite — ${name}`,
      "",
      who
        ? `${who} invited you. Don't make this weird.`
        : "You've been invited. Don't make this weird.",
      "",
      "War Room Pick'em = NFL (pro football) against the spread with the group.",
      "This is NOT the CFB/college room — Sundays, late windows, the whole thing.",
      "Pick games. Talk trash. Check the board after kickoff.",
      "There's a Toilet Bowl so the bottom half still has something to play for (and something to roast).",
      "",
      "How to join (easier than setting the DVR):",
      linkBlock,
      codeLine,
      "",
      "Click link → account if needed → done.",
      "See you Sunday. Love you. Don't reply-all if this is email.",
    ],
    boomer: [
      sportBanner,
      `Hello — you're invited to our NFL (pro football) league: ${name}.`,
      "",
      "This is NFL pick'em with friends — pro football, not college. No gambling required. No complicated fantasy draft.",
      "",
      "What you do each week:",
      "1) Open the link below",
      "2) Pick 5 NFL games (who covers the spread)",
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
      sportBanner,
      who
        ? `${who} is not asking. You're in ${name}.`
        : `Plot twist: you're in ${name} now.`,
      "",
      "Remember when Sunday meant actual NFL opinions and nobody was \"building a brand\"?",
      "This is that. On your phone. With a scoreboard that keeps receipts.",
      "",
      "NFL (pro football) pick'em — not CFB. Confidence points. Best Bet. Props. Toilet Bowl for the cursed half of the room.",
      "No NFT. No crypto. No \"engage with our content.\" Just the group being wrong together.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up Sundays. That's the whole product — we kept it simple on purpose.",
    ],
    xennial: [
      sportBanner,
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember hanging at somebody's place, pizza boxes, arguing about the NFL line until kickoff?",
      "We ported that energy to 2026 — without the weird apps that want your kidney data.",
      "",
      "War Room: NFL pick'em · confidence · Best Bet · props · Sunday Gazette · real standings.",
      "Championship banner if you're good. Toilet Bowl if you're content.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Sunday. That's it. That's the product.",
    ],
    millennial: [
      sportBanner,
      "ok so hear me out 🏈",
      "",
      who
        ? `${who} is dragging you into ${name} and honestly? correct decision.`
        : `you've been summoned to ${name}.`,
      "",
      "it's NFL pick'em with the group — pro football, not CFB, not another \"download this app and also our sister apps\" situation.",
      "5 picks a week. confidence points. one Best Bet. one prop. standings that will absolutely live rent-free in the group chat.",
      "top half: championship energy. bottom half: Toilet Bowl (still a trophy, still a personality).",
      "",
      "tap this (code's already in it):",
      linkBlock,
      codeLine,
      "",
      "seriously 30 seconds. then we can all be wrong about the late window together. do it before the ADHD fairies take this text away ✨",
    ],
    chaos: [
      sportBanner,
      "🚨 GROUP CHAT EMERGENCY 🚨",
      "",
      `${name} needs bodies. (NFL league — pro football, not CFB.)`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's NFL. It's legal-ish trash talk.",
      "You will either win a title OR star in the Toilet Bowl.",
      "Both are content. Both go in the Gazette. Both will be brought up at Thanksgiving.",
      "",
      "ONE TAP. NO EXCUSES. NO \"I'll do it later\":",
      linkBlock,
      codeLine,
      "",
      "If you don't join we're putting you on the inactive list in next week's headlines.",
      "THIS IS NOT A DRILL. (ok it is a little bit of a drill. still join.)",
    ],
    primetime: [
      sportBanner,
      "📺 SUNDAY / MNF / TNF ENERGY",
      "",
      who
        ? `${who} locked you into ${name} for the NFL season.`
        : `${name} is an NFL pick'em. Pro football only.`,
      "",
      "NFL — not college. Late windows. Flex scheduling. Zero campus.",
      "5 confidence picks · Best Bet · prop · standings that live in the chat all week.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap in. Don't ghost Thursday Night. Don't ghost Sunday. Don't ghost MNF.",
    ],
    tailgate: [
      sportBanner,
      "🌭 NFL TAILGATE — PRO FOOTBALL ONLY",
      "",
      who
        ? `${who} saved you a spot in ${name}.`
        : `Open seat in ${name}. NFL only.`,
      "",
      "Pro football pick'em (NFL, not CFB). Confidence ranks. Toilet Bowl for the cursed half.",
      "No fantasy draft. Just Sundays, late games, and the group chat.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up every Sunday. Roast responsibly.",
    ],
    redzone: [
      sportBanner,
      "🚨 RED ZONE ALERT — NFL ROOM",
      "",
      `${name} needs one more body in the NFL War Room.`,
      who ? `Commissioner / blame: ${who}` : null,
      "",
      "This is NFL pick'em — pro football, NOT college. One card a week. Real standings. Real receipts.",
      "Championship or Toilet Bowl. Both are content.",
      "",
      linkBlock,
      codeLine,
      "",
      "You're either in or you're on the inactive list. NFL only.",
    ],
  };

  const by = nfl ? byNfl : byCfb;
  const lines = by[flavor] || by.warroom;
  let text = lines.filter((line) => line != null).join("\n");

  // Belt-and-suspenders: never ship the wrong sport banner / copy
  if (nfl) {
    if (!/LEAGUE TYPE:\s*NFL/i.test(text)) {
      text = `${sportBanner}\n\n${text}`;
    }
    // If CFB leaked into an NFL message, rebuild with warroom NFL
    if (/\bCFB\b|college football|Saturdays only/i.test(text) && !/not CFB|not college|NOT the CFB|not campus/i.test(text)) {
      text = (byNfl.warroom || lines)
        .filter((line) => line != null)
        .join("\n");
    }
  } else {
    if (!/LEAGUE TYPE:\s*CFB/i.test(text)) {
      text = `${sportBanner}\n\n${text}`;
    }
  }

  // Always append join URL once more if somehow missing (iMessage truncations)
  if (joinUrl && !text.includes(joinUrl)) {
    text = `${text}\n\n${joinUrl}`;
  }

  return text;
}

/** Share-sheet title — always names the sport. */
export function buildInviteShareTitle(opts: {
  leagueName: string;
  sportId?: string | null;
}): string {
  const sportId = resolveInviteSportId(opts.sportId);
  const sport = sportId === "nfl" ? "NFL" : "CFB";
  const name = (opts.leagueName || "War Room").trim();
  return `War Room ${sport}: ${name}`;
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
  sportId?: string | null;
}): Promise<"shared" | "copied" | "failed"> {
  const sportId = resolveInviteSportId(opts.sportId);
  const text = buildInviteShareText({
    ...opts,
    sportId,
    flavor: opts.flavor ?? "random",
  });
  const url = buildInviteJoinUrl(opts);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: buildInviteShareTitle({
          leagueName: opts.leagueName,
          sportId,
        }),
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
