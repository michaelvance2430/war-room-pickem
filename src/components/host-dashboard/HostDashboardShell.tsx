"use client";

/**
 * League operations porch — Hero → This Week → The Room → League Settings.
 * Invite / Share League lives on Home — not here.
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
  humanCount: number;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  actions: HostDashboardActions;
  /** Tools for this week (card / locks / score) — not a peer section */
  workbench?: ReactNode;
  /** Settings body when expanded */
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
  quiet: "All quiet",
};

export default function HostDashboardShell({
  leagueName,
  sportLabel,
  isOwner,
  hero,
  thisWeek,
  humanCount,
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
    <div className="space-y-6 mb-6">
      {/* Header — front porch, not admin software */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          League
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-0.5 tracking-tight">
          {leagueName || "Your league"}
        </h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          {sportLabel}
          {thisWeek.weekLabel ? ` · ${thisWeek.weekLabel}` : ""}
          {!isOwner ? " · Deputy" : ""}
        </p>
        <p className="text-xs text-muted mt-1.5 max-w-md leading-relaxed">
          Open the door to your season — one job at a time.
        </p>
      </div>

      {/* 1. HERO — Why did I open League today? */}
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
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            {hero.detail}
          </p>
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

      {/* 2. THIS WEEK — sacred object, never disappears */}
      <section aria-label="This week">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            This week
          </h2>
          <p className="text-[10px] text-muted/80">
            Always lives here
          </p>
        </div>
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
              {thisWeek.status === "scored" && (
                <p className="text-xs text-muted pt-0.5">
                  Written. Standings and the paper already know.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted leading-relaxed">
              No card yet — but this week always lives here. Publish a slate and
              the object never disappears; only the status changes.
            </p>
          )}

          {/* Secondary actions — one primary job lives in Hero */}
          <div className="flex flex-wrap gap-2 pt-1">
            {thisWeek.canEdit && (
              <button
                type="button"
                onClick={actions.onEditCard}
                className="px-3 py-2 rounded-lg bg-primary text-black text-xs font-bold min-h-[44px]"
              >
                {thisWeek.published ? "Edit this week’s card" : "Build this week’s card"}
              </button>
            )}
            {thisWeek.canScore && (
              <button
                type="button"
                onClick={actions.onScoreWeek}
                className="px-3 py-2 rounded-lg border border-warning/50 text-warning text-xs font-bold min-h-[44px]"
              >
                Score this week
              </button>
            )}
            <button
              type="button"
              onClick={actions.onSeeLocks}
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted min-h-[44px]"
            >
              Community pulse
            </button>
            {thisWeek.canPreview && (
              <button
                type="button"
                onClick={actions.onPreviewPlayer}
                className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted min-h-[44px]"
              >
                See as player
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. THE ROOM — people */}
      <section aria-label="The room">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-2">
          The room
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {humanCount <= 0
              ? "Empty porch — waiting for your people."
              : humanCount === 1
                ? "Just you for now. The season gets fun when the crew shows up."
                : `${humanCount} people in the circle.`}
            {thisWeek.published && thisWeek.expectedLocks > 0 ? (
              <>
                {" "}
                {thisWeek.completeLocks}/{thisWeek.expectedLocks} locked this
                week.
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
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
                Where you change rules, deputies, and season stuff
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

      {/* This week's tools — under the hierarchy, not a fifth peer section */}
      {workbench && (
        <div
          id="host-workbench"
          className="scroll-mt-24 pt-4 border-t border-border/50"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted mb-1">
            This week&apos;s tools
          </h2>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            Build the card, see who locked, score the week — same object as
            above.
          </p>
          {workbench}
        </div>
      )}
    </div>
  );
}
