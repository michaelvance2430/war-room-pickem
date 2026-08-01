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
      // Include sport when column exists (run supabase/sport-id.sql on dev DB)
      // Crystal Ball is CFB pride pick — default off for NFL
      const withSport: Record<string, unknown> = {
        ...baseRow,
        sport_id: sportId,
        sport_settings: {},
        crystal_ball_enabled: sportId === "cfb",
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

      // Column missing — strip open-room and/or sport fields and retry
      if (
        leagueError &&
        /is_open|open_listed|sport_id|sport_settings|column|schema cache|PGRST/i.test(
          leagueError.message || ""
        )
      ) {
        const stripped = { ...withSport };
        delete stripped.is_open;
        delete stripped.open_listed_at;
        let res = await supabase.from("leagues").insert(stripped).select().single();
        if (
          res.error &&
          /sport_id|sport_settings|column|schema cache|PGRST/i.test(
            res.error.message || ""
          )
        ) {
          res = await supabase.from("leagues").insert(baseRow).select().single();
        }
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

      if (leagueError || !league) {
        throw new Error(leagueError?.message || "Could not create league");
      }

      const leagueId = league.id as string;
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
      localStorage.setItem(
        "warroom-session",
        JSON.stringify({
          playerId: userId,
          playerName: displayName.trim() || "Commissioner",
          isCommissioner: true,
          leagueId,
        })
      );
      const createdSportId =
        (league.sport_id as string) || sportId || "cfb";
      localStorage.setItem(
        "warroom-league",
        JSON.stringify({
          id: leagueId,
          name: league.name as string,
          code: league.code as string,
          commissionerId: userId,
          createdAt: league.created_at as string,
          sportId: createdSportId,
          settings: {
            cutPercent: (league.cut_percent as number) ?? 50,
            regularSeasonWeeks: pack.defaultSeasonWeeks,
            gamesPerWeek:
              (league.games_per_week as number) ?? pack.defaultGamesPerWeek,
            // Crystal Ball = CFB national champ pride pick; off for NFL by default
            crystalBallEnabled: createdSportId === "cfb",
            homeTaglineId: "good-teams",
            homeTaglineCustom: "",
            seasonThemeId: "default",
          },
        })
      );
      // Persist CB default to cloud when column exists
      try {
        if (createdSportId === "nfl") {
          const { saveLeagueToCloud } = await import("@/lib/league-sync");
          await saveLeagueToCloud({
            settings: { crystalBallEnabled: false },
          });
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
        (league as { sport_id?: string }).sport_id || "cfb";

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

        const { error: memError } = await supabase.from("memberships").insert({
          league_id: league.id,
          user_id: userId,
          role: "player",
          division,
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
      localStorage.setItem(
        "warroom-session",
        JSON.stringify({
          playerId: userId,
          playerName: displayName.trim() || "Player",
          isCommissioner: league.commissioner_id === userId,
          leagueId: league.id,
        })
      );
      // Full settings from cloud so season theme paints immediately for joiners
      const seasonThemeId =
        typeof league.season_theme_id === "string" && league.season_theme_id
          ? league.season_theme_id
          : "default";
      localStorage.setItem(
        "warroom-league",
        JSON.stringify({
          id: league.id,
          name: league.name,
          code: league.code,
          commissionerId: league.commissioner_id,
          createdAt: league.created_at,
          sportId: joinedSportId,
          settings: {
            cutPercent: league.cut_percent ?? 50,
            regularSeasonWeeks: 18, // fixed CFB calendar (app weeks 0–18)
            gamesPerWeek: league.games_per_week ?? 5,
            crystalBallEnabled: league.crystal_ball_enabled !== false,
            homeTaglineId: league.home_tagline_id || "good-teams",
            homeTaglineCustom: league.home_tagline_custom || "",
            seasonThemeId,
          },
        })
      );
      try {
        const { applySeasonTheme } = await import("@/lib/season-theme");
        applySeasonTheme(seasonThemeId);
      } catch {
        /* ignore */
      }
      try {
        const { applySportTheme } = await import("@/lib/sports/sport-theme");
        applySportTheme(joinedSportId);
      } catch {
        /* ignore */
      }
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
        <div className="max-w-md w-full rounded-xl border-2 border-primary/40 bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2 text-center">
            You&apos;re the host
          </p>
          <h1 className="text-2xl font-bold mb-1 text-center">League created</h1>
          <p className="text-sm text-muted mb-4 text-center">
            {leagueLabel} — share the invite link, then build the first card.
          </p>
          <div className="text-3xl font-bold tracking-[0.3em] text-primary text-center mb-4 font-mono">
            {createdCode}
          </div>

          <InviteFriends
            leagueName={leagueLabel}
            code={createdCode}
            leagueId={leagueId}
            className="mb-4 !border-primary/30"
          />

          {hostCopied && (
            <p className="text-xs text-primary text-center mb-3">{hostCopied}</p>
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
          <div className="w-12 h-12 rounded-lg bg-primary text-black font-bold text-lg flex items-center justify-center mx-auto mb-3">
            WR
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
                        if (live) setSportId(s.id as SportId);
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
