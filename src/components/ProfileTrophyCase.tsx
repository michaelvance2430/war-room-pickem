"use client";

import { useState } from "react";
import {
  DIVISION_CONFERENCE_SECTION,
  HARDWARE_KIND_META,
  splitHardwareCases,
  type ProfileTrophy,
} from "@/lib/profile-hardware";
import TrophyShareButton from "@/components/TrophyShareButton";
import { divisionFullLabel } from "@/lib/divisions";
import { getLeague, getSession } from "@/lib/league";
import {
  EVENT_EASTER_EGG,
  recordTrophyTap,
} from "@/lib/easter-eggs";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import TrophyLightbox from "@/components/TrophyLightbox";

function Plaque({
  item,
  leagueName,
  canShare,
  spinny,
  onTrophyTap,
  sportId,
  winnerAvatarUrl,
  liveWinnerName,
  leagueId,
  leagueCode,
}: {
  item: ProfileTrophy;
  leagueName?: string;
  canShare: boolean;
  spinny?: boolean;
  onTrophyTap?: () => void;
  sportId?: string | null;
  /** Profile photo of this trophy-case owner (NFL + CFB holders) */
  winnerAvatarUrl?: string | null;
  /** Current display name (updates when they rename) */
  liveWinnerName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
}) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const meta = HARDWARE_KIND_META[item.kind];
  // Live profile name/photo — not the frozen engraving (Jstray vs Justin Strayer)
  // Vonnagio championship shares must carry league name so gold art loads
  const plaqueLeague = item.leagueName || leagueName;
  const plaqueSport = item.sportId || sportId;
  const sharePayload = {
    kind: item.kind,
    seasonYear: item.seasonYear,
    winnerName: liveWinnerName || item.winnerName,
    leagueName: plaqueLeague,
    division: item.division,
    subtitle: item.subtitle,
    sportId: plaqueSport || undefined,
    winnerAvatarUrl: winnerAvatarUrl || undefined,
    trophyDesignId: item.trophyDesignId,
  };
  const inspectTitle = `${item.seasonYear} · ${item.title}`;
  const inspectSub =
    [item.leagueName || leagueName, item.subtitle, item.notes]
      .filter(Boolean)
      .join(" · ") || undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setInspectOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setInspectOpen(true);
        }
      }}
      className={`rounded-xl border ${meta.border} bg-gradient-to-b from-card to-black/40 p-4 min-h-[120px] relative cursor-zoom-in touch-manipulation text-left`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        {/* Icon only: easter egg / spin — does NOT open lightbox */}
        <button
          type="button"
          className={`relative z-[1] select-none touch-manipulation ${
            spinny ? "animate-spin" : ""
          } ${item.kind === "championship" ? "cursor-pointer" : "cursor-default"}`}
          aria-label={`${item.title} icon`}
          onClick={(e) => {
            e.stopPropagation();
            if (item.kind === "championship") onTrophyTap?.();
          }}
        >
          <HardwareTrophyIcon
            kind={item.kind}
            sportId={plaqueSport}
            size={item.kind === "championship" ? 96 : item.kind === "division" ? 84 : 64}
            animate={false}
            leagueName={plaqueLeague}
            leagueId={item.leagueId || leagueId}
            leagueCode={item.leagueCode || leagueCode}
            trophyDesignId={item.trophyDesignId}
          />
        </button>
        {canShare && (
          <span onClick={(e) => e.stopPropagation()}>
            <TrophyShareButton compact trophy={sharePayload} />
          </span>
        )}
      </div>
      <p className="text-[9px] text-muted mb-0.5">
        Tap card to enlarge · icon is for the curious
      </p>
      <div className={`text-[10px] uppercase tracking-wide font-semibold ${meta.accent}`}>
        {item.seasonYear} · {item.title}
        {item.sportId === "nfl" ? (
          <span className="text-muted font-medium normal-case tracking-normal">
            {" "}
            · NFL
          </span>
        ) : item.sportId === "cfb" ? (
          <span className="text-muted font-medium normal-case tracking-normal">
            {" "}
            · CFB
          </span>
        ) : null}
      </div>
      {(item.leagueName || leagueName) && (
        <p className="text-sm font-bold text-foreground mt-1 leading-snug">
          {item.leagueName || leagueName}
        </p>
      )}
      {item.division && (
        <div className="text-sm font-semibold mt-0.5 text-foreground/90">
          {divisionFullLabel(item.division, item.sportId || getLeague()?.sportId)}
        </div>
      )}
      {item.subtitle && (
        <p className="text-xs text-muted mt-1">{item.subtitle}</p>
      )}
      {item.notes && (
        <p className="text-[11px] text-muted/80 mt-2 italic leading-snug">
          {item.notes}
        </p>
      )}
      {item.source === "legacy" && (
        <span className="absolute bottom-2 right-3 text-[9px] uppercase tracking-wider text-muted">
          Legacy
        </span>
      )}
      {canShare && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <TrophyShareButton
            trophy={sharePayload}
            label="Share win"
            className="w-full justify-center"
          />
        </div>
      )}
      <TrophyLightbox
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        kind={item.kind}
        sportId={plaqueSport}
        title={inspectTitle}
        subtitle={inspectSub}
        leagueName={plaqueLeague}
        leagueId={item.leagueId || leagueId}
        leagueCode={item.leagueCode || leagueCode}
        trophyDesignId={item.trophyDesignId}
      />
    </div>
  );
}

export default function ProfileTrophyCase({
  items,
  playerName,
  leagueName,
  /** When true (viewing your own profile), show share on every plaque */
  isSelf = false,
  /** Owner profile photo — goes on every share graphic for their hardware */
  winnerAvatarUrl,
}: {
  items: ProfileTrophy[];
  playerName: string;
  leagueName?: string;
  isSelf?: boolean;
  winnerAvatarUrl?: string | null;
}) {
  const { bigGame, division } = splitHardwareCases(items);
  const [spinId, setSpinId] = useState<string | null>(null);

  const hasAny = items.length > 0;
  // Anyone can flex hardware (yours or a buddy's roast share)
  const canShare = true;
  void isSelf;
  const liveLeague = getLeague();
  const leagueId = liveLeague?.id ?? null;
  const leagueCode = liveLeague?.code ?? null;
  // Vonnagio is NFL — force nfl so championship never renders CFB crystal/Lombardi default path
  let vonnaggioRoom = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVonnaggioLeague } =
      require("@/lib/league-trophy-override") as typeof import("@/lib/league-trophy-override");
    vonnaggioRoom = isVonnaggioLeague(
      leagueName || liveLeague?.name,
      leagueId,
      leagueCode
    );
  } catch {
    vonnaggioRoom = false;
  }
  const sportId =
    vonnaggioRoom ? "nfl" : liveLeague?.sportId || null;

  function handleTrophyTap(itemId: string) {
    setSpinId(itemId);
    window.setTimeout(() => setSpinId(null), 900);
    const pid = getSession()?.playerId;
    if (!pid) return;
    // Vonnagio: any room member can discover on the gold form.
    // Global curiosity egg: still yours-only on your own case.
    if (!vonnaggioRoom && !isSelf) return;
    const moment = recordTrophyTap(pid, {
      leagueName: leagueName || liveLeague?.name,
      leagueId,
    });
    if (moment) {
      try {
        window.dispatchEvent(
          new CustomEvent(EVENT_EASTER_EGG, { detail: moment })
        );
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Trophy Room</h2>
        {hasAny && (
          <p className="text-xs text-muted mt-0.5">
            Career hardware for {playerName.split(/\s+/)[0] || "this player"}.
            Every league gets its own plaque, and every plaque can be shared.
          </p>
        )}
      </div>

      {/* Big game hardware */}
      {bigGame.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300/90">
              Championship hardware
            </h3>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {bigGame.map((item) => (
              <Plaque
                key={`${item.id}:${item.leagueId || item.leagueName || ""}`}
                item={item}
                leagueName={item.leagueName || leagueName}
                leagueId={item.leagueId || leagueId}
                leagueCode={item.leagueCode || leagueCode}
                canShare={canShare}
                sportId={item.sportId || sportId}
                winnerAvatarUrl={winnerAvatarUrl}
                liveWinnerName={playerName}
                spinny={spinId === item.id}
                onTrophyTap={() => handleTrophyTap(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Division / Conference case — side-by-side labels; plaques stack */}
      {division.length > 0 && (
        <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary shrink-0">
              {DIVISION_CONFERENCE_SECTION.labelA}
            </h3>
            <span
              className="text-xs font-black text-muted/80 shrink-0"
              aria-hidden
            >
              /
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 shrink-0">
              {DIVISION_CONFERENCE_SECTION.labelB}
            </h3>
          </div>
          <div className="flex-1 h-px bg-border min-w-[1rem]" />
        </div>
        <p className="text-[10px] text-muted mb-3 leading-relaxed">
          {DIVISION_CONFERENCE_SECTION.blurb}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {division.map((item) => (
            <Plaque
              key={item.id}
              item={item}
              leagueName={leagueName}
              canShare={canShare}
              sportId={sportId}
              winnerAvatarUrl={winnerAvatarUrl}
              liveWinnerName={playerName}
            />
          ))}
        </div>
        </div>
      )}

      {!hasAny && (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-5 py-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Trophy Room Security Report
          </p>
          <p className="mt-2 text-sm font-bold text-foreground">
            No brass has breached the perimeter. Get back out there and fix that.
          </p>
        </div>
      )}
    </section>
  );
}
