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
  markInviteCopied,
  stashPendingJoinCode,
  takePendingJoinCode,
} from "@/lib/commish-onboarding";
import { markLeagueBuildNeeded } from "@/lib/league-build";
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
  /**
   * Per-league nickname (create/join). Starts empty on purpose —
   * invite a new identity; do not clone the last room’s handle.
   * Career / trophies stay on auth userId, not this string.
   */
  const [displayName, setDisplayName] = useState("");
  /** Account label for chrome only (email / meta) — never pre-fills nickname fields */
  const [accountHint, setAccountHint] = useState("");
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  /** Create wizard: sport first, then name / open listing */
  const [createStep, setCreateStep] = useState<"sport" | "details">("sport");
  /** Empty on purpose — room name is intentional, not a copy of last league */
  const [leagueName, setLeagueName] = useState("");
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
    if (m === "create") {
      setMode("create");
      setCreateStep("sport");
      setLeagueName("");
      setDisplayName("");
    }
    if (m === "join") {
      setMode("join");
      setDisplayName("");
    }
    if (searchParams.get("open") === "1") {
      setMode("create");
      setCreateStep("sport");
      setListAsOpen(true);
      setLeagueName("");
      setDisplayName("");
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
        const emailLocal = data.user.email?.split("@")[0] || "";
        // Account chrome only — never pre-fill league nickname (per-room identity)
        setAccountHint(metaName || emailLocal || "your account");
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
    const room = leagueName.trim();
    const nick = displayName.trim(); // optional league alias — never writes profiles
    if (!room) {
      setError("Name your room — every league starts a new story.");
      return;
    }
    if (nick) {
      const { validateDisplayNameInput } = await import("@/lib/display-name");
      const v = validateDisplayNameInput(nick);
      if (!v.ok) {
        setError(v.error);
        return;
      }
    }
    setLoading(true);
    const supabase = createClient();
    const newCode = generateCode();
    const pack = getSportPack(sportId);
    // UI selection is source of truth — never let a DB default flip NFL → CFB
    const selectedSportId = sportId;
    try {
      // Ensure profile exists; NEVER overwrite global account name with league alias
      const { ensureProfileRowExists } = await import(
        "@/lib/league-display-name"
      );
      await ensureProfileRowExists(userId, accountHint || undefined);
      const { data: profRow } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      const accountName =
        (profRow?.display_name as string)?.trim() ||
        accountHint ||
        "Player";

      const { resolveNewLeagueOpeningWeek } = await import(
        "@/lib/active-week-storage"
      );
      const openingWeek = resolveNewLeagueOpeningWeek(selectedSportId);
      const baseRow: Record<string, unknown> = {
        name: room,
        code: newCode,
        commissioner_id: userId,
        current_week: openingWeek,
      };
      // Crystal Ball / Super Bowl pride pick — default ON; League Build wizard confirms
      const withSport: Record<string, unknown> = {
        ...baseRow,
        sport_id: selectedSportId,
        sport_settings: {},
        crystal_ball_enabled: true,
        current_week: openingWeek,
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
              crystal_ball_enabled: true,
              current_week: openingWeek,
            })
            .eq("id", league.id as string);
          if (!sportUpErr) {
            league = {
              ...league,
              sport_id: selectedSportId,
              crystal_ball_enabled: true,
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
            crystal_ball_enabled: true,
            current_week: openingWeek,
          })
          .eq("id", leagueId)
          .select("sport_id, current_week")
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
          crystal_ball_enabled: true,
        };
      }

      const { error: memError } = await supabase.from("memberships").insert({
        league_id: leagueId,
        user_id: userId,
        role: "commissioner",
        division: "North",
      });
      if (memError) throw memError;

      // Optional league alias only (never profiles.display_name)
      let resolvedName = accountName;
      let override: string | null = null;
      if (nick) {
        try {
          const { setMyLeagueDisplayName } = await import(
            "@/lib/league-display-name"
          );
          const aliasRes = await setMyLeagueDisplayName(leagueId, nick);
          if (aliasRes.ok) {
            resolvedName = aliasRes.resolved;
            override = aliasRes.override;
          } else {
            // Keep typed alias for retry; do not mutate global profile
            setError(
              aliasRes.error ||
                "Room created, but league name could not be saved. Set it in Account."
            );
          }
        } catch {
          /* optional until migration applied */
        }
      } else {
        const { resolveLeagueDisplayName } = await import("@/lib/display-name");
        resolvedName = resolveLeagueDisplayName({
          membershipOverride: null,
          profileDisplayName: accountName,
        });
      }

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
          leagueName: (league.name as string) || room,
          code: (league.code as string) || newCode,
          commissionerId: userId,
          createdAt: (league.created_at as string) || new Date().toISOString(),
          cutPercent: (league.cut_percent as number) ?? 50,
          regularSeasonWeeks: pack.defaultSeasonWeeks,
          gamesPerWeek:
            (league.games_per_week as number) ?? pack.defaultGamesPerWeek,
          role: "commissioner",
          displayName: resolvedName,
          displayNameOverride: override,
          crystalBallEnabled: true,
          homeTaglineId: "good-teams",
          homeTaglineCustom: "",
          seasonThemeId: "default",
          sportId: createdSportId,
          isOpen: listAsOpen,
        },
        userId
      );
      saveActiveLeagueId(leagueId);
      try {
        const { writeScopedActiveWeek } = await import(
          "@/lib/active-week-storage"
        );
        writeScopedActiveWeek(openingWeek, {
          userId,
          leagueId,
          sportId: createdSportId,
        });
      } catch {
        /* ignore */
      }
      markLeagueBuildNeeded(leagueId);
      // Silent Crew + first chapter (no day-one lecture — story at finale)
      try {
        const { ensureCrewForLeague } = await import("@/lib/crew");
        ensureCrewForLeague({
          leagueId,
          leagueName: (league.name as string) || room,
          sportId: createdSportId,
          createdBy: userId,
          foundedAt:
            (league.created_at as string) || new Date().toISOString(),
        });
      } catch {
        /* local-first optional */
      }

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
              crystal_ball_enabled: true,
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
      // League Build first — invite / card come after constitution is set
      router.push(
        listAsOpen ? "/league-build?new=1&open=1" : "/league-build?new=1"
      );
      router.refresh();
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create league");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!userId) return;
    setError(null);
    const nick = displayName.trim(); // optional league alias
    if (nick) {
      const { validateDisplayNameInput } = await import("@/lib/display-name");
      const v = validateDisplayNameInput(nick);
      if (!v.ok) {
        setError(v.error);
        return;
      }
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { ensureProfileRowExists } = await import(
        "@/lib/league-display-name"
      );
      await ensureProfileRowExists(userId, accountHint || undefined);
      const { data: profRow } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      const accountName =
        (profRow?.display_name as string)?.trim() ||
        accountHint ||
        "Player";

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

        // Fair Entry: mid-season joiners start at a frozen band percentile (not 0).
        let startPts = 0;
        try {
          const { resolveFairEntryForJoin } = await import("@/lib/fair-entry");
          const fe = await resolveFairEntryForJoin(league.id as string);
          startPts = fe.midSeason ? fe.points : 0;
        } catch {
          startPts = 0;
        }
        const { error: memError } = await supabase.from("memberships").insert({
          league_id: league.id,
          user_id: userId,
          role: "player",
          division,
          total_points: startPts,
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
        // Notice only — never show the point number
        if (startPts > 0) {
          try {
            const { markFairEntryPendingNotice, bandForLatestScoredWeek } =
              await import("@/lib/fair-entry");
            const { listScoredWeekNumbers } = await import("@/lib/cloud");
            const scored = await listScoredWeekNumbers();
            const latest =
              scored.length > 0 ? Math.max(...scored.filter((w) => w >= 0)) : null;
            const band = bandForLatestScoredWeek(latest);
            if (band) {
              markFairEntryPendingNotice(league.id as string, userId, {
                points: startPts,
                bandId: band.id,
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
      // Full settings from cloud so season theme paints immediately for joiners
      const seasonThemeId =
        typeof league.season_theme_id === "string" && league.season_theme_id
          ? league.season_theme_id
          : "default";
      // Honor DB flag; NFL/CFB default ON when unset (do not force NFL off).
      const crystalOn =
        typeof league.crystal_ball_enabled === "boolean"
          ? !!league.crystal_ball_enabled
          : joinedSportId === "nfl" || joinedSportId === "cfb";
      // Optional league alias after membership exists
      let resolvedName = accountName;
      let override: string | null = null;
      if (nick) {
        try {
          const { setMyLeagueDisplayName } = await import(
            "@/lib/league-display-name"
          );
          const aliasRes = await setMyLeagueDisplayName(
            league.id as string,
            nick
          );
          if (aliasRes.ok) {
            resolvedName = aliasRes.resolved;
            override = aliasRes.override;
          }
        } catch {
          /* migration pending */
        }
      } else {
        try {
          const { data: mem } = await supabase
            .from("memberships")
            .select("display_name_override")
            .eq("league_id", league.id)
            .eq("user_id", userId)
            .maybeSingle();
          const { resolveLeagueDisplayName } = await import(
            "@/lib/display-name"
          );
          override =
            (mem as { display_name_override?: string | null } | null)
              ?.display_name_override ?? null;
          resolvedName = resolveLeagueDisplayName({
            membershipOverride: override,
            profileDisplayName: accountName,
          });
        } catch {
          resolvedName = accountName;
        }
      }

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
          displayName: resolvedName,
          displayNameOverride: override,
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

      // Sport-aware allegiance only after league sport is known; preserve Home.
      let landPath = "/";
      try {
        const {
          needsAllegianceForSport,
          declareAllegianceHref,
        } = await import("@/lib/favorite-teams");
        if (await needsAllegianceForSport(joinedSportId)) {
          landPath = declareAllegianceHref(joinedSportId, "/");
        }
      } catch {
        /* Home hub still gates CHOOSE_TEAM / Super Bowl / weekly */
      }
      router.push(landPath);
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
            You&apos;re the commish
          </p>
      <h1 className="text-2xl font-bold mb-1 text-center">League created</h1>
      <p className="text-sm text-muted mb-4 text-center">
            {leagueLabel} — next: set up the room, then publish the first card.
            {listAsOpen ? " Listed in the open room lobby." : ""}
          </p>
      <div className="text-3xl font-bold tracking-[0.3em] text-primary text-center mb-4 font-mono">
            {createdCode}
          </div>
      <div id="invite-friends-root">
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
          </div>

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
              <span className="font-semibold text-primary">1.</span> Share the
              invite (empty room is the #1 fail)
            </li>
      <li>
              <span className="font-semibold text-primary">2.</span> Publish a
              card (demo slate is fine first time)
            </li>
      <li>
              <span className="font-semibold text-primary">3.</span> Score the
              week (practice is fine)
            </li>
      </ol>

                    <p className="text-[11px] text-muted text-center mb-3 leading-relaxed">
            You can invite from Home anytime. First job: publish a card so
            people can pick.
          </p>
          <button
            type="button"
            onClick={() => {
              if (leagueId) markHostScreenSeen(leagueId);
              router.push("/week-ops?first=1");
              router.refresh();
            }}
            className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold mb-2 touch-manipulation"
          >
            Build first card →
          </button>
          <button
            type="button"
            onClick={() => {
              if (leagueId) markHostScreenSeen(leagueId);
              router.push("/league-build?new=1");
              router.refresh();
            }}
            className="w-full py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground touch-manipulation"
          >
            Finish room setup first
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
      <p className="text-sm text-muted mt-1">
            Signed in
            {accountHint ? (
              <>
                {" · "}
                <span className="text-foreground/80">{accountHint}</span>
              </>
            ) : null}
          </p>
      </div>

        {mode === "choose" && (
          <div className="space-y-3">
      <button
              type="button"
              onClick={() => {
                setMode("create");
                setCreateStep("sport");
                setLeagueName("");
                setDisplayName("");
                setError(null);
              }}
              className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
            >
              Commissioner — create league
            </button>
      <button
              type="button"
              onClick={() => {
                setMode("join");
                setDisplayName("");
                setError(null);
              }}
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
            {createStep === "sport" ? (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                    Step 1 of 2
                  </p>
                  <h2 className="font-semibold text-lg">Which sport?</h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Everything about this room follows from the sport desk.
                    College Football or NFL — pick one first.
                  </p>
                </div>
                <div className="space-y-2 pr-0.5">
                  {listSportPickerOptions()
                    .filter((s) => s.status === "live")
                    .map((s) => {
                      const selected = sportId === s.id;
                      const isNfl = s.id === "nfl";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const next = s.id as SportId;
                            setSportId(next);
                            void import("@/lib/sports/sport-theme").then(
                              ({ applySportTheme }) => applySportTheme(next)
                            );
                            void import("@/lib/sport-room-scope").then(
                              ({ setSportScope }) => setSportScope(next)
                            );
                          }}
                          className={`w-full text-left rounded-xl border px-3 py-3.5 transition touch-manipulation ${
                            selected && isNfl
                              ? "border-[#C1121F]/70 bg-[#0B1426] shadow-[0_0_22px_rgba(193,18,31,0.25)]"
                              : selected
                                ? "border-primary bg-primary/15 shadow-[0_0_20px_rgba(34,197,94,0.12)]"
                                : "border-border bg-background hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isNfl ? (
                              <NflBrandMark size={36} className="shrink-0" />
                            ) : (
                              <span className="text-xl shrink-0" aria-hidden>
                                {s.emoji}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-bold text-foreground block">
                                {s.id === "cfb"
                                  ? "College Football"
                                  : s.id === "nfl"
                                    ? "NFL"
                                    : s.label}
                              </span>
                              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                                {s.blurb}
                              </p>
                            </div>
                            {selected && (
                              <span className="text-sm font-black text-primary shrink-0">
                                ✓
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  type="button"
                  disabled={!isLiveSport(sportId)}
                  onClick={() => {
                    if (!isLiveSport(sportId)) {
                      setError("Pick College Football or NFL to continue.");
                      return;
                    }
                    setError(null);
                    setCreateStep("details");
                  }}
                  className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-50 touch-manipulation"
                >
                  Continue →
                </button>
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="w-full text-sm text-muted min-h-[44px]"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                    Step 2 of 2 · {getSportPack(sportId).shortLabel}
                  </p>
                  <h2 className="font-semibold text-lg">
                    What kind of room are you building today?
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Fresh names invite a new story — not a copy of last league.
                    Best with{" "}
                    <strong className="text-foreground">8–16 friends</strong>{" "}
                    (bots can fill empty seats later). Cap {MAX_LEAGUE_PLAYERS}.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="create-room-name"
                    className="text-[11px] font-semibold uppercase tracking-wide text-muted"
                  >
                    Room name
                  </label>
                  <input
                    id="create-room-name"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    placeholder="e.g. Saturday Situation Room"
                    autoComplete="off"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="create-display-name"
                    className="text-[11px] font-semibold uppercase tracking-wide text-muted"
                  >
                    Name in this league — optional
                  </label>
                  <input
                    id="create-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Leave blank for your account name"
                    autoComplete="off"
                    maxLength={40}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    Leave blank to use your War Room account name
                    {accountHint ? ` (${accountHint})` : ""}. This never changes
                    your account identity or other leagues.
                  </p>
                </div>
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
                      Strangers can find you in the open lobby. Turn off anytime
                      in Settings.
                    </span>
                  </span>
                </label>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={loading || !isLiveSport(sportId)}
                  className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-extrabold disabled:opacity-50 touch-manipulation"
                >
                  {loading
                    ? "Creating…"
                    : sportId === "nfl"
                      ? "Create NFL league →"
                      : `Create ${getSportPack(sportId).shortLabel} league →`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCreateStep("sport");
                  }}
                  className="w-full text-sm text-muted min-h-[44px]"
                >
                  Back · change sport
                </button>
              </>
            )}
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
              <strong className="text-foreground">Fair Entry</strong> places
              late arrivals in a fair starting position based on when you join —
              early players keep what they earned; you still have room to climb.
              Missed weeks stay missed. Cheevos and hardware still count from
              here on.
            </div>
      <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-widest uppercase font-mono"
            />
            <div className="space-y-1.5">
              <label
                htmlFor="join-display-name"
                className="text-[11px] font-semibold uppercase tracking-wide text-muted"
              >
                Name in this league — optional
              </label>
              <input
                id="join-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Leave blank for your account name"
                autoComplete="off"
                maxLength={40}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-muted leading-relaxed">
                Leave blank to use your War Room account name
                {accountHint ? ` (${accountHint})` : ""}.
              </p>
            </div>
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
