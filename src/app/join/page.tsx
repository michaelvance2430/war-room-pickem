"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  MAX_LEAGUE_PLAYERS,
  isLeagueFull,
  leagueFullMessage,
} from "@/lib/league-limits";
import Link from "next/link";
import {
  markHostScreenSeen,
  stashPendingJoinCode,
  takePendingJoinCode,
} from "@/lib/commish-onboarding";
import InviteFriends from "@/components/InviteFriends";
import {
  getSportPack,
  isLiveSport,
  listSportPickerOptions,
} from "@/lib/sports/registry";
import { DEFAULT_SPORT_ID, type SportId } from "@/lib/sports/types";
import OwnershipNotice from "@/components/OwnershipNotice";
import WwcTrophyLogo from "@/components/WwcTrophyLogo";
import NflBrandMark from "@/components/NflBrandMark";
import BrandMark from "@/components/BrandMark";
import OpenRoomBotsNudge from "@/components/OpenRoomBotsNudge";
import {
  saveActiveLeagueId,
  writeSessionAndLeague,
} from "@/lib/session-restore";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [leagueName, setLeagueName] = useState("War Room");
  /** Multi-sport: CFB + NFL live; others coming soon */
  const [sportId, setSportId] = useState<SportId>(DEFAULT_SPORT_ID);
  /** List new league in open-room lobby for strangers to fill seats */
  const [listAsOpen, setListAsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hostCopied, setHostCopied] = useState<string | null>(null);
  const [deepLinkCode, setDeepLinkCode] = useState<string | null>(null);
  /** Host created as open room — offer bot pad deep link */
  const [showOpenRoomBotsNudge, setShowOpenRoomBotsNudge] = useState(false);

  useEffect(() => {
    // Deep link: /join?code=ABC123 (or stashed from login)
    const fromUrl = (searchParams.get("code") || "").trim().toUpperCase();
    const pending = takePendingJoinCode();
    const c = fromUrl || pending || "";
    if (c) {
      setCode(c);
      setDeepLinkCode(c);
      setMode("join");
      stashPendingJoinCode(c); // keep if we bounce to login
      return;
    }
    const m = (searchParams.get("mode") || "").toLowerCase();
    if (m === "create") setMode("create");
    if (m === "join") setMode("join");
    if (searchParams.get("open") === "1") {
      setMode("create");
      setListAsOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      if (!hasSupabaseConfig()) {
        setError("Supabase is not configured.");
        setChecking(false);
        return;
      }
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const data = { user: sessionData.session?.user ?? null };
        if (!data.user) {
          // Keep code in URL for after login
          const q = code || searchParams.get("code") || "";
          if (q) stashPendingJoinCode(q);
          const next = q
            ? `/login?next=${encodeURIComponent(`/join?code=${q.trim().toUpperCase()}`)}`
            : "/login";
          router.replace(next);
          return;
        }
        setUserId(data.user.id);
        const metaName = data.user.user_metadata?.display_name as string | undefined;
        setDisplayName(metaName || data.user.email?.split("@")[0] || "Player");
        setChecking(false);
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setChecking(false);
    }
  }, [router, code, searchParams]);

  async function handleCreate() {
    if (!userId) return;
    setError(null);
    if (!isLiveSport(sportId)) {
      setError(
        `${getSportPack(sportId).label} is coming soon. Pick CFB or NFL for now.`
      );
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const newCode = generateCode();
    const pack = getSportPack(sportId);
    // UI selection is source of truth — never let a DB default flip NFL → CFB
    const selectedSportId = sportId;
    try {
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim() || "Commissioner",
      });

      const baseRow: Record<string, unknown> = {
        name: leagueName.trim() || "War Room",
        code: newCode,
        commissioner_id: userId,
      };
      // Crystal Ball is CFB pride pick — default off for NFL
      const withSport: Record<string, unknown> = {
        ...baseRow,
        sport_id: selectedSportId,
        sport_settings: {},
        crystal_ball_enabled: selectedSportId === "cfb",
      };
      if (listAsOpen) {
        withSport.is_open = true;
        withSport.open_listed_at = new Date().toISOString();
      }

      let league: Record<string, unknown> | null = null;
      let leagueError: { message?: string } | null = null;

      {
        const res = await supabase
          .from("leagues")
          .insert(withSport)
          .select()
          .single();
        league = res.data as Record<string, unknown> | null;
        leagueError = res.error;
      }

      // Retry without open-room columns if those fail (keep sport_id)
      if (
        leagueError &&
        /is_open|open_listed|column|schema cache|PGRST/i.test(
          leagueError.message || ""
        )
      ) {
        const noOpen = { ...withSport };
        delete noOpen.is_open;
        delete noOpen.open_listed_at;
        const res = await supabase
          .from("leagues")
          .insert(noOpen)
          .select()
          .single();
        league = res.data as Record<string, unknown> | null;
        leagueError = res.error;
        if (listAsOpen && league?.id && !leagueError) {
          try {
            const { setLeagueOpenListing } = await import("@/lib/open-room");
            await setLeagueOpenListing(league.id as string, true);
          } catch {
            /* SQL not run yet */
          }
        }
      }

      // Last resort: insert bare row, then force sport_id update
      if (
        leagueError &&
        /sport_id|sport_settings|column|schema cache|PGRST/i.test(
          leagueError.message || ""
        )
      ) {
        const res = await supabase
          .from("leagues")
          .insert(baseRow)
          .select()
          .single();
        league = res.data as Record<string, unknown> | null;
        leagueError = res.error;
        if (league?.id && !leagueError) {
          const { error: sportUpErr } = await supabase
            .from("leagues")
            .update({
              sport_id: selectedSportId,
              sport_settings: {},
              crystal_ball_enabled: selectedSportId === "cfb",
            })
            .eq("id", league.id as string);
          if (!sportUpErr) {
            league = {
              ...league,
              sport_id: selectedSportId,
              crystal_ball_enabled: selectedSportId === "cfb",
            };
          }
          if (listAsOpen) {
            try {
              const { setLeagueOpenListing } = await import("@/lib/open-room");
              await setLeagueOpenListing(league.id as string, true);
            } catch {
              /* optional */
            }
          }
        }
      }

      if (leagueError || !league) {
        throw new Error(leagueError?.message || "Could not create league");
      }

      const leagueId = league.id as string;
      const createdSportId = selectedSportId;

      // Always re-assert sport on the row and verify (DB default is cfb —
      // without this, NFL rooms open as CFB after the next cloud sync).
      {
        const { data: sportRow, error: sportErr } = await supabase
          .from("leagues")
          .update({
            sport_id: createdSportId,
            crystal_ball_enabled: createdSportId === "cfb",
          })
          .eq("id", leagueId)
          .select("sport_id")
          .single();
        if (
          sportErr &&
          /sport_id|column|schema cache|PGRST/i.test(sportErr.message || "")
        ) {
          throw new Error(
            "Your database is missing the sport column. Run supabase/sport-id.sql in the Supabase SQL editor, then create the league again."
          );
        }
        const got =
          sportRow && typeof (sportRow as { sport_id?: string }).sport_id === "string"
            ? String((sportRow as { sport_id: string }).sport_id).trim()
            : "";
        if (got && got !== createdSportId) {
          throw new Error(
            `Could not set sport to ${createdSportId} (database has "${got}"). Check leagues.sport_id, then try again.`
          );
        }
        league = {
          ...league,
          sport_id: createdSportId,
          crystal_ball_enabled: createdSportId === "cfb",
        };
      }

      const { error: memError } = await supabase.from("memberships").insert({
        league_id: leagueId,
        user_id: userId,
        role: "commissioner",
        division: "North",
      });
      if (memError) throw memError;
      try {
        const { recordLeagueFirstJoin } = await import("@/lib/cloud");
        await recordLeagueFirstJoin(leagueId);
      } catch {
        /* optional until join-order.sql is run */
      }

      // Single write path: session + league + active league id (so home
      // restore does not bounce back to an older CFB room).
      writeSessionAndLeague(
        {
          leagueId,
          leagueName: (league.name as string) || leagueName.trim() || "War Room",
          code: (league.code as string) || newCode,
          commissionerId: userId,
          createdAt: (league.created_at as string) || new Date().toISOString(),
          cutPercent: (league.cut_percent as number) ?? 50,
          regularSeasonWeeks: pack.defaultSeasonWeeks,
          gamesPerWeek:
            (league.games_per_week as number) ?? pack.defaultGamesPerWeek,
          role: "commissioner",
          displayName: displayName.trim() || "Commissioner",
          crystalBallEnabled: createdSportId === "cfb",
          homeTaglineId: "good-teams",
          homeTaglineCustom: "",
          seasonThemeId: "default",
          sportId: createdSportId,
          isOpen: listAsOpen,
        },
        userId
      );
      saveActiveLeagueId(leagueId);

      // Pin sport BEFORE any cloud rehydrate (mobile race: 1s red then CFB green)
      try {
        const { pinLeagueSport, applySportTheme } = await import(
          "@/lib/sports/sport-theme"
        );
        pinLeagueSport(leagueId, createdSportId);
        applySportTheme(createdSportId);
      } catch {
        /* ignore */
      }
      try {
        const { setSportScope } = await import("@/lib/sport-room-scope");
        setSportScope(createdSportId);
      } catch {
        /* ignore */
      }

      try {
        if (createdSportId === "nfl") {
          // Direct update — avoid saveLeagueToCloud full rehydrate clobber
          await supabase
            .from("leagues")
            .update({
              sport_id: "nfl",
              crystal_ball_enabled: false,
            })
            .eq("id", leagueId);
          const { pinLeagueSport, applySportTheme } = await import(
            "@/lib/sports/sport-theme"
          );
          pinLeagueSport(leagueId, "nfl");
          applySportTheme("nfl");
        }
      } catch {
        /* optional */
      }
      try {
        const { applySportTheme } = await import("@/lib/sports/sport-theme");
        applySportTheme(createdSportId);
      } catch {
        /* ignore */
      }
      setCreatedCode(newCode);
      if (listAsOpen) setShowOpenRoomBotsNudge(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create league");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim() || "Player",
      });
      const { data: league, error: findError } = await supabase
        .from("leagues")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .single();
      if (findError || !league) throw new Error("Invalid league code");

      // Already in league → re-enter only (do NOT overwrite division/role)
      const { data: existingMem } = await supabase
        .from("memberships")
        .select("id, role, division")
        .eq("league_id", league.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMem) {
        // Ensure first-join stamp exists (idempotent)
        try {
          const { recordLeagueFirstJoin } = await import("@/lib/cloud");
          await recordLeagueFirstJoin(league.id);
        } catch {
          /* optional */
        }
      }

      const joinedSportId =
        (league as { sport_id?: string }).sport_id ||
        (league as { sportId?: string }).sportId ||
        "cfb";
      const joinPack = getSportPack(joinedSportId);

      if (!existingMem) {
        const { count, error: countErr } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("league_id", league.id);
        if (countErr) throw countErr;
        if (isLeagueFull(count ?? 0)) {
          throw new Error(leagueFullMessage(count ?? MAX_LEAGUE_PLAYERS));
        }

        // Auto-balance: put new players in the least-populated division
        const { data: divRows } = await supabase
          .from("memberships")
          .select("division")
          .eq("league_id", league.id);
        const counts = { North: 0, South: 0, East: 0, West: 0 } as Record<
          string,
          number
        >;
        for (const r of divRows || []) {
          const d = (r as { division?: string }).division || "North";
          counts[d] = (counts[d] || 0) + 1;
        }
        let division: "North" | "South" | "East" | "West" = "North";
        let best = Infinity;
        for (const d of ["North", "South", "East", "West"] as const) {
          if ((counts[d] || 0) < best) {
            best = counts[d] || 0;
            division = d;
          }
        }

        // Mid-season OK: 0 season pts (no catch-up). Cheevos/trophies still earnable.
        const { error: memError } = await supabase.from("memberships").insert({
          league_id: league.id,
          user_id: userId,
          role: "player",
          division,
          total_points: 0,
          weeks_played: 0,
        });
        if (memError) {
          if (/full|max 32|check_violation/i.test(memError.message || "")) {
            throw new Error(leagueFullMessage());
          }
          throw memError;
        }
        // Permanent first-join stamp — leave/rejoin cannot reset title rank
        try {
          const { recordLeagueFirstJoin } = await import("@/lib/cloud");
          await recordLeagueFirstJoin(league.id);
        } catch {
          /* optional until join-order.sql is run */
        }
      }
      // Full settings from cloud so season theme paints immediately for joiners
      const seasonThemeId =
        typeof league.season_theme_id === "string" && league.season_theme_id
          ? league.season_theme_id
          : "default";
      const crystalOn =
        joinedSportId === "nfl"
          ? false
          : league.crystal_ball_enabled !== false;
      writeSessionAndLeague(
        {
          leagueId: league.id as string,
          leagueName: (league.name as string) || "War Room",
          code: (league.code as string) || "",
          commissionerId: league.commissioner_id as string,
          createdAt: (league.created_at as string) || "",
          cutPercent: (league.cut_percent as number) ?? 50,
          regularSeasonWeeks:
            (league.regular_season_weeks as number) ??
            joinPack.defaultSeasonWeeks,
          gamesPerWeek:
            (league.games_per_week as number) ?? joinPack.defaultGamesPerWeek,
          role:
            league.commissioner_id === userId ? "commissioner" : "player",
          displayName: displayName.trim() || "Player",
          crystalBallEnabled: crystalOn,
          homeTaglineId: (league.home_tagline_id as string) || "good-teams",
          homeTaglineCustom: (league.home_tagline_custom as string) || "",
          seasonThemeId,
          sportId: joinedSportId,
          isOpen: (league as { is_open?: boolean }).is_open === true,
        },
        userId
      );
      saveActiveLeagueId(league.id as string);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
    );
  }

  if (createdCode) {
    const leagueLabel = leagueName.trim() || "War Room";
    let leagueId = "";
    try {
      const raw = localStorage.getItem("warroom-league");
      leagueId = raw ? (JSON.parse(raw) as { id?: string }).id || "" : "";
    } catch {
      /* ignore */
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        {listAsOpen && (
          <OpenRoomBotsNudge
            open={showOpenRoomBotsNudge}
            onClose={() => setShowOpenRoomBotsNudge(false)}
          />
        )}
        <div className="max-w-md w-full rounded-xl border-2 border-primary/40 bg-card p-6">
          <div className="flex justify-center mb-3">
            <BrandMark size={72} variant="force" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2 text-center">
            You&apos;re the host
          </p>
          <h1 className="text-2xl font-bold mb-1 text-center">League created</h1>
          <p className="text-sm text-muted mb-4 text-center">
            {leagueLabel} — share the invite link, then build the first card.
            {listAsOpen ? " Listed in the open room lobby." : ""}
          </p>
          <div className="text-3xl font-bold tracking-[0.3em] text-primary text-center mb-4 font-mono">
            {createdCode}
          </div>

          <InviteFriends
            leagueName={leagueLabel}
            code={createdCode}
            leagueId={leagueId}
            sportId={
              // Prefer what we just wrote to session storage
              (() => {
                try {
                  const raw = localStorage.getItem("warroom-league");
                  if (raw) {
                    const j = JSON.parse(raw) as { sportId?: string };
                    if (j.sportId) return j.sportId;
                  }
                } catch {
                  /* ignore */
                }
                return undefined;
              })()
            }
            className="mb-4 !border-primary/30"
          />

          {hostCopied && (
            <p className="text-xs text-primary text-center mb-3">{hostCopied}</p>
          )}

          {listAsOpen && (
            <button
              type="button"
              onClick={() => setShowOpenRoomBotsNudge(true)}
              className="w-full py-3 min-h-[48px] rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm font-bold mb-3 touch-manipulation"
            >
              Round out with bots? →
            </button>
          )}

          <ol className="text-left text-sm space-y-2 mb-6 rounded-lg border border-border bg-background/50 px-4 py-3">
            <li>
              <span className="font-semibold text-primary">1.</span> Share invite
              (one tap above)
            </li>
            <li>
              <span className="font-semibold text-primary">2.</span> Build &amp;
              publish a card (demo slate is fine first time)
            </li>
            <li>
              <span className="font-semibold text-primary">3.</span> After games,
              score the week
            </li>
          </ol>

          <button
            type="button"
            onClick={() => {
              if (leagueId) markHostScreenSeen(leagueId);
              router.push("/commissioner?tab=card&first=1");
              router.refresh();
            }}
            className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold mb-2 touch-manipulation"
          >
            Publish first card (one tap) →
          </button>
          <button
            type="button"
            onClick={() => {
              if (leagueId) markHostScreenSeen(leagueId);
              router.push("/");
              router.refresh();
            }}
            className="w-full py-3 min-h-[48px] rounded-xl border border-border text-sm text-muted hover:text-foreground touch-manipulation"
          >
            Home first
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandMark size={80} variant="force" className="rounded-xl" />
          </div>
          <h1 className="text-2xl font-bold">War Room Pick&apos;Em</h1>
          <p className="text-sm text-muted mt-1">Signed in as {displayName}</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("create")}
              className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
            >
              Commissioner — create league
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className="w-full py-4 min-h-[56px] rounded-xl border border-border bg-card text-base font-bold touch-manipulation"
            >
              Join with code
            </button>
            <Link
              href="/open-room"
              className="w-full py-4 min-h-[56px] rounded-xl border-2 border-primary/40 bg-primary/10 text-base font-bold touch-manipulation flex items-center justify-center text-foreground"
            >
              Join open room
            </Link>
            <p className="text-center text-[11px] text-muted pt-1 leading-relaxed">
              Open lobby fills one room at a time (max {MAX_LEAGUE_PLAYERS}).
              Full rooms get a friendly “no seats” message — not a scolding.
            </p>
            <Link href="/login" className="block text-center text-xs text-muted mt-4">Switch account</Link>
            <OwnershipNotice className="mt-6" />
          </div>
        )}

        {mode === "create" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Create league</h2>
            <p className="text-xs text-muted">
              Pick a sport, then name the room. Up to {MAX_LEAGUE_PLAYERS}{" "}
              players. Same War Room soul — different field.
            </p>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
                Sport
              </p>
              <div className="space-y-2 max-h-[min(50vh,22rem)] overflow-y-auto pr-0.5">
                {listSportPickerOptions().map((s) => {
                  const live = s.status === "live";
                  const selected = sportId === s.id;
                  const isWwc = s.id === "soccer_wwc";
                  const isNfl = s.id === "nfl";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!live}
                      onClick={() => {
                        if (!live) return;
                        const next = s.id as SportId;
                        setSportId(next);
                        // Paint NFL/CFB skin immediately so create flow feels right
                        void import("@/lib/sports/sport-theme").then(
                          ({ applySportTheme }) => applySportTheme(next)
                        );
                        void import("@/lib/sport-room-scope").then(
                          ({ setSportScope }) => setSportScope(next)
                        );
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition touch-manipulation ${
                        selected && isWwc
                          ? "border-[#FFDF00]/60 bg-[#009C3B]/15 shadow-[0_0_22px_rgba(0,156,59,0.2)]"
                          : selected && isNfl
                            ? "border-[#C1121F]/70 bg-[#0B1426] shadow-[0_0_22px_rgba(193,18,31,0.25)]"
                            : selected
                              ? "border-primary bg-primary/15 shadow-[0_0_20px_rgba(34,197,94,0.12)]"
                              : live
                                ? "border-border bg-background hover:border-primary/40"
                                : "border-border/50 bg-background/40 opacity-55 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {isWwc ? (
                          <WwcTrophyLogo size={36} className="shrink-0 mt-0.5" />
                        ) : isNfl ? (
                          <NflBrandMark size={36} className="shrink-0 mt-0.5" />
                        ) : (
                          <span className="text-xl shrink-0" aria-hidden>
                            {s.emoji}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {s.label}
                            </span>
                            {live ? (
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide ${
                                  isWwc
                                    ? "text-[#FFDF00]"
                                    : isNfl
                                      ? "text-[#C5CCD3]"
                                      : "text-primary"
                                }`}
                              >
                                Live
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                Coming soon
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted mt-0.5 leading-snug">
                            {s.blurb}
                          </p>
                        </div>
                        {selected && live && (
                          <span
                            className={`text-sm font-black shrink-0 ${
                              isWwc
                                ? "text-[#FFDF00]"
                                : isNfl
                                  ? "text-[#C1121F]"
                                  : "text-primary"
                            }`}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                <span className="text-foreground font-medium">CFB</span> and{" "}
                <span className="text-foreground font-medium">NFL</span> are
                live. World Cup and others ship next — same clubhouse, different
                desk.
              </p>
            </div>

            <input
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="League name"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
            />
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background/50 px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={listAsOpen}
                onChange={(e) => setListAsOpen(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-border shrink-0"
              />
              <span>
                <span className="text-sm font-semibold text-foreground block">
                  List as open room
                </span>
                <span className="text-xs text-muted leading-relaxed">
                  Strangers can find you in the open lobby. We fill this room
                  first before seating people elsewhere. Turn off anytime in
                  Settings.
                </span>
              </span>
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={() => void handleCreate()}
              disabled={loading || !isLiveSport(sportId)}
              className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
            >
              {loading
                ? "Creating…"
                : sportId === "soccer_wwc"
                  ? "Create FIFA WWC Brazil 2027™ league"
                  : sportId === "nfl"
                    ? "Create NFL league"
                    : `Create ${getSportPack(sportId).shortLabel} league`}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-muted"
            >
              Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Join league</h2>
            {deepLinkCode ? (
              <p className="text-xs text-primary font-medium leading-relaxed">
                Invite link detected — code filled in. Confirm your name and
                hit Join.
              </p>
            ) : (
              <p className="text-xs text-muted">
                If the league already has {MAX_LEAGUE_PLAYERS} players, you&apos;ll
                need another code or a free seat.
              </p>
            )}
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-muted leading-relaxed">
              <p className="font-semibold text-foreground text-xs mb-0.5">
                Season already rolling?
              </p>
              You can still join. You start at{" "}
              <strong className="text-foreground">0 season points</strong> — no
              catch-up for weeks you missed. From here on you still pick, chase{" "}
              <strong className="text-foreground">cheevos</strong>, and can win{" "}
              <strong className="text-foreground">trophies</strong> like anyone
              else. Empty seats only.
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-widest uppercase font-mono"
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50 min-h-[48px]"
            >
              {loading ? "Joining…" : deepLinkCode ? "Join this league" : "Join"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-muted">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <JoinPageInner />
    </Suspense>
  );
}
