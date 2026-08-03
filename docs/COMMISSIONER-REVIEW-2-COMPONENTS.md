# COMMISSIONER REVIEW 2 — COMPONENTS DIRECTLY RENDERED (unminified)

**Purpose:** Every component imported and rendered by `CommissionerClient` / related first-hour host surfaces that interact with this page.  
**Generated:** 2026-08-03

---

## Direct children of CommissionerClient

| Component | Path | Role |
|-----------|------|------|
| FirstCardWizard | src/components/FirstCardWizard.tsx | First publish coach on Build Card |
| PlayerLink | src/components/PlayerLink.tsx | Profile links in Who's in / deputies |
| OpenRoomBotsNudge | src/components/OpenRoomBotsNudge.tsx | Modal after open-room bot fill |
| OpenRoomLeaveNudge | src/components/OpenRoomLeaveNudge.tsx | Nudge for open-room leave flow |
| CommishWeekChecklist | src/components/CommishWeekChecklist.tsx | 5-job checklist (hidden first-time simple host) |
| SportPoolCommishPanel | src/components/SportPoolCommishPanel.tsx | Multi-sport pool (settings, not simple host) |
| SandboxHopOptIn | src/components/SandboxHopOptIn.tsx | Foundry lab hop (labTools only) |

## Related (not always children of /commissioner, but interact with it)

| Component / lib | Path | Role |
|-----------------|------|------|
| CommishSetupBanner | src/components/CommishSetupBanner.tsx | Home host Start Here → links into /commissioner |
| InviteFriends | src/components/InviteFriends.tsx | Invites (Home + settings path) |
| OnboardingHost | src/components/onboarding/OnboardingHost.tsx | Conversation engine; deep-links commissionerCard / Results |
| commissioner journey | src/lib/onboarding/journeys/commissioner.ts | Data for host onboarding |
| start onboarding | src/lib/onboarding/start.ts | When commissioner journey starts |
| commish-onboarding | src/lib/commish-onboarding.ts | first-time flags, invites |
| view-as-player | src/lib/view-as-player.ts | View as Player flag |
| foundry-preview | src/lib/foundry-preview.ts | showCommishLabTools gate |

---

### FILE: `src/components/FirstCardWizard.tsx`

```tsx
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

```

### FILE: `src/components/PlayerLink.tsx`

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getJustJoinedBadge,
  subscribeJoinBadges,
} from "@/lib/join-badge-store";
import {
  getEquippedTitleLabel,
  subscribeEquippedTitles,
} from "@/lib/equipped-title-store";
import { isChaosFlamesActive } from "@/lib/chaos-mode";
import { getLeague } from "@/lib/league";
import { loadLeagueActiveWeek } from "@/lib/cloud";
import { wrProfile, wrProfileRoute } from "@/lib/runtime-iso";

/** One in-flight profile navigation at a time (P0 freeze: triple click-received). */
const pendingNav = new Map<string, number>();
const NAV_GUARD_MS = 2_500;

function armProfileNavGuard(profileId: string): boolean {
  const now = Date.now();
  // Drop expired
  for (const [k, t] of pendingNav) {
    if (now - t > NAV_GUARD_MS) pendingNav.delete(k);
  }
  if (pendingNav.has(profileId)) return false;
  pendingNav.set(profileId, now);
  return true;
}

function clearProfileNavGuard(profileId: string) {
  pendingNav.delete(profileId);
}

// Clear when route actually changes away/to profile
if (typeof window !== "undefined") {
  window.addEventListener("warroom-route-change", (ev) => {
    wrProfileRoute(
      "listener:PlayerLink.pendingNavClear",
      `path=${(ev as CustomEvent)?.detail?.pathname || "?"}`
    );
    // Soft clear all after hop so next intentional click works
    window.setTimeout(() => pendingNav.clear(), 400);
  });
}

/**
 * Name → /profile/[id].
 * Equipped title + just-joined pill + Chaos flames when dad went Chaos this week.
 */
export default function PlayerLink({
  id,
  name,
  className = "",
  showYou = false,
  hideJoinBadge = false,
  hideEquippedTitle = false,
  /** Force chaos flames (e.g. board slip already knows) */
  chaosFlames,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  showYou?: boolean;
  hideJoinBadge?: boolean;
  hideEquippedTitle?: boolean;
  chaosFlames?: boolean;
}) {
  const label = name?.trim() || "TBD";
  const [liveWeek, setLiveWeek] = useState(0);
  const [chaosTick, setChaosTick] = useState(0);
  const [navLocked, setNavLocked] = useState(false);

  // Load week once on mount for Chaos flames. Do NOT re-fetch on every route hop.
  useEffect(() => {
    let cancelled = false;
    void loadLeagueActiveWeek().then((w) => {
      if (!cancelled) setLiveWeek(w);
    });
    function onChaos() {
      setChaosTick((t) => t + 1);
    }
    function onRoute(ev: Event) {
      wrProfileRoute(
        "listener:PlayerLink.onRoute",
        `path=${(ev as CustomEvent)?.detail?.pathname || "?"} id=${id?.slice(0, 8) || "?"}`
      );
      setNavLocked(false);
      if (id) clearProfileNavGuard(id);
    }
    window.addEventListener("warroom-chaos-active", onChaos);
    window.addEventListener("warroom-route-change", onRoute);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-chaos-active", onChaos);
      window.removeEventListener("warroom-route-change", onRoute);
    };
  }, [id]);

  const joinBadge = useSyncExternalStore(
    subscribeJoinBadges,
    () => (hideJoinBadge || !id ? null : getJustJoinedBadge(id)),
    () => null
  );

  const equippedTitle = useSyncExternalStore(
    subscribeEquippedTitles,
    () => (hideEquippedTitle || !id ? null : getEquippedTitleLabel(id)),
    () => null
  );

  void chaosTick;
  const flames =
    chaosFlames === true ||
    (!!id && isChaosFlamesActive(id, liveWeek, getLeague()?.id));

  if (!id) {
    return <span className={`text-muted ${className}`.trim()}>{label}</span>;
  }

  function onProfileClick(e: React.MouseEvent) {
    if (!id) return;
    if (navLocked || !armProfileNavGuard(id)) {
      e.preventDefault();
      e.stopPropagation();
      wrProfile("click-ignored-duplicate", undefined, id.slice(0, 8));
      return;
    }
    setNavLocked(true);
    wrProfile("click-received", undefined, `PlayerLink→${id.slice(0, 8)}`);
    wrProfileRoute("click", `id=${id.slice(0, 8)} href=/profile/${id.slice(0, 8)}`);
    try {
      performance.mark?.("wr-profile-route:click");
    } catch {
      /* ok */
    }
    // Safety: unlock if navigation never completes
    window.setTimeout(() => {
      clearProfileNavGuard(id);
      setNavLocked(false);
    }, NAV_GUARD_MS);
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 max-w-full ${
        navLocked ? "pointer-events-none opacity-70" : ""
      }`}
    >
      <Link
        href={`/profile/${id}`}
        onClick={onProfileClick}
        title={
          flames
            ? `${label} went CHAOS this week — pure random card, doubles if it hits`
            : equippedTitle
              ? `${equippedTitle} ${label} — view profile`
              : `View ${label}'s profile`
        }
        aria-label={
          flames
            ? `${label} Chaos Mode this week — view profile`
            : equippedTitle
              ? `View ${equippedTitle} ${label}'s profile`
              : `View ${label}'s profile`
        }
        className={[
          "inline-flex items-center gap-1 max-w-full min-w-0",
          "font-semibold text-primary",
          "underline decoration-primary decoration-2 underline-offset-[3px]",
          "active:opacity-80 touch-manipulation",
          "py-0.5 -my-0.5",
          flames
            ? "chaos-flames rounded-md px-1.5 py-0.5 text-orange-200 decoration-orange-400"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {flames && (
          <span className="shrink-0 text-sm leading-none" aria-hidden>
            🔥
          </span>
        )}
        {equippedTitle && (
          <span
            className="shrink-0 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-amber-300 no-underline"
            title="Equipped on Account"
          >
            {equippedTitle}
          </span>
        )}
        <span className="truncate">{label}</span>
        {flames && (
          <span
            className="shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-orange-300 no-underline"
            title="Chaos Mode — robots cooked this card"
          >
            CHAOS
          </span>
        )}
        <span
          className="shrink-0 text-[10px] font-bold opacity-80 no-underline leading-none"
          aria-hidden
        >
          ↗
        </span>
        {showYou && (
          <span className="ml-0.5 text-xs text-primary/90 no-underline shrink-0">
            (You)
          </span>
        )}
      </Link>
      {joinBadge && (
        <span
          className="shrink-0 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-sky-400/50 bg-sky-400/15 text-sky-200 leading-none"
          title="Joined this league in the last 24 hours"
        >
          {joinBadge}
        </span>
      )}
    </span>
  );
}

```

### FILE: `src/components/OpenRoomBotsNudge.tsx`

```tsx
"use client";

/**
 * When a commissioner lists an open room, nudge them to fill empty seats
 * with bots (simple yes/no on Host). Does not auto-add.
 */

import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Deep link: Host → Fill empty seats? */
export const COMMISH_BOTS_HREF = "/commissioner?tab=settings#commish-bots";

export default function OpenRoomBotsNudge({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-room-bots-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-primary/40 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-amber-400 to-primary" />
        <div className="p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary text-center">
            Open room · host tip
          </p>
          <div className="text-center">
            <div className="text-4xl mb-2" aria-hidden>
              🤖
            </div>
            <h2
              id="open-room-bots-title"
              className="text-xl font-black text-foreground"
            >
              Round out your numbers with bots?
            </h2>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              Real people join first. Want a fuller room? In{" "}
              <strong className="text-foreground">Commish</strong> settings: fill
              empty seats with bots. They take real standings seats until you
              remove them (pre-lock only). Once the season starts, bots stay
              (fairness). Never replaces humans.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={COMMISH_BOTS_HREF}
              onClick={onClose}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold text-center flex items-center justify-center touch-manipulation"
            >
              Yes — take me there
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 min-h-[48px] rounded-xl border border-border text-muted text-sm font-medium hover:text-foreground touch-manipulation"
            >
              Not now — humans only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

```

### FILE: `src/components/OpenRoomLeaveNudge.tsx`

```tsx
"use client";

/**
 * Commissioner banner: someone left — open the room to recruit replacements?
 */

import { useCallback, useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import {
  dismissOpenRoomNudge,
  loadOpenRoomNudge,
  type OpenRoomNudge,
} from "@/lib/open-room-nudge";
import { setLeagueOpenListing } from "@/lib/open-room";

export default function OpenRoomLeaveNudge() {
  const [nudge, setNudge] = useState<OpenRoomNudge | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = getSession();
    const league = getLeague();
    if (!session?.isCommissioner || !league?.id) {
      setNudge(null);
      return;
    }
    const n = await loadOpenRoomNudge(league.id);
    setNudge(n);
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (!nudge) return null;

  async function onOpenYes() {
    const league = getLeague();
    if (!league?.id) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await setLeagueOpenListing(league.id, true);
      if (!res.ok) {
        setStatus(res.error || "Could not open listing");
        setBusy(false);
        return;
      }
      await dismissOpenRoomNudge(league.id);
      setNudge(null);
      setStatus(null);
      // Keep league local flag in sync if present
      try {
        const raw = localStorage.getItem("warroom-league");
        if (raw) {
          const lg = JSON.parse(raw) as Record<string, unknown>;
          lg.isOpen = true;
          localStorage.setItem("warroom-league", JSON.stringify(lg));
        }
      } catch {
        /* ignore */
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  async function onNo() {
    if (!nudge) return;
    setBusy(true);
    await dismissOpenRoomNudge(nudge.leagueId);
    setNudge(null);
    setBusy(false);
  }

  return (
    <div
      className="mx-4 mt-3 sm:mx-auto sm:max-w-3xl rounded-xl border-2 border-primary/50 bg-primary/10 p-4 shadow-lg"
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary mb-1">
        Seat opened
      </p>
      <h2 className="text-sm font-bold text-foreground mb-1">
        {nudge.leftName} left the room
      </h2>
      <p className="text-xs text-muted leading-relaxed mb-3">
        Want to set the league to{" "}
        <strong className="text-foreground">open</strong> so new players can
        find you? Late joiners start at{" "}
        <strong className="text-foreground">0 season points</strong> (no
        catch-up) but can still earn cheevos and trophies going forward — empty
        seats only, nobody loses standings.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onOpenYes()}
          className="flex-1 min-h-[44px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Working…" : "Yes — open the room"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onNo()}
          className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
        >
          Not now
        </button>
      </div>
      {status && (
        <p className="text-xs text-danger mt-2 leading-relaxed">{status}</p>
      )}
    </div>
  );
}

```

### FILE: `src/components/CommishWeekChecklist.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  loadLeagueRoster,
  loadPickSubmissionStatus,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getLeague } from "@/lib/league";
import { weekTitle } from "@/lib/dates";

type ActionTab = "settings" | "card" | "picks" | "results";

type Step = {
  id: string;
  label: string;
  detail: string;
  why: string;
  done: boolean;
  actionTab?: ActionTab;
};

const TAB_HREF: Record<ActionTab, string> = {
  settings: "/commissioner?tab=settings",
  card: "/commissioner?tab=card",
  picks: "/commissioner?tab=picks",
  results: "/commissioner?tab=results",
};

/**
 * Commissioner day-one / every-week path.
 * Turns the ops firehose into 5 clear jobs without removing advanced tools.
 */
export default function CommishWeekChecklist({
  onGoTab,
}: {
  onGoTab?: (tab: ActionTab) => void;
}) {
  const [week, setWeek] = useState(1);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const w = await loadLeagueActiveWeek();
        const card = await loadWeekCard(w);
        const hasCard = !!(card?.games?.length);
        const roster = (await loadLeagueRoster()).filter((m) => !m.isBot);
        const humans = roster.length;
        const league = getLeague();
        const hasCode = !!league?.code;

        let completeLocks = 0;
        let expected = humans;
        if (hasCard) {
          const status = await loadPickSubmissionStatus(
            w,
            card!.games!.length || 5
          );
          if (status.ok) {
            completeLocks = status.rows.filter((r) => r.complete).length;
            expected = status.rows.length || humans;
          }
        }

        let scored: number[] = [];
        try {
          scored = await listScoredWeekNumbers();
        } catch {
          scored = [];
        }
        const thisWeekScored = scored.includes(w);

        const next: Step[] = [
          {
            id: "invite",
            label: "1. Invite the room",
            detail: hasCode
              ? `Share code ${league?.code} · ${humans} human${humans === 1 ? "" : "s"} joined`
              : "Copy your league code from Settings and text the crew",
            why: "No code = empty room.",
            done: humans >= 2,
            actionTab: "settings",
          },
          {
            id: "card",
            label: "2. Build & publish the card",
            detail: hasCard
              ? `${weekTitle(w)} is live (${card!.games!.length} games)`
              : `Publish by 48h before first kickoff — or the system auto-posts (2 misses = gavel to 1st place)`,
            why: "No card = friends can’t pick. Miss two weeks and you lose the gavel.",
            done: hasCard,
            actionTab: "card",
          },
          {
            id: "bots",
            label: "3. Fill empty seats? (optional)",
            detail:
              "Yes = filler bots toward a full room. No = humans only. Once the season starts, bots stay.",
            why: "Empty seats only — never removes friends. Fairness lock after kickoff.",
            // Optional — never blocks the host path
            done: true,
            actionTab: "settings",
          },
          {
            id: "locks",
            label: "4. Get locks in",
            detail: hasCard
              ? `${completeLocks}/${expected || humans} fully locked · milk carton the rest`
              : "Publish a card first — then chase locks on Who’s in",
            why: "No locks = empty scores and salty group chat.",
            done:
              hasCard &&
              completeLocks > 0 &&
              completeLocks >= Math.max(1, expected - 1),
            actionTab: "picks",
          },
          {
            id: "score",
            label: "5. Enter results & score",
            detail: thisWeekScored
              ? `${weekTitle(w)} is scored`
              : hasCard
                ? "After games finish: sync scores or enter results, then Score League"
                : "Need a published card before you can score",
            why: "No score = standings look broken.",
            done: thisWeekScored,
            actionTab: "results",
          },
          {
            id: "vibe",
            label: "6. Let the room cook",
            detail:
              "Gazette, Locker, standings drama — the app does the theater after you score",
            why: "This is why they stay.",
            done: thisWeekScored || completeLocks > 0,
          },
        ];

        if (!cancelled) {
          setWeek(w);
          setSteps(next);
        }
      } catch {
        if (!cancelled) setSteps([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-border/40 rounded mb-2" />
        <div className="h-3 w-full bg-border/20 rounded" />
      </div>
    );
  }

  if (!steps.length) return null;

  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-primary/10 transition"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Run this week
          </p>
          <p className="text-sm font-semibold text-foreground">
            {weekTitle(week)} · {doneCount}/{steps.length} done
            {nextStep
              ? ` · Next: ${nextStep.label.replace(/^\d+\.\s*/, "")}`
              : " · Looking good"}
          </p>
        </div>
        <span className="text-xs text-muted shrink-0">
          {collapsed ? "Show" : "Hide"}
        </span>
      </button>

      {!collapsed && (
        <ol className="px-4 pb-4 space-y-2">
          {steps.map((s) => (
            <li
              key={s.id}
              className={`rounded-lg border px-3 py-2.5 flex gap-3 items-start ${
                s.done
                  ? "border-primary/30 bg-primary/10"
                  : "border-border bg-background/60"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  s.done
                    ? "bg-primary text-black"
                    : "border border-muted text-muted"
                }`}
                aria-hidden
              >
                {s.done ? "✓" : s.id === nextStep?.id ? "→" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    s.done ? "text-primary" : "text-foreground"
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {s.detail}
                </p>
                <p className="text-[10px] text-primary/80 mt-0.5">Why: {s.why}</p>
                {!s.done && s.actionTab && (
                  <Link
                    href={TAB_HREF[s.actionTab]}
                    onClick={(e) => {
                      // Same-page tab switch when parent provided a handler
                      if (onGoTab) {
                        e.preventDefault();
                        onGoTab(s.actionTab!);
                        // Keep URL in sync so back/refresh land on the right tab
                        try {
                          window.history.replaceState(
                            null,
                            "",
                            TAB_HREF[s.actionTab!]
                          );
                        } catch {
                          /* ignore */
                        }
                        // Scroll tab content into view (mobile)
                        requestAnimationFrame(() => {
                          document
                            .getElementById("commish-tab-panel")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        });
                      }
                    }}
                    className="inline-flex items-center mt-2 min-h-[44px] px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-sm font-bold text-primary active:bg-primary/20"
                  >
                    Go there →
                  </Link>
                )}
              </div>
            </li>
          ))}
          <p className="text-[10px] text-muted pt-1 px-1">
            Advanced tools (bots, odds credits, reset, pass commissioner) stay
            under Settings → Advanced until your first scored week.
          </p>
        </ol>
      )}
    </section>
  );
}

```

### FILE: `src/components/SportPoolCommishPanel.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague } from "@/lib/league";
import { listSportPickerOptions, getSportPack } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  closeSportPoolPoll,
  countSourceLeagueVoters,
  createSportPoolPoll,
  loadOpenPollForLeague,
  loadPollVotes,
  seedBotSportPoolVotes,
  spinUpLeagueFromPoll,
  sportPoolSqlHint,
  type SportPoolPoll,
  type SportPoolVote,
} from "@/lib/sport-pool";
import { switchToLeague } from "@/lib/session-restore";

/**
 * Commish: soft invite for a next-sport chapter (community-led).
 * Only yeses get seats. No pressure, no auto-transfer, source room stays.
 */
export default function SportPoolCommishPanel() {
  const router = useRouter();
  const league = getLeague();
  const currentSport = league?.sportId || "cfb";
  const liveOthers = listSportPickerOptions().filter(
    (s) => s.status === "live" && s.id !== currentSport
  );

  const [targetSport, setTargetSport] = useState<SportId>(
    (liveOthers[0]?.id as SportId) || "nfl"
  );
  const [proposedName, setProposedName] = useState("");
  const [message, setMessage] = useState("");
  const [poll, setPoll] = useState<SportPoolPoll | null>(null);
  const [votes, setVotes] = useState<SportPoolVote[]>([]);
  const [voterTotal, setVoterTotal] = useState(0);
  const [botCount, setBotCount] = useState(0);
  const [newCommId, setNewCommId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spun, setSpun] = useState<{
    code: string;
    leagueId: string;
    leagueName: string;
    seated: number;
    sportId: string;
  } | null>(null);
  const [sqlNeeded, setSqlNeeded] = useState(false);

  const refresh = useCallback(async () => {
    if (!league?.id) return;
    const counts = await countSourceLeagueVoters(league.id);
    setVoterTotal(counts.total);
    setBotCount(counts.bots);

    const { poll: p, error } = await loadOpenPollForLeague(league.id);
    if (error && /sport-pool-polls\.sql|SQL Editor/i.test(error)) {
      setSqlNeeded(true);
      setErr(error);
    } else if (error && !p) {
      setErr(error);
    } else {
      setSqlNeeded(false);
      if (!error) setErr(null);
    }
    setPoll(p);
    if (p) {
      const { votes: v } = await loadPollVotes(p.id);
      setVotes(v);
    } else {
      setVotes([]);
    }
  }, [league?.id]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const yeses = votes.filter((v) => v.response === "yes");
  const nos = votes.filter((v) => v.response === "no");
  const answered = votes.length;
  const humansApprox = Math.max(0, voterTotal - botCount);
  // Interest signal only — never a “must answer” meter
  const interestNote =
    yeses.length === 0
      ? "No interest yet — totally fine. Leave the door open or close it."
      : yeses.length < 3
        ? "A few people are curious. Open a room when it feels right — or wait."
        : "Solid interest. Open the chapter when the community feels ready.";

  async function sendPoll() {
    setBusy(true);
    setErr(null);
    setNote(null);
    setSqlNeeded(false);
    const pack = getSportPack(targetSport);
    const defaultMsg =
      `Optional: anyone interested in ${pack.shortLabel} with this crew? ` +
      `No pressure — pass or ignore is fine. This room keeps going either way.`;
    const res = await createSportPoolPoll({
      targetSportId: targetSport,
      proposedName:
        proposedName.trim() ||
        `${league?.name || "War Room"} · ${pack.shortLabel}`,
      message: message.trim() || defaultMsg,
    });
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    setPoll(res.poll);
    setNote(
      botCount > 0
        ? "Invite is live (soft). You’re marked interested so you can practice. Bots can answer for dry-runs only."
        : "Invite is live on Home — optional, dismissible. You’re counted as interested as host."
    );
    void refresh();
  }

  async function botsAnswer() {
    if (!poll) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await seedBotSportPoolVotes(poll.id);
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    if (res.bots < 1) {
      setNote("No trial bots in this room — optional for practice only.");
    } else {
      setNote(
        `Practice: bots simulated ${res.yes} interested · ${res.no} pass. Humans still choose freely.`
      );
    }
    void refresh();
  }

  async function createFromYeses() {
    if (!poll) return;
    if (yeses.length < 1) {
      setErr(
        "Need at least one interested person (you’re counted as host). Don’t force the room."
      );
      return;
    }
    const pack = getSportPack(poll.targetSportId);
    const ok = confirm(
      `Open a ${pack.shortLabel} chapter for people who opted in?\n\n` +
        `• ${yeses.length} interested → get a seat\n` +
        `• Pass / no answer → stay only in this room (no move, no shame)\n` +
        `• This ${getSportPack(currentSport).shortLabel} room keeps going\n\n` +
        `Community-led — only yeses join the new desk.`
    );
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await spinUpLeagueFromPoll({
      pollId: poll.id,
      newCommissionerId: newCommId || null,
      leagueNameOverride: proposedName.trim() || poll.proposedName,
    });
    setBusy(false);
    if (!res.ok) {
      if (/sport-pool-polls\.sql|SQL Editor/i.test(res.error)) {
        setSqlNeeded(true);
      }
      setErr(res.error);
      return;
    }
    setSpun({
      code: res.code,
      leagueId: res.leagueId,
      leagueName: res.leagueName,
      seated: res.seated,
      sportId: res.sportId,
    });
    setPoll(null);
    setNote(
      `Chapter open: ${res.leagueName} · ${res.seated} opted-in · code ${res.code}`
    );
    void refresh();
  }

  async function openNewRoom() {
    if (!spun?.leagueId) return;
    setBusy(true);
    const ok = await switchToLeague(spun.leagueId);
    setBusy(false);
    if (ok) {
      router.push("/");
      router.refresh();
      window.location.href = "/";
    } else {
      setErr(
        "Room created — open it from Account → Your leagues if switch failed."
      );
    }
  }

  if (!liveOthers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted leading-relaxed">
        No other live sports to invite yet. When CFB and NFL are both live, you
        can softly poll this room for a next chapter — never forced.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Community-led · optional chapter
        </p>
        <h3 className="text-base font-bold text-foreground mt-1">
          Soft invite — same Crew, new desk if they want
        </h3>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          Ask who&apos;s interested in another sport.{" "}
          <strong className="text-foreground">Nobody is moved</strong> out of
          this room. Only people who say yes get a seat in the new one. Pass,
          silence, and hide are all fine — this season keeps going either way.
        </p>
      </div>

      {sqlNeeded && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-3 text-xs text-danger leading-relaxed space-y-2">
          <p className="font-bold">One-time database setup required</p>
          <p>
            In Supabase → <strong className="text-foreground">SQL Editor</strong>{" "}
            → New query, paste{" "}
            <code className="text-foreground">supabase/sport-pool-polls.sql</code>{" "}
            → Run. Then hard-refresh.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(sportPoolSqlHint());
              setNote("Hint copied — open the .sql file in the repo for the full script.");
            }}
            className="text-[11px] font-semibold underline"
          >
            Copy setup hint
          </button>
        </div>
      )}

      {!poll && !spun && (
        <div className="space-y-3">
          <label className="block text-xs text-muted">
            Sport to invite (not replace this room)
            <select
              value={targetSport}
              onChange={(e) => setTargetSport(e.target.value as SportId)}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {liveOthers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Name if a room opens
            <input
              value={proposedName}
              onChange={(e) => setProposedName(e.target.value)}
              placeholder={`${league?.name || "War Room"} · ${getSportPack(targetSport).shortLabel}`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Invite wording (optional — keep it soft)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              rows={3}
              placeholder={`Optional: anyone interested in ${getSportPack(targetSport).shortLabel}? No pressure.`}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || sqlNeeded}
            onClick={() => void sendPoll()}
            className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 bg-primary/15 text-primary font-bold text-sm disabled:opacity-50 hover:bg-primary/25"
          >
            Share soft invite with the room
          </button>
          <p className="text-[11px] text-muted leading-relaxed">
            Shows a quiet Home card. People can pass, hide forever, or ignore.
            You&apos;ll only seat interest — never the whole roster by default.
          </p>
        </div>
      )}

      {poll && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Invite open · {getSportPack(poll.targetSportId).emoji}{" "}
              {getSportPack(poll.targetSportId).shortLabel} · {poll.proposedName}
            </p>
            <p className="text-xs text-muted mt-1.5">
              <span className="text-primary font-semibold">
                {yeses.length} interested
              </span>
              {nos.length > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">{nos.length} passed</span>
                </>
              )}
              {answered > 0 && humansApprox > 0 && (
                <>
                  {" · "}
                  <span className="text-muted">
                    {answered} responded (of ~{voterTotal || "?"} in room
                    {botCount > 0 ? `, incl. ${botCount} bots` : ""})
                  </span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              {interestNote} Silence is not a no and not a yes — just silence.
            </p>
          </div>

          {yeses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Interested · would get a seat ({yeses.length})
              </p>
              <p className="text-[11px] text-muted mb-1.5">
                Host-only list. We don&apos;t publish who passed.
              </p>
              <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                {yeses.map((v) => (
                  <li key={v.userId} className="text-foreground">
                    {v.displayName || v.userId.slice(0, 8)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block text-xs text-muted">
            Commissioner for the new desk (optional)
            <select
              value={newCommId}
              onChange={(e) => setNewCommId(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="">Keep me as commissioner</option>
              {yeses.map((v) => (
                <option key={v.userId} value={v.userId}>
                  {v.displayName || "Player"} — hand them the gavel
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={busy || yeses.length < 1}
            onClick={() => void createFromYeses()}
            className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            {yeses.length < 1
              ? "Waiting for interest…"
              : `Open ${getSportPack(poll.targetSportId).shortLabel} chapter for ${yeses.length} interested`}
          </button>
          {botCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void botsAnswer()}
              className="w-full py-2.5 min-h-[44px] rounded-xl border border-border bg-background text-sm font-medium text-muted disabled:opacity-50"
            >
              Practice: bots simulate answers
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                await closeSportPoolPoll(poll.id);
                setBusy(false);
                setPoll(null);
                setNote("Invite closed. No new room — this season continues as usual.");
              })();
            }}
            className="w-full py-2 text-xs text-muted hover:text-foreground"
          >
            Close invite without opening a room
          </button>
        </div>
      )}

      {spun && (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-3 text-sm space-y-2">
          <p className="font-bold text-primary">Chapter opened</p>
          <p className="text-foreground font-semibold">{spun.leagueName}</p>
          <p className="font-mono tracking-widest text-lg text-foreground">
            {spun.code}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {spun.seated} people who opted in are seated ·{" "}
            {getSportPack(spun.sportId).shortLabel}. Everyone else stays only in
            this room — nothing was forced.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openNewRoom()}
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
          >
            Open new desk →
          </button>
        </div>
      )}

      {note && <p className="text-xs text-primary leading-relaxed">{note}</p>}
      {err && !sqlNeeded && (
        <p className="text-xs text-danger leading-relaxed">{err}</p>
      )}
    </div>
  );
}

```

### FILE: `src/components/SandboxHopOptIn.tsx`

```tsx
"use client";

/**
 * Explicit opt-in for the sandbox hop bar.
 * Build next card / normal Host tabs never turn hop on by themselves.
 */

import { useEffect, useState } from "react";
import { getLeague, getSession, isOps } from "@/lib/league";
import { isSandboxMode } from "@/lib/season-mode";
import { isGuestMode } from "@/lib/guest-mode";
import {
  EVENT_SANDBOX_HOST_HOP,
  isSandboxHostHopActive,
  setSandboxHostHopActive,
} from "@/lib/sandbox-host-hop";
import { getSeasonOpenLabel } from "@/lib/season-countdown";

export default function SandboxHopOptIn() {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);
  const [label, setLabel] = useState("doors open");

  useEffect(() => {
    function refresh() {
      if (isGuestMode() || !isOps() || !isSandboxMode()) {
        setShow(false);
        return;
      }
      const lid = getLeague()?.id || getSession()?.leagueId;
      if (!lid) {
        setShow(false);
        return;
      }
      setShow(true);
      setOn(isSandboxHostHopActive(lid));
      try {
        setLabel(getSeasonOpenLabel(getLeague()?.sportId));
      } catch {
        setLabel("doors open");
      }
    }
    refresh();
    window.addEventListener(EVENT_SANDBOX_HOST_HOP, refresh);
    window.addEventListener("warroom-league-switched", refresh);
    return () => {
      window.removeEventListener(EVENT_SANDBOX_HOST_HOP, refresh);
      window.removeEventListener("warroom-league-switched", refresh);
    };
  }, []);

  if (!show) return null;

  const lid = getLeague()?.id || getSession()?.leagueId;

  return (
    <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
        Sandbox only · optional
      </p>
      <p className="text-sm font-bold text-foreground">
        Dry-run hop bar
      </p>
      <p className="text-xs text-muted leading-relaxed">
        Sticky Home · Picks · Board · Gazette · Commish jumps until {label}.{" "}
        <strong className="text-foreground">Off by default</strong> — building
        the next card or opening Commish tools does <em>not</em> turn this on
        (NFL + CFB). Only this switch does.
      </p>
      <button
        type="button"
        onClick={() => {
          const next = !on;
          setSandboxHostHopActive(next, lid);
          setOn(next);
        }}
        className={`w-full min-h-[48px] rounded-xl text-sm font-extrabold touch-manipulation border ${
          on
            ? "bg-amber-400 text-black border-amber-300"
            : "bg-black/30 text-amber-100 border-amber-400/40 hover:border-amber-400/70"
        }`}
      >
        {on ? "Hop bar ON · tap to turn off" : "Turn hop bar on for this room"}
      </button>
      {on && (
        <p className="text-[10px] text-amber-200/75 leading-snug">
          Use <strong>Close bar</strong> / <strong>Wipe board</strong> on the
          hop bar to exit. Switching leagues always clears it.
        </p>
      )}
    </div>
  );
}

```

### FILE: `src/components/CommishSetupBanner.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLeagueRoster,
  loadWeekCard,
  listScoredWeekNumbers,
  listPublishedWeekNumbers,
  loadLeagueActiveWeek,
} from "@/lib/cloud";
import { getLeague, isActuallyCommissioner } from "@/lib/league";
import {
  getCommishSetup,
  isFirstTimeCommish,
} from "@/lib/commish-onboarding";
import InviteFriends from "@/components/InviteFriends";
import { weekTitle } from "@/lib/dates";
import {
  isOnboardingActive,
  readOnboardingState,
  ONBOARDING_EVENT,
} from "@/lib/onboarding";

/**
 * First-time host companion on Home.
 * Conversation, not a checklist. One action only. No "3 jobs."
 * Scoring stays quiet until a practice week card is live.
 * Hidden while the commissioner conversation engine is active (coach owns the path).
 */
export default function CommishSetupBanner() {
  const [show, setShow] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyStepId, setJourneyStepId] = useState<string | null>(null);
  const [humans, setHumans] = useState(0);
  const [hasCard, setHasCard] = useState(false);
  const [code, setCode] = useState("");
  const [leagueName, setLeagueName] = useState("War Room");
  const [leagueId, setLeagueId] = useState("");
  const [weekLabel, setWeekLabel] = useState("this week");

  useEffect(() => {
    function syncJourney() {
      try {
        const s = readOnboardingState();
        const active =
          isOnboardingActive() && s.journeyId === "commissioner";
        setJourneyActive(active);
        setJourneyStepId(active ? s.stepId : null);
      } catch {
        setJourneyActive(false);
        setJourneyStepId(null);
      }
    }
    syncJourney();
    window.addEventListener(ONBOARDING_EVENT, syncJourney);
    return () => window.removeEventListener(ONBOARDING_EVENT, syncJourney);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isActuallyCommissioner()) {
        setShow(false);
        return;
      }
      const league = getLeague();
      if (!league?.id) {
        setShow(false);
        return;
      }
      try {
        const scoredWeeks = await listScoredWeekNumbers();
        if (
          !isFirstTimeCommish({
            leagueId: league.id,
            scoredWeekCount: scoredWeeks.length,
          })
        ) {
          if (!cancelled) setShow(false);
          return;
        }
        const [roster, week, published] = await Promise.all([
          loadLeagueRoster(),
          loadLeagueActiveWeek(),
          listPublishedWeekNumbers(),
        ]);
        const card = await loadWeekCard(week);
        if (cancelled) return;
        setLeagueId(league.id);
        setCode(league.code || "");
        setLeagueName(league.name || "War Room");
        setHumans(roster.filter((m) => !m.isBot).length);
        setHasCard(!!(card?.games?.length) || published.length > 0);
        setWeekLabel(weekTitle(week));
        setShow(true);
      } catch {
        if (!cancelled) setShow(false);
      }
    }
    const t = window.setTimeout(() => void load(), 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  // While conversation engine runs: only surface the ONE current action UI
  // (never a second manual / checklist). Welcome + finish stay coach-only.
  if (journeyActive) {
    if (journeyStepId !== "invite" && journeyStepId !== "build_week") {
      return null;
    }
  }

  const invited = humans >= 2 || getCommishSetup(leagueId).inviteCopied;
  // One action only — never a three-step syllabus
  type HostBeat = "invite" | "card" | "soft_score";
  let beat: HostBeat = !invited ? "invite" : !hasCard ? "card" : "soft_score";
  if (journeyActive && journeyStepId === "invite") beat = "invite";
  if (journeyActive && journeyStepId === "build_week") beat = "card";
  // Soft score only after practice week exists AND journey is done
  if (journeyActive && beat === "soft_score") return null;

  return (
    <section
      id="host-start-here"
      className="mb-5 rounded-2xl border-2 border-primary/50 bg-card/95 p-4 sm:p-5 shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-black">
          Start here
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          Host · I&apos;m with you
        </p>
      </div>

      {beat === "invite" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            Get one friend in the door.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            One share. Drop it in the group chat. That&apos;s the whole job
            right now — not a checklist.
          </p>
          {code ? (
            <InviteFriends
              leagueName={leagueName}
              code={code}
              leagueId={leagueId}
              compact
              startHere
            />
          ) : null}
        </>
      )}

      {beat === "card" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            Build one practice week.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            {humans} {humans === 1 ? "person" : "people"} in the room. Pull
            Odds, pick 5, Publish. One card — then the room is alive.
          </p>
          <Link
            href="/commissioner?tab=card&first=1"
            className="flex items-center justify-center w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation active:scale-[0.99]"
          >
            Start here · Build {weekLabel} →
          </Link>
        </>
      )}

      {beat === "soft_score" && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
            You already ran a week.
          </h2>
          <p className="text-sm text-muted mb-3 leading-relaxed">
            When the games die, come back and score — standings move, paper
            drops. Not now. Only when kickoffs are done.
          </p>
          <Link
            href="/commissioner?tab=results"
            className="flex items-center justify-center w-full py-3.5 min-h-[48px] rounded-xl border border-primary/50 text-primary text-sm font-bold touch-manipulation"
          >
            I&apos;ll score when games are done →
          </Link>
        </>
      )}
    </section>
  );
}

```

### FILE: `src/components/InviteFriends.tsx`

```tsx
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
  /** Highlight as the single onboarding "Start Here" control */
  startHere?: boolean;
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
  startHere = false,
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
      <div
        id={startHere ? "invite-start-here" : undefined}
        className={className}
      >
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
            className={
              startHere
                ? "px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-extrabold disabled:opacity-50 min-h-[48px] ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
                : "px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50 min-h-[44px]"
            }
          >
            {busy ? "…" : startHere ? "Start here · Share invite" : "Share invite"}
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
              {busy
                ? "…"
                : `Share · ${isNfl ? "NFL" : "CFB"}`}
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
            : `Share · ${isNfl ? "NFL" : "CFB"} · ${
                leagueName.length > 16
                  ? `${leagueName.slice(0, 14)}…`
                  : leagueName
              }`}
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

```

### FILE: `src/components/onboarding/OnboardingHost.tsx`

```tsx
"use client";

/**
 * Immersive onboarding host.
 * Rule: illuminate War Room — never cover it or replace it with a course UI.
 * Coach = host beside you. App stays center stage.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  ONBOARDING_EVENT,
  acknowledgeSpeak,
  confirmStepComplete,
  evaluateSuccess,
  finishCelebration,
  getActiveStep,
  isOnboardingActive,
  readOnboardingState,
  secondarySkip,
  setPracticePicksHref,
  skipJourney,
  type OnboardingPersistedState,
  type OnboardingStep,
  type PointAtTarget,
} from "@/lib/onboarding";
import { maybeStartOnboarding } from "@/lib/onboarding/start";
import { prepareNavigation } from "@/lib/smooth";

/** Slim top strip — never a huge practice panel */
function PracticeStrip() {
  return (
    <div className="fixed top-0 inset-x-0 z-[56] pointer-events-none">
      <div
        className="mx-auto max-w-lg px-3 pt-[max(0.35rem,env(safe-area-inset-top))]"
      >
        <div className="pointer-events-none rounded-b-lg border border-t-0 border-sky-400/35 bg-sky-950/90 backdrop-blur-md px-3 py-1.5 flex items-center justify-between gap-2 shadow-lg">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-200">
            Practice mode
          </p>
          <p className="text-[10px] text-sky-100/75 truncate">
            Nothing here affects your real league · Follow the guide
          </p>
        </div>
      </div>
    </div>
  );
}

/** Point at bottom nav — player drives, coach only guides attention */
function NavPointer({
  target,
  startHere,
}: {
  target: PointAtTarget;
  startHere?: boolean;
}) {
  if (!target) return null;
  const labels: Record<string, string> = {
    home: "Home",
    picks: "My Picks",
    standings: "Standings",
    locker: "Locker",
    commissioner: "Commish",
  };
  const label = labels[target] || target;
  return (
    <div
      className="fixed inset-x-0 z-[54] flex justify-center pointer-events-none md:hidden"
      style={{
        bottom: "calc(3.25rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-hidden
    >
      <div className="flex flex-col items-center animate-bounce">
        <span className="text-[10px] font-extrabold text-black bg-primary border border-primary rounded-full px-2.5 py-1 shadow-lg mb-0.5">
          {startHere ? `Start here · ${label}` : `Tap ${label}`}
        </span>
        <span className="text-primary text-lg leading-none">↓</span>
      </div>
    </div>
  );
}

function primaryLabel(step: OnboardingStep, busy?: boolean): string {
  if (busy) return "…";
  const raw = step.action?.label || "Continue →";
  if (step.conversation.startHere && !/^start here/i.test(raw)) {
    return `Start here · ${raw}`;
  }
  return raw;
}

function CoachStrip({
  step,
  phase,
  onPrimary,
  onSecondary,
  onContinue,
  onSkipAll,
  onDismissCelebrate,
  primaryBusy,
}: {
  step: OnboardingStep;
  phase: OnboardingPersistedState["phase"];
  onPrimary: () => void;
  onSecondary?: () => void;
  onContinue: () => void;
  onSkipAll: () => void;
  onDismissCelebrate: () => void;
  primaryBusy?: boolean;
}) {
  const c = step.conversation;
  const isPeak = phase === "celebrate" && c.celebrate === "peak";
  const isMicro = phase === "celebrate" && c.celebrate === "micro";
  const isFullscreenSpeak =
    step.layout === "fullscreen" && phase === "speak";

  // Peak only — full attention, rare
  if (isPeak && c.celebrateCopy) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          aria-label="Continue"
          onClick={onDismissCelebrate}
        />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-primary/50 bg-card p-5 sm:p-6 space-y-3 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {c.kicker || "Nice"}
          </p>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {c.celebrateCopy}
          </div>
          <button
            type="button"
            onClick={onDismissCelebrate}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm"
          >
            {c.nextHint ? `Nice · ${c.nextHint} →` : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // Micro recognition — slim, does not cover the app
  if (isMicro) {
    return (
      <div
        className="fixed left-0 right-0 z-[55] px-3 pointer-events-none"
        style={{
          bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="max-w-lg mx-auto pointer-events-auto rounded-xl border border-primary/50 bg-card/95 backdrop-blur-md px-3 py-2.5 shadow-xl">
          <p className="text-sm font-semibold text-foreground">
            {c.celebrateCopy || "✓ Nice."}
          </p>
          {(c.explainAfter || c.nextHint) && (
            <p className="text-[11px] text-muted mt-0.5">
              {c.explainAfter || c.nextHint}
            </p>
          )}
        </div>
      </div>
    );
  }

  // One-time welcome only — keep short so Home is visible behind
  if (isFullscreenSpeak) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Lighter scrim so War Room still peeks through */}
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
        <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-card/98 p-5 space-y-3 shadow-2xl">
          {c.kicker && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {c.kicker}
            </p>
          )}
          <h2 className="text-xl font-black text-foreground leading-snug">
            {c.title}
          </h2>
          <p className="text-sm text-foreground/90 leading-relaxed">{c.speak}</p>
          {c.whyCare && (
            <p className="text-xs text-muted leading-relaxed">{c.whyCare}</p>
          )}
          <button
            type="button"
            disabled={primaryBusy}
            onClick={onPrimary}
            className="w-full py-3.5 min-h-[48px] rounded-xl bg-primary text-black font-extrabold text-sm disabled:opacity-60"
          >
            {primaryLabel(step, primaryBusy)}
          </button>
          {step.secondaryAction && (
            <button
              type="button"
              onClick={onSecondary}
              className="w-full py-2 text-xs text-muted hover:text-foreground"
            >
              {step.secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={onSkipAll}
            className="w-full py-1.5 text-[10px] text-muted/70"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Sticky host coach — compact, app stays hero
  return (
    <div
      className="fixed left-0 right-0 z-[55] px-3 pointer-events-none"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto rounded-xl border border-primary/60 bg-card/95 backdrop-blur-md shadow-xl overflow-hidden mb-1">
        <div className="px-3 py-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {c.startHere && (
              <span className="inline-flex mb-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-black">
                Start here
              </span>
            )}
            {c.kicker && (
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary mb-0.5">
                {c.kicker}
              </p>
            )}
            <p className="text-sm font-bold text-foreground leading-snug">
              {c.title}
            </p>
            <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-3">
              {c.speak}
            </p>
            {phase === "awaiting" && c.nextHint && (
              <p className="text-[11px] text-primary font-semibold mt-1">
                → {c.nextHint}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSkipAll}
            className="text-[10px] text-muted shrink-0 px-1"
          >
            Skip
          </button>
        </div>
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {step.action && (
            <button
              type="button"
              disabled={primaryBusy}
              onClick={onPrimary}
              className="flex-1 min-w-[7rem] py-2 rounded-lg bg-primary text-black text-xs font-extrabold disabled:opacity-60"
            >
              {primaryLabel(step, primaryBusy)}
            </button>
          )}
          {phase === "awaiting" &&
            (step.successCondition.type === "manual" ||
              step.secondaryAction) && (
              <button
                type="button"
                onClick={onContinue}
                className="px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold"
              >
                {step.secondaryAction?.label?.includes("→")
                  ? step.secondaryAction.label
                  : "Continue →"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<OnboardingPersistedState | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    const s = readOnboardingState();
    setState(s);
    setStep(getActiveStep());
  }, []);

  useEffect(() => {
    if (isGuestMode()) return;
    if (!getSession()?.playerId) return;

    let cancelled = false;
    void (async () => {
      if (!isOnboardingActive()) {
        await maybeStartOnboarding();
      }
      if (!cancelled) sync();
    })();

    const t = window.setTimeout(() => {
      void maybeStartOnboarding().then(sync);
    }, 1400);

    function onOb() {
      sync();
    }
    function onCardPublished() {
      const s = readOnboardingState();
      if (s.active && s.phase === "awaiting") {
        const st = getActiveStep();
        if (
          st?.successCondition.type === "event" &&
          (st.successCondition.name === "warroom-card-published" ||
            !st.successCondition.name)
        ) {
          confirmStepComplete();
          sync();
        }
      }
    }
    function onInviteShared() {
      const s = readOnboardingState();
      if (s.active && s.phase === "awaiting") {
        evaluateSuccess(window.location.pathname);
        sync();
      }
    }
    window.addEventListener(ONBOARDING_EVENT, onOb);
    window.addEventListener("warroom-card-published", onCardPublished);
    window.addEventListener("warroom-invite-shared", onInviteShared);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener(ONBOARDING_EVENT, onOb);
      window.removeEventListener("warroom-card-published", onCardPublished);
      window.removeEventListener("warroom-invite-shared", onInviteShared);
    };
  }, [sync]);

  // Path / flags while awaiting
  useEffect(() => {
    if (!state?.active || state.phase !== "awaiting") return;
    evaluateSuccess(pathname);
    sync();
    const id = window.setInterval(() => {
      evaluateSuccess(pathname);
      sync();
    }, 700);
    return () => window.clearInterval(id);
  }, [pathname, state?.active, state?.phase, state?.stepId, sync]);

  // Micro celebration: show recognition, then advance (never stall with no next)
  useEffect(() => {
    if (state?.phase !== "celebrate") return;
    const st = getActiveStep();
    if (!st || st.conversation.celebrate !== "micro") return;
    const t = window.setTimeout(() => {
      finishCelebration();
      sync();
    }, 1600);
    return () => window.clearTimeout(t);
  }, [state?.phase, state?.stepId, sync]);

  async function resolveHref(step: OnboardingStep): Promise<string | null> {
    const a = step.action;
    if (!a) return null;
    if (a.href) return a.href;
    if (a.resolveHref === "home") return "/";
    if (a.resolveHref === "tutorialPicks") {
      // Prefer practice so Promise #2 holds — real app UI only
      try {
        const { isBoredPracticeWindowOpen } = await import(
          "@/lib/bored-practice"
        );
        if (isBoredPracticeWindowOpen()) {
          const { startBoredPracticeWeek } = await import(
            "@/lib/bored-practice-run"
          );
          const res = await startBoredPracticeWeek();
          if (res.ok && res.picksHref) {
            setPracticePicksHref(res.picksHref);
            return res.picksHref;
          }
        }
      } catch {
        /* fall through */
      }
      try {
        const { ensureTutorialPicksHref } = await import(
          "@/lib/player-tutorial"
        );
        const d = await ensureTutorialPicksHref();
        setPracticePicksHref(d.href);
        return d.href;
      } catch {
        return "/picks";
      }
    }
    if (a.resolveHref === "commissionerCard") {
      return "/commissioner?tab=card&first=1";
    }
    if (a.resolveHref === "commissionerResults") {
      return "/commissioner?tab=results";
    }
    return null;
  }

  async function onPrimary() {
    if (!step) return;
    setBusy(true);
    try {
      prepareNavigation("onboarding.primary");
      const href = await resolveHref(step);

      if (step.layout === "fullscreen" && readOnboardingState().phase === "speak") {
        if (href) {
          // Land inside the product once — never double-advance (always already leaves step)
          if (step.successCondition.type === "always") {
            confirmStepComplete();
          } else {
            acknowledgeSpeak();
          }
          try {
            router.push(href);
          } catch {
            window.location.href = href;
          }
        } else {
          confirmStepComplete();
        }
        sync();
        return;
      }

      if (href) {
        acknowledgeSpeak();
        try {
          router.push(href);
        } catch {
          window.location.href = href;
        }
        // If already on target path, force evaluate
        window.setTimeout(() => {
          evaluateSuccess(window.location.pathname);
          sync();
        }, 100);
        sync();
        return;
      }

      if (step.successCondition.type === "manual") {
        acknowledgeSpeak();
        sync();
        return;
      }

      confirmStepComplete();
      sync();
    } finally {
      setBusy(false);
    }
  }

  function onSecondary() {
    secondarySkip();
    sync();
  }

  function onContinue() {
    confirmStepComplete();
    sync();
  }

  function onSkipAll() {
    skipJourney();
    sync();
  }

  function onDismissCelebrate() {
    finishCelebration();
    sync();
  }

  if (isGuestMode()) return null;
  if (!state?.active || !step) return null;
  if (state.phase === "idle" || state.phase === "complete") return null;

  const showPracticeStrip =
    !!step.conversation.practiceBanner && state.phase !== "celebrate";
  const pointAt =
    state.phase === "speak" || state.phase === "awaiting"
      ? step.conversation.pointAt
      : null;

  return (
    <>
      {showPracticeStrip && <PracticeStrip />}
      {pointAt && state.phase === "awaiting" && (
        <NavPointer
          target={pointAt}
          startHere={!!step.conversation.startHere}
        />
      )}
      {pointAt &&
        state.phase === "speak" &&
        step.action?.resolveHref === "tutorialPicks" && (
          <NavPointer
            target={pointAt}
            startHere={!!step.conversation.startHere}
          />
        )}
      {pointAt &&
        state.phase === "speak" &&
        (step.action?.href === "/standings" ||
          step.action?.href === "/locker-room" ||
          step.action?.resolveHref === "commissionerCard") && (
          <NavPointer
            target={pointAt}
            startHere={!!step.conversation.startHere}
          />
        )}
      <CoachStrip
        step={step}
        phase={state.phase}
        onPrimary={() => void onPrimary()}
        onSecondary={onSecondary}
        onContinue={onContinue}
        onSkipAll={onSkipAll}
        onDismissCelebrate={onDismissCelebrate}
        primaryBusy={busy}
      />
    </>
  );
}

export function replayOnboardingJourney(id: "player" | "commissioner") {
  void import("@/lib/onboarding").then((m) => {
    m.resetJourney(id);
    m.startJourney(id, { userId: getSession()?.playerId, force: true });
  });
}

```

### FILE: `src/lib/onboarding/journeys/commissioner.ts`

```tsx
/**
 * Journey A — New Commissioner (Scrub #2: host conversation, not a manual)
 *
 * Emotional goal: "Wow... I can actually run this."
 * NOT: "I know the three jobs."
 *
 * Rules:
 * - One action at a time
 * - Always one "Start Here"
 * - Coach stays with you
 * - No scoring / advanced until after a practice week is live
 * - Foundry never appears in this copy
 */

import type { OnboardingJourney } from "../types";

export const commissionerJourney: OnboardingJourney = {
  id: "commissioner",
  name: "First hour as host",
  successFeeling: "Wow... I can actually run this.",
  steps: [
    {
      id: "welcome",
      goal: "Welcome as a host — promise company, not a syllabus",
      layout: "fullscreen",
      conversation: {
        kicker: "Hey, host",
        title: "This is your room.",
        speak:
          "I'm staying with you. Not a manual — just the next thing, one step at a time. You can't break the league from here.",
        whyCare: "A few minutes. Then you'll know you can actually run this.",
        celebrate: "none",
        startHere: true,
        pointAt: "home",
      },
      action: {
        label: "Start here — walk me in →",
        resolveHref: "home",
        advancesOnClick: true,
      },
      secondaryAction: { label: "I'll explore on my own", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: "invite",
    },
    {
      id: "invite",
      goal: "One action: get a friend in the door",
      layout: "coach",
      conversation: {
        kicker: "Still with you",
        title: "Get one friend in the door.",
        speak:
          "That's the whole job right now. Tap Share invite — drop it in the group chat. Empty room isn't broken. It's waiting.",
        celebrate: "micro",
        celebrateCopy: "✓ Nice. Someone's about to walk in.",
        explainAfter:
          "Next we wake the room with one practice week. Same moves you'll use all season.",
        nextHint: "Share invite on Home",
        startHere: true,
        pointAt: "home",
      },
      action: {
        label: "Start here · Share invite",
        href: "/#invite-friends",
        advancesOnClick: true,
      },
      secondaryAction: {
        label: "I shared it →",
      },
      successCondition: { type: "sessionFlag", key: "warroom-invite-shared" },
      nextStep: "build_week",
    },
    {
      id: "build_week",
      goal: "One action: publish a practice week so the room is alive",
      layout: "coach",
      conversation: {
        kicker: "Still with you",
        title: "Build one practice week.",
        speak:
          "Open Commish → Pull Odds → pick 5 → Publish. One card. That's it. Friends can lock picks after this.",
        whyCare:
          "Practice week energy — you're learning the real host move, not reading about it.",
        celebrate: "peak",
        celebrateCopy:
          "🎉 You just ran a week.\n\nThe room is alive. Players can open My Picks.\n\nWow… you can actually run this.",
        explainAfter: "That's the hard part. You're the host now.",
        nextHint: "Open Commish · Build Card",
        startHere: true,
        pointAt: "commissioner",
      },
      action: {
        label: "Start here · Build the card →",
        resolveHref: "commissionerCard",
        advancesOnClick: true,
      },
      successCondition: { type: "event", name: "warroom-card-published" },
      secondaryAction: {
        label: "I published it →",
      },
      // Scoring deliberately NOT next — delay until after practice week exists
      nextStep: "youre_ready",
    },
    {
      id: "youre_ready",
      goal: "Single emotional finish — confidence, not curriculum",
      layout: "fullscreen",
      conversation: {
        kicker: "You did it",
        title: "You can run this.",
        speak:
          "Invite. Card. Room alive. When friends text “is the league open?” — you already know what to do. Scoring waits until the games die. We'll do that together then.",
        whyCare: "Welcome to the War Room, host.",
        celebrate: "none",
        startHere: true,
      },
      action: {
        label: "Start here · Take me home →",
        href: "/",
        advancesOnClick: true,
      },
      secondaryAction: { label: "Done", skipTo: "complete" },
      successCondition: { type: "always" },
      nextStep: null,
    },
  ],
};

```

### FILE: `src/lib/onboarding/start.ts`

```tsx
/**
 * Decide which journey to offer a signed-in user (not guest, not Through Their Eyes).
 */

import { getSession, isActuallyCommissioner } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { isFirstTimeCommish } from "@/lib/commish-onboarding";
import { listScoredWeekNumbers } from "@/lib/cloud";
import {
  hasCompletedJourney,
  isOnboardingActive,
  needsJourney,
  startJourney,
} from "./engine";
import { getLeague } from "@/lib/league";

/**
 * Prefer commissioner journey for first-time hosts; else player journey.
 * Never starts if already active or guest.
 */
export async function maybeStartOnboarding(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isGuestMode()) return;
  if (isOnboardingActive()) return;

  const session = getSession();
  if (!session?.playerId) return;

  // Host first — they need the room alive before players lock
  if (isActuallyCommissioner()) {
    const leagueId = getLeague()?.id || session.leagueId || "";
    let scored = 0;
    try {
      scored = (await listScoredWeekNumbers()).length;
    } catch {
      scored = 0;
    }
    if (
      leagueId &&
      isFirstTimeCommish({ leagueId, scoredWeekCount: scored }) &&
      needsJourney("commissioner")
    ) {
      startJourney("commissioner", { userId: session.playerId });
      return;
    }
  }

  if (needsJourney("player") && !hasCompletedJourney("player")) {
    // Suppress legacy "Walk the dog" coach — new engine owns first session
    try {
      const { completePlayerTutorial } = await import("@/lib/player-tutorial");
      completePlayerTutorial();
    } catch {
      /* ok */
    }
    startJourney("player", { userId: session.playerId });
  }
}

```

### FILE: `src/lib/view-as-player.ts`

```tsx
/**
 * Commish “see the app as a player” preview.
 * UI-only: hides Commish/Ops/Mod chrome. Server permissions unchanged.
 */

import { reapplySeasonThemeFromLocal } from "./season-theme";

const KEY = "warroom-view-as-player";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function isViewAsPlayer(): boolean {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setViewAsPlayer(on: boolean) {
  if (!canUseStorage()) return;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  // Keep season theme painted when switching Commish ↔ player preview
  if (typeof window !== "undefined") {
    try {
      reapplySeasonThemeFromLocal();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("warroom-view-as-player", { detail: on })
    );
  }
}

export function toggleViewAsPlayer(): boolean {
  const next = !isViewAsPlayer();
  setViewAsPlayer(next);
  return next;
}

```

### FILE: `src/lib/foundry-preview.ts`

```tsx
/**
 * Foundry testing — when you’re in the lab, ceremonies must actually fire.
 * First-hour “eyes” sims stay quiet on purpose; Foundry sticky + post/score does not.
 */

import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";

export const EVENT_FORCE_GAZETTE_PAPER = "warroom-force-gazette-paper";
export const EVENT_FORCE_BADGE_CHECK = "warroom-force-badge-check";

const FOUNDRY_STICKY = "warroom-foundry-session-v1";

export function isFoundrySessionSticky(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FOUNDRY_STICKY) === "1";
  } catch {
    return false;
  }
}

/**
 * Demo slate / randomize & score / auto-score / hop bar — shop tools only.
 * Regular commiss get Pull Odds → publish → Sync scores (Foundry owns fakes).
 */
export function showCommishLabTools(): boolean {
  if (typeof window === "undefined") return false;
  const uid = getSession()?.playerId;
  if (isAppCreator(uid)) return true;
  if (isFoundrySessionSticky()) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isCreatorEyesActive()) return true;
  } catch {
    /* ok */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sb = require("./creator-sandbox") as typeof import("./creator-sandbox");
    if (sb.isCreatorSandboxActive()) return true;
  } catch {
    /* ok */
  }
  return false;
}

/**
 * Allow Gazette / cheevo / ceremony popups while testing Foundry.
 * Quiet first-hour eyes (new player / new host) stay calm.
 */
export function allowFoundryCeremonies(): boolean {
  if (typeof window === "undefined") return false;
  const uid = getSession()?.playerId;
  if (!isAppCreator(uid)) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isCreatorEyesActive()) return false;
  } catch {
    /* ok */
  }

  if (isFoundrySessionSticky()) return true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sb = require("./creator-sandbox") as typeof import("./creator-sandbox");
    if (sb.isCreatorSandboxActive()) return true;
  } catch {
    /* ok */
  }

  return false;
}

/**
 * After Foundry post/score — open the real drama path so you can see
 * Gazette + cheevos like a live room (not stuck in pre-lock calm).
 */
export async function prepareFoundryDramaAfterScore(
  weekNumber: number
): Promise<{ ok: boolean; message: string }> {
  const session = getSession();
  if (!session?.playerId || !session.leagueId) {
    return { ok: false, message: "No session" };
  }
  if (!isAppCreator(session.playerId)) {
    return { ok: false, message: "Creator only" };
  }

  try {
    // Sticky Foundry session (← Foundry bar)
    try {
      localStorage.setItem(FOUNDRY_STICKY, "1");
      window.dispatchEvent(new CustomEvent("warroom-foundry-session"));
    } catch {
      /* ok */
    }

    // Exit quiet first-hour gates
    const fw = await import("./first-week");
    fw.markHasLockedPicksOnce(session.playerId);
    fw.markSeasonComeAlive(session.playerId);

    const rules = await import("./rules");
    rules.markRulesSeen();

    // Clear “already read” so paper can pop again for this week
    try {
      const { clearGazetteSeenForWeek } = await import("./gazette");
      clearGazetteSeenForWeek(session.leagueId, weekNumber);
    } catch {
      /* ok */
    }

    // Build + archive paper so offer has something to show
    try {
      const { loadLeaguePlayers } = await import("./cloud");
      const {
        buildGazetteEdition,
        archiveGazetteEdition,
      } = await import("./gazette");
      const players = await loadLeaguePlayers();
      const edition = await buildGazetteEdition(players);
      if (edition) {
        await archiveGazetteEdition(edition);
      }
    } catch {
      /* paper may still build client-side from weekly points */
    }

    // Progressive: full-ish room so nav/shelf match
    try {
      const sb = await import("./creator-sandbox");
      sb.saveCreatorSandbox({
        enabled: true,
        weekNumber: Math.max(weekNumber, 1),
        scoredCount: Math.max(weekNumber, 1),
        phase: weekNumber >= 3 ? "deepening" : "core",
      });
    } catch {
      /* ok */
    }

    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
    window.dispatchEvent(new CustomEvent("warroom-first-week-progress"));
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_GAZETTE_PAPER));
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_BADGE_CHECK));

    return {
      ok: true,
      message: "Drama unlocked — Gazette + cheevos can fire",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Foundry drama prep failed",
    };
  }
}

/** Force-show paper / cheevos from Foundry “Flash a moment” buttons. */
export async function forceFoundryGazetteAndCheevos(): Promise<void> {
  const session = getSession();
  if (!session?.playerId) return;
  await prepareFoundryDramaAfterScore(
    // use sandbox week or 1
    (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sb = require("./creator-sandbox") as typeof import("./creator-sandbox");
        return sb.loadCreatorSandbox().weekNumber || 1;
      } catch {
        return 1;
      }
    })()
  );
}

```

### FILE: `src/lib/commish-onboarding.ts`

```tsx
/**
 * First-time commissioner guidance — setup spine until first week is scored.
 */

const KEY = "warroom-commish-setup-v1";

export type CommishSetupFlags = {
  hostScreenSeen?: boolean;
  inviteCopied?: boolean;
  firstCardPublished?: boolean;
  practiceWeekDone?: boolean;
  graduated?: boolean;
};

type Store = Record<string, CommishSetupFlags>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getCommishSetup(leagueId: string): CommishSetupFlags {
  if (!leagueId) return {};
  return readAll()[leagueId] || {};
}

export function patchCommishSetup(
  leagueId: string,
  patch: Partial<CommishSetupFlags>
) {
  if (!leagueId) return;
  const all = readAll();
  all[leagueId] = { ...(all[leagueId] || {}), ...patch };
  writeAll(all);
}

export function markHostScreenSeen(leagueId: string) {
  patchCommishSetup(leagueId, { hostScreenSeen: true });
}

export function markInviteCopied(leagueId: string) {
  patchCommishSetup(leagueId, { inviteCopied: true });
  // Onboarding conversation engine — one-action success for "invite"
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("warroom-invite-shared", "1");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("warroom-invite-shared"));
      window.dispatchEvent(new CustomEvent("warroom-onboarding"));
    }
  } catch {
    /* ok */
  }
}

export function markFirstCardPublished(leagueId: string) {
  patchCommishSetup(leagueId, { firstCardPublished: true });
}

export function markPracticeWeekDone(leagueId: string) {
  patchCommishSetup(leagueId, { practiceWeekDone: true });
}

export function markCommishGraduated(leagueId: string) {
  patchCommishSetup(leagueId, { graduated: true });
}

/**
 * First-time mode until they've scored a real week (or we mark graduated).
 * scoredWeeks from cloud wins over local flags.
 */
export function isFirstTimeCommish(opts: {
  leagueId: string;
  scoredWeekCount: number;
}): boolean {
  if (!opts.leagueId) return false;
  if (opts.scoredWeekCount > 0) {
    markCommishGraduated(opts.leagueId);
    return false;
  }
  const f = getCommishSetup(opts.leagueId);
  if (f.graduated) return false;
  return true;
}

/** Deep link that lands friends on join with code pre-filled. */
export function buildInviteJoinUrl(opts: {
  code: string;
  appUrl?: string;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const base =
    opts.appUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base || !code) return code ? `/join?code=${encodeURIComponent(code)}` : "";
  return `${base.replace(/\/$/, "")}/join?code=${encodeURIComponent(code)}`;
}

export type InviteFlavor =
  | "warroom"
  | "groupchat"
  | "dad"
  | "boomer"
  | "genx"
  | "xennial"
  | "millennial"
  | "chaos"
  | "primetime"
  | "tailgate"
  | "redzone";

/**
 * Resolve CFB vs NFL for invites — never guess wrong.
 * Prefer explicit sportId → active league → localStorage league row.
 * Defaults to cfb only as last resort.
 */
export function resolveInviteSportId(
  explicit?: string | null
): "cfb" | "nfl" {
  const norm = (s: string | null | undefined): "cfb" | "nfl" | null => {
    const x = (s || "").toLowerCase().trim();
    if (!x) return null;
    if (x === "nfl" || x === "pro" || x === "pro_football") return "nfl";
    if (
      x === "cfb" ||
      x === "ncaaf" ||
      x === "college" ||
      x === "college_football"
    )
      return "cfb";
    // Other packs (wwc, etc.) fall through — treat as non-NFL
    if (x.includes("nfl")) return "nfl";
    if (x.includes("cfb") || x.includes("ncaa")) return "cfb";
    return null;
  };

  const fromArg = norm(explicit);
  if (fromArg) return fromArg;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    const fromLeague = norm(getLeague()?.sportId);
    if (fromLeague) return fromLeague;
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("warroom-league");
      if (raw) {
        const j = JSON.parse(raw) as { sportId?: string };
        const fromLs = norm(j?.sportId);
        if (fromLs) return fromLs;
      }
    } catch {
      /* ignore */
    }
  }

  return "cfb";
}

/**
 * Entertaining invite copy for texts/iMessage/Discord — every generation in 2026.
 * Deep link first so one tap opens join with code filled in.
 * Random flavor when flavor is omitted or "random" (fresh every share).
 * ANY league member can send these — not just the commissioner.
 *
 * CRITICAL: sportId must match the room. NFL never gets CFB copy (and reverse).
 */
export function buildInviteShareText(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
  /** Who’s sending — “Mike pulled you in” energy */
  inviterName?: string;
  flavor?: InviteFlavor | "random";
  /** cfb | nfl — dual-sport invites must not sound like campus when it's Sunday */
  sportId?: string | null;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const name = (opts.leagueName || "War Room").trim();
  const who = (opts.inviterName || "").trim();
  const joinUrl = buildInviteJoinUrl({ code, appUrl: opts.appUrl });
  const linkBlock = joinUrl ? `👉 ${joinUrl}` : code ? `Code: ${code}` : "";
  const codeLine = code ? `(Code if needed: ${code})` : "";
  const sportId = resolveInviteSportId(opts.sportId);
  const nfl = sportId === "nfl";
  // Always explicit — dual-sport invites must not be ambiguous
  const sportBanner = nfl
    ? "🏈 LEAGUE TYPE: NFL — pro football pick'em"
    : "🏟️ LEAGUE TYPE: CFB — college football pick'em";

  const flavors: InviteFlavor[] = [
    "warroom",
    "groupchat",
    "dad",
    "boomer",
    "genx",
    "xennial",
    "millennial",
    "chaos",
    "primetime",
    "tailgate",
    "redzone",
  ];
  let flavor: InviteFlavor =
    opts.flavor && opts.flavor !== "random" ? opts.flavor : "warroom";
  if (!opts.flavor || opts.flavor === "random") {
    // NFL: weight the new Sunday-flavored templates a bit more often
    if (nfl) {
      const nflWeighted: InviteFlavor[] = [
        ...flavors,
        "primetime",
        "tailgate",
        "redzone",
        "chaos",
        "groupchat",
      ];
      flavor =
        nflWeighted[Math.floor(Math.random() * nflWeighted.length)];
    } else {
      flavor = flavors[Math.floor(Math.random() * flavors.length)];
    }
  }

  // Keep blank lines (""): they make SMS/iMessage readable. Only drop null.
  // Every flavor must name CFB or NFL (not just "football").
  const byCfb: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      sportBanner,
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      `War Room Pick'em · CFB (college football) with YOUR people.`,
      "5 confidence picks · one Best Bet · one prop · standings that don't lie.",
      "Championship for the top. Toilet Bowl for the rest (still a trophy).",
      "",
      "No fantasy draft. No waivers. No app that wants your life.",
      "Just Saturdays and opinions.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap → account if you need one → you're in. Don't ghost Saturday.",
    ],
    groupchat: [
      sportBanner,
      "STOP SCROLLING 🛑",
      "",
      who
        ? `${who} just put you in ${name}.`
        : `You've been voluntold for ${name}.`,
      "",
      "It's our CFB (college football) pick'em league — not NFL — and it'll live in this chat all fall.",
      "Every week: 5 games, confidence 1–5, Best Bet, prop.",
      "Winner gets glory. Last place gets the Toilet Bowl and permanent meme status.",
      "",
      "ONE TAP (code already in the link):",
      linkBlock,
      codeLine,
      "",
      "30 seconds. Zero excuses next Saturday. Do it now before you forget 😤",
    ],
    dad: [
      sportBanner,
      `Subject: CFB league invite — ${name}`,
      "",
      who
        ? `${who} invited you. Don't make this weird.`
        : "You've been invited. Don't make this weird.",
      "",
      "War Room Pick'em = CFB (college football) against the spread with the group.",
      "This is NOT the NFL room — Saturdays, campus, the whole thing.",
      "Pick games. Talk trash. Check the board after kickoff.",
      "There's a Toilet Bowl so the bottom half still has something to play for (and something to roast).",
      "",
      "How to join (easier than setting the DVR):",
      linkBlock,
      codeLine,
      "",
      "Click link → account if needed → done.",
      "See you Saturday. Love you. Don't reply-all if this is email.",
    ],
    boomer: [
      sportBanner,
      `Hello — you're invited to our CFB (college football) league: ${name}.`,
      "",
      "This is college football pick'em with friends — CFB, not the NFL. No gambling required. No complicated fantasy draft.",
      "",
      "What you do each week:",
      "1) Open the link below",
      "2) Pick 5 CFB games (who covers the spread)",
      "3) Lock before kickoff",
      "4) Watch standings update after the games",
      "",
      "Tap this link — it opens with our league code already filled in:",
      linkBlock,
      codeLine,
      "",
      "If you can open a text message, you can do this.",
      "Call me if you get stuck. Looking forward to having you in the group!",
    ],
    genx: [
      sportBanner,
      who
        ? `${who} is not asking. You're in ${name}.`
        : `Plot twist: you're in ${name} now.`,
      "",
      "Remember when Saturday meant actual CFB opinions and nobody was \"building a brand\"?",
      "This is that. On your phone. With a scoreboard that keeps receipts.",
      "",
      "CFB (college football) pick'em — not NFL. Confidence points. Best Bet. Props. Toilet Bowl for the cursed half of the room.",
      "No NFT. No crypto. No \"engage with our content.\" Just the group being wrong together.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up Saturdays. That's the whole product — we kept it simple on purpose.",
    ],
    xennial: [
      sportBanner,
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember hanging at somebody's place, pizza boxes, arguing about the CFB line until kickoff?",
      "We ported that energy to 2026 — without the weird apps that want your kidney data.",
      "",
      "War Room: CFB (college football) pick'em · confidence · Best Bet · props · Gazette headlines · real standings.",
      "Championship banner if you're good. Toilet Bowl if you're content.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Saturday. That's it. That's the product.",
    ],
    millennial: [
      sportBanner,
      "ok so hear me out 🏈",
      "",
      who
        ? `${who} is dragging you into ${name} and honestly? correct decision.`
        : `you've been summoned to ${name}.`,
      "",
      "it's CFB (college football) pick'em with the group — not NFL, not another \"download this app and also our sister apps\" situation.",
      "5 picks a week. confidence points. one Best Bet. one prop. standings that will absolutely live rent-free in the group chat.",
      "top half: championship energy. bottom half: Toilet Bowl (still a trophy, still a personality).",
      "",
      "tap this (code's already in it):",
      linkBlock,
      codeLine,
      "",
      "seriously 30 seconds. then we can all be wrong about Alabama together. do it before the ADHD fairies take this text away ✨",
    ],
    chaos: [
      sportBanner,
      "🚨 GROUP CHAT EMERGENCY 🚨",
      "",
      `${name} needs bodies. (CFB league — college football, not NFL.)`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's CFB. It's legal-ish trash talk.",
      "You will either win a title OR star in the Toilet Bowl.",
      "Both are content. Both go in the Gazette. Both will be brought up at Thanksgiving.",
      "",
      "ONE TAP. NO EXCUSES. NO \"I'll do it later\":",
      linkBlock,
      codeLine,
      "",
      "If you don't join we're putting you on the milk carton in next week's headlines.",
      "THIS IS NOT A DRILL. (ok it is a little bit of a drill. still join.)",
    ],
    primetime: [
      sportBanner,
      "📺 PRIMETIME PICK'EM (still CFB)",
      "",
      who
        ? `${who} wants you in ${name} for college Saturdays.`
        : `${name} is live — college Saturdays only.`,
      "",
      "CFB (college football) — not the NFL. Night games. Big brands. Bigger regrets.",
      "5 confidence picks · Best Bet · prop · Gazette headlines.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap in before kickoff. Campus energy only.",
    ],
    tailgate: [
      sportBanner,
      "🌭 TAILGATE ENERGY — CFB ONLY",
      "",
      who
        ? `${who} is grilling spots in ${name}.`
        : `There's a seat in ${name}. Bring opinions.`,
      "",
      "College football pick'em (CFB, not NFL). Confidence ranks. Toilet Bowl for the cursed half.",
      "No fantasy draft. Just Saturdays and the group chat.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join. Trash talk. Repeat every Saturday.",
    ],
    redzone: [
      sportBanner,
      "🚨 RED ZONE ALERT — CFB ROOM",
      "",
      `${name} is taking college football seriously (well… sort of).`,
      who ? `From: ${who}` : null,
      "",
      "This is CFB pick'em — campus, not the NFL. One card a week. Standings that keep receipts.",
      "",
      linkBlock,
      codeLine,
      "",
      "You're either in or you're in the milk carton. CFB only.",
    ],
  };

  const byNfl: Record<InviteFlavor, (string | null)[]> = {
    warroom: [
      sportBanner,
      who
        ? `${who} just drafted you into ${name}.`
        : `You're being drafted into ${name}.`,
      "",
      "War Room Pick'em · NFL (pro football) with YOUR people.",
      "5 confidence picks · one Best Bet · one prop · standings that don't lie.",
      "Championship for the top. Toilet Bowl for the rest (still a trophy).",
      "",
      "No fantasy draft. No waivers. No app that wants your life.",
      "Just Sundays, late windows, and opinions.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap → account if you need one → you're in. Don't ghost Sunday.",
    ],
    groupchat: [
      sportBanner,
      "STOP SCROLLING 🛑",
      "",
      who
        ? `${who} just put you in ${name}.`
        : `You've been voluntold for ${name}.`,
      "",
      "It's our NFL pick'em league — pro football, not college — and it'll live in this chat all season.",
      "Every week: 5 games, confidence 1–5, Best Bet, prop.",
      "Winner gets glory. Last place gets the Toilet Bowl and permanent meme status.",
      "",
      "ONE TAP (code already in the link):",
      linkBlock,
      codeLine,
      "",
      "30 seconds. Zero excuses next Sunday. Do it now before you forget 😤",
    ],
    dad: [
      sportBanner,
      `Subject: NFL league invite — ${name}`,
      "",
      who
        ? `${who} invited you. Don't make this weird.`
        : "You've been invited. Don't make this weird.",
      "",
      "War Room Pick'em = NFL (pro football) against the spread with the group.",
      "This is NOT the CFB/college room — Sundays, late windows, the whole thing.",
      "Pick games. Talk trash. Check the board after kickoff.",
      "There's a Toilet Bowl so the bottom half still has something to play for (and something to roast).",
      "",
      "How to join (easier than setting the DVR):",
      linkBlock,
      codeLine,
      "",
      "Click link → account if needed → done.",
      "See you Sunday. Love you. Don't reply-all if this is email.",
    ],
    boomer: [
      sportBanner,
      `Hello — you're invited to our NFL (pro football) league: ${name}.`,
      "",
      "This is NFL pick'em with friends — pro football, not college. No gambling required. No complicated fantasy draft.",
      "",
      "What you do each week:",
      "1) Open the link below",
      "2) Pick 5 NFL games (who covers the spread)",
      "3) Lock before kickoff",
      "4) Watch standings update after the games",
      "",
      "Tap this link — it opens with our league code already filled in:",
      linkBlock,
      codeLine,
      "",
      "If you can open a text message, you can do this.",
      "Call me if you get stuck. Looking forward to having you in the group!",
    ],
    genx: [
      sportBanner,
      who
        ? `${who} is not asking. You're in ${name}.`
        : `Plot twist: you're in ${name} now.`,
      "",
      "Remember when Sunday meant actual NFL opinions and nobody was \"building a brand\"?",
      "This is that. On your phone. With a scoreboard that keeps receipts.",
      "",
      "NFL (pro football) pick'em — not CFB. Confidence points. Best Bet. Props. Toilet Bowl for the cursed half of the room.",
      "No NFT. No crypto. No \"engage with our content.\" Just the group being wrong together.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up Sundays. That's the whole product — we kept it simple on purpose.",
    ],
    xennial: [
      sportBanner,
      who
        ? `${who} is forcing a tradition. You're in ${name}.`
        : `New tradition loading: ${name}.`,
      "",
      "Remember hanging at somebody's place, pizza boxes, arguing about the NFL line until kickoff?",
      "We ported that energy to 2026 — without the weird apps that want your kidney data.",
      "",
      "War Room: NFL pick'em · confidence · Best Bet · props · Sunday Gazette · real standings.",
      "Championship banner if you're good. Toilet Bowl if you're content.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Come back every Sunday. That's it. That's the product.",
    ],
    millennial: [
      sportBanner,
      "ok so hear me out 🏈",
      "",
      who
        ? `${who} is dragging you into ${name} and honestly? correct decision.`
        : `you've been summoned to ${name}.`,
      "",
      "it's NFL pick'em with the group — pro football, not CFB, not another \"download this app and also our sister apps\" situation.",
      "5 picks a week. confidence points. one Best Bet. one prop. standings that will absolutely live rent-free in the group chat.",
      "top half: championship energy. bottom half: Toilet Bowl (still a trophy, still a personality).",
      "",
      "tap this (code's already in it):",
      linkBlock,
      codeLine,
      "",
      "seriously 30 seconds. then we can all be wrong about the late window together. do it before the ADHD fairies take this text away ✨",
    ],
    chaos: [
      sportBanner,
      "🚨 GROUP CHAT EMERGENCY 🚨",
      "",
      `${name} needs bodies. (NFL league — pro football, not CFB.)`,
      who ? `Blame: ${who}` : "Blame: whoever sent this",
      "",
      "It's free. It's NFL. It's legal-ish trash talk.",
      "You will either win a title OR star in the Toilet Bowl.",
      "Both are content. Both go in the Gazette. Both will be brought up at Thanksgiving.",
      "",
      "ONE TAP. NO EXCUSES. NO \"I'll do it later\":",
      linkBlock,
      codeLine,
      "",
      "If you don't join we're putting you on the inactive list in next week's headlines.",
      "THIS IS NOT A DRILL. (ok it is a little bit of a drill. still join.)",
    ],
    primetime: [
      sportBanner,
      "📺 SUNDAY / MNF / TNF ENERGY",
      "",
      who
        ? `${who} locked you into ${name} for the NFL season.`
        : `${name} is an NFL pick'em. Pro football only.`,
      "",
      "NFL — not college. Late windows. Flex scheduling. Zero campus.",
      "5 confidence picks · Best Bet · prop · standings that live in the chat all week.",
      "",
      linkBlock,
      codeLine,
      "",
      "Tap in. Don't ghost Thursday Night. Don't ghost Sunday. Don't ghost MNF.",
    ],
    tailgate: [
      sportBanner,
      "🌭 NFL TAILGATE — PRO FOOTBALL ONLY",
      "",
      who
        ? `${who} saved you a spot in ${name}.`
        : `Open seat in ${name}. NFL only.`,
      "",
      "Pro football pick'em (NFL, not CFB). Confidence ranks. Toilet Bowl for the cursed half.",
      "No fantasy draft. Just Sundays, late games, and the group chat.",
      "",
      linkBlock,
      codeLine,
      "",
      "Join once. Show up every Sunday. Roast responsibly.",
    ],
    redzone: [
      sportBanner,
      "🚨 RED ZONE ALERT — NFL ROOM",
      "",
      `${name} needs one more body in the NFL War Room.`,
      who ? `Commissioner / blame: ${who}` : null,
      "",
      "This is NFL pick'em — pro football, NOT college. One card a week. Real standings. Real receipts.",
      "Championship or Toilet Bowl. Both are content.",
      "",
      linkBlock,
      codeLine,
      "",
      "You're either in or you're on the inactive list. NFL only.",
    ],
  };

  const by = nfl ? byNfl : byCfb;
  const lines = by[flavor] || by.warroom;
  let text = lines.filter((line) => line != null).join("\n");

  // Belt-and-suspenders: never ship the wrong sport banner / copy
  if (nfl) {
    if (!/LEAGUE TYPE:\s*NFL/i.test(text)) {
      text = `${sportBanner}\n\n${text}`;
    }
    // If CFB leaked into an NFL message, rebuild with warroom NFL
    if (/\bCFB\b|college football|Saturdays only/i.test(text) && !/not CFB|not college|NOT the CFB|not campus/i.test(text)) {
      text = (byNfl.warroom || lines)
        .filter((line) => line != null)
        .join("\n");
    }
  } else {
    if (!/LEAGUE TYPE:\s*CFB/i.test(text)) {
      text = `${sportBanner}\n\n${text}`;
    }
  }

  // Always append join URL once more if somehow missing (iMessage truncations)
  if (joinUrl && !text.includes(joinUrl)) {
    text = `${text}\n\n${joinUrl}`;
  }

  return text;
}

/** Share-sheet title — always names the sport. */
export function buildInviteShareTitle(opts: {
  leagueName: string;
  sportId?: string | null;
}): string {
  const sportId = resolveInviteSportId(opts.sportId);
  const sport = sportId === "nfl" ? "NFL" : "CFB";
  const name = (opts.leagueName || "War Room").trim();
  return `War Room ${sport}: ${name}`;
}

const PENDING_CODE_KEY = "warroom-pending-join-code";

/** Persist code across login → join (deep link). */
export function stashPendingJoinCode(code: string) {
  if (typeof window === "undefined") return;
  const c = (code || "").trim().toUpperCase();
  if (!c) return;
  try {
    sessionStorage.setItem(PENDING_CODE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function takePendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const c = sessionStorage.getItem(PENDING_CODE_KEY);
    if (c) sessionStorage.removeItem(PENDING_CODE_KEY);
    return c ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function peekPendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PENDING_CODE_KEY)?.toUpperCase() || null;
  } catch {
    return null;
  }
}

/**
 * One-tap invite: native share sheet when available, else copy.
 * Returns what happened for UI toast.
 */
export async function shareLeagueInvite(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
  inviterName?: string;
  flavor?: InviteFlavor | "random";
  sportId?: string | null;
}): Promise<"shared" | "copied" | "failed"> {
  const sportId = resolveInviteSportId(opts.sportId);
  const text = buildInviteShareText({
    ...opts,
    sportId,
    flavor: opts.flavor ?? "random",
  });
  const url = buildInviteJoinUrl(opts);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: buildInviteShareTitle({
          leagueName: opts.leagueName,
          sportId,
        }),
        text,
        url: url || undefined,
      });
      return "shared";
    }
  } catch (e: unknown) {
    // User cancelled share — not a hard fail
    if (e instanceof Error && /Abort|cancel/i.test(e.message)) {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

```
