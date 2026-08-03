"use client";

/**
 * Host Dashboard shell — Hero → This Week → The Room → League Settings.
 * IA frozen. Not a checklist. Not project management.
 */

import type { ReactNode } from "react";
import {
  thisWeekStatusLabel,
  type HostHeroState,
  type ThisWeekViewModel,
} from "@/lib/host-dashboard";

export type HostDashboardActions = {
  onPublishCard: () => void;
  onScoreWeek: () => void;
  onNudgeHoldouts: () => void;
  onShareInvite: () => void;
  onPreviewPlayer: () => void;
  onOpenStandings: () => void;
  onOpenGazette: () => void;
  onEditCard: () => void;
  onSeeLocks: () => void;
  onOpenSettings: () => void;
};

type Props = {
  leagueName: string;
  sportLabel: string;
  isOwner: boolean;
  hero: HostHeroState;
  thisWeek: ThisWeekViewModel;
  humanCount: number;
  inviteCode?: string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  actions: HostDashboardActions;
  /** Workbench panels (card / picks / results tools) */
  workbench?: ReactNode;
  /** Full settings body when expanded */
  settingsBody?: ReactNode;
};

const TONE_BORDER: Record<HostHeroState["tone"], string> = {
  blocked: "border-danger/50 bg-danger/10",
  attention: "border-warning/50 bg-warning/10",
  celebrate: "border-primary/50 bg-primary/10",
  quiet: "border-border bg-card",
};

const TONE_LABEL: Record<HostHeroState["tone"], string> = {
  blocked: "Needs you",
  attention: "Attention",
  celebrate: "Looking good",
  quiet: "Quiet",
};

export default function HostDashboardShell({
  leagueName,
  sportLabel,
  isOwner,
  hero,
  thisWeek,
  humanCount,
  inviteCode,
  settingsOpen,
  onToggleSettings,
  actions,
  workbench,
  settingsBody,
}: Props) {
  function runHero() {
    switch (hero.action) {
      case "publish_card":
        actions.onPublishCard();
        break;
      case "score_week":
        actions.onScoreWeek();
        break;
      case "nudge_holdouts":
        actions.onNudgeHoldouts();
        break;
      case "share_invite":
        actions.onShareInvite();
        break;
      case "preview_player":
        actions.onPreviewPlayer();
        break;
      case "open_standings":
        actions.onOpenStandings();
        break;
      case "open_gazette":
        actions.onOpenGazette();
        break;
      default:
        break;
    }
  }

  const statusBadge =
    thisWeek.status === "needs_score"
      ? "bg-warning/20 text-warning border-warning/40"
      : thisWeek.status === "live"
        ? "bg-primary/15 text-primary border-primary/40"
        : thisWeek.status === "scored"
          ? "bg-muted/30 text-muted border-border"
          : "bg-card-hover text-muted border-border";

  return (
    <div className="space-y-5 mb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            League
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">
            {leagueName || "Your league"}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {sportLabel}
            {thisWeek.weekLabel ? ` · ${thisWeek.weekLabel}` : ""}
            {!isOwner ? " · Deputy ops" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={actions.onPreviewPlayer}
          className="shrink-0 px-3 py-2 rounded-lg border border-warning/50 bg-warning/10 text-warning text-xs font-bold min-h-[44px]"
        >
          Preview as player →
        </button>
      </div>

      {/* 1. HERO — one thing only */}
      <section
        className={`rounded-2xl border-2 px-4 py-4 sm:px-5 sm:py-5 ${TONE_BORDER[hero.tone]}`}
        aria-label="What needs your attention"
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted mb-1.5">
          {TONE_LABEL[hero.tone]}
        </p>
        <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
          {hero.title}
        </h2>
        {hero.detail && (
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{hero.detail}</p>
        )}
        {hero.actionLabel && hero.action !== "none" && (
          <button
            type="button"
            onClick={runHero}
            className="mt-4 w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-primary text-black text-sm font-extrabold"
          >
            {hero.actionLabel}
          </button>
        )}
      </section>

      {/* 2. THIS WEEK — the product object */}
      <section aria-label="This week">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
          This week
        </h2>
        <div className="rounded-2xl border border-primary/40 bg-card p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge}`}
            >
              {thisWeekStatusLabel(thisWeek.status)}
            </span>
            <span className="text-sm font-bold text-foreground">
              {thisWeek.weekLabel}
            </span>
          </div>

          {thisWeek.published ? (
            <div className="text-sm text-foreground/90 space-y-1">
              <p>
                <strong className="text-foreground">{thisWeek.gameCount}</strong>{" "}
                games
                {thisWeek.propQuestion ? " · prop set" : ""}
              </p>
              {thisWeek.firstKickoffLabel && (
                <p className="text-muted text-xs">
                  First kickoff {thisWeek.firstKickoffLabel}
                </p>
              )}
              {thisWeek.expectedLocks > 0 && (
                <p className="text-sm">
                  <strong className="text-foreground">
                    {thisWeek.completeLocks}/{thisWeek.expectedLocks}
                  </strong>{" "}
                  locked
                  {thisWeek.missingNames.length === 1
                    ? ` · ${thisWeek.missingNames[0]} still out`
                    : thisWeek.missingNames.length > 1
                      ? ` · ${thisWeek.missingNames.length} still out`
                      : thisWeek.allHumansLocked
                        ? " · everyone’s in"
                        : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted leading-relaxed">
              No card published yet. This week always lives here — publish a
              slate and it never disappears.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {thisWeek.canEdit && (
              <button
                type="button"
                onClick={actions.onEditCard}
                className="px-3 py-2 rounded-lg bg-primary text-black text-xs font-bold min-h-[44px]"
              >
                {thisWeek.published ? "Edit card" : "Build card"}
              </button>
            )}
            {thisWeek.canPreview && (
              <button
                type="button"
                onClick={actions.onPreviewPlayer}
                className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground min-h-[44px]"
              >
                Preview as player
              </button>
            )}
            <button
              type="button"
              onClick={actions.onSeeLocks}
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground min-h-[44px]"
            >
              Who&apos;s locked
            </button>
            {thisWeek.canScore && (
              <button
                type="button"
                onClick={actions.onScoreWeek}
                className="px-3 py-2 rounded-lg border border-warning/50 text-warning text-xs font-bold min-h-[44px]"
              >
                Score week
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. THE ROOM — people, not a stats panel */}
      <section aria-label="The room">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
          The room
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {humanCount <= 0
              ? "Empty room — waiting for your people."
              : humanCount === 1
                ? "Just you for now. Invite the crew."
                : `${humanCount} people in the circle.`}
            {thisWeek.published && thisWeek.expectedLocks > 0 ? (
              <>
                {" "}
                {thisWeek.completeLocks}/{thisWeek.expectedLocks} locked this
                week.
              </>
            ) : null}
          </p>
          {inviteCode && (
            <p className="text-xs text-muted">
              Invite code{" "}
              <span className="font-mono text-primary font-bold tracking-widest">
                {inviteCode}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={actions.onShareInvite}
              className="px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-bold min-h-[44px]"
            >
              Share invite
            </button>
            <a
              href="/standings"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground min-h-[44px]"
            >
              Standings
            </a>
            <a
              href="/locker-room"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground min-h-[44px]"
            >
              Locker
            </a>
            <a
              href="/gazette"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground min-h-[44px]"
            >
              Gazette
            </a>
          </div>
        </div>
      </section>

      {/* 4. LEAGUE SETTINGS — calm, collapsed */}
      {isOwner && (
        <section aria-label="League settings">
          <button
            type="button"
            onClick={onToggleSettings}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left min-h-[48px]"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                League settings
              </p>
              <p className="text-sm font-semibold text-foreground">
                Rules · deputies · bots · season
              </p>
            </div>
            <span className="text-muted text-lg leading-none">
              {settingsOpen ? "▾" : "▸"}
            </span>
          </button>
          {settingsOpen && settingsBody && (
            <div className="mt-3 space-y-6" id="host-league-settings">
              {settingsBody}
            </div>
          )}
        </section>
      )}

      {/* Workbench for edit card / locks / score tools */}
      {workbench && (
        <div id="host-workbench" className="scroll-mt-24 pt-2 border-t border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-3">
            Tools
          </p>
          {workbench}
        </div>
      )}
    </div>
  );
}
