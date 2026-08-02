"use client";

import { useState } from "react";
import {
  BIG_GAME_KINDS,
  DIVISION_CONFERENCE_SECTION,
  HARDWARE_KIND_META,
  splitHardwareCases,
  type ProfileTrophy,
  type ProfileTrophyKind,
} from "@/lib/profile-hardware";
import TrophyShareButton from "@/components/TrophyShareButton";
import { divisionFullLabel } from "@/lib/divisions";
import { getLeague, getSession } from "@/lib/league";
import {
  EVENT_EASTER_EGG,
  recordTrophyTap,
} from "@/lib/easter-eggs";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";

function Plaque({
  item,
  leagueName,
  canShare,
  spinny,
  onTrophyTap,
  sportId,
  winnerAvatarUrl,
  liveWinnerName,
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
}) {
  const meta = HARDWARE_KIND_META[item.kind];
  // Live profile name/photo — not the frozen engraving (Jstray vs Justin Strayer)
  const sharePayload = {
    kind: item.kind,
    seasonYear: item.seasonYear,
    winnerName: liveWinnerName || item.winnerName,
    leagueName,
    division: item.division,
    subtitle: item.subtitle,
    sportId: sportId || undefined,
    winnerAvatarUrl: winnerAvatarUrl || undefined,
  };

  return (
    <div
      className={`rounded-xl border ${meta.border} bg-gradient-to-b from-card to-black/40 p-4 min-h-[120px] relative`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <button
          type="button"
          className={`select-none ${
            spinny ? "animate-spin" : ""
          } ${item.kind === "championship" ? "cursor-pointer" : "cursor-default"}`}
          aria-hidden
          tabIndex={item.kind === "championship" ? 0 : -1}
          onClick={() => {
            if (item.kind === "championship") onTrophyTap?.();
          }}
        >
          <HardwareTrophyIcon
            kind={item.kind}
            sportId={sportId}
            size={item.kind === "championship" ? 52 : 48}
            animate={false}
          />
        </button>
        {canShare && <TrophyShareButton compact trophy={sharePayload} />}
      </div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold ${meta.accent}`}>
        {item.seasonYear} · {item.title}
      </div>
      {item.division && (
        <div className="text-sm font-bold mt-1">
          {divisionFullLabel(item.division, getLeague()?.sportId)}
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
        <div className="mt-3">
          <TrophyShareButton
            trophy={sharePayload}
            label="Share win"
            className="w-full justify-center"
          />
        </div>
      )}
    </div>
  );
}

function EmptySlot({
  kind,
  spinny,
  onTrophyTap,
  sportId,
}: {
  kind: ProfileTrophyKind;
  spinny?: boolean;
  onTrophyTap?: () => void;
  sportId?: string | null;
}) {
  const meta = HARDWARE_KIND_META[kind];
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-4 min-h-[120px] flex flex-col justify-center opacity-50">
      <button
        type="button"
        className={`mb-1 grayscale text-left ${
          spinny ? "animate-spin" : ""
        } ${kind === "championship" ? "cursor-pointer" : "cursor-default"}`}
        aria-hidden
        tabIndex={kind === "championship" ? 0 : -1}
        onClick={() => {
          if (kind === "championship") onTrophyTap?.();
        }}
      >
        <HardwareTrophyIcon
          kind={kind}
          sportId={sportId}
          size={40}
          empty
          animate={false}
        />
      </button>
      <div className="text-[10px] uppercase tracking-wide text-muted">
        {kind === "championship"
          ? "Championship"
          : kind === "toilet_bowl"
            ? "Toilet Bowl"
            : kind === "crystal_ball"
              ? "Village Nerd"
              : DIVISION_CONFERENCE_SECTION.combined}
      </div>
      <p className="text-xs text-muted mt-1">{meta.emptyLabel}</p>
    </div>
  );
}

/** Empty shelf tile with its own Division or Conference label (side-by-side pair). */
function EmptyDivConfSlot({
  flavor,
}: {
  flavor: "division" | "conference";
}) {
  const label =
    flavor === "division"
      ? DIVISION_CONFERENCE_SECTION.labelA
      : DIVISION_CONFERENCE_SECTION.labelB;
  const empty =
    flavor === "division"
      ? DIVISION_CONFERENCE_SECTION.emptyA
      : DIVISION_CONFERENCE_SECTION.emptyB;
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-4 min-h-[120px] flex flex-col justify-center opacity-50">
      <div className="mb-1 grayscale">
        <HardwareTrophyIcon
          kind="division"
          sportId={getLeague()?.sportId}
          size={40}
          empty
          animate={false}
        />
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
        {label}
      </div>
      <p className="text-xs text-muted mt-1">{empty}</p>
      <p className="text-[10px] text-muted/70 mt-2 leading-snug">
        {flavor === "division"
          ? "NFL-style division crown (AFC East, etc.)."
          : "CFB-style conference crown (SEC, Big Ten, …)."}
      </p>
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

  const byKind = (kind: ProfileTrophyKind) =>
    bigGame.filter((i) => i.kind === kind);

  const hasAny = items.length > 0;
  // Anyone can flex hardware (yours or a buddy's roast share)
  const canShare = true;
  void isSelf;
  const sportId = getLeague()?.sportId || null;

  function handleTrophyTap(itemId: string) {
    setSpinId(itemId);
    window.setTimeout(() => setSpinId(null), 900);
    const pid = getSession()?.playerId;
    if (!pid) return;
    // Vonnaggio: any room member can discover on the gold form.
    // Global curiosity egg: still yours-only on your own case.
    let vonnaggio = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isVonnaggioLeague } =
        require("@/lib/league-trophy-override") as typeof import("@/lib/league-trophy-override");
      const lg = getLeague();
      vonnaggio = isVonnaggioLeague(
        leagueName || lg?.name,
        lg?.id,
        lg?.code
      );
    } catch {
      vonnaggio = false;
    }
    if (!vonnaggio && !isSelf) return;
    const moment = recordTrophyTap(pid, {
      leagueName: leagueName || getLeague()?.name,
      leagueId: getLeague()?.id,
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
        <h2 className="font-semibold text-lg">Trophy case</h2>
        <p className="text-xs text-muted mt-0.5">
          Championship &amp; Toilet hardware, Village Nerd, and{" "}
          <strong className="text-foreground">Division / Conference</strong>{" "}
          titles — career flex for{" "}
          {playerName.split(/\s+/)[0] || "this player"}. Stack every year.
          {hasAny ? (
            <>
              {" "}
              Hit <strong className="text-foreground">Share</strong> on a
              plaque for a custom IG/FB graphic.
            </>
          ) : (
            <> Empty shelves fill when they win hardware.</>
          )}
        </p>
      </div>

      {/* Big game hardware */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300/90">
            Championship hardware
          </h3>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BIG_GAME_KINDS.map((kind) => {
            const won = byKind(kind);
            if (won.length === 0) {
              return (
                <EmptySlot
                  key={kind}
                  kind={kind}
                  sportId={sportId}
                  spinny={spinId === `empty-${kind}`}
                  onTrophyTap={() => handleTrophyTap(`empty-${kind}`)}
                />
              );
            }
            return (
              <div key={kind} className="space-y-2">
                {won.map((item) => (
                  <Plaque
                    key={item.id}
                    item={item}
                    leagueName={leagueName}
                    canShare={canShare}
                    sportId={sportId}
                    winnerAvatarUrl={winnerAvatarUrl}
                    liveWinnerName={playerName}
                    spinny={spinId === item.id}
                    onTrophyTap={() => handleTrophyTap(item.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Division / Conference case — side-by-side labels; plaques stack */}
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
        {division.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EmptyDivConfSlot flavor="division" />
            <EmptyDivConfSlot flavor="conference" />
          </div>
        ) : (
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
            {/* Keep a free shelf so next year’s stack is obvious */}
            <div className="rounded-xl border border-dashed border-primary/25 bg-card/20 p-4 min-h-[100px] flex flex-col justify-center opacity-45">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                Open shelf
              </p>
              <p className="text-xs text-muted mt-1 leading-snug">
                Win another division or conference crown — plaques stack here
                year after year.
              </p>
            </div>
          </div>
        )}
      </div>

      {!hasAny && (
        <p className="text-[11px] text-muted mt-4 text-center">
          Empty shelves — win a championship, toilet, nerd award, or
          division/conference title. Then share it to IG/FB with one tap.
        </p>
      )}
    </section>
  );
}
