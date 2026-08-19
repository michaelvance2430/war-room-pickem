"use client";

/**
 * Home League Hub — the front door to War Room.
 *
 * Answers in under five seconds:
 * 1. Which sport am I viewing?
 * 2. Which leagues am I in?
 * 3. What do I need to do next?
 * 4. Can I join more leagues?
 *
 * Not Account. Not administration. Navigation — Discord/Slack energy.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  fetchMyMemberships,
  switchToLeague,
  type LeagueMembership,
} from "@/lib/session-restore";
import { getLeague, getSession } from "@/lib/league";
import { getSportPack, normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  setSportScope,
  EVENT_SPORT_ROOM_SCOPE,
  resolveSportScope,
} from "@/lib/sport-room-scope";
import {
  attentionAriaLabel,
  combinedLeagueAttention,
  loadLeagueHubPulses,
  leagueHubToneClasses,
  otherLeaguesCombinedAttentionTotal,
  type LeagueHubPulse,
  type LeagueHubTone,
} from "@/lib/league-hub-actions";
import { EVENT_CARD_PUBLISHED } from "@/lib/first-session";
import {
  countUnreadAnnouncementsByLeague,
  EVENT_ANNOUNCEMENTS_SEEN,
} from "@/lib/room-unseen";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";

/** Match Nav mobile More sheet stacking. */
const HUB_BACKDROP_Z = 55;
const HUB_PANEL_Z = 60;

/** Pulse + announcement attention poll only while hub is open. */
const OPEN_ATTENTION_REFRESH_MS = 60_000;

/**
 * Amber attention pill — number + aria-label (color is not the only cue).
 * Stage 3: combined weekly task (0|1) + unread commissioner announcements.
 * Visible badge caps at 99+; aria keeps the exact count.
 */
function HubAttentionBadge({
  count,
  ariaLabel,
  size = "md",
}: {
  count: number;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  const sizeCls =
    size === "sm"
      ? "min-w-[1.125rem] h-[1.125rem] px-1 text-[9px]"
      : "min-w-[1.25rem] h-5 px-1.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full tabular-nums font-extrabold shrink-0 border border-amber-200/90 bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.35)] ${sizeCls}`}
      aria-label={ariaLabel}
    >
      {display}
    </span>
  );
}

/** Primary sports always on the hub. */
const HUB_SPORTS: SportId[] = ["nfl", "cfb"];

function SportIcon({ sportId, size = 18 }: { sportId: string; size?: number }) {
  if (sportId === "nfl") {
    return <NflBrandMark size={size} className="rounded" />;
  }
  if (sportId === "cfb") {
    return <BrandMark size={size} variant="force" className="rounded" />;
  }
  return (
    <span style={{ fontSize: size * 0.9 }} aria-hidden>
      {getSportPack(sportId).emoji}
    </span>
  );
}

function sportEmoji(sportId: string): string {
  if (sportId === "nfl") return "🏈";
  if (sportId === "cfb") return "🎓";
  return getSportPack(sportId).emoji || "🏟️";
}

type Props = {
  className?: string;
  onSwitched?: () => void;
};

export default function HomeSportSwitcher({ className = "" }: Props) {
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [pulse, setPulse] = useState<Record<string, LeagueHubPulse>>({});
  /**
   * Badges only after first pulse resolve finishes (success or fail-closed).
   * Prevents false “1” while loading; refresh keeps prior pulse (no flicker).
   */
  const [pulseReady, setPulseReady] = useState(false);
  /**
   * Stage 3: durable unread commissioner announcements by leagueId.
   * Last successful map is kept on refresh failure (task badges independent).
   */
  const [annUnread, setAnnUnread] = useState<Record<string, number>>({});
  const [annReady, setAnnReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scope, setScope] = useState<SportId>(() =>
    normalizeSportId(getLeague()?.sportId || "cfb")
  );
  const [loaded, setLoaded] = useState(false);
  /** Portal target ready (client only). */
  const [portalReady, setPortalReady] = useState(false);
  /**
   * Fixed positions (viewport coords) for portaled chrome while open.
   * Trigger stays sharp above the backdrop; panel anchors under it.
   */
  const [hubGeom, setHubGeom] = useState<{
    triggerTop: number;
    triggerLeft: number;
    panelTop: number;
    panelLeft: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Single-flight pulse refresh — no parallel storms. */
  const pulseInflightRef = useRef<Promise<void> | null>(null);
  /** Single-flight announcement attention refresh. */
  const annInflightRef = useRef<Promise<void> | null>(null);
  const membershipsRef = useRef(memberships);
  membershipsRef.current = memberships;

  const activeId = getSession()?.leagueId || getLeague()?.id || "";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const loadPulsesOnly = useCallback(async (ms: LeagueMembership[]) => {
    if (pulseInflightRef.current) return pulseInflightRef.current;
    const run = (async () => {
      try {
        const uid = getSession()?.playerId;
        if (!uid || ms.length === 0) {
          setPulse({});
          return;
        }
        const p = await loadLeagueHubPulses(ms, uid);
        setPulse(p);
      } catch {
        // Fail closed: clear only if we never had a good pulse; else keep prior.
        setPulse((prev) => (Object.keys(prev).length ? prev : {}));
      } finally {
        setPulseReady(true);
      }
    })().finally(() => {
      pulseInflightRef.current = null;
    });
    pulseInflightRef.current = run;
    return run;
  }, []);

  /**
   * Stage 3: batched unread announcements across membership league IDs.
   * Failure keeps prior map (or zeros on first fail) — never erases pulse tasks.
   * Opening the switcher never writes announcement_reads.
   */
  const loadAnnOnly = useCallback(async (ms: LeagueMembership[]) => {
    if (annInflightRef.current) return annInflightRef.current;
    const run = (async () => {
      try {
        const uid = getSession()?.playerId;
        if (!uid || ms.length === 0) {
          setAnnUnread({});
          return;
        }
        const leagueIds = ms.map((m) => m.leagueId).filter(Boolean);
        const byLeague = await countUnreadAnnouncementsByLeague(
          leagueIds,
          uid
        );
        setAnnUnread(byLeague);
      } catch {
        setAnnUnread((prev) =>
          Object.keys(prev).length ? prev : {}
        );
      } finally {
        setAnnReady(true);
      }
    })().finally(() => {
      annInflightRef.current = null;
    });
    annInflightRef.current = run;
    return run;
  }, []);

  const load = useCallback(async () => {
    try {
      const ms = await fetchMyMemberships();
      setMemberships(ms);
      const activeSport = getLeague()?.sportId;
      const next = resolveSportScope({
        membershipSportIds: ms.map((m) => m.sportId || "cfb"),
        activeSportId: activeSport,
      });
      // Prefer a hub sport if scope is something else
      const hubScope = HUB_SPORTS.includes(next)
        ? next
        : HUB_SPORTS.includes(normalizeSportId(activeSport || "cfb"))
          ? normalizeSportId(activeSport || "cfb")
          : "cfb";
      setScope(hubScope);

      await Promise.all([loadPulsesOnly(ms), loadAnnOnly(ms)]);
    } catch {
      /* optional — switcher stays usable without pulse badges */
      setPulseReady(true);
      setAnnReady(true);
    } finally {
      setLoaded(true);
    }
  }, [loadPulsesOnly, loadAnnOnly]);

  /** Coordinated attention refresh (parallel, each single-flight). */
  const refreshAttention = useCallback(
    (ms?: LeagueMembership[]) => {
      const list = ms ?? membershipsRef.current;
      if (!list.length) {
        void load();
        return;
      }
      void loadPulsesOnly(list);
      void loadAnnOnly(list);
    },
    [load, loadPulsesOnly, loadAnnOnly]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Open → re-resolve attention (memberships warm when possible).
  useEffect(() => {
    if (!open) return;
    const ms = membershipsRef.current;
    if (ms.length > 0) refreshAttention(ms);
    else void load();
  }, [open, load, refreshAttention]);

  // 60s attention refresh only while open (no closed polling).
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      const ms = membershipsRef.current;
      if (ms.length > 0) refreshAttention(ms);
    }, OPEN_ATTENTION_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [open, refreshAttention]);

  // Focus / visibility + task/announcement invalidation events.
  useEffect(() => {
    function onRefresh() {
      const ms = membershipsRef.current;
      if (ms.length > 0) refreshAttention(ms);
      else void load();
    }
    function onVis() {
      if (document.visibilityState === "visible") onRefresh();
    }
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_CARD_PUBLISHED, onRefresh);
    // Existing News page fires this after durable announcement_reads upsert.
    window.addEventListener(EVENT_ANNOUNCEMENTS_SEEN, onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_CARD_PUBLISHED, onRefresh);
      window.removeEventListener(EVENT_ANNOUNCEMENTS_SEEN, onRefresh);
    };
  }, [load, refreshAttention]);

  useEffect(() => {
    function onScope(e: Event) {
      const id = normalizeSportId((e as CustomEvent<string>).detail);
      if (HUB_SPORTS.includes(id)) setScope(id);
    }
    window.addEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
    return () => window.removeEventListener(EVENT_SPORT_ROOM_SCOPE, onScope);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Backdrop owns outside-click dismiss (Nav More sheet pattern).
    // Escape remains desktop keyboard close.
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Portal backdrop + panel to document.body so they stack above Home's
   * `main.relative.z-10` and cover sticky header + bottom nav (same band as
   * Nav More: backdrop z-55, chrome z-60). In-tree fixed would trap under main.
   */
  useLayoutEffect(() => {
    if (!open) {
      setHubGeom(null);
      return;
    }

    function placeHub() {
      const trigger = rootRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const gutter = 10;
      const maxW = Math.min(22.5 * 16, window.innerWidth - gutter * 2);
      let panelLeft = r.left;
      if (panelLeft + maxW > window.innerWidth - gutter) {
        panelLeft = Math.max(gutter, window.innerWidth - maxW - gutter);
      }
      if (panelLeft < gutter) panelLeft = gutter;
      setHubGeom({
        triggerTop: r.top,
        triggerLeft: r.left,
        panelTop: r.bottom + 6,
        panelLeft,
      });
    }

    placeHub();
    window.addEventListener("resize", placeHub);
    // Capture scroll from any ancestor (Home main, etc.)
    window.addEventListener("scroll", placeHub, true);
    return () => {
      window.removeEventListener("resize", placeHub);
      window.removeEventListener("scroll", placeHub, true);
    };
  }, [open, scope, memberships.length]);

  const roomsBySport = useMemo(() => {
    const map = new Map<SportId, LeagueMembership[]>();
    for (const sid of HUB_SPORTS) map.set(sid, []);
    for (const m of memberships) {
      const sid = normalizeSportId(m.sportId || "cfb");
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(m);
    }
    for (const [sid, rooms] of map) {
      rooms.sort((a, b) => {
        // Active league first, then alpha
        if (a.leagueId === activeId) return -1;
        if (b.leagueId === activeId) return 1;
        return (a.leagueName || "").localeCompare(b.leagueName || "");
      });
      map.set(sid, rooms);
    }
    return map;
  }, [memberships, activeId]);

  function selectSport(sportId: SportId) {
    setSportScope(sportId);
    setScope(sportId);
    setOpen(true);
  }

  function toggleHub() {
    setOpen((o) => !o);
  }

  /**
   * Switch league if needed, then hard-navigate to the task path.
   * Hard assign clears stale room data from the previous league.
   */
  async function runAction(leagueId: string, href: string) {
    if (busyId) return;
    setBusyId(leagueId);
    try {
      const target = memberships.find((m) => m.leagueId === leagueId);
      if (target?.sportId) {
        setSportScope(target.sportId);
        setScope(normalizeSportId(target.sportId));
      }

      if (leagueId !== activeId) {
        const ok = await switchToLeague(leagueId);
        if (!ok) {
          setBusyId(null);
          return;
        }
      }

      setOpen(false);
      window.location.assign(href || "/");
    } catch {
      setBusyId(null);
    }
  }

  const openRooms = roomsBySport.get(scope) || [];
  const pack = getSportPack(scope);
  const isNfl = scope === "nfl";
  const roomCount = openRooms.length;

  /**
   * Collapsed badge: OTHER leagues × all sports.
   * Stage 3: (task 0|1) + unread announcements per league, then sum.
   * Task contribution waits on pulseReady; announcement uses last success map.
   */
  const otherLeaguesAttention = useMemo(() => {
    if (!pulseReady && !annReady) return 0;
    // When pulse not ready yet, still allow ann-only collapsed total from warm map
    if (!pulseReady) {
      let n = 0;
      for (const m of memberships) {
        if (!m.leagueId || m.leagueId === activeId) continue;
        n += Math.max(0, Math.floor(annUnread[m.leagueId] || 0));
      }
      return n;
    }
    return otherLeaguesCombinedAttentionTotal(
      pulse,
      memberships,
      activeId,
      annUnread
    );
  }, [pulseReady, annReady, pulse, memberships, activeId, annUnread]);

  function closeHub() {
    setOpen(false);
  }

  const hubPanel = open && hubGeom ? (
    <div
      role="listbox"
      aria-label={`${pack.shortLabel} leagues`}
      style={{
        position: "fixed",
        top: hubGeom.panelTop,
        left: hubGeom.panelLeft,
        zIndex: HUB_PANEL_Z,
      }}
      className="w-[min(22.5rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Sport switch inside the hub — one destination selector */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 border-b border-border/40">
        {HUB_SPORTS.map((sid) => {
          const p = getSportPack(sid);
          const selected = sid === scope;
          const n = (roomsBySport.get(sid) || []).length;
          const nfl = sid === "nfl";
          return (
            <button
              key={sid}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectSport(sid)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg text-xs font-extrabold touch-manipulation transition ${
                selected
                  ? nfl
                    ? "bg-red-500/20 text-red-100 border border-red-500/40"
                    : "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted hover:text-foreground border border-transparent"
              }`}
            >
              <SportIcon sportId={sid} size={16} />
              <span>{p.shortLabel}</span>
              {loaded ? (
                <span className="opacity-60 text-[10px] tabular-nums">{n}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mx-2 mt-2 rounded-lg border border-amber-300/35 bg-amber-300/[0.06] px-3 py-2.5" aria-label="The Fieldhouse under construction">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Under Construction</p>
            <p className="mt-0.5 text-sm font-black text-white">The Fieldhouse</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted">College Basketball · Saturdays build the résumé. March destroys it.</p>
          </div>
          <span className="shrink-0 rounded-full border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-200">Locked</span>
        </div>
      </div>

      {openRooms.length === 0 ? (
        <div className="px-4 py-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted mb-2">
            No {pack.shortLabel} leagues yet
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed mb-4">
            Join friends, start your own, or browse open communities.
          </p>
          <GrowthActions onNavigate={closeHub} stacked />
        </div>
      ) : (
        <>
          <div
            className={`px-2 py-2 space-y-1 ${
              openRooms.length > 6
                ? "max-h-[min(52vh,24rem)] overflow-y-auto overscroll-contain"
                : ""
            }`}
          >
            {openRooms.map((m) => {
              const isActive = m.leagueId === activeId;
              const p = pulse[m.leagueId];
              const busy = busyId === m.leagueId;
              const action = p?.action || {
                code: "ENTER" as const,
                label: "Open",
                href: "/",
              };
              const weekLine = p?.weekLine || "Checking status";
              const tone: LeagueHubTone = p?.signal?.tone || "waiting";
              const signalLabel = p?.signal?.label || "Verifying room";
              const signalEmoji = p?.signal?.emoji || "⚪";
              const tones = leagueHubToneClasses(tone);
              const leagueName = m.leagueName || "War Room";
              // Stage 3: task (0|1 once pulseReady) + durable unread announcements.
              const rowAttention = combinedLeagueAttention(
                pulseReady ? p : undefined,
                annUnread[m.leagueId] || 0
              );

              return (
                <div
                  key={m.leagueId}
                  role="option"
                  aria-selected={isActive}
                  className={`flex items-stretch gap-2 rounded-lg px-2.5 py-2.5 min-h-[56px] ${
                    isActive
                      ? "bg-primary/12 border border-primary/35"
                      : "bg-background/25 border border-transparent hover:bg-background/40"
                  }`}
                >
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate leading-tight min-w-0 flex-1">
                        <span className="mr-1" aria-hidden>
                          {sportEmoji(scope)}
                        </span>
                        {leagueName}
                        {isActive ? (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wide text-primary font-extrabold align-middle">
                            here
                          </span>
                        ) : null}
                      </p>
                      {rowAttention > 0 ? (
                        <HubAttentionBadge
                          count={rowAttention}
                          ariaLabel={attentionAriaLabel(rowAttention, {
                            leagueName,
                          })}
                          size="md"
                        />
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 truncate">
                      {weekLine}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 font-semibold truncate ${tones.text}`}
                    >
                      <span aria-hidden className="mr-1">
                        {signalEmoji}
                      </span>
                      {signalLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => void runAction(m.leagueId, action.href)}
                    className={`self-center shrink-0 min-h-[40px] px-2.5 rounded-lg text-[11px] font-extrabold tracking-wide touch-manipulation disabled:opacity-50 whitespace-nowrap ${tones.button}`}
                  >
                    {busy ? "…" : action.label}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/50 px-3 py-2.5">
            <GrowthActions onNavigate={closeHub} />
          </div>
        </>
      )}
    </div>
  ) : null;

  const hubOverlay =
    open && portalReady
      ? createPortal(
          <>
            {/*
              Full-viewport dim + restrained blur — same recipe as Nav More
              (bg-black/65 + backdrop-blur-[2px], z-55). Portal escapes Home
              main stacking so nav is covered and clicks cannot leak through.
            */}
            <div
              className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
              style={{ zIndex: HUB_BACKDROP_Z }}
              aria-hidden
              onClick={closeHub}
            />
            {hubPanel}
          </>,
          document.body
        )
      : null;

  const triggerClass = `inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-xs font-extrabold touch-manipulation transition border ${
    isNfl
      ? "border-red-500/50 bg-red-500/15 text-red-100 hover:bg-red-500/20"
      : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20"
  }`;

  const otherLeaguesAria = attentionAriaLabel(otherLeaguesAttention, {
    otherLeagues: true,
  });
  const collapsedAria =
    otherLeaguesAttention > 0
      ? `${pack.shortLabel} League Hub, ${otherLeaguesAria}`
      : `${pack.shortLabel} League Hub`;

  const triggerInner = (
    <>
      <SportIcon sportId={scope} size={18} />
      <span>{pack.shortLabel}</span>
      {loaded && roomCount > 0 ? (
        <span className="opacity-70 text-[10px] font-semibold tabular-nums">
          {roomCount}
        </span>
      ) : null}
      {otherLeaguesAttention > 0 ? (
        <HubAttentionBadge
          count={otherLeaguesAttention}
          ariaLabel={otherLeaguesAria}
          size="sm"
        />
      ) : null}
      <span className="opacity-70 text-[10px]" aria-hidden>
        {open ? "▴" : "▾"}
      </span>
    </>
  );

  return (
    <>
      <div ref={rootRef} className={`relative inline-block ${className}`}>
        {/* In-flow trigger (layout anchor). When open, a portaled twin sits above the backdrop. */}
        <button
          type="button"
          onClick={toggleHub}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={collapsedAria}
          className={`${triggerClass} ${open ? "invisible" : ""}`}
          tabIndex={open ? -1 : 0}
        >
          {triggerInner}
        </button>
      </div>
      {hubOverlay}
      {open && portalReady && hubGeom
        ? createPortal(
            <button
              type="button"
              onClick={toggleHub}
              aria-expanded
              aria-haspopup="listbox"
              aria-label={collapsedAria}
              style={{
                position: "fixed",
                top: hubGeom.triggerTop,
                left: hubGeom.triggerLeft,
                zIndex: HUB_PANEL_Z + 1,
              }}
              className={triggerClass}
            >
              {triggerInner}
            </button>,
            document.body
          )
        : null}
    </>
  );
}

function GrowthActions({
  onNavigate,
  stacked = false,
}: {
  onNavigate: () => void;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/join?mode=join"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-primary text-black text-xs font-extrabold touch-manipulation"
        >
          JOIN WITH CODE
        </Link>
        <Link
          href="/join?mode=create"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg border border-border text-xs font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          START NEW LEAGUE
        </Link>
        <Link
          href="/open-room"
          onClick={onNavigate}
          className="min-h-[44px] flex items-center justify-center rounded-lg border border-border text-xs font-bold text-foreground hover:bg-card-hover touch-manipulation"
        >
          ENTER LOBBY
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link
        href="/join?mode=join"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Join with Code
      </Link>
      <Link
        href="/join?mode=create"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Start New League
      </Link>
      <Link
        href="/open-room"
        onClick={onNavigate}
        className="block text-[11px] font-bold uppercase tracking-wide text-primary hover:underline py-1.5 min-h-[36px] flex items-center"
      >
        Enter Lobby
      </Link>
    </div>
  );
}
