import type { Player } from "./types";
import { rankPlayersWithSwings, weekCrownAndShame } from "./fun-board";
import { weekTitle } from "./dates";

export type WeeklyResultsShareModel = {
  leagueName: string;
  sportId: string;
  weekIndex: number;
  weekLabel: string;
  crown: { name: string; points: number };
  shame: { name: string; points: number } | null;
  leader: { name: string; points: number };
  mover: { name: string; spots: number } | null;
  headline: string;
};

export function buildWeeklyResultsShareModel(
  players: Player[],
  opts: { leagueName: string; sportId?: string | null }
): WeeklyResultsShareModel | null {
  const eligible = players.filter((player) => !player.isMock);
  const result = weekCrownAndShame(eligible);
  if (!result || eligible.length < 2) return null;

  const ranked = rankPlayersWithSwings(eligible, opts.sportId);
  const leader = ranked[0];
  if (!leader) return null;
  const mover = ranked
    .filter((player) => player.swing.delta > 0)
    .sort((a, b) => b.swing.delta - a.swing.delta || a.rank - b.rank)[0];
  const weekLabel = weekTitle(result.weekIndex, opts.sportId || "cfb");
  const crownName = result.crown.player.name;

  return {
    leagueName: opts.leagueName || "War Room",
    sportId: opts.sportId || "cfb",
    weekIndex: result.weekIndex,
    weekLabel,
    crown: { name: crownName, points: result.crown.pts },
    shame: result.samePerson
      ? null
      : { name: result.shame.player.name, points: result.shame.pts },
    leader: { name: leader.name, points: leader.totalPoints },
    mover: mover ? { name: mover.name, spots: mover.swing.delta } : null,
    headline: `${crownName.toUpperCase()} WON THE WEEK. THE GROUP CHAT HAS BEEN NOTIFIED.`,
  };
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startingSize: number,
  weight = 900
) {
  let size = startingSize;
  do {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 24);
}

export function renderWeeklyResultsCanvas(model: WeeklyResultsShareModel): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const accent = model.sportId === "nfl" ? "#c1121f" : "#22c55e";
  ctx.fillStyle = "#070a0d";
  ctx.fillRect(0, 0, 1080, 1350);
  const gradient = ctx.createRadialGradient(540, 220, 30, 540, 220, 720);
  gradient.addColorStop(0, model.sportId === "nfl" ? "rgba(193,18,31,.35)" : "rgba(34,197,94,.25)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 900);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(34, 34, 1012, 1282);
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "900 24px Arial, sans-serif";
  ctx.fillText("OFFICIAL WEEKLY AFTER-ACTION REPORT", 540, 100);
  ctx.fillStyle = "#ffffff";
  fitText(ctx, model.leagueName.toUpperCase(), 900, 58);
  ctx.fillText(model.leagueName.toUpperCase(), 540, 174);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "700 25px Arial, sans-serif";
  ctx.fillText(model.weekLabel.toUpperCase(), 540, 220);

  ctx.fillStyle = "#ffffff";
  fitText(ctx, model.headline, 890, 54);
  const words = model.headline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 880 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((value, index) => ctx.fillText(value, 540, 310 + index * 64));

  const cards = [
    ["WEEKLY CROWN", model.crown.name, `${model.crown.points} PTS`, "#facc15"],
    ["WALL OF SHAME", model.shame?.name || "NO SEPARATE VICTIM", model.shame ? `${model.shame.points} PTS` : "SOLO OPERATION", "#fb7185"],
    ["COMMANDING THE BOARD", model.leader.name, `${model.leader.points} SEASON PTS`, accent],
    ["BIGGEST MOVER", model.mover?.name || "THE BOARD HELD", model.mover ? `UP ${model.mover.spots} SPOT${model.mover.spots === 1 ? "" : "S"}` : "NO MOVEMENT", "#60a5fa"],
  ] as const;
  cards.forEach(([label, name, stat, color], index) => {
    const x = index % 2 === 0 ? 90 : 555;
    const y = 550 + Math.floor(index / 2) * 275;
    ctx.fillStyle = "rgba(255,255,255,.045)";
    ctx.fillRect(x, y, 435, 235);
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 435, 235);
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.font = "900 19px Arial, sans-serif";
    ctx.fillText(label, x + 28, y + 45);
    ctx.fillStyle = "#ffffff";
    fitText(ctx, name.toUpperCase(), 375, 38);
    ctx.fillText(name.toUpperCase(), x + 28, y + 110);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "800 24px Arial, sans-serif";
    ctx.fillText(stat, x + 28, y + 164);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = "900 43px Arial, sans-serif";
  ctx.fillText("WAR ROOM PICK'EM", 540, 1185);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 21px Arial, sans-serif";
  ctx.fillText("PICKS BECOME HISTORY.", 540, 1226);
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillText("war-room-picks.com", 540, 1268);
  return canvas;
}

export async function shareWeeklyResults(model: WeeklyResultsShareModel): Promise<"shared" | "downloaded" | "cancelled"> {
  const canvas = renderWeeklyResultsCanvas(model);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not render image")), "image/png")
  );
  const file = new File([blob], `war-room-${model.weekLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-results.png`, { type: "image/png" });
  const text = `${model.leagueName} · ${model.weekLabel}\n👑 ${model.crown.name}: ${model.crown.points} pts${model.shame ? `\n🧻 ${model.shame.name}: ${model.shame.points} pts` : ""}\n\nWar Room Pick'Em — picks become history.`;
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: `${model.leagueName} weekly results`, text, files: [file] });
      return "shared";
    }
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
  return "downloaded";
}
