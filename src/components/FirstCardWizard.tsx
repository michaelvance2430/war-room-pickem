"use client";

/**
 * First-time host on Build Card — conversation, not a manual.
 * One "Start Here" action at a time. No Foundry. No scoring dump.
 * Demo tools only when explicitly enabled for lab accounts.
 */

type Props = {
  weekLabel: string;
  hasDraftGames: boolean;
  hasProp: boolean;
  busy?: boolean;
  /** True after a successful publish this session for the week */
  cardPublished?: boolean;
  /** Manual publish after draft selection */
  onPublish?: () => void;
  /** Jump past wizard to full Build Card tools */
  onDismiss?: () => void;
  /** Lab-only demo publish (hidden for real hosts) */
  showLabDemo?: boolean;
  onDemoPublish?: () => void;
  onDemo?: () => void;
};

export default function FirstCardWizard({
  weekLabel,
  hasDraftGames,
  hasProp,
  busy,
  cardPublished,
  onPublish,
  onDismiss,
  showLabDemo,
  onDemoPublish,
  onDemo,
}: Props) {
  const phase: "pull" | "pick" | "publish" | "done" = cardPublished
    ? "done"
    : !hasDraftGames
      ? "pull"
      : "publish";

  return (
    <section
      id="first-card-start-here"
      className="rounded-xl border-2 border-primary/50 bg-card p-4 sm:p-5 mb-6 space-y-3 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-black">
              Start here
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Practice week · I&apos;m with you
            </p>
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {phase === "pull" && `Wake ${weekLabel}.`}
            {phase === "publish" && `Lock ${weekLabel} live.`}
            {phase === "done" && `${weekLabel} is live.`}
          </h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            {phase === "pull" &&
              "One move: Pull Odds for this week. Then pick 5 games. That's the whole job right now."}
            {phase === "publish" &&
              "You've got games. Hit Publish so friends can open My Picks. You're almost there."}
            {phase === "done" &&
              "Nice — the room can pick. Scoring waits until the games die."}
          </p>
        </div>
        {onDismiss && phase !== "done" && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-muted hover:text-foreground shrink-0"
          >
            Full tools
          </button>
        )}
      </div>

      {phase === "pull" && (
        <p className="text-xs text-primary font-semibold leading-relaxed">
          → Scroll to <strong className="text-foreground">Pull Odds</strong>{" "}
          below and tap it. I&apos;ll still be here.
        </p>
      )}

      {onPublish && phase !== "done" && (
        <button
          type="button"
          disabled={busy || cardPublished || !hasDraftGames}
          onClick={onPublish}
          className="w-full py-3.5 rounded-xl bg-primary text-black text-base font-bold disabled:opacity-50 min-h-[48px]"
        >
          {busy
            ? "Publishing…"
            : !hasDraftGames
              ? "Start here · Pull Odds first (below)"
              : hasProp
                ? `Start here · Publish ${weekLabel}`
                : `Start here · Publish ${weekLabel}`}
        </button>
      )}

      {phase === "done" && (
        <p className="text-sm font-semibold text-foreground">
          ✓ Practice week is up. You can run this.
        </p>
      )}

      {showLabDemo && (onDemoPublish || onDemo) && (
        <details className="rounded-lg border border-border bg-muted/10 px-3 py-2">
          <summary className="text-[11px] font-semibold text-muted cursor-pointer select-none">
            Lab · demo slate (shop only)
          </summary>
          <div className="mt-2 space-y-2">
            {onDemoPublish && (
              <button
                type="button"
                disabled={busy || cardPublished}
                onClick={onDemoPublish}
                className="w-full px-3 py-2 rounded-lg border border-border text-foreground text-sm font-bold disabled:opacity-50"
              >
                {busy ? "Publishing demo…" : "Publish demo week"}
              </button>
            )}
            {onDemo && (
              <button
                type="button"
                disabled={busy || hasDraftGames}
                onClick={onDemo}
                className="w-full px-3 py-2 rounded-lg border border-border text-muted text-sm font-medium disabled:opacity-50"
              >
                {hasDraftGames ? "Games loaded ✓" : "Generate demo slate only"}
              </button>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
