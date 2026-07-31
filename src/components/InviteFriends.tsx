"use client";

/**
 * One-tap league invite for commissioners.
 * Deep link: /join?code=XXXX — friend lands with code filled in.
 */

import { useState } from "react";
import {
  buildInviteJoinUrl,
  buildInviteShareText,
  markInviteCopied,
  shareLeagueInvite,
} from "@/lib/commish-onboarding";

type Props = {
  leagueName: string;
  code: string;
  leagueId?: string;
  /** Compact for banners */
  compact?: boolean;
  className?: string;
};

export default function InviteFriends({
  leagueName,
  code,
  leagueId,
  compact,
  className = "",
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!code) return null;

  const joinUrl = buildInviteJoinUrl({ code });

  async function onShare() {
    setBusy(true);
    setStatus(null);
    const result = await shareLeagueInvite({ leagueName, code });
    setBusy(false);
    if (leagueId) markInviteCopied(leagueId);
    if (result === "shared") setStatus("Shared — they get the link + code");
    else if (result === "copied")
      setStatus("Invite copied — paste in the group chat");
    else setStatus("Couldn’t share — try Copy link");
    setTimeout(() => setStatus(null), 3500);
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      if (leagueId) markInviteCopied(leagueId);
      setStatus("Link copied — one tap opens join with code");
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus("Copy failed — select the link manually");
    }
  }

  async function onCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
      if (leagueId) markInviteCopied(leagueId);
      setStatus("Code copied");
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus("Copy failed");
    }
  }

  if (compact) {
    return (
      <div className={className}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onShare()}
            className="px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50 min-h-[44px]"
          >
            {busy ? "…" : "Share invite"}
          </button>
          <button
            type="button"
            onClick={() => void onCopyLink()}
            className="px-3 py-2 rounded-xl border border-primary/40 text-primary text-sm font-semibold min-h-[44px]"
          >
            Copy link
          </button>
        </div>
        {status && (
          <p className="text-xs text-primary mt-2 font-medium">{status}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 ${className}`}
    >
      <h2 className="font-semibold mb-1">Invite friends</h2>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        One tap sends a link that opens the app with your code already filled
        in. They sign up (or log in) and join — no hunting for a code box.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-3">
        <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 font-mono text-lg tracking-[0.25em] text-center sm:text-left text-primary font-bold">
          {code}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onShare()}
          className="px-5 py-3 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50 min-h-[48px]"
        >
          {busy ? "Sharing…" : "Share invite"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCopyLink()}
          className="px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold"
        >
          Copy join link
        </button>
        <button
          type="button"
          onClick={() => void onCopyCode()}
          className="px-3 py-2 rounded-lg border border-border text-muted text-xs font-medium hover:text-foreground"
        >
          Copy code only
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                buildInviteShareText({ leagueName, code })
              );
              if (leagueId) markInviteCopied(leagueId);
              setStatus("Full invite text copied");
              setTimeout(() => setStatus(null), 2500);
            } catch {
              setStatus("Copy failed");
            }
          }}
          className="px-3 py-2 rounded-lg border border-border text-muted text-xs font-medium hover:text-foreground"
        >
          Copy full message
        </button>
      </div>
      <p className="text-[11px] text-muted mt-3 break-all">
        Link:{" "}
        <span className="text-foreground/90 font-mono text-[10px]">
          {joinUrl}
        </span>
      </p>
      {status && (
        <p className="text-xs text-primary mt-2 font-medium">{status}</p>
      )}
    </div>
  );
}
