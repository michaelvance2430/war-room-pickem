"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { MAX_LEAGUE_PLAYERS } from "@/lib/league-limits";
import Link from "next/link";
import {
  markHostScreenSeen,
  stashPendingJoinCode,
  takePendingJoinCode,
} from "@/lib/commish-onboarding";
import { markLeagueBuildNeeded } from "@/lib/league-build";
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
import {
  saveActiveLeagueId,
  writeSessionAndLeague,
} from "@/lib/session-restore";
import {
  createLeagueWithCommissionerSeat,
  fetchLeagueRowForMember,
  joinLeagueByCode,
} from "@/lib/d1b-b-membership";
import type { DeploymentCreditPolicy } from "@/lib/deployment-credit";

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
  const [lateJoinPolicy, setLateJoinPolicy] =
    useState<DeploymentCreditPolicy>("reinforcement_credit");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Join-path status line under the button (rejoin / navigating) */
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [deepLinkCode, setDeepLinkCode] = useState<string | null>(null);

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

      // D1B-B: atomic create + commissioner seat (no direct membership INSERT)
      const created = await createLeagueWithCommissionerSeat({
        name: room,
        sportId: selectedSportId,
        listAsOpen,
        crystalBallEnabled: true,
        currentWeek: openingWeek,
        lateJoinPolicy: listAsOpen ? "reinforcement_credit" : lateJoinPolicy,
      });
      if (!created.ok) {
        throw new Error(created.message);
      }

      const leagueId = created.leagueId;
      const createdSportId = created.sportId || selectedSportId;
      if (createdSportId !== selectedSportId) {
        throw new Error(
          `Could not create league as ${selectedSportId} (database has "${createdSportId}"). Sport is set only at insert — check leagues.sport_id.`
        );
      }

      // Member-scoped hydrate for session fields not in RPC payload
      const fetched = await fetchLeagueRowForMember(leagueId);
      const leagueRow = fetched.ok ? fetched.row : null;

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

      // first-join stamped inside create RPC (R4) — no client membership INSERT

      writeSessionAndLeague(
        {
          leagueId,
          leagueName: created.name || room,
          code: created.code,
          commissionerId: userId,
          createdAt:
            (leagueRow?.created_at as string) || new Date().toISOString(),
          cutPercent:
            created.cutPercent ??
            (leagueRow?.cut_percent as number) ??
            50,
          regularSeasonWeeks: pack.defaultSeasonWeeks,
          gamesPerWeek:
            (leagueRow?.games_per_week as number) ?? pack.defaultGamesPerWeek,
          role: "commissioner",
          displayName: resolvedName,
          displayNameOverride: override,
          crystalBallEnabled: true,
          homeTaglineId: "good-teams",
          homeTaglineCustom: "",
          seasonThemeId: "default",
          sportId: createdSportId,
          isOpen: listAsOpen || created.isOpen,
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
      try {
        const { ensureCrewForLeague } = await import("@/lib/crew");
        ensureCrewForLeague({
          leagueId,
          leagueName: created.name || room,
          sportId: createdSportId,
          createdBy: userId,
          foundedAt:
            (leagueRow?.created_at as string) || new Date().toISOString(),
        });
      } catch {
        /* local-first optional */
      }

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
    setJoinStatus(null);
    const nick = displayName.trim(); // optional league alias
    if (nick) {
      const { validateDisplayNameInput } = await import("@/lib/display-name");
      const v = validateDisplayNameInput(nick);
      if (!v.ok) {
        setError(v.error);
        return;
      }
    }
    const rawCode = code.trim().toUpperCase();
    if (!rawCode || rawCode.length < 4) {
      setError("Enter the full league code from your host.");
      return;
    }
    setLoading(true);
    setJoinStatus("Checking code…");
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

      // D1B-B: join by private code only — no browser code SELECT *, no membership INSERT
      setJoinStatus("Joining room…");
      const joined = await joinLeagueByCode(rawCode);
      if (!joined.ok) {
        throw new Error(joined.message);
      }

      if (joined.alreadyMember) {
        setJoinStatus("You’re already in — opening your room…");
      } else {
        setJoinStatus("Seat confirmed — loading your room…");
      }

      const leagueId = joined.leagueId;
      const fetched = await fetchLeagueRowForMember(leagueId);
      if (!fetched.ok) {
        throw new Error(
          fetched.message ||
            "Joined, but couldn’t load the room. Open Home or try the code again."
        );
      }
      const league = fetched.row;

      const joinedSportId =
        joined.sportId ||
        (league.sport_id as string) ||
        "cfb";
      const joinPack = getSportPack(joinedSportId);

      // Deployment Credit notice only — server already wrote the separate credit
      const startPts = joined.totalPoints ?? 0;
      if (startPts > 0 && !joined.alreadyMember) {
        try {
          const { markFairEntryPendingNotice } =
            await import("@/lib/fair-entry");
          markFairEntryPendingNotice(leagueId, userId, {
            points: startPts,
            bandId: "deployment",
          });
        } catch {
          /* ignore */
        }
      }

      const seasonThemeId =
        typeof league.season_theme_id === "string" && league.season_theme_id
          ? (league.season_theme_id as string)
          : "default";
      const crystalOn =
        typeof league.crystal_ball_enabled === "boolean"
          ? !!league.crystal_ball_enabled
          : joinedSportId === "nfl" || joinedSportId === "cfb";

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
          }
        } catch {
          /* migration pending */
        }
      } else {
        try {
          const { data: mem } = await supabase
            .from("memberships")
            .select("display_name_override")
            .eq("league_id", leagueId)
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

      const commissionerId = (league.commissioner_id as string) || "";
      writeSessionAndLeague(
        {
          leagueId,
          leagueName:
            (league.name as string) || joined.name || "War Room",
          code: joined.code || (league.code as string) || "",
          commissionerId,
          createdAt: (league.created_at as string) || "",
          cutPercent: (league.cut_percent as number) ?? 50,
          regularSeasonWeeks:
            (league.regular_season_weeks as number) ??
            joinPack.defaultSeasonWeeks,
          gamesPerWeek:
            (league.games_per_week as number) ?? joinPack.defaultGamesPerWeek,
          role: commissionerId === userId ? "commissioner" : "player",
          displayName: resolvedName,
          displayNameOverride: override,
          crystalBallEnabled: crystalOn,
          homeTaglineId: (league.home_tagline_id as string) || "good-teams",
          homeTaglineCustom: (league.home_tagline_custom as string) || "",
          seasonThemeId,
          sportId: joinedSportId,
          isOpen: league.is_open === true,
        },
        userId
      );
      saveActiveLeagueId(leagueId);

      let landPath = "/";
      try {
        const {
          needsAllegianceForSport,
          declareAllegianceHref,
        } = await import("@/lib/favorite-teams");
        if (await needsAllegianceForSport(joinedSportId)) {
          landPath = declareAllegianceHref(joinedSportId, "/");
          setJoinStatus("Almost there — choose your team…");
        } else {
          setJoinStatus(
            joined.alreadyMember
              ? "Welcome back — taking you home…"
              : "You’re in — taking you home…"
          );
        }
      } catch {
        setJoinStatus(
          joined.alreadyMember
            ? "Welcome back — taking you home…"
            : "You’re in — taking you home…"
        );
      }
      router.push(landPath);
      router.refresh();
    } catch (err: unknown) {
      setJoinStatus(null);
      const msg = err instanceof Error ? err.message : "Could not join";
      // Never surface raw SQL / stack to players
      if (/permission denied|PGRST|schema cache|SQLSTATE/i.test(msg)) {
        setError(
          "Couldn’t join right now. Check the code and your connection, then try again."
        );
      } else {
        setError(msg);
      }
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
        <div className="max-w-md w-full rounded-xl border-2 border-primary/40 bg-card p-6">
      <div className="flex justify-center mb-3">
            <BrandMark size={72} variant="force" />
      </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2 text-center">
            You&apos;re the commish
          </p>
      <h1 className="text-2xl font-bold mb-1 text-center">League created</h1>
      <p className="text-sm text-muted mb-4 text-center">
            {leagueLabel} is ready. Set the permanent rules once, then Home will
            give you the first weekly job.
            {listAsOpen ? " Listed in the open room lobby." : ""}
          </p>
      <div className="text-3xl font-bold tracking-[0.3em] text-primary text-center mb-4 font-mono">
            {createdCode}
          </div>
          <button
            type="button"
            onClick={() => {
              if (leagueId) markHostScreenSeen(leagueId);
              router.push("/league-build?new=1");
              router.refresh();
            }}
            className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
          >
            Set up league →
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
              Enter Lobby
            </Link>
      <p className="text-center text-[11px] text-muted pt-1 leading-relaxed">
              Browse public and private rooms first. You only join after choosing
              a room yourself (max {MAX_LEAGUE_PLAYERS} players).
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
                    <strong className="text-foreground">8–16 friends</strong>.
                    Cap {MAX_LEAGUE_PLAYERS}.
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
                    onChange={(e) => {
                      setListAsOpen(e.target.checked);
                      if (e.target.checked) {
                        setLateJoinPolicy("reinforcement_credit");
                      }
                    }}
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
                <fieldset className="space-y-2 rounded-xl border border-border bg-background/50 px-3 py-3">
                  <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Late-join rule · locked at creation
                  </legend>
                  {([
                    [
                      "reinforcement_credit",
                      "Reinforcement Credit",
                      "Bottom-15% weekly credit. Required for public rooms.",
                    ],
                    [
                      "zero_backfill",
                      "Zero Backfill",
                      "Late arrivals begin at zero and climb from there.",
                    ],
                    [
                      "closed_roster",
                      "Closed Roster",
                      "Joining closes as soon as the first card is published.",
                    ],
                  ] as const).map(([value, label, detail]) => {
                    const disabled = listAsOpen && value !== "reinforcement_credit";
                    return (
                      <label
                        key={value}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                          lateJoinPolicy === value
                            ? "border-primary/60 bg-primary/5"
                            : "border-border"
                        } ${disabled ? "opacity-45" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          name="late-join-policy"
                          value={value}
                          checked={lateJoinPolicy === value}
                          disabled={disabled}
                          onChange={() => setLateJoinPolicy(value)}
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {label}
                          </span>
                          <span className="block text-[11px] leading-relaxed text-muted">
                            {detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
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
            {deepLinkCode && (
              <div className="overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-background to-black p-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  Private War Room invitation
                </p>
                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Your seat is waiting.
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">
                  Weekly picks become standings, rivalries, hardware, and a Dispatch
                  that remembers exactly who talked big before collapsing.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["10–15 min", "a week"],
                    ["No ads", "just the room"],
                    ["Free", "to play"],
                  ].map(([value, label]) => (
                    <div key={value} className="rounded-lg border border-white/10 bg-black/35 px-2 py-2.5">
                      <p className="text-xs font-black text-foreground">{value}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
      <h2 className="font-semibold">{deepLinkCode ? "Claim your seat" : "Join league"}</h2>
            {deepLinkCode ? (
              <p className="text-xs text-primary font-medium leading-relaxed">
                Invite link detected — code filled in. Confirm your name and
                hit Join.
              </p>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                Enter the private code from your host. Rooms cap at{" "}
                {MAX_LEAGUE_PLAYERS} humans — if it&apos;s full, ask for another
                code or try the open lobby.
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
            {error && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5">
                <p className="text-sm text-danger leading-relaxed">{error}</p>
              </div>
            )}
            {joinStatus && !error && (
              <p className="text-sm text-primary font-medium text-center">
                {joinStatus}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50 min-h-[48px] touch-manipulation"
            >
              {loading
                ? joinStatus?.includes("already") ||
                  joinStatus?.includes("Welcome back")
                  ? "Opening..."
                  : "Joining..."
                : deepLinkCode
                  ? "Join this league"
                  : "Join"}
            </button>
            <p className="text-[11px] text-muted text-center leading-relaxed">
              Already a member? Enter the same code - you&apos;ll re-open the room without a second seat.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError(null);
                setJoinStatus(null);
              }}
              className="w-full text-sm text-muted min-h-[44px]"
            >
              Back
            </button>
            <Link
              href="/open-room"
              className="block w-full text-center text-sm text-primary font-medium py-2"
            >
              No code? Enter the Lobby
            </Link>
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
