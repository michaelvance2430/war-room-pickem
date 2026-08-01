"use client";

/**
 * Share this Gazette edition — newspaper image + FB/IG/chat flex.
 */

import { useEffect, useMemo, useState } from "react";
import type { GazetteEdition } from "@/lib/gazette";
import {
  buildGazetteSharePack,
  renderGazetteShareCanvas,
  shareGazetteToSocial,
} from "@/lib/gazette-share";

type Props = {
  edition: GazetteEdition;
  open: boolean;
  onClose: () => void;
};

export default function GazetteShareSheet({ edition, open, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pack = useMemo(() => buildGazetteSharePack(edition), [edition]);

  useEffect(() => {
    if (!open) return;
    try {
      const canvas = renderGazetteShareCanvas(edition);
      setPreviewUrl(canvas.toDataURL("image/png"));
    } catch {
      setPreviewUrl(null);
    }
    return () => setPreviewUrl(null);
  }, [open, edition]);

  if (!open) return null;

  async function run(
    mode:
      | "native"
      | "download"
      | "copy_caption"
      | "copy_image"
      | "facebook"
      | "instagram"
  ) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await shareGazetteToSocial(edition, mode);
      if (result === "shared") {
        setStatus("Shared — go flex the paper 📰");
      } else if (result === "image_copied") {
        setStatus("Image copied — paste into Texts / Messages");
      } else if (result === "copied") {
        setStatus("Caption copied — paste under your post");
      } else if (result === "downloaded") {
        if (mode === "copy_image") {
          setStatus(
            "Clipboard blocked — image downloaded. Attach it in your text thread."
          );
        } else if (mode === "instagram") {
          setStatus(
            "Image saved + caption copied — IG → New post / Story → add photo → paste caption"
          );
        } else if (mode === "facebook") {
          setStatus(
            "Image saved + caption copied — attach the photo on Facebook (quote ready)"
          );
        } else {
          setStatus("Image downloaded + caption copied");
        }
      } else if (result === "cancelled") {
        setStatus(null);
      } else {
        setStatus("Couldn’t share — try Copy image or Download");
      }
    } catch {
      setStatus("Something went wrong — try Copy image or Download");
    }
    setBusy(false);
    if (mode !== "copy_caption" && mode !== "copy_image") {
      setTimeout(() => setStatus(null), 6000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gazette-share-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-stone-600 bg-[#1c1917] text-[#f4f0e6] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-600 bg-[#1c1917]/95 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">
              Extra · Extra
            </p>
            <h2 id="gazette-share-title" className="font-semibold text-sm">
              Share this edition
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-[#f4f0e6] text-sm px-2 py-1"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg overflow-hidden border-2 border-stone-500 bg-[#f4f0e6] aspect-square max-w-[280px] mx-auto shadow-lg">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Gazette share graphic"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-700 text-sm font-serif">
                Printing…
              </div>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 leading-relaxed px-1">
            Newspaper card + caption. Flex the crown, shame the room, and stamp{" "}
            <strong className="text-[#f4f0e6]">War Room Pick&apos;Em</strong> on
            the post. Phones: Share opens IG / FB / Messages.{" "}
            <strong className="text-[#f4f0e6]">Copy image</strong> pastes
            straight into a text thread.
          </p>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("native")}
              className="w-full py-3.5 rounded-xl bg-red-700 text-[#f4f0e6] font-black text-sm uppercase tracking-wide disabled:opacity-50 min-h-[52px]"
            >
              {busy ? "Working…" : "Share to IG / FB / chats"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("instagram")}
                className="py-2.5 rounded-xl border border-pink-500/50 bg-pink-500/15 text-pink-200 text-xs font-bold disabled:opacity-50 min-h-[44px]"
              >
                Instagram
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("facebook")}
                className="py-2.5 rounded-xl border border-blue-500/50 bg-blue-500/15 text-blue-200 text-xs font-bold disabled:opacity-50 min-h-[44px]"
              >
                Facebook
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("copy_image")}
              className="w-full py-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/15 text-amber-100 font-bold text-sm disabled:opacity-50 min-h-[48px]"
            >
              {busy ? "Working…" : "Copy image (for text)"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("download")}
                className="py-2 rounded-lg border border-stone-600 text-stone-300 text-xs font-semibold hover:text-[#f4f0e6] disabled:opacity-50"
              >
                Download image
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("copy_caption")}
                className="py-2 rounded-lg border border-stone-600 text-stone-300 text-xs font-semibold hover:text-[#f4f0e6] disabled:opacity-50"
              >
                Copy caption
              </button>
            </div>
          </div>

          {status && (
            <p className="text-xs text-emerald-400 font-medium text-center leading-snug">
              {status}
            </p>
          )}

          <div className="rounded-lg border border-stone-600 bg-black/40 px-3 py-2.5 max-h-44 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1.5">
              Caption preview · {pack.shortLabel}
            </p>
            <pre className="text-[11px] text-stone-300 whitespace-pre-wrap font-sans leading-relaxed">
              {pack.caption}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
