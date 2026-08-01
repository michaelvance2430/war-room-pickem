"use client";

/**
 * One-tap league invite for EVERY member — not just Commish.
 * Deep link: /join?code=XXXX — friend lands with code filled in.
 * Share copy rotates multi-gen flavors (boomer → Gen X → millennial → chaos).
 */

import { useEffect, useState } from "react";
import { getSession, getLeague } from "@/lib/league";
import {
  buildInviteJoinUrl,
  buildInviteShareText,
  markInviteCopied,
  resolveInviteSportId,
  shareLeagueInvite,
  type InviteFlavor,
} from "@/lib/commish-onboarding";

type Props = {
  leagueName?: string;
  code?: string;
  leagueId?: string;
  /** Explicit sport — never let NFL/CFB invites mix */
  sportId?: string | null;
  /** Compact for banners */
  compact?: boolean;
  className?: string;
};

const FLAVOR_CHIPS: {
  id: InviteFlavor | "random";
  label: string;
  hint: string;
}[] = [
  { id: "random", label: "Surprise me", hint: "Random vibe every share" },
  { id: "groupchat", label: "Group chat", hint: "Stop scrolling energy" },
  { id: "boomer", label: "Boomer", hint: "Clear steps, no slang" },
  { id: "genx", label: "Gen X", hint: "Cynical & simple" },
  { id: "xennial", label: "Xennial", hint: "Pizza-box tradition" },
  { id: "millennial", label: "Millennial", hint: "Group-chat soft launch" },
  { id: "dad", label: "Dad energy", hint: "Subject line + love you" },
  { id: "chaos", label: "Chaos", hint: "Milk-carton threat" },
  { id: "primetime", label: "Primetime", hint: "TV window energy" },
  { id: "tailgate", label: "Tailgate", hint: "Grill + trash talk" },
  { id: "redzone", label: "Red zone", hint: "Urgent roster fill" },
  { id: "warroom", label: "Classic", hint: "Straight product pitch" },
];

export default function InviteFriends({
  leagueName: leagueNameProp,
  code: codeProp,
  leagueId: leagueIdProp,
  sportId: sportIdProp,
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
  const sportId = resolveInviteSportId(sportIdProp ?? league?.sportId);
  const isNfl = sportId === "nfl";

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flavor, setFlavor] = useState<InviteFlavor | "random">("random");
  /**
   * Collapsed by default (phone-first — most players live on phones).
   * One-tap Share stays visible; "More vibes" expands flavors/preview.
   */
  const [expanded, setExpanded] = useState(false);
  /** Only label Share with sport/room when multi-league (avoids clutter for 1-room players) */
  const [multiLeague, setMultiLeague] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { fetchMyMemberships } = await import("@/lib/session-restore");
        const ms = await fetchMyMemberships();
        if (!cancelled) setMultiLeague(ms.length >= 2);
      } catch {
        if (!cancelled) setMultiLeague(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

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
      sportId,
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
          sportId,
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
        {multiLeague && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
            Sharing as{" "}
            <span className={isNfl ? "text-blue-300" : "text-amber-200"}>
              {isNfl ? "NFL" : "CFB"}
            </span>
          </p>
        )}
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

  const activeChip = FLAVOR_CHIPS.find((f) => f.id === flavor);
  // Stable preview for a picked vibe; random only resolves on share/copy
  const previewText =
    flavor === "random"
      ? null
      : buildInviteShareText({
          leagueName,
          code,
          inviterName,
          flavor,
          sportId,
        });

  // Collapsed strip on phone until they expand (desktop always full)
  if (!expanded && !compact) {
    return (
      <div
        className={`rounded-xl border border-primary/25 bg-primary/5 p-3 sm:p-4 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Invite · everyone
              {multiLeague && (
                <>
                  {" · "}
                  <span className={isNfl ? "text-blue-300" : "text-amber-200"}>
                    {isNfl ? "NFL" : "CFB"}
                  </span>
                </>
              )}
            </p>
            <p className="text-sm text-foreground font-medium truncate">
              Code{" "}
              <span className="font-mono text-primary tracking-widest">
                {code}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onShare()}
              className="flex-1 sm:flex-none px-4 py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50 touch-manipulation"
              title={`Share ${isNfl ? "NFL" : "CFB"} invite for ${leagueName}`}
            >
              {busy ? "…" : multiLeague ? `Share · ${isNfl ? "NFL" : "CFB"}` : "Share"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="px-3 py-3 min-h-[48px] rounded-xl border border-border text-xs font-semibold text-muted hover:text-foreground touch-manipulation"
            >
              More vibes
            </button>
          </div>
        </div>
        {status && (
          <p className="text-xs text-primary mt-2 font-medium">{status}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
            Spread the word · everyone
            {multiLeague && (
              <>
                {" · "}
                <span className={isNfl ? "text-blue-300" : "text-amber-200"}>
                  {isNfl ? "NFL" : "CFB"}
                </span>
              </>
            )}
          </p>
          <h2 className="font-semibold mb-1">Bring your people</h2>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="sm:hidden text-[11px] text-muted font-semibold min-h-[40px] px-2"
        >
          Less
        </button>
      </div>
      <p className="text-sm text-muted mb-3 leading-relaxed">
        <strong className="text-foreground">Every member</strong> can invite —
        not just the commissioner.
        {multiLeague ? (
          <>
            {" "}
            Messages always say{" "}
            <strong className={isNfl ? "text-blue-300" : "text-amber-200"}>
              {isNfl ? "NFL (pro football)" : "CFB (college football)"}
            </strong>
            {" — "}check you&apos;re in the right room first.
          </>
        ) : (
          <> One tap shares a deep link plus a message vibe.</>
        )}{" "}
        Surprise me randomizes the tone.
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
          {busy
            ? "Sharing…"
            : multiLeague
              ? `Share · ${isNfl ? "NFL" : "CFB"} · ${
                  leagueName.length > 18
                    ? `${leagueName.slice(0, 16)}…`
                    : leagueName
                }`
              : "Share invite"}
        </button>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">
        Message vibe{" "}
        {activeChip && (
          <span className="normal-case tracking-normal font-medium text-foreground/70">
            — {activeChip.hint}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FLAVOR_CHIPS.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.hint}
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

      {previewText && (
        <div className="mb-3 rounded-lg border border-border bg-background/80 px-3 py-2.5 max-h-40 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">
            Preview (what your buddy sees)
          </p>
          <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
            {previewText}
          </pre>
        </div>
      )}
      {flavor === "random" && (
        <p className="text-[11px] text-muted mb-3 italic">
          Surprise me picks a random generation vibe each time you share —
          great for blasting the whole crew.
        </p>
      )}

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
