/**
 * Gazette share — newspaper graphic + caption for IG / FB / chats.
 * Flex the room, advertise War Room, keep the paper energy.
 */

import {
  formatGazetteShareText,
  type GazetteEdition,
} from "@/lib/gazette";

export type GazetteSharePack = {
  shareTitle: string;
  caption: string;
  shortLabel: string;
  filename: string;
};

export type GazetteShareResult =
  | "shared"
  | "copied"
  | "downloaded"
  | "failed"
  | "cancelled";

function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://warroompickem.com";
}

function sportHashtag(sportId?: string | null): string {
  if (sportId === "nfl") return "#NFL";
  if (sportId === "soccer_wwc") return "#WWC2027";
  return "#CFB";
}

/** Caption: paper headlines + War Room flex / ad. */
export function buildGazetteSharePack(
  edition: GazetteEdition
): GazetteSharePack {
  const origin = appOrigin();
  const week = edition.weekLabel || `Week ${edition.weekIndex}`;
  const ritual = edition.ritualName || "War Room Gazette";
  const body = formatGazetteShareText(edition);
  const tag = sportHashtag(edition.sportId);

  const caption = [
    body,
    "",
    "———",
    "War Room Pick'Em — friend leagues. Confidence picks. Best Bets. Toilet Bowl for the cursed half.",
    "No fantasy draft. No waivers. Just the room and the card.",
    "",
    `Join the chaos → ${origin}`,
    "",
    `#WarRoomPickEm #Gazette ${tag} #PickEm`,
  ].join("\n");

  return {
    shareTitle: `${ritual} · ${week}`,
    caption,
    shortLabel: week,
    filename: `war-room-gazette-w${edition.weekIndex}.png`,
  };
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number
): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.length > 0) {
    // ellipsis if truncated
    const last = lines[maxLines - 1];
    if (ctx.measureText(last + "…").width <= maxW) {
      lines[maxLines - 1] = last.replace(/[.,;:]?$/, "") + "…";
    }
  }
  return lines;
}

function fillWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
  align: CanvasTextAlign = "left"
): number {
  ctx.textAlign = align;
  const lines = wrapLines(ctx, text, maxW, maxLines);
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineH);
  });
  return lines.length * lineH;
}

/**
 * 1080×1080 newspaper card — cream paper, EXTRA stamp, A1 crown, War Room ad strip.
 */
export function renderGazetteShareCanvas(
  edition: GazetteEdition,
  opts?: { size?: number }
): HTMLCanvasElement {
  const size = opts?.size ?? 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const s = size / 1080;
  const paper = "#f4f0e6";
  const ink = "#1c1917";
  const muted = "#57534e";
  const rule = "#a8a29e";
  const isNfl = edition.sportId === "nfl";
  const isWwc = edition.sportId === "soccer_wwc";
  const stamp = isWwc ? "#009C3B" : isNfl ? "#0B1426" : "#b91c1c";
  const accent = isWwc ? "#002776" : isNfl ? "#C1121F" : "#991b1b";

  // Paper background
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);

  // Subtle paper grain
  ctx.save();
  for (let i = 0; i < 120; i++) {
    const x = ((i * 97) % 1080) * s;
    const y = ((i * 53) % 1080) * s;
    ctx.fillStyle = `rgba(0,0,0,${0.015 + (i % 3) * 0.008})`;
    ctx.fillRect(x, y, 2 * s, 2 * s);
  }
  ctx.restore();

  // Outer border
  ctx.strokeStyle = ink;
  ctx.lineWidth = 10 * s;
  ctx.strokeRect(28 * s, 28 * s, size - 56 * s, size - 56 * s);
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(42 * s, 42 * s, size - 84 * s, size - 84 * s);

  // EXTRA stamp bar
  ctx.fillStyle = stamp;
  ctx.fillRect(56 * s, 56 * s, size - 112 * s, 52 * s);
  ctx.font = `900 ${22 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = isWwc ? "#FFDF00" : "#f4f0e6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    (edition.stampLine || "EXTRA · EXTRA").toUpperCase(),
    size / 2,
    82 * s
  );

  // Masthead
  ctx.fillStyle = ink;
  ctx.font = `900 ${Math.min(54, 48) * s}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = "alphabetic";
  const mast =
    (edition.masthead || "WAR ROOM GAZETTE").toUpperCase().slice(0, 28);
  // shrink if needed
  let mastSize = 48 * s;
  ctx.font = `900 ${mastSize}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(mast).width > size - 140 * s && mastSize > 28 * s) {
    mastSize -= 2 * s;
    ctx.font = `900 ${mastSize}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillText(mast, size / 2, 160 * s);

  // Volume / week
  ctx.font = `600 ${18 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = muted;
  const vol = [
    edition.ritualName || "War Room Edition",
    edition.volumeLabel,
    edition.weekLabel,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillText(vol.slice(0, 72), size / 2, 195 * s);

  // Double rule
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(70 * s, 220 * s);
  ctx.lineTo(size - 70 * s, 220 * s);
  ctx.stroke();
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(70 * s, 228 * s);
  ctx.lineTo(size - 70 * s, 228 * s);
  ctx.stroke();

  // Tagline
  ctx.font = `italic 500 ${20 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = muted;
  ctx.fillText(
    (edition.tagline || "All the news that's fit to roast").slice(0, 56),
    size / 2,
    258 * s
  );

  // A1 kicker
  ctx.font = `800 ${16 * s}px system-ui, sans-serif`;
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.fillText("A1 · CROWN", 80 * s, 310 * s);

  // Crown headline
  ctx.fillStyle = ink;
  ctx.font = `900 ${36 * s}px Georgia, "Times New Roman", serif`;
  let y = 350 * s;
  y +=
    fillWrapped(
      ctx,
      edition.crown?.headline || "SOMEBODY WON THE WEEK",
      80 * s,
      y,
      size - 160 * s,
      42 * s,
      3,
      "left"
    ) +
    8 * s;

  // Crown deck
  ctx.font = `500 ${22 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = muted;
  y +=
    fillWrapped(
      ctx,
      edition.crown?.deck || "",
      80 * s,
      y,
      size - 160 * s,
      28 * s,
      3,
      "left"
    ) +
    16 * s;

  // Rule
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(80 * s, y);
  ctx.lineTo(size - 80 * s, y);
  ctx.stroke();
  y += 28 * s;

  // Chaos or shame secondary
  if (edition.chaosDetonation) {
    ctx.font = `800 ${15 * s}px system-ui, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText("💥 CHAOS DESK", 80 * s, y);
    y += 28 * s;
    ctx.fillStyle = ink;
    ctx.font = `800 ${26 * s}px Georgia, "Times New Roman", serif`;
    y +=
      fillWrapped(
        ctx,
        edition.chaosDetonation.headline,
        80 * s,
        y,
        size - 160 * s,
        32 * s,
        2,
        "left"
      ) +
      12 * s;
  } else if (edition.shame) {
    ctx.font = `800 ${15 * s}px system-ui, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText("🚽 WALL OF SHAME", 80 * s, y);
    y += 28 * s;
    ctx.fillStyle = ink;
    ctx.font = `800 ${26 * s}px Georgia, "Times New Roman", serif`;
    y +=
      fillWrapped(
        ctx,
        edition.shame.headline,
        80 * s,
        y,
        size - 160 * s,
        32 * s,
        2,
        "left"
      ) +
      12 * s;
  }

  // Pull quote box
  const quoteY = Math.max(y + 10 * s, 720 * s);
  ctx.fillStyle = hexAlpha(stamp, 0.08);
  ctx.fillRect(70 * s, quoteY, size - 140 * s, 100 * s);
  ctx.strokeStyle = hexAlpha(ink, 0.25);
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(70 * s, quoteY, size - 140 * s, 100 * s);

  ctx.font = `italic 600 ${22 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  const q = `"${(edition.pullQuote?.text || "Trust the process.").replace(/^"|"$/g, "")}"`;
  fillWrapped(ctx, q, size / 2, quoteY + 36 * s, size - 200 * s, 28 * s, 2, "center");
  ctx.font = `600 ${16 * s}px system-ui, sans-serif`;
  ctx.fillStyle = muted;
  ctx.fillText(
    `— ${edition.pullQuote?.by || "The desk"}`,
    size / 2,
    quoteY + 82 * s
  );

  // War Room ad strip (flex / advertisement)
  const adY = size - 130 * s;
  ctx.fillStyle = stamp;
  ctx.fillRect(56 * s, adY, size - 112 * s, 74 * s);
  ctx.font = `800 ${20 * s}px system-ui, sans-serif`;
  ctx.fillStyle = isWwc ? "#FFDF00" : "#f4f0e6";
  ctx.textAlign = "center";
  ctx.fillText("WAR ROOM PICK'EM", size / 2, adY + 28 * s);
  ctx.font = `600 ${15 * s}px system-ui, sans-serif`;
  ctx.fillStyle = isWwc ? "#FFFFFF" : hexAlpha("#f4f0e6", 0.9);
  ctx.fillText(
    "Friend leagues · confidence · Best Bet · Toilet Bowl",
    size / 2,
    adY + 52 * s
  );

  return canvas;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export image"))),
      "image/png"
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
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

/**
 * Prefer native share with image (IG/FB/Messages on phone).
 * FB/IG web buttons: download image + caption, open app.
 */
export async function shareGazetteToSocial(
  edition: GazetteEdition,
  mode: "native" | "download" | "copy_caption" | "facebook" | "instagram" | "copy_text"
): Promise<GazetteShareResult> {
  const pack = buildGazetteSharePack(edition);

  if (mode === "copy_caption" || mode === "copy_text") {
    try {
      await navigator.clipboard.writeText(pack.caption);
      return "copied";
    } catch {
      return "failed";
    }
  }

  const canvas = renderGazetteShareCanvas(edition);
  const blob = await canvasToPngBlob(canvas);
  const file = new File([blob], pack.filename, { type: "image/png" });

  if (mode === "download") {
    downloadBlob(blob, pack.filename);
    try {
      await navigator.clipboard.writeText(pack.caption);
    } catch {
      /* ok */
    }
    return "downloaded";
  }

  if (mode === "instagram") {
    downloadBlob(blob, pack.filename);
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
    downloadBlob(blob, pack.filename);
    try {
      await navigator.clipboard.writeText(pack.caption);
    } catch {
      /* ok */
    }
    const quote = encodeURIComponent(pack.caption.slice(0, 500));
    const u = encodeURIComponent(appOrigin());
    try {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${quote}`,
        "_blank",
        "noopener,noreferrer,width=600,height=700"
      );
    } catch {
      /* ok */
    }
    return "downloaded";
  }

  // Native share with image
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
        url: appOrigin(),
      });
      downloadBlob(blob, pack.filename);
      return "shared";
    }
  } catch (e: unknown) {
    if (e instanceof Error && /Abort|cancel/i.test(e.message)) {
      return "cancelled";
    }
  }

  downloadBlob(blob, pack.filename);
  try {
    await navigator.clipboard.writeText(pack.caption);
  } catch {
    /* ok */
  }
  return "downloaded";
}
