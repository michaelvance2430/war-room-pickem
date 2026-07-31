"use client";

/**
 * One-tap league invite for EVERY member — not just Commish.
 * Deep link: /join?code=XXXX — friend lands with code filled in.
 * Share copy rotates flavors (boomer / dad / group chat / chaos…).
 */

import { useState } from "react";
import { getSession, getLeague } from "@/lib/league";
import {
  buildInviteJoinUrl,
  buildInviteShareText,
  markInviteCopied,
  shareLeagueInvite,
  type InviteFlavor,
} from "@/lib/commish-onboarding";

type Props = {
  leagueName?: string;
  code?: string;
  leagueId?: string;
  /** Compact for banners */
  compact?: boolean;
  className?: string;
};

const FLAVOR_CHIPS: { id: InviteFlavor | "random"; label: string }[] = [
  { id: "random", label: "Surprise me" },
  { id: "groupchat", label: "Group chat" },
  { id: "dad", label: "Dad energy" },
  { id: "boomer", label: "Keep it simple" },
  { id: "xennial", label: "Tradition" },
  { id: "chaos", label: "Chaos" },
  { id: "warroom", label: "Classic" },
];

export default function InviteFriends({
  leagueName: leagueNameProp,
  code: codeProp,
  leagueId: leagueIdProp,
  compact,
  className = "",
}: Props) {
  const session = getSession();
  const league = getLeague();
  const code = (codeProp || league?.code || "").trim().toUpperCase();
  const leagueName =
    leagueNameProp || league?.name || "War Room";
  const leagueId = leagueIdProp || league?.id || "";
  const inviterName = session?.playerName || "";

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flavor, setFlavor] = useState<InviteFlavor | "random">("random");

  if (!code) return null;

  const joinUrl = buildInviteJoinUrl({ code });

  async function onShare() {
    setBusy(true);
    setStatus(null);
    const result = await shareLeagueInvite({
      leagueName,
      code,
      inviterName,
      flavor,
    });
    setBusy(false);
    if (leagueId) markInviteCopied(leagueId);
    if (result === "shared") setStatus("Shared — they get the link + code");
    else if (result === "copied")
      setStatus("Invite copied — paste it in the group chat");
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

  async function onCopyMessage() {
    try {
      await navigator.clipboard.writeText(
        buildInviteShareText({
          leagueName,
          code,
          inviterName,
          flavor,
        })
      );
      if (leagueId) markInviteCopied(leagueId);
      setStatus("Full invite text copied — ready to paste");
      setTimeout(() => setStatus(null), 2500);
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
          <button
            type="button"
            onClick={() => void onCopyMessage()}
            className="px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium min-h-[44px] hover:text-foreground"
          >
            Copy message
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
      className={`rounded-xl border border-primary/30 bg-primary/5 p-5 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
        Spread the word
      </p>
      <h2 className="font-semibold mb-1">Bring your people</h2>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        Not just the commissioner —{" "}
        <strong className="text-foreground">anyone</strong> can invite. One
        tap shares a link that opens the app with the code already filled
        in. Message flips flavors so it hits dad group chats{" "}
        <em>and</em> the chaos thread.
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

      <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">
        Message vibe
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FLAVOR_CHIPS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlavor(f.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
              flavor === f.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
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
          onClick={() => void onCopyMessage()}
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
