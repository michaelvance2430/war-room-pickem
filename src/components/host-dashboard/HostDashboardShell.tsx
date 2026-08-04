"use client";

/**
 * Commissioner operations center — one week, one workspace, one mission.
 * Attention + This Week + The Room are merged into a single Operations card.
 * Invite / Share League lives on Home. Community Pulse is secondary + collapsed.
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
  /** @deprecated Room size no longer a permanent section — kept for call-site compat */
  humanCount?: number;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  actions: HostDashboardActions;
  /** Build / score tool strip */
  workbench?: ReactNode;
  /** Community Pulse (collapsed accordion) — optional ops intel */
  communityPulse?: ReactNode;
  /** Settings body when expanded */
  settingsBody?: ReactNode;
};

const TONE_BORDER: Record<HostHeroState["tone"], string> = {
  blocked: "border-danger/50 bg-danger/5",
  attention: "border-warning/50 bg-warning/5",
  celebrate: "border-primary/40 bg-primary/5",
  quiet: "border-border bg-card",
};

export default function HostDashboardShell({
  leagueName,
  sportLabel,
  isOwner,
  hero,
  thisWeek,
  settingsOpen,
  onToggleSettings,
  actions,
  workbench,
  communityPulse,
  settingsBody,
}: Props) {
  function runMission() {
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
          ? "bg-muted/40 text-muted border-border"
          : "bg-card-hover text-muted border-border";

  return (
    <div className="space-y-5 mb-6">
      {/* Page identity — not a third summary of the week */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          Manage League
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-0.5 tracking-tight">
          {leagueName || "Your league"}
        </h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          {sportLabel}
          {thisWeek.weekLabel ? ` · ${thisWeek.weekLabel}` : ""}
          {!isOwner ? " · Deputy" : ""}
        </p>
      </div>

      {/* ONE operations card — status + mission + actions */}
      <section
        className={`rounded-2xl border-2 px-4 py-4 sm:px-5 sm:py-5 space-y-4 ${TONE_BORDER[hero.tone]}`}
        aria-label="This week operations"
      >
        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge}`}
          >
            {thisWeekStatusLabel(thisWeek.status)}
          </span>
          <span className="text-sm font-bold text-foreground">
            {thisWeek.weekLabel}
          </span>
          {thisWeek.published ? (
            <span className="text-xs text-muted">
              {thisWeek.gameCount} games
              {thisWeek.propQuestion ? " · prop set" : " · no prop yet"}
              {thisWeek.firstKickoffLabel
                ? ` · ${thisWeek.firstKickoffLabel}`
                : ""}
            </span>
          ) : (
            <span className="text-xs text-muted">No card yet</span>
          )}
        </div>

        {/* Current mission — one priority */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted mb-1">
            Current mission
          </p>
          <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
            {hero.title}
          </h2>
          {hero.detail && (
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              {hero.detail}
            </p>
          )}
        </div>

        {/* Primary actions — state dependent */}
        <div className="flex flex-wrap gap-2">
          {hero.actionLabel && hero.action !== "none" && (
            <button
              type="button"
              onClick={runMission}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation"
            >
              {hero.actionLabel}
            </button>
          )}
          {thisWeek.canEdit && hero.action !== "publish_card" && (
            <button
              type="button"
              onClick={actions.onEditCard}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-foreground touch-manipulation"
            >
              {thisWeek.published ? "Edit card" : "Build card"}
            </button>
          )}
          {thisWeek.canScore && hero.action !== "score_week" && (
            <button
              type="button"
              onClick={actions.onScoreWeek}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-warning/50 text-warning text-xs font-bold touch-manipulation"
            >
              Score week
            </button>
          )}
          {thisWeek.canPreview && (
            <button
              type="button"
              onClick={actions.onPreviewPlayer}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted touch-manipulation"
            >
              See as player
            </button>
          )}
        </div>

        {/* Secondary — Community Pulse lives here, not a peer card */}
        {communityPulse}
      </section>

      {/* League settings — calm, collapsed */}
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
                Rules, deputies, and season stuff
              </p>
            </div>
            <span className="text-muted text-lg leading-none shrink-0">
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

      {/* Tools strip — same week object, not another summary */}
      {workbench && (
        <div
          id="host-workbench"
          className="scroll-mt-24 pt-1"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
            Workspace
          </h2>
          {workbench}
        </div>
      )}
    </div>
  );
}
