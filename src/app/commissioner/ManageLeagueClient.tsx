"use client";

/**
 * Manage League — Stage 1
 * Persistent settings only. Weekly ops live on Home → /week-ops.
 * Simulation and testing tools are never rendered here.
 */

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PlayerLink from "@/components/PlayerLink";
import {
  getLeague,
  getSession,
  isCommissioner,
  isOps,
  type League,
} from "@/lib/league";
import { saveLeagueToCloud, syncLeagueFromCloud } from "@/lib/league-sync";
import {
  loadLeagueRoster,
  loadLeagueActiveWeek,
  loadWeekCard,
  listScoredWeekNumbers,
  refreshStaffSessionFlags,
  setMemberModeration,
  startNextSeasonInCloud,
  unpublishWeekCard,
  type CloudCard,
  type LeagueRosterMember,
} from "@/lib/cloud";
import {
  HOME_TAGLINE_MAX_CHARS,
  DEFAULT_HOME_TAGLINE_ID,
  homeTaglinePresetsForSport,
  resolveHomeTagline,
} from "@/lib/home-tagline";
import { transferCommissioner, defaultSeasonYear } from "@/lib/trophies";
import { paintAutomaticSeasonTheme } from "@/lib/season-theme";
import { DIVISIONS, divisionDisplayLabel } from "@/lib/divisions";
import { isLeagueBuildLocked, openingWeekLockLabel } from "@/lib/league-build";
import SportPoolCommishPanel from "@/components/SportPoolCommishPanel";
import { weekTitle } from "@/lib/dates";
import { deleteLeague } from "@/lib/session-restore";
import {
  listPrivateRoomJoinRequests,
  reviewPrivateRoomJoin,
  setLeagueLobbyVisibility,
  type LobbyJoinRequest,
  type LobbyVisibility,
} from "@/lib/lobby";

type SectionId =
  | "identity"
  | "rules"
  | "people"
  | "season"
  | null;

function sportLabel(sportId?: string | null) {
  return sportId === "nfl" ? "NFL" : "CFB";
}

function ManageLeagueInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [allowed, setAllowed] = useState<boolean | null>(() => {
    try {
      return isOps();
    } catch {
      return null;
    }
  });
  const [isOwner, setIsOwner] = useState(() => {
    try {
      return isCommissioner();
    } catch {
      return false;
    }
  });

  const [league, setLeague] = useState<League | null>(() => {
    try {
      return getLeague();
    } catch {
      return null;
    }
  });
  const [openSection, setOpenSection] = useState<SectionId>(null);

  const [leagueNameEdit, setLeagueNameEdit] = useState("");
  const [cutPercent, setCutPercent] = useState(50);
  const [crystalBallEnabled, setCrystalBallEnabled] = useState(true);
  const [lobbyVisibility, setLobbyVisibility] = useState<LobbyVisibility>("hidden");
  const [joinRequests, setJoinRequests] = useState<LobbyJoinRequest[]>([]);
  const [openRoomBusy, setOpenRoomBusy] = useState(false);
  const [openRoomNote, setOpenRoomNote] = useState<string | null>(null);
  const [homeTaglineId, setHomeTaglineId] = useState(DEFAULT_HOME_TAGLINE_ID);
  const [homeTaglineCustom, setHomeTaglineCustom] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSavedFor, setSettingsSavedFor] = useState<
    "identity" | "rules" | null
  >(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [roster, setRoster] = useState<LeagueRosterMember[]>([]);
  const [deputyBusyId, setDeputyBusyId] = useState<string | null>(null);
  const [deputyReport, setDeputyReport] = useState<string | null>(null);
  const [passToUserId, setPassToUserId] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passReport, setPassReport] = useState<string | null>(null);

  const [scoredWeeks, setScoredWeeks] = useState<number[]>([]);
  const [resettingSeason, setResettingSeason] = useState(false);
  const [seasonReport, setSeasonReport] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeCard, setActiveCard] = useState<CloudCard | null>(null);
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [unpublishReport, setUnpublishReport] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteReport, setDeleteReport] = useState<string | null>(null);

  const [peopleExtrasOpen, setPeopleExtrasOpen] = useState(false);

  // Legacy weekly URLs → week-ops / players (before paint)
  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    const first = searchParams.get("first");
    if (first === "1" && (!tab || tab === "card")) {
      router.replace("/week-ops?first=1");
      return;
    }
    if (tab === "card" || tab === "build") {
      router.replace("/week-ops");
      return;
    }
    if (tab === "results" || tab === "score" || tab === "scoring") {
      router.replace("/week-ops?step=score");
      return;
    }
    if (tab === "picks") {
      router.replace("/week-ops");
      return;
    }
    if (tab === "players" || tab === "roster" || tab === "alignment") {
      router.replace("/players");
      return;
    }
  }, [router, searchParams]);

  const hydrate = useCallback(async () => {
    await refreshStaffSessionFlags().catch(() => {});
    setAllowed(isOps());
    setIsOwner(isCommissioner());

    let lg = getLeague();
    try {
      const fresh = (await syncLeagueFromCloud()) || getLeague();
      if (fresh) lg = fresh;
    } catch {
      /* local shell */
    }
    if (lg) {
      setLeague(lg);
      setLeagueNameEdit(lg.name || "");
      setCutPercent(lg.settings?.cutPercent ?? 50);
      setCrystalBallEnabled(lg.settings?.crystalBallEnabled !== false);
      setHomeTaglineId(lg.settings?.homeTaglineId || DEFAULT_HOME_TAGLINE_ID);
      setHomeTaglineCustom(lg.settings?.homeTaglineCustom || "");
      void paintAutomaticSeasonTheme({});
      try {
        const { createClient, hasSupabaseConfig } = await import(
          "@/lib/supabase/client"
        );
        if (hasSupabaseConfig() && lg.id) {
          const sb = createClient();
          const { data: row } = await sb
            .from("leagues")
            .select("is_open,lobby_visibility")
            .eq("id", lg.id)
            .maybeSingle();
          const visibility = (row as { lobby_visibility?: LobbyVisibility } | null)?.lobby_visibility;
          setLobbyVisibility(visibility || ((row as { is_open?: boolean } | null)?.is_open ? "public" : "hidden"));
          const requestResult = await listPrivateRoomJoinRequests(lg.id);
          if (!requestResult.error) setJoinRequests(requestResult.requests);
        }
      } catch {
        /* optional column */
      }
      try {
        const liveWeek = await loadLeagueActiveWeek();
        setActiveWeek(liveWeek);
        setActiveCard(await loadWeekCard(liveWeek));
      } catch {
        setActiveCard(null);
      }
    }

    let scored: number[] = [];
    try {
      const [r, sc] = await Promise.all([
        loadLeagueRoster(),
        listScoredWeekNumbers().catch(() => [] as number[]),
      ]);
      setRoster(r);
      scored = sc;
      setScoredWeeks(sc);
    } catch {
      setRoster([]);
    }

  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const session = getSession();
  const humans = useMemo(
    () => roster.filter((m) => !m.isBot),
    [roster]
  );
  const deputies = useMemo(
    () => humans.filter((m) => m.isDeputy),
    [humans]
  );
  const passRoster = useMemo(
    () =>
      humans
        .filter((m) => m.userId !== session?.playerId)
        .sort((a, b) => {
          if (!!a.isDeputy !== !!b.isDeputy) return a.isDeputy ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [humans, session?.playerId]
  );
  const commissioner = humans.find((m) => m.role === "commissioner");
  const divCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of DIVISIONS) c[d] = 0;
    for (const m of roster) {
      const d = m.division || "North";
      c[d] = (c[d] || 0) + 1;
    }
    return c;
  }, [roster]);

  const seasonYear = defaultSeasonYear();
  const rulesLocked = isLeagueBuildLocked(league?.sportId);
  const mottoPreview = resolveHomeTagline({
    homeTaglineId,
    homeTaglineCustom,
    sportId: league?.sportId,
  });

  async function saveIdentity() {
    setSettingsError(null);
    const cleanName = leagueNameEdit.trim();
    if (!cleanName) {
      setSettingsError("League name cannot be blank.");
      return;
    }
    setSettingsBusy(true);
    const result = await saveLeagueToCloud({
      name: cleanName,
      settings: {
        homeTaglineId,
        homeTaglineCustom: homeTaglineCustom.slice(0, HOME_TAGLINE_MAX_CHARS),
      },
    });
    setSettingsBusy(false);
    if (result.ok && result.league) {
      setLeague(result.league);
      void paintAutomaticSeasonTheme();
      setSettingsSavedFor("identity");
      setTimeout(() => setSettingsSavedFor(null), 1500);
    } else {
      setSettingsError(result.error || "Failed to save settings");
    }
  }

  async function saveRules() {
    setSettingsError(null);
    if (rulesLocked) {
      setSettingsError(`Rules locked at ${openingWeekLockLabel(league?.sportId)}.`);
      return;
    }
    const safeCut = Math.min(75, Math.max(10, cutPercent));
    setCutPercent(safeCut);
    setSettingsBusy(true);
    const result = await saveLeagueToCloud({
      settings: {
        cutPercent: safeCut,
        crystalBallEnabled,
      },
    });
    setSettingsBusy(false);
    if (result.ok && result.league) {
      setLeague(result.league);
      setSettingsSavedFor("rules");
      setTimeout(() => setSettingsSavedFor(null), 1500);
    } else {
      setSettingsError(result.error || "Failed to save rules");
    }
  }

  async function changeLobbyVisibility(next: LobbyVisibility) {
    if (!league?.id || openRoomBusy) return;
    setOpenRoomBusy(true);
    setOpenRoomNote(null);
    try {
      const res = await setLeagueLobbyVisibility(league.id, next);
      if (!res.ok) {
        setOpenRoomNote(res.error || "Could not update listing");
      } else {
        setLobbyVisibility(next);
        setOpenRoomNote(next === "public" ? "Public — players can join now." : next === "private" ? "Private — players can request access." : "Hidden — invite code only.");
      }
    } catch (e: unknown) {
      setOpenRoomNote(e instanceof Error ? e.message : "Failed");
    }
    setOpenRoomBusy(false);
  }

  async function reviewLobbyRequest(requestId: string, approve: boolean) {
    setOpenRoomBusy(true);
    setOpenRoomNote(null);
    const result = await reviewPrivateRoomJoin(requestId, approve);
    if (!result.ok) setOpenRoomNote(result.error);
    else {
      setJoinRequests((current) => current.filter((request) => request.id !== requestId));
      setOpenRoomNote(approve ? "Player approved and added to the room." : "Request declined.");
      if (approve) void hydrate();
    }
    setOpenRoomBusy(false);
  }

  async function toggleDeputy(m: LeagueRosterMember) {
    if (!isOwner || m.role === "commissioner" || m.userId === session?.playerId)
      return;
    const next = !m.isDeputy;
    if (
      !confirm(
        next
          ? `Make ${m.name} a deputy?\n\nThey can build cards and score weeks. They cannot change settings, reset, or pass ownership.`
          : `Remove deputy from ${m.name}?`
      )
    ) {
      return;
    }
    setDeputyBusyId(m.userId);
    setDeputyReport(null);
    const res = await setMemberModeration({
      userId: m.userId,
      isDeputy: next,
    });
    setDeputyBusyId(null);
    if (!res.ok) {
      setDeputyReport(res.error || "Failed");
      return;
    }
    setDeputyReport(
      next ? `${m.name} is now a deputy.` : `${m.name} is no longer a deputy.`
    );
    void hydrate();
  }

  async function handlePassCommissioner() {
    setPassReport(null);
    if (!passToUserId) {
      setPassReport("Pick a player.");
      return;
    }
    const target = passRoster.find((m) => m.userId === passToUserId);
    const name = target?.name || "this player";
    if (
      !confirm(
        `Pass commissioner to ${name}?\n\nYou become a player. Trophy Room stays with the league.`
      )
    ) {
      return;
    }
    const typed = window.prompt(`Type PASS to confirm transfer to ${name}.`);
    if (typed !== "PASS") {
      setPassReport("Cancelled — type PASS to confirm.");
      return;
    }
    setPassBusy(true);
    const result = await transferCommissioner(passToUserId);
    setPassBusy(false);
    if (!result.ok) {
      setPassReport(result.error || "Transfer failed");
      return;
    }
    setPassReport(`Done. ${result.newCommissionerName || name} is commissioner.`);
    setTimeout(() => router.push("/"), 1200);
  }

  async function handleStartNextSeason() {
    const typed = window.prompt(
      "Start next season in this same room?\n\nClears cards, picks, and board. Keeps members, code, trophies.\n\nType NEXT to confirm."
    );
    if (typed !== "NEXT") {
      setSeasonReport("Cancelled.");
      return;
    }
    setResettingSeason(true);
    setSeasonReport(null);
    const res = await startNextSeasonInCloud();
    setResettingSeason(false);
    if (!res.ok) {
      setSeasonReport(res.error || "Failed");
      return;
    }
    setSeasonReport(res.message || "Next season board is open.");
    void hydrate();
  }

  async function handleUnpublishWeek() {
    const label = weekTitle(activeWeek, league?.sportId || "cfb");
    const typed = window.prompt(
      `Unpublish ${label}?\n\nThis removes the live card and every player’s picks for this week. It does not remove anyone from the league. An announcement will tell everyone they must pick again after you publish the replacement.\n\nThis is blocked after kickoff or scoring.\n\nType CLEAR to confirm.`
    );
    if (typed !== "CLEAR") {
      setUnpublishReport("Cancelled. Nothing changed.");
      return;
    }

    setUnpublishBusy(true);
    setUnpublishReport(null);
    const result = await unpublishWeekCard(activeWeek);
    setUnpublishBusy(false);
    if (!result.ok) {
      setUnpublishReport(result.error || "Could not unpublish the card.");
      return;
    }

    setActiveCard(null);
    setUnpublishReport(
      result.alreadyClear
        ? `${label} was already clear.`
        : `${label} unpublished. ${result.picksRemoved || 0} player pick${result.picksRemoved === 1 ? "" : "s"} removed. Announcement posted.`
    );
  }

  async function handleDeleteLeague() {
    if (!league?.id || !league.name) return;
    const typed = window.prompt(
      `Permanently delete “${league.name}”?\n\nThis removes the room, its members, cards, and picks. Player accounts stay intact. Deletion is blocked once any game kicks off or league history exists.\n\nType the exact league name to confirm.`
    );
    if (typed === null) {
      setDeleteReport("Cancelled. Nothing changed.");
      return;
    }
    setDeleteBusy(true);
    setDeleteReport(null);
    const result = await deleteLeague(league.id, typed);
    setDeleteBusy(false);
    if (!result.ok) {
      setDeleteReport(result.error || "Could not delete the league.");
      return;
    }
    router.replace(result.nextLeagueId ? "/" : "/account");
    router.refresh();
  }

  function toggleSection(id: SectionId) {
    setOpenSection((cur) => (cur === id ? null : id));
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center rounded-xl border border-border bg-card p-6">
            <h1 className="text-xl font-bold mb-2">Ops only</h1>
            <p className="text-sm text-muted mb-3">
              Only the commissioner or a deputy can open Manage League.
            </p>
            <Link href="/" className="text-sm font-semibold text-primary">
              ← Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Deputy: management is owner-facing; point them to weekly ops + players
  if (!isOwner) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Manage League
          </p>
          <h1 className="text-2xl font-black">Deputy access</h1>
          <p className="text-sm text-muted leading-relaxed">
            Weekly card and scoring are on Home. You can also manage divisions
            on Players.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/week-ops"
              className="py-3 rounded-xl bg-primary text-black text-center font-bold min-h-[48px] flex items-center justify-center"
            >
              Open week ops →
            </Link>
            <Link
              href="/players"
              className="py-3 rounded-xl border border-border text-center font-semibold min-h-[48px] flex items-center justify-center"
            >
              People & alignment →
            </Link>
            <Link
              href="/"
              className="text-center text-sm text-primary font-semibold py-2"
            >
              ← Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const roleLabel = "Commissioner";
  const accessSummary = lobbyVisibility === "public"
    ? "Public Lobby room · Join now"
    : lobbyVisibility === "private"
      ? `Private Lobby room · ${joinRequests.length} request${joinRequests.length === 1 ? "" : "s"}`
      : "Hidden room · Invite code active";
  const rulesSummary = [
    sportLabel(league?.sportId),
    "Fair Entry always on",
    crystalBallEnabled ? "Crystal Ball on" : "Crystal Ball off",
    `Cut ${cutPercent}%`,
  ].join(" · ");
  const peopleSummary = `${humans.length} members · ${deputies.length} deput${
    deputies.length === 1 ? "y" : "ies"
  } · 4 divisions`;
  const historySummary =
    scoredWeeks.length === 0
      ? `${seasonYear} season · No scored weeks yet · Rollover quiet`
      : `${seasonYear} season · ${scoredWeeks.length} week${
          scoredWeeks.length === 1 ? "" : "s"
        } scored`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Manage League
          </p>
          <h1 className="text-2xl sm:text-3xl font-black mt-0.5 text-foreground">
            {league?.name || "Your league"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {sportLabel(league?.sportId)} · {seasonYear} · {roleLabel}
          </p>
          <p className="text-xs text-muted mt-2 max-w-xl">
            Persistent settings and people. Weekly card and scoring stay on{" "}
            <Link href="/" className="text-primary font-semibold">
              Home
            </Link>
            .
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          {/* 1. Identity & Access */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground">Identity & Access</h2>
                <p className="text-sm text-muted mt-1 leading-snug">
                  {accessSummary}
                </p>
                <p className="text-xs text-muted mt-1 truncate">
                  Motto: {mottoPreview}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSection("identity")}
                className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold min-h-[40px]"
              >
                {openSection === "identity" ? "Close" : "Edit"}
              </button>
            </div>
            {openSection === "identity" && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <label className="block text-xs text-muted">
                  League name
                  <input
                    value={leagueNameEdit}
                    onChange={(e) => setLeagueNameEdit(e.target.value)}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                  />
                </label>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">Lobby access</p>
                  <p className="mt-1 text-xs text-muted">Public joins instantly. Private requires your approval. Hidden uses invite codes only.</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["public", "private", "hidden"] as LobbyVisibility[]).map((option) => (
                      <button key={option} type="button" disabled={openRoomBusy} onClick={() => void changeLobbyVisibility(option)} className={`min-h-[42px] rounded-lg border text-[10px] font-black uppercase tracking-wider ${lobbyVisibility === option ? "border-primary bg-primary text-black" : "border-border bg-background text-muted"}`}>{option}</button>
                    ))}
                  </div>
                </div>
                {lobbyVisibility === "private" && (
                  <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-bold">Lobby requests</p><span className="text-xs text-muted">{joinRequests.length} pending</span></div>
                    {joinRequests.length === 0 ? <p className="mt-2 text-xs text-muted">No one is waiting for clearance.</p> : <div className="mt-2 space-y-2">{joinRequests.map((request) => <div key={request.id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{request.gameHandle}</span><button type="button" disabled={openRoomBusy} onClick={() => void reviewLobbyRequest(request.id, false)} className="rounded-md border border-border px-2 py-1 text-[10px] font-bold text-muted">DENY</button><button type="button" disabled={openRoomBusy} onClick={() => void reviewLobbyRequest(request.id, true)} className="rounded-md bg-primary px-2 py-1 text-[10px] font-black text-black">APPROVE</button></div>)}</div>}
                  </div>
                )}
                {openRoomNote && (
                  <p className="text-xs text-primary">{openRoomNote}</p>
                )}
                <label className="block text-xs text-muted">
                  Home motto preset
                  <select
                    value={homeTaglineId}
                    onChange={(e) => setHomeTaglineId(e.target.value)}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {homeTaglinePresetsForSport(league?.sportId).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {homeTaglineId === "custom" && (
                  <textarea
                    value={homeTaglineCustom}
                    onChange={(e) =>
                      setHomeTaglineCustom(
                        e.target.value.slice(0, HOME_TAGLINE_MAX_CHARS)
                      )
                    }
                    rows={2}
                    maxLength={HOME_TAGLINE_MAX_CHARS}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
                    placeholder="Custom home line"
                  />
                )}
                <p className="text-xs text-muted">
                  Invite code:{" "}
                  <span className="font-mono text-foreground">
                    {league?.code || "—"}
                  </span>{" "}
                  (share from Home)
                </p>
                <button
                  type="button"
                  disabled={settingsBusy}
                  onClick={() => void saveIdentity()}
                  className="w-full py-3 rounded-xl bg-primary text-black font-bold min-h-[48px]"
                >
                  {settingsBusy
                    ? "Saving…"
                    : settingsSavedFor === "identity"
                      ? "Saved"
                      : "Save identity"}
                </button>
                {settingsError && (
                  <p className="text-sm text-danger">{settingsError}</p>
                )}
              </div>
            )}
          </section>

          {/* 2. Rules & Format */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground">Rules & Format</h2>
                <p className="text-sm text-muted mt-1 leading-snug">
                  {rulesSummary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSection("rules")}
                className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold min-h-[40px]"
              >
                {openSection === "rules" ? "Close" : "Review"}
              </button>
            </div>
            {openSection === "rules" && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {rulesLocked && (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5">
                    <p className="text-sm font-semibold text-warning">Rules locked</p>
                    <p className="text-xs text-muted mt-1">
                      Opening week has started. Existing league rules now stay fixed.
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted">
                  Sport:{" "}
                  <strong className="text-foreground">
                    {sportLabel(league?.sportId)}
                  </strong>{" "}
                  (fixed for this room)
                </p>
                <div className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Fair Entry
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    <strong className="text-foreground">Always on</strong> for
                    this product. Mid-season joiners receive a banded start from
                    the existing Fair Entry path on join — there is no owner
                    off-switch. Early players keep what they earned.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">Crystal Ball</p>
                    <p className="text-xs text-muted">
                      {crystalBallEnabled ? "Tab visible" : "Tab hidden"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={crystalBallEnabled}
                    disabled={rulesLocked || settingsBusy}
                    onClick={() => setCrystalBallEnabled((v) => !v)}
                    className={`relative shrink-0 w-12 h-7 rounded-full ${
                      crystalBallEnabled ? "bg-primary" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-black transition ${
                        crystalBallEnabled ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                <label className="block text-xs text-muted">
                  Cut line (% to Toilet Bowl)
                  <input
                    type="number"
                    min={10}
                    max={75}
                    disabled={rulesLocked || settingsBusy}
                    value={cutPercent}
                    onChange={(e) =>
                      setCutPercent(parseInt(e.target.value, 10) || 50)
                    }
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={rulesLocked || settingsBusy}
                  onClick={() => void saveRules()}
                  className="w-full py-3 rounded-xl bg-primary text-black font-bold min-h-[48px] disabled:opacity-50"
                >
                  {settingsBusy
                    ? "Saving…"
                    : settingsSavedFor === "rules"
                      ? "Saved"
                      : rulesLocked
                        ? "Rules locked"
                        : "Save rules"}
                </button>
                {settingsError && (
                  <p className="text-sm text-danger">{settingsError}</p>
                )}
              </div>
            )}
          </section>

          {/* 3. People & Permissions */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground">
                  People & Permissions
                </h2>
                <p className="text-sm text-muted mt-1 leading-snug">
                  {peopleSummary}
                </p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {DIVISIONS.map(
                    (d) => `${divisionDisplayLabel(d, league?.sportId)} ${divCounts[d] || 0}`
                  ).join(" · ")}
                </p>
                {commissioner && (
                  <p className="text-xs text-muted mt-1">
                    Commissioner:{" "}
                    <PlayerLink id={commissioner.userId} name={commissioner.name} />
                  </p>
                )}
              </div>
              <Link
                href="/players"
                className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold min-h-[40px] flex items-center"
              >
                Manage
              </Link>
            </div>
            <p className="text-xs text-muted mt-3">
              Roster, divisions, Auto-Balance, and removals open on Players.
            </p>
            <button
              type="button"
              onClick={() => {
                setPeopleExtrasOpen((o) => !o);
                setOpenSection("people");
              }}
              className="mt-3 text-xs font-semibold text-primary"
            >
              {peopleExtrasOpen
                ? "Hide deputies & permissions"
                : "Deputies & Permissions"}
            </button>
            {peopleExtrasOpen && (
              <div className="mt-3 pt-3 border-t border-border space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Deputies</p>
                  {passRoster.length === 0 ? (
                    <p className="text-xs text-muted">
                      Need another real player to appoint a deputy.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {passRoster.map((m) => (
                        <li
                          key={m.userId}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">
                            <PlayerLink id={m.userId} name={m.name} />
                            {m.isDeputy && (
                              <span className="ml-1 text-[10px] uppercase text-primary">
                                Deputy
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={deputyBusyId === m.userId}
                            onClick={() => void toggleDeputy(m)}
                            className="text-xs px-2 py-1 rounded-lg border border-border shrink-0"
                          >
                            {m.isDeputy ? "Remove" : "Make deputy"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {deputyReport && (
                    <p className="text-xs text-primary mt-2">{deputyReport}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Pass commissioner</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={passToUserId}
                      onChange={(e) => setPassToUserId(e.target.value)}
                      className="flex-1 bg-background border border-border rounded-lg px-2 py-2 text-sm"
                    >
                      <option value="">— Select —</option>
                      {passRoster.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={passBusy || !passToUserId}
                      onClick={() => void handlePassCommissioner()}
                      className="px-3 py-2 rounded-lg border border-primary text-primary text-xs font-bold disabled:opacity-50"
                    >
                      {passBusy ? "…" : "Pass"}
                    </button>
                  </div>
                  {passReport && (
                    <p className="text-xs mt-1 text-muted">{passReport}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 4. Season & History */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground">Season & History</h2>
                <p className="text-sm text-muted mt-1 leading-snug">
                  {historySummary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleSection("season")}
                className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold min-h-[40px]"
              >
                {openSection === "season" ? "Close" : "View"}
              </button>
            </div>
            {openSection === "season" && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <Link
                  href="/trophy-room"
                  className="inline-flex text-sm font-semibold text-primary"
                >
                  Trophy Room / history →
                </Link>
                {scoredWeeks.length > 0 ? (
                  <>
                    <p className="text-xs text-muted leading-relaxed">
                      When the season is finished, open a clean board for the same
                      room. Members, code, and trophies stay. Type NEXT to confirm.
                    </p>
                    <button
                      type="button"
                      disabled={resettingSeason}
                      onClick={() => void handleStartNextSeason()}
                      className="w-full py-3 rounded-xl border border-primary/50 text-primary font-bold min-h-[48px] disabled:opacity-50"
                    >
                      {resettingSeason ? "Working…" : "Start next season"}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-muted leading-relaxed">
                    Season rollover becomes available after this room records an
                    official scored week.
                  </p>
                )}
                {seasonReport && (
                  <p className="text-xs text-muted">{seasonReport}</p>
                )}
              </div>
            )}
          </section>

          {/* Commissioner-only cross-sport opt-in and one-touch seating. */}
          {isOwner && (
            <div className="lg:col-span-2">
              <SportPoolCommishPanel />
            </div>
          )}

          {/* Bottom of League Tools: reversible only before kickoff/scoring. */}
          <section className="lg:col-span-2 rounded-xl border border-danger/35 bg-card p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-danger">
              League Tools · Card control
            </p>
            <h2 className="font-bold text-foreground mt-1">
              Unpublish this week&apos;s card
            </h2>
            {activeCard?.games?.length ? (
              <>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">
                  {weekTitle(activeWeek, league?.sportId || "cfb")} is live. Clearing
                  it removes the card and everyone&apos;s picks for that week so you
                  can pull fresh odds and publish again. The league gets an
                  announcement automatically.
                </p>
                <button
                  type="button"
                  disabled={unpublishBusy}
                  onClick={() => void handleUnpublishWeek()}
                  className="mt-4 w-full min-h-[48px] rounded-xl border border-danger/60 bg-danger/10 px-4 py-3 text-sm font-bold text-danger disabled:opacity-50"
                >
                  {unpublishBusy
                    ? "Unpublishing…"
                    : `Unpublish ${weekTitle(activeWeek, league?.sportId || "cfb")} card`}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted mt-1.5">
                No published card for {weekTitle(activeWeek, league?.sportId || "cfb")}.
              </p>
            )}
            {unpublishReport && (
              <p className="text-sm text-muted mt-3 leading-relaxed">
                {unpublishReport}
              </p>
            )}
          </section>

          <section className="lg:col-span-2 rounded-xl border border-danger/50 bg-danger/5 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-danger">
              League Tools · Permanent cleanup
            </p>
            <h2 className="font-bold text-foreground mt-1">Delete unused league</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Made an extra room while testing? Delete it before the first kickoff.
              Once play begins—or any official history exists—the room is permanent.
              Player accounts are never deleted.
            </p>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => void handleDeleteLeague()}
              className="mt-4 w-full min-h-[48px] rounded-xl border border-danger/70 bg-danger/10 px-4 py-3 text-sm font-bold text-danger disabled:opacity-50"
            >
              {deleteBusy ? "Deleting…" : "Delete this unused league"}
            </button>
            {deleteReport && (
              <p className="text-sm text-muted mt-3 leading-relaxed">{deleteReport}</p>
            )}
          </section>
        </div>

        <p className="text-center text-xs text-muted mt-8">
          <Link href="/" className="text-primary font-semibold">
            ← Home
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function ManageLeagueClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted text-sm">
          Opening Manage League…
        </div>
      }
    >
      <ManageLeagueInner />
    </Suspense>
  );
}
