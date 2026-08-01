"use client";

/**
 * Share icon for championship / Toilet Bowl / Nerd King / division wins.
 * Opens a modal with unique graphic + hilarious caption; posts via
 * native share (IG/FB on mobile) or download + copy for desktop.
 */

import { useEffect, useMemo, useState } from "react";
import {
  buildTrophySharePack,
  renderTrophyShareCanvas,
  shareTrophyToSocial,
  type ShareableTrophy,
} from "@/lib/trophy-share";

type Props = {
  trophy: ShareableTrophy;
  /** Compact icon-only (plaque corner) */
  compact?: boolean;
  className?: string;
  /** Label next to icon when not compact */
  label?: string;
};

export default function TrophyShareButton({
  trophy,
  compact,
  className = "",
  label = "Share",
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pack = useMemo(() => buildTrophySharePack(trophy), [trophy]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreviewUrl(null);
    void (async () => {
      try {
        const canvas = await renderTrophyShareCanvas(trophy);
        if (cancelled) return;
        setPreviewUrl(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      setPreviewUrl(null);
    };
  }, [open, trophy]);

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
      const result = await shareTrophyToSocial(trophy, mode);
      if (result === "shared") {
        setStatus("Shared — go flex 🔥");
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
            "Image saved + caption copied — open IG → New post / Story → paste caption"
          );
        } else if (mode === "facebook") {
          setStatus(
            "Image saved + caption copied — attach the photo on Facebook"
          );
        } else {
          setStatus("Image downloaded + caption copied to clipboard");
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
      setTimeout(() => setStatus(null), 5000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Share ${pack.shortLabel} to IG / FB`}
        aria-label={`Share ${pack.shortLabel}`}
        className={
          compact
            ? `inline-flex items-center justify-center w-8 h-8 rounded-full border border-border/80 bg-black/40 text-foreground hover:border-primary hover:text-primary transition ${className}`
            : `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-black/30 text-xs font-semibold text-muted hover:text-primary hover:border-primary/50 transition ${className}`
        }
      >
        <ShareIcon className={compact ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trophy-share-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card/95 backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Flex the hardware
                </p>
                <h2 id="trophy-share-title" className="font-semibold text-sm">
                  Share {pack.shortLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground text-sm px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Preview */}
              <div className="rounded-xl overflow-hidden border border-border bg-black aspect-square max-w-[280px] mx-auto shadow-lg">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={`${pack.heroLine} share graphic`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted">
                    <span className="text-4xl">{pack.emoji}</span>
                    <span className="text-[11px] font-medium">
                      Loading face + hardware…
                    </span>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-muted leading-relaxed px-2">
                Unique picture + write-up for{" "}
                <strong className="text-foreground">{pack.shortLabel}</strong>.
                On phones, Share opens IG / FB / Messages.{" "}
                <strong className="text-foreground">Copy image</strong> pastes
                straight into a text thread.
              </p>

              {/* Primary actions */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("native")}
                  className="w-full py-3 rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50 min-h-[48px]"
                >
                  {busy ? "Working…" : "Share to IG / FB / chats"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("instagram")}
                    className="py-2.5 rounded-xl border border-pink-500/40 bg-pink-500/10 text-pink-200 text-xs font-bold disabled:opacity-50 min-h-[44px]"
                  >
                    Instagram
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("facebook")}
                    className="py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-200 text-xs font-bold disabled:opacity-50 min-h-[44px]"
                  >
                    Facebook
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("copy_image")}
                  className="w-full py-3 rounded-xl border-2 border-primary/50 bg-primary/10 text-primary font-bold text-sm disabled:opacity-50 min-h-[48px]"
                >
                  {busy ? "Working…" : "Copy image (for text)"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("download")}
                    className="py-2 rounded-lg border border-border text-muted text-xs font-semibold hover:text-foreground disabled:opacity-50"
                  >
                    Download image
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("copy_caption")}
                    className="py-2 rounded-lg border border-border text-muted text-xs font-semibold hover:text-foreground disabled:opacity-50"
                  >
                    Copy caption
                  </button>
                </div>
              </div>

              {status && (
                <p className="text-xs text-primary font-medium text-center leading-snug">
                  {status}
                </p>
              )}

              {/* Caption preview */}
              <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5 max-h-48 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">
                  Caption (hilarious on purpose)
                </p>
                <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                  {pack.caption}
                </pre>
              </div>

              <p className="text-[10px] text-muted text-center leading-relaxed pb-2">
                Tip: Instagram doesn’t allow direct web posts — we save the
                square graphic + copy the caption so you paste in one motion.
                On iPhone/Android, “Share” often goes straight into IG or FB.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ShareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}
