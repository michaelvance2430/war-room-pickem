"use client";

import { useEffect } from "react";

interface AvatarLightboxProps {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl?: string | null;
  initials: string;
}

export default function AvatarLightbox({
  open,
  onClose,
  name,
  avatarUrl,
  initials,
}: AvatarLightboxProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} profile photo`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-muted hover:text-foreground text-sm px-3 py-1.5 rounded-lg border border-border bg-card/80"
      >
        Close
      </button>

      <div
        className="max-w-lg w-full flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
          />
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl bg-card border border-border flex items-center justify-center text-6xl font-bold text-primary">
            {initials}
          </div>
        )}
        <p className="text-lg font-semibold">{name}</p>
      </div>
    </div>
  );
}
