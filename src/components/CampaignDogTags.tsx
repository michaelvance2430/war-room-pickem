"use client";

import { useState } from "react";
import { isAppCreator } from "@/lib/creator";

type CampaignTag = {
  year: number;
  league: string;
  record: string;
  finish: string;
  honor: string;
};

const MIKE_CAMPAIGNS: CampaignTag[] = [
  {
    year: 2025,
    league: "Vonnaggio Fantasy",
    record: "9–9",
    finish: "League Runner-Up",
    honor: "AFC Champion",
  },
];

export default function CampaignDogTags({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const campaigns = isAppCreator(playerId) ? MIKE_CAMPAIGNS : [];
  if (!campaigns.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-zinc-500/40 bg-zinc-950/70 p-5 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
        Completed campaigns
      </p>
      <p className="mt-1 text-xs text-muted">
        Dog tags are stamped when a season closes. Tap one for its service record.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {campaigns.map((tag, index) => {
          const expanded = open === index;
          return (
            <button
              key={`${tag.year}-${tag.league}`}
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : index)}
              className="group relative w-full max-w-[310px] overflow-hidden rounded-[18px] border border-zinc-300/50 bg-gradient-to-br from-zinc-200 via-zinc-500 to-zinc-800 p-[1px] text-left shadow-[0_12px_35px_rgba(0,0,0,.4)]"
            >
              <span className="block rounded-[17px] bg-[linear-gradient(135deg,#8d949a_0%,#d7dadd_28%,#6f777d_54%,#bcc1c4_76%,#555d62_100%)] px-5 py-4 text-zinc-950">
                <span className="absolute right-4 top-4 h-3 w-3 rounded-full border border-zinc-700 bg-zinc-900/70 shadow-inner" />
                <span className="block pr-7 text-[10px] font-black uppercase tracking-[0.18em]">
                  War Room · {tag.year} Campaign
                </span>
                <span className="mt-2 block truncate text-lg font-black uppercase tracking-tight">
                  {tag.league}
                </span>
                <span className="mt-3 grid grid-cols-2 gap-x-4 border-t border-zinc-800/40 pt-2 text-[11px] font-black uppercase">
                  <span>{tag.honor}</span>
                  <span className="text-right">Record {tag.record}</span>
                </span>
                {expanded && (
                  <span className="mt-3 block border-t border-zinc-800/40 pt-3 text-xs font-bold">
                    Final standing: {tag.finish}. Campaign completed and permanently entered into the service record.
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
