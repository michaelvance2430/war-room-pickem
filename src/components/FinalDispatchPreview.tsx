"use client";

import { useState } from "react";

const dispatch = {
  player: "Mike Vance",
  league: "Vonnaggio Fantasy",
  opponent: "The Bracket",
  score: "Season closed · 9–9",
  sincere:
    "You gave the room an entire campaign of conviction, noise, and reasons to keep checking the standings. The season was better because you were in it.",
  roast:
    "Unfortunately, finishing second is just losing with enough paperwork to make it sound official.",
};

function drawShareCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#101318");
  gradient.addColorStop(1, "#23150d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#d6a24b";
  ctx.lineWidth = 8;
  ctx.strokeRect(48, 48, 984, 1254);
  ctx.textAlign = "center";
  ctx.fillStyle = "#d6a24b";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("WAR ROOM · FINAL DISPATCH", 540, 130);
  ctx.fillStyle = "#f7f1e6";
  ctx.font = "bold 70px sans-serif";
  ctx.fillText(dispatch.player.toUpperCase(), 540, 240);
  ctx.font = "bold 31px sans-serif";
  ctx.fillStyle = "#c8c3b9";
  ctx.fillText(dispatch.league, 540, 300);
  const lines = [
    "You gave the room an entire campaign of conviction,",
    "noise, and reasons to keep checking the standings.",
    "The season was better because you were in it.",
    "",
    "Unfortunately, finishing second is just losing with",
    "enough paperwork to make it sound official.",
  ];
  ctx.font = "32px serif";
  ctx.fillStyle = "#f7f1e6";
  lines.forEach((line, i) => ctx.fillText(line, 540, 470 + i * 56));
  ctx.fillStyle = "#d6a24b";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("YOUR CAMPAIGN IS OVER.", 540, 920);
  ctx.fillText("YOUR STORIES REMAIN.", 540, 975);
  ctx.save();
  ctx.translate(540, 1115);
  ctx.rotate(-0.06);
  ctx.strokeStyle = "#b5342c";
  ctx.lineWidth = 7;
  ctx.strokeRect(-230, -55, 460, 110);
  ctx.fillStyle = "#d84a40";
  ctx.font = "bold 58px sans-serif";
  ctx.fillText("ELIMINATED", 0, 20);
  ctx.restore();
  ctx.fillStyle = "#aaa49a";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("REST UP · TALK TRASH · RETURN DANGEROUS", 540, 1250);
  return canvas;
}

export default function FinalDispatchPreview() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const canvas = drawShareCard();
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "war-room-final-dispatch.png", { type: "image/png" });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My War Room Final Dispatch", files: [file] });
        setStatus("Share sheet opened.");
        return;
      }
    } catch {
      return;
    }
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(href);
    setStatus("Dispatch downloaded. Post it anywhere.");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-20 rounded-lg border border-border bg-background p-3 text-left">
        <strong className="block text-sm">Final Dispatch</strong>
        <span className="mt-1 block text-[11px] leading-snug text-muted">The funny, sincere, shareable farewell after tournament elimination.</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Final Dispatch preview">
          <article className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/50 bg-gradient-to-b from-zinc-950 to-amber-950/40 p-6 text-center shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 min-h-10 min-w-10 rounded-full border border-white/20" aria-label="Close">×</button>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">War Room · Final Dispatch</p>
            <h2 className="mt-4 text-3xl font-black uppercase">{dispatch.player}</h2>
            <p className="mt-1 text-xs font-bold text-muted">{dispatch.league} · {dispatch.score}</p>
            <div className="my-6 border-y border-amber-300/20 py-6 text-left">
              <p className="leading-relaxed text-zinc-100">{dispatch.sincere}</p>
              <p className="mt-4 leading-relaxed text-zinc-100">{dispatch.roast}</p>
            </div>
            <p className="font-black uppercase text-amber-200">Your campaign is over. Your stories remain.</p>
            <p className="mt-2 text-xs text-muted">Your dog tag has been stamped. Rest up. Talk trash. Return dangerous.</p>
            <div className="mt-5 -rotate-2 border-4 border-red-500/70 px-4 py-2 text-2xl font-black uppercase tracking-widest text-red-400">Eliminated</div>
            <button type="button" onClick={() => void share()} className="mt-6 min-h-12 w-full rounded-xl bg-amber-400 px-4 font-black text-zinc-950">Share My Final Dispatch</button>
            {status && <p className="mt-2 text-xs text-muted">{status}</p>}
          </article>
        </div>
      )}
    </>
  );
}
