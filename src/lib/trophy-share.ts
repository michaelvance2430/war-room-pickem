/**
 * Share championship / Toilet Bowl / Village Nerd / division hardware
 * to IG, FB, group chats — unique graphic + hilarious caption per win type.
 */

import type { ProfileTrophyKind } from "./profile-hardware";

export type ShareableTrophy = {
  kind: ProfileTrophyKind;
  seasonYear: number;
  winnerName: string;
  leagueName?: string;
  division?: string | null;
  subtitle?: string | null;
  /** cfb | nfl — dual-sport hashtags / day-of-week energy */
  sportId?: string | null;
};

function resolveShareSport(sportId?: string | null): "cfb" | "nfl" {
  if (sportId === "nfl") return "nfl";
  if (sportId === "cfb") return "cfb";
  try {
    // Lazy — avoid circular imports at module init
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  } catch {
    return "cfb";
  }
}

export type TrophySharePack = {
  kind: ProfileTrophyKind;
  /** Short label for UI */
  shortLabel: string;
  /** Share sheet title */
  shareTitle: string;
  /** Instagram / Facebook / text caption */
  caption: string;
  /** Hashtags (appended on some platforms) */
  hashtags: string;
  /** Canvas palette */
  colors: {
    bg0: string;
    bg1: string;
    accent: string;
    accent2: string;
    text: string;
    muted: string;
  };
  emoji: string;
  heroLine: string;
  subLine: string;
  footerRoast: string;
};

function firstName(full: string) {
  return (full || "Champ").trim().split(/\s+/)[0] || "Champ";
}

function divisionLabel(div?: string | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { divisionFullLabel } = require("./divisions") as typeof import("./divisions");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    return divisionFullLabel(div, getLeague()?.sportId) || "Division";
  } catch {
    const d = (div || "").trim();
    return d ? `${d} Division` : "Division";
  }
}

/** Hilarious, distinct write-ups — different personality per hardware type. */
export function buildTrophySharePack(t: ShareableTrophy): TrophySharePack {
  const year = t.seasonYear;
  const name = (t.winnerName || "Someone").trim();
  const first = firstName(name);
  const league = (t.leagueName || "War Room").trim();
  const div = divisionLabel(t.division);
  const nfl = resolveShareSport(t.sportId) === "nfl";
  const sportTag = nfl ? "#NFL" : "#CFB";
  const dayWord = nfl ? "Sundays" : "Saturdays";
  const champHero = nfl ? "WAR ROOM CHAMPION" : "NATIONAL CHAMPION";
  const champLabel = nfl ? "Champion" : "National title";

  const packs: Record<ProfileTrophyKind, TrophySharePack> = {
    championship: {
      kind: "championship",
      shortLabel: champLabel,
      shareTitle: `${year} War Room Champion — ${name}`,
      emoji: "🏆",
      heroLine: champHero,
      subLine: `${year} · ${league}`,
      footerRoast: "They said it was a long season. They were right. And wrong.",
      caption: [
        `🏆 ${name} is your ${year} ${league} ${nfl ? "WAR ROOM CHAMPION" : "NATIONAL CHAMPION"}.`,
        ``,
        `Not "pretty good." Not "top of the chat." The big one.`,
        `Confidence picks. Best Bets. Props. ${dayWord} that aged like fine trash talk.`,
        ``,
        `If you doubted ${first} all year: this post is your apology form.`,
        `If you rode with them: cash the clout, buy the pizza.`,
        ``,
        `Hardware is permanent. Group-chat amnesia is not.`,
        ``,
        `#WarRoomPickEm ${sportTag} #Champion #${year}`,
      ].join("\n"),
      hashtags: `#WarRoomPickEm ${sportTag} #Champion`,
      colors: {
        bg0: "#0c0a06",
        bg1: "#1a1408",
        accent: "#fbbf24",
        accent2: "#f59e0b",
        text: "#fffbeb",
        muted: "#d6d3d1",
      },
    },
    toilet_bowl: {
      kind: "toilet_bowl",
      shortLabel: "Toilet Bowl",
      shareTitle: `${year} Toilet Bowl Champ — ${name}`,
      emoji: "🚽",
      heroLine: "TOILET BOWL CHAMPION",
      subLine: `${year} · Bottom half. Still a crown.`,
      footerRoast: "Glory is glory. Even when it flushes.",
      caption: [
        `🚽 ${name} just won the ${year} TOILET BOWL.`,
        ``,
        `That's right. The bottom half had a tournament.`,
        `And ${first} beat EVERYONE in it.`,
        ``,
        `Is it prestigious? Debatable.`,
        `Is it permanent? Absolutely.`,
        `Will this image live in the group chat forever? You already know.`,
        ``,
        `They didn't win the National Title.`,
        `They won something better: a story you will never let die.`,
        ``,
        `Proudly engraved. Loudly shared. Zero shame. Maximum content.`,
        ``,
        `#ToiletBowl #WarRoomPickEm ${sportTag} #StillATrophy #${year}`,
      ].join("\n"),
      hashtags: `#ToiletBowl #WarRoomPickEm ${sportTag} #StillATrophy`,
      colors: {
        bg0: "#0a0612",
        bg1: "#1a0b2e",
        accent: "#c084fc",
        accent2: "#a855f7",
        text: "#f5f3ff",
        muted: "#c4b5fd",
      },
    },
    crystal_ball: {
      kind: "crystal_ball",
      shortLabel: "Nerd King",
      shareTitle: `${year} Village Nerd — ${name}`,
      emoji: "🔮",
      heroLine: "VILLAGE NERD KING",
      subLine: nfl
        ? `${year} · Pride pick · Super Bowl flex`
        : `${year} · Crystal Ball national champ`,
      footerRoast: "Zero standings points. Infinite smug. Correct once.",
      caption: [
        `🔮 ANNOUNCING YOUR ${year} VILLAGE NERD / NERD KING: ${name}`,
        ``,
        nfl
          ? `While y'all were sweating spreads, ${first} was out here calling the Super Bowl champ as a pride pick.`
          : `While y'all were sweating spreads, ${first} was out here calling the NATIONAL CHAMPION in the Crystal Ball.`,
        ``,
        `Prize pool: $0`,
        `Standings impact: also $0`,
        `Smugness: federally unregulated`,
        ``,
        `They get a plaque. You get the "I told you so" for free.`,
        `This is pure prophecy energy. Nerd hardware. Absolute cinema.`,
        ``,
        `#VillageNerd #NerdKing #CrystalBall #WarRoomPickEm ${sportTag} #${year}`,
      ].join("\n"),
      hashtags: `#VillageNerd #NerdKing #CrystalBall #WarRoomPickEm ${sportTag}`,
      colors: {
        bg0: "#020617",
        bg1: "#0c1929",
        accent: "#38bdf8",
        accent2: "#0ea5e9",
        text: "#f0f9ff",
        muted: "#7dd3fc",
      },
    },
    division: {
      kind: "division",
      shortLabel: "Division champ",
      shareTitle: `${year} ${div} Champ — ${name}`,
      emoji: "🛡️",
      heroLine: `${(t.division || "DIVISION").toString().toUpperCase()} CHAMPION`,
      subLine: `${year} · ${league} · ${div}`,
      footerRoast: "Own your division. Let the playoffs sort the rest.",
      caption: [
        `🛡️ ${name} runs the ${div}.`,
        ``,
        `${year} ${league} DIVISION CHAMPION.`,
        ``,
        `While other divisions were doing whatever they do, ${first}'s side of the bracket was a dictatorship.`,
        `Season points. Consistency. Occasional miracles. Maximum division bragging rights.`,
        ``,
        `National title is another conversation.`,
        `This post is about LOCAL DOMINANCE and making three other divisions slightly mad.`,
        ``,
        `#DivisionChamp #WarRoomPickEm ${sportTag} #${year}`,
      ].join("\n"),
      hashtags: `#DivisionChamp #WarRoomPickEm ${sportTag}`,
      colors: {
        bg0: "#04140f",
        bg1: "#0a2e22",
        accent: "#34d399",
        accent2: "#10b981",
        text: "#ecfdf5",
        muted: "#6ee7b7",
      },
    },
  };

  return packs[t.kind];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draw a 1080×1080 IG/FB-ready trophy graphic. */
export function renderTrophyShareCanvas(
  t: ShareableTrophy,
  opts?: { size?: number }
): HTMLCanvasElement {
  const size = opts?.size ?? 1080;
  const pack = buildTrophySharePack(t);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { colors } = pack;
  const s = size / 1080;

  // Background gradient
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, colors.bg0);
  g.addColorStop(0.45, colors.bg1);
  g.addColorStop(1, colors.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Soft radial glow
  const glow = ctx.createRadialGradient(
    size * 0.5,
    size * 0.38,
    size * 0.05,
    size * 0.5,
    size * 0.4,
    size * 0.55
  );
  glow.addColorStop(0, hexAlpha(colors.accent, 0.35));
  glow.addColorStop(0.5, hexAlpha(colors.accent2, 0.12));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Corner confetti / stars
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const x = ((i * 137) % 1000) * s + 40 * s;
    const y = ((i * 97) % 1000) * s + 40 * s;
    const r = (3 + (i % 4)) * s;
    ctx.fillStyle = hexAlpha(i % 2 ? colors.accent : colors.accent2, 0.25 + (i % 5) * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Outer frame
  ctx.strokeStyle = hexAlpha(colors.accent, 0.55);
  ctx.lineWidth = 8 * s;
  roundRect(ctx, 36 * s, 36 * s, size - 72 * s, size - 72 * s, 40 * s);
  ctx.stroke();
  ctx.strokeStyle = hexAlpha(colors.accent2, 0.25);
  ctx.lineWidth = 2 * s;
  roundRect(ctx, 52 * s, 52 * s, size - 104 * s, size - 104 * s, 32 * s);
  ctx.stroke();

  // Brand strip
  ctx.fillStyle = hexAlpha(colors.accent, 0.12);
  roundRect(ctx, 100 * s, 100 * s, size - 200 * s, 56 * s, 16 * s);
  ctx.fill();
  ctx.font = `700 ${22 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WAR ROOM PICK'EM", size / 2, 128 * s);

  // Emoji / hero glyph
  ctx.font = `${160 * s}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(pack.emoji, size / 2, 300 * s);

  // Hero line
  ctx.font = `800 ${Math.min(64, 56) * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = colors.accent;
  ctx.fillText(pack.heroLine, size / 2, 430 * s);

  // Winner name
  const name = (t.winnerName || "Champion").trim();
  let nameSize = 72 * s;
  ctx.font = `800 ${nameSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  while (ctx.measureText(name).width > size - 160 * s && nameSize > 36 * s) {
    nameSize -= 2 * s;
    ctx.font = `800 ${nameSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  }
  ctx.fillStyle = colors.text;
  ctx.fillText(name, size / 2, 520 * s);

  // Sub line
  ctx.font = `600 ${28 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = colors.muted;
  ctx.fillText(pack.subLine, size / 2, 580 * s);

  if (t.subtitle) {
    ctx.font = `500 ${24 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillStyle = hexAlpha(colors.text, 0.85);
    ctx.fillText(t.subtitle.slice(0, 48), size / 2, 625 * s);
  }

  // Divider
  ctx.strokeStyle = hexAlpha(colors.accent, 0.4);
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(200 * s, 680 * s);
  ctx.lineTo(size - 200 * s, 680 * s);
  ctx.stroke();

  // Footer roast (wrap)
  ctx.font = `500 ${26 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = colors.text;
  wrapCenter(ctx, pack.footerRoast, size / 2, 740 * s, size - 180 * s, 36 * s);

  // Bottom brand
  ctx.font = `700 ${20 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = hexAlpha(colors.accent, 0.75);
  ctx.fillText("Share the hardware · Tag the haters", size / 2, 980 * s);

  return canvas;
}

function wrapCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineH);
  });
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export image"))),
      "image/png"
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type TrophyShareResult =
  | "shared"
  | "copied"
  | "downloaded"
  | "failed"
  | "cancelled";

/**
 * Prefer native share sheet with image file (IG / FB / Messages on mobile).
 * Falls back to download + copy caption.
 */
export async function shareTrophyToSocial(
  t: ShareableTrophy,
  mode: "native" | "download" | "copy_caption" | "facebook" | "instagram"
): Promise<TrophyShareResult> {
  const pack = buildTrophySharePack(t);
  const canvas = renderTrophyShareCanvas(t);
  const blob = await canvasToPngBlob(canvas);
  const filename = `war-room-${t.kind}-${t.seasonYear}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (mode === "copy_caption") {
    try {
      await navigator.clipboard.writeText(pack.caption);
      return "copied";
    } catch {
      return "failed";
    }
  }

  if (mode === "download") {
    downloadBlob(blob, filename);
    try {
      await navigator.clipboard.writeText(pack.caption);
    } catch {
      /* ok */
    }
    return "downloaded";
  }

  if (mode === "instagram") {
    // No public web post API — download + open IG so user can post Stories/Feed
    downloadBlob(blob, filename);
    try {
      await navigator.clipboard.writeText(pack.caption);
    } catch {
      /* ok */
    }
    try {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch {
      /* ok */
    }
    return "downloaded";
  }

  if (mode === "facebook") {
    downloadBlob(blob, filename);
    try {
      await navigator.clipboard.writeText(pack.caption);
    } catch {
      /* ok */
    }
    // Quote-friendly share; image still from gallery after download
    const quote = encodeURIComponent(pack.caption.slice(0, 500));
    try {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?quote=${quote}`,
        "_blank",
        "noopener,noreferrer,width=600,height=700"
      );
    } catch {
      /* ok */
    }
    return "downloaded";
  }

  // Native share with image when supported (best path for IG/FB on phones)
  try {
    const canFiles =
      typeof navigator !== "undefined" &&
      !!navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [file] }));

    if (canFiles && navigator.share) {
      await navigator.share({
        title: pack.shareTitle,
        text: pack.caption,
        files: [file],
      });
      return "shared";
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: pack.shareTitle,
        text: pack.caption,
      });
      downloadBlob(blob, filename);
      return "shared";
    }
  } catch (e: unknown) {
    if (e instanceof Error && /Abort|cancel/i.test(e.message)) {
      return "cancelled";
    }
  }

  // Desktop fallback
  downloadBlob(blob, filename);
  try {
    await navigator.clipboard.writeText(pack.caption);
  } catch {
    /* ok */
  }
  return "downloaded";
}
