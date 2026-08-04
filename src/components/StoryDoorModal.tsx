"use client";

/**
 * Cut-line + Trophy story doors — one popup, one destination.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EVENT_FORCE_CUT_DOOR,
  EVENT_FORCE_TROPHY_DOOR,
  EVENT_STORY_DOORS,
  loadStoryDoorOffer,
  markStoryDoorSeen,
  storyDoorCopy,
  type StoryDoorKind,
} from "@/lib/story-doors";

export default function StoryDoorModal() {
  const pathname = usePathname();
  const [kind, setKind] = useState<StoryDoorKind | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const offer = await loadStoryDoorOffer();
        if (!cancelled) setKind(offer);
      } catch {
        if (!cancelled) setKind(null);
      }
    }

    void check();
    function onEvt() {
      void check();
    }
    function onForceCut() {
      setKind("cut");
    }
    function onForceTrophy() {
      setKind("trophy");
    }
    window.addEventListener(EVENT_STORY_DOORS, onEvt);
    window.addEventListener("warroom-progressive-disclosure", onEvt);
    window.addEventListener("warroom-first-week-progress", onEvt);
    window.addEventListener(EVENT_FORCE_CUT_DOOR, onForceCut);
    window.addEventListener(EVENT_FORCE_TROPHY_DOOR, onForceTrophy);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_STORY_DOORS, onEvt);
      window.removeEventListener("warroom-progressive-disclosure", onEvt);
      window.removeEventListener("warroom-first-week-progress", onEvt);
      window.removeEventListener(EVENT_FORCE_CUT_DOOR, onForceCut);
      window.removeEventListener(EVENT_FORCE_TROPHY_DOOR, onForceTrophy);
    };
  }, [pathname]);

  if (!kind) return null;

  const copy = storyDoorCopy(kind);

  function dismiss() {
    markStoryDoorSeen(kind!);
    setKind(null);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-door-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-card shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden">
        <div className="bg-primary/10 border-b border-primary/30 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {copy.eyebrow}
          </p>
          <h2
            id="story-door-title"
            className="text-lg font-extrabold text-foreground mt-0.5"
          >
            {copy.title}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-muted leading-relaxed">
          {copy.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
          <Link
            href={copy.ctaHref}
            onClick={dismiss}
            className="flex-1 text-center py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm hover:opacity-90"
          >
            {copy.ctaLabel}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-background"
          >
            {copy.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
