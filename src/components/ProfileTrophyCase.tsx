"use client";

import { useState } from "react";
import {
  BIG_GAME_KINDS,
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
import SportChampionshipTrophy from "@/components/SportChampionshipTrophy";

function Plaque({
  item,
  leagueName,
  canShare,
  spinny,
  onTrophyTap,
  sportId,
}: {
  item: ProfileTrophy;
  leagueName?: string;
  canShare: boolean;
  spinny?: boolean;
  onTrophyTap?: () => void;
  sportId?: string | null;
}) {
  const meta = HARDWARE_KIND_META[item.kind];
  const sharePayload = {
    kind: item.kind,
    seasonYear: item.seasonYear,
    winnerName: item.winnerName,
    leagueName,
    division: item.division,
    subtitle: item.subtitle,
    sportId: sportId || undefined,
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
          {item.kind === "championship" ? (
            <SportChampionshipTrophy
              sport={sportId}
              size={48}
              animate={false}
            />
          ) : (
            <span className="text-2xl">{meta.emoji}</span>
          )}
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
        {kind === "championship" ? (
          <SportChampionshipTrophy
            sport={sportId}
            size={40}
            animate={false}
          />
        ) : (
          <span className="text-2xl">{meta.emoji}</span>
        )}
      </button>
      <div className="text-[10px] uppercase tracking-wide text-muted">
        {kind === "championship"
          ? "Championship"
          : kind === "toilet_bowl"
            ? "Toilet Bowl"
            : kind === "crystal_ball"
              ? "Village Nerd"
              : "Division"}
      </div>
      <p className="text-xs text-muted mt-1">{meta.emptyLabel}</p>
    </div>
  );
}

export default function ProfileTrophyCase({
  items,
  playerName,
  leagueName,
  /** When true (viewing your own profile), show share on every plaque */
  isSelf = false,
}: {
  items: ProfileTrophy[];
  playerName: string;
  leagueName?: string;
  isSelf?: boolean;
}) {
  const { bigGame, division } = splitHardwareCases(items);
  const [spinId, setSpinId] = useState<string | null>(null);

  const byKind = (kind: ProfileTrophyKind) =>
    bigGame.filter((i) => i.kind === kind);

  const hasAny = items.length > 0;
  // Anyone can flex hardware (yours or a buddy's roast share)
  const canShare = true;
  void isSelf;
  void hasAny;
  const sportId = getLeague()?.sportId || null;

  function handleTrophyTap(itemId: string) {
    setSpinId(itemId);
    window.setTimeout(() => setSpinId(null), 900);
    const pid = getSession()?.playerId;
    if (!pid || !isSelf) return;
    const moment = recordTrophyTap(pid);
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
          Championship &amp; Toilet hardware, Village Nerd, and division titles —
          career flex for {playerName.split(/\s+/)[0] || "this player"}.
          Won something? Hit <strong className="text-foreground">Share</strong>{" "}
          for a custom IG/FB graphic.
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
                    spinny={spinId === item.id}
                    onTrophyTap={() => handleTrophyTap(item.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Division case */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            Division titles
          </h3>
          <div className="flex-1 h-px bg-border" />
        </div>
        {division.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EmptySlot kind="division" />
            <div className="rounded-xl border border-dashed border-border/50 bg-card/20 p-4 min-h-[120px] flex flex-col justify-center opacity-40">
              <p className="text-xs text-muted">
                Win your division to put a shield here. Commissioner can engrave
                division hardware after the season (coming with Trophy Room
                division awards).
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {division.map((item) => (
              <Plaque
                key={item.id}
                item={item}
                leagueName={leagueName}
                canShare={canShare}
              />
            ))}
          </div>
        )}
      </div>

      {!hasAny && (
        <p className="text-[11px] text-muted mt-4 text-center">
          Empty shelves — win a championship, toilet, nerd award, or division.
          Then share it to IG/FB with one tap.
        </p>
      )}
    </section>
  );
}
