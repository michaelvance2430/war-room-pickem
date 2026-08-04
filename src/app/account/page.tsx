"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import {
  getSession,
  getLeague,
  isActuallyCommissioner,
  isActuallyOps,
} from "@/lib/league";
import {
  fetchMyMemberships,
  switchToLeague,
  signOutFully,
  leaveLeague,
  deleteLeague,
  LeagueMembership,
} from "@/lib/session-restore";
import {
  resolveSportScope,
  setSportScope,
  syncSportScopeToActiveLeague,
} from "@/lib/sport-room-scope";
import { getSportPack, normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import {
  loadMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  updateMyDisplayName,
  lockMyBirthdayOnce,
  hydrateBirthdayFromCloud,
} from "@/lib/profile";
import { isAppCreator, withCreatorFlag } from "@/lib/creator";
import { isViewAsPlayer, setViewAsPlayer } from "@/lib/view-as-player";
import FeedbackForm from "@/components/FeedbackForm";
import OwnershipNotice from "@/components/OwnershipNotice";
import { isGuestMode } from "@/lib/guest-mode";
import { getPlayerBadges, withPermanentBadges } from "@/lib/badges";
import {
  listEquipableTitlesFromBadges,
  titleVibeLabel,
  type EquipableTitleOption,
} from "@/lib/equipable-titles";
import {
  getLocalEquippedBadgeId,
  setMyEquippedTitle,
  syncMyEquippedTitleFromCloud,
} from "@/lib/equipped-title-store";
import { isChaosTitleLocked } from "@/lib/chaos-mode";
import {
  PROFILE_BORDER_CATALOG,
  getActiveSeasonThemeId,
  isBorderUnlocked,
  type ProfileBorderDef,
} from "@/lib/profile-borders";
import {
  getLocalEquippedBorderId,
  setMyEquippedBorder,
  syncMyBorderFromCloud,
} from "@/lib/profile-border-store";
import { loadLeaguePlayers } from "@/lib/cloud";
import type { Player } from "@/lib/types";
import { getPlayerBirthday } from "@/lib/easter-eggs";
import LeagueMembershipCard from "@/components/LeagueMembershipCard";
import { FEEDBACK_TO_EMAIL } from "@/components/FeedbackForm";

export default function AccountPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [leagueSportScope, setLeagueSportScope] = useState<SportId>("cfb");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState("");
  /** Cloud hard-lock once set — no self-serve edit */
  const [birthdayLocked, setBirthdayLocked] = useState(false);
  const [birthdayBusy, setBirthdayBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [fullRoom, setFullRoom] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playerView, setPlayerView] = useState(false);
  const [canPreviewPlayer, setCanPreviewPlayer] = useState(false);
  const [titleOptions, setTitleOptions] = useState<EquipableTitleOption[]>(
    []
  );
  const [equippedBadgeId, setEquippedBadgeId] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [equippedBorderId, setEquippedBorderId] = useState<string>("plain");
  const [borderBusy, setBorderBusy] = useState(false);
  const [chaosTitleLock, setChaosTitleLock] = useState(false);

  async function reload() {
    const session = getSession();
    const league = getLeague();
    setUserId(session?.playerId || null);
    setPlayerView(isViewAsPlayer());
    setActiveId(league?.id || session?.leagueId || null);
    setChaosTitleLock(isChaosTitleLocked(session?.playerId, league?.id));
    try {
      const { wantsFullRoom } = await import("@/lib/progressive-disclosure");
      setFullRoom(wantsFullRoom(session?.playerId));
    } catch {
      setFullRoom(false);
    }
    const profile = await loadMyProfile();
    if (profile) {
      setName(profile.displayName);
      setNameDraft(profile.displayName);
      setAvatarUrl(profile.avatarUrl);
    } else {
      const n = session?.playerName || "";
      setName(n);
      setNameDraft(n);
    }
    const list = await fetchMyMemberships();
    setMemberships(list);
    const activeSport =
      list.find((m) => m.leagueId === (league?.id || session?.leagueId))
        ?.sportId || league?.sportId;
    setLeagueSportScope(
      resolveSportScope({
        membershipSportIds: list.map((m) => m.sportId || "cfb"),
        activeSportId: activeSport,
      })
    );

    // Birthday: cloud is source of truth (fixes "had to load bday again" after login)
    if (session?.playerId) {
      const cloudBday =
        profile?.birthdayMmdd ||
        (await hydrateBirthdayFromCloud(session.playerId));
      const localBday = getPlayerBirthday(session.playerId);
      const bday = cloudBday || localBday || "";
      setBirthdayDraft(bday);
      setBirthdayLocked(!!cloudBday || !!profile?.birthdayLockedAt);
      await syncMyEquippedTitleFromCloud();
      await syncMyBorderFromCloud();
      setEquippedBadgeId(getLocalEquippedBadgeId(session.playerId));
      setEquippedBorderId(
        getLocalEquippedBorderId(session.playerId) || "plain"
      );
      try {
        let peers: Player[] = [];
        try {
          peers = await loadLeaguePlayers();
        } catch {
          peers = [];
        }
        let me =
          peers.find((p) => p.id === session.playerId) ||
          ({
            id: session.playerId,
            name: session.playerName || profile?.displayName || "You",
            division: "North",
            totalPoints: 0,
            weeklyPoints: [],
            atsCorrect: 0,
            atsTotal: 0,
            currentStreak: 0,
            bestWeek: 0,
            worstWeek: 0,
            perfectWeeks: 0,
            bestBetHits: 0,
            bestBetTotal: 0,
            propHits: 0,
            propTotal: 0,
            weeksPlayed: 0,
          } as Player);
        me = withPermanentBadges(withCreatorFlag(me));
        const badges = getPlayerBadges(me, peers.length ? peers : undefined);
        setTitleOptions(listEquipableTitlesFromBadges(badges));
        setEarnedBadgeIds(
          new Set(badges.filter((b) => b.earned).map((b) => b.def.id))
        );
      } catch {
        setTitleOptions([]);
        setEarnedBadgeIds(new Set());
      }
    }
    // Any path that means "you run a league" → can preview player UI
    const runsALeague =
      isActuallyCommissioner() ||
      isActuallyOps() ||
      !!session?.isCommissioner ||
      !!session?.isDeputy ||
      list.some(
        (m) =>
          m.role === "commissioner" ||
          m.commissionerId === session?.playerId
      );
    setCanPreviewPlayer(runsALeague);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const disarm = (() => {
      try {
        const { armLoadingFailSafe } =
          require("@/lib/boot-safety") as typeof import("@/lib/boot-safety");
        return armLoadingFailSafe(setLoading, 6_000);
      } catch {
        return () => {};
      }
    })();
    void reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      disarm();
    };
  }, []);

  // Holiday borders appear/disappear with Commish season theme
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    function onTheme() {
      setThemeTick((t) => t + 1);
      try {
        const {
          getLocalEquippedBorderId,
          stripHolidayBordersIfThemeEnded,
        } = require("@/lib/profile-border-store") as typeof import("@/lib/profile-border-store");
        stripHolidayBordersIfThemeEnded();
        if (userId) {
          const id = getLocalEquippedBorderId(userId);
          if (id) setEquippedBorderId(id);
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("warroom-season-theme", onTheme);
    return () => window.removeEventListener("warroom-season-theme", onTheme);
  }, [userId]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const res = await uploadMyAvatar(file);
    setUploading(false);
    if (!res.ok) {
      setMessage(res.error || "Upload failed");
      return;
    }
    setAvatarUrl(res.avatarUrl || null);
    setMessage("Profile photo updated");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onRemovePhoto() {
    if (!confirm("Remove your profile photo?")) return;
    setUploading(true);
    setMessage(null);
    const res = await removeMyAvatar();
    setUploading(false);
    if (!res.ok) {
      setMessage(res.error || "Could not remove photo");
      return;
    }
    setAvatarUrl(null);
    setMessage("Profile photo removed");
  }

  async function onSaveName() {
    if (isGuestMode()) {
      setMessage("Exit guest demo to change a real display name.");
      return;
    }
    const next = nameDraft.trim().replace(/\s+/g, " ");
    if (!next || next === name.trim()) {
      setMessage(next === name.trim() ? "That’s already your name." : "Enter a name.");
      return;
    }
    setNameBusy(true);
    setMessage(null);
    const res = await updateMyDisplayName(next);
    setNameBusy(false);
    if (!res.ok) {
      setMessage(res.error || "Could not save name");
      return;
    }
    setName(res.displayName || next);
    setNameDraft(res.displayName || next);
    setMessage(
      `Name updated to ${res.displayName || next}. The room will see it on the board.`
    );
  }

  async function onSwitch(leagueId: string) {
    setMessage(null);
    const ok = await switchToLeague(leagueId);
    if (!ok) {
      setMessage("Could not switch leagues");
      return;
    }
    const m = memberships.find((x) => x.leagueId === leagueId);
    if (m?.sportId) {
      setSportScope(m.sportId);
      setLeagueSportScope(normalizeSportId(m.sportId));
    } else {
      syncSportScopeToActiveLeague();
    }
    setActiveId(leagueId);
    setMessage("Switched league");
    router.push("/");
    router.refresh();
  }

  const sportBuckets = useMemo(() => {
    const map = new Map<SportId, LeagueMembership[]>();
    for (const m of memberships) {
      const sid = normalizeSportId(m.sportId || "cfb");
      const arr = map.get(sid) || [];
      arr.push(m);
      map.set(sid, arr);
    }
    return [...map.entries()]
      .map(([sportId, rooms]) => ({
        sportId,
        rooms: rooms.sort((a, b) =>
          (a.leagueName || "").localeCompare(b.leagueName || "")
        ),
      }))
      .sort(
        (a, b) =>
          getSportPack(a.sportId).sortOrder - getSportPack(b.sportId).sortOrder
      );
  }, [memberships]);

  const scopedMemberships = useMemo(() => {
    if (sportBuckets.length <= 1) return memberships;
    return (
      sportBuckets.find((b) => b.sportId === leagueSportScope)?.rooms ||
      memberships
    );
  }, [memberships, sportBuckets, leagueSportScope]);

  const [leaveModal, setLeaveModal] = useState<{
    leagueId: string;
    leagueName: string;
    sportId?: string | null;
    busy: boolean;
    /** Season over — keep rewards */
    seasonFinished: boolean | null;
    /** After opening week + not finished → Blue Falcon + forfeit */
    penaltiesApply: boolean | null;
    /** Current Blue Falcon Count before this leave */
    blueFalconCount: number;
  } | null>(null);

  async function onLeave(
    leagueId: string,
    leagueName: string,
    sportId?: string | null
  ) {
    setMessage(null);
    let bf = 0;
    try {
      const { getBlueFalconCount, hydrateBlueFalconFromCloud } = await import(
        "@/lib/blue-falcon"
      );
      if (userId) {
        bf = await hydrateBlueFalconFromCloud(userId);
      } else {
        bf = getBlueFalconCount(userId);
      }
    } catch {
      bf = 0;
    }
    setLeaveModal({
      leagueId,
      leagueName,
      sportId,
      busy: false,
      seasonFinished: null,
      penaltiesApply: null,
      blueFalconCount: bf,
    });
    try {
      const {
        isLeagueSeasonFinishedForRewards,
        leaveAppliesPenalties,
      } = await import("@/lib/league-earned-ledger");
      const finished = await isLeagueSeasonFinishedForRewards(
        leagueId,
        sportId
      );
      const penalties = leaveAppliesPenalties({
        sportId,
        seasonFinished: finished,
      });
      setLeaveModal((prev) =>
        prev && prev.leagueId === leagueId
          ? {
              ...prev,
              seasonFinished: finished,
              penaltiesApply: penalties,
            }
          : prev
      );
    } catch {
      setLeaveModal((prev) =>
        prev && prev.leagueId === leagueId
          ? { ...prev, seasonFinished: false, penaltiesApply: false }
          : prev
      );
    }
  }

  async function confirmLeave() {
    if (!leaveModal) return;
    setLeaveModal({ ...leaveModal, busy: true });
    setBusyId(leaveModal.leagueId);
    const result = await leaveLeague(leaveModal.leagueId);
    setBusyId(null);
    if (!result.ok) {
      setMessage(result.error || "Could not leave");
      setLeaveModal(null);
      return;
    }
    const parts: string[] = [];
    if (result.forfeitMessage) parts.push(result.forfeitMessage);
    else if (result.forfeitedCount) {
      parts.push(`Left league — forfeited ${result.forfeitedCount} unlock(s).`);
    } else {
      parts.push("Left league");
    }
    if (
      !result.seasonFinished &&
      result.blueFalconCount != null &&
      result.blueFalconCount > 0
    ) {
      parts.push(`Blue Falcon Count: ${result.blueFalconCount}`);
    }
    setMessage(parts.join(" · "));
    setLeaveModal(null);
    await reload();
    if (getSession() === null) {
      const list = await fetchMyMemberships();
      if (list.length === 1) {
        await switchToLeague(list[0].leagueId);
        router.push("/");
      } else if (list.length === 0) {
        router.push("/join");
      }
    }
  }

  const [deleteModal, setDeleteModal] = useState<{
    leagueId: string;
    leagueName: string;
    eval: import("@/lib/league-delete-guard").LeagueDeleteEval | null;
    busy: boolean;
    /** Voluntary handoff target (never forced) */
    passToUserId: string;
  } | null>(null);

  async function onDelete(leagueId: string, leagueName: string) {
    setMessage(null);
    setBusyId(leagueId);
    try {
      const { evaluateLeagueDelete } = await import(
        "@/lib/league-delete-guard"
      );
      const eval_ = await evaluateLeagueDelete(leagueId);
      setDeleteModal({
        leagueId,
        leagueName,
        eval: eval_,
        busy: false,
        // Pre-select 1st as a suggestion only — user must still confirm
        passToUserId: eval_.firstPlace?.userId || "",
      });
    } catch {
      // Fail closed — never offer hard-delete when status is unknown
      setDeleteModal({
        leagueId,
        leagueName,
        eval: {
          canHardDelete: false,
          reason:
            "Could not check league status. Rooms with players or history cannot be deleted — pass the keys instead.",
          otherHumans: 0,
          scoredWeeks: 0,
          firstPlace: null,
          candidates: [],
        },
        busy: false,
        passToUserId: "",
      });
    }
    setBusyId(null);
  }

  async function confirmHardDelete() {
    if (!deleteModal?.eval?.canHardDelete) return;
    if (
      !confirm(
        `DELETE "${deleteModal.leagueName}" forever? This removes the league for everyone. This cannot be undone.`
      )
    )
      return;
    setDeleteModal({ ...deleteModal, busy: true });
    const result = await deleteLeague(deleteModal.leagueId);
    if (!result.ok) {
      setMessage(result.error || "Could not delete");
      setDeleteModal(null);
      return;
    }
    setMessage("League deleted");
    setDeleteModal(null);
    await reload();
    const list = await fetchMyMemberships();
    if (list.length === 1) {
      await switchToLeague(list[0].leagueId);
      router.push("/");
    } else if (list.length === 0) {
      router.push("/join");
    }
  }

  async function passKeysVoluntarily() {
    if (!deleteModal?.passToUserId) return;
    const pick =
      deleteModal.eval?.candidates.find(
        (c) => c.userId === deleteModal.passToUserId
      ) || deleteModal.eval?.firstPlace;
    setDeleteModal({ ...deleteModal, busy: true });
    const { passCommissionerForLeague } = await import(
      "@/lib/league-delete-guard"
    );
    const result = await passCommissionerForLeague(
      deleteModal.leagueId,
      deleteModal.passToUserId
    );
    if (!result.ok) {
      setMessage(result.error || "Could not pass commissioner");
      setDeleteModal({ ...deleteModal, busy: false });
      return;
    }
    setMessage(
      `Commissioner passed to ${result.newCommissionerName || pick?.name || "player"}. Room stays open — everyone can finish.`
    );
    setDeleteModal(null);
    await reload();
  }

  async function onSignOut() {
    await signOutFully();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          {/* brand crest — house identity on account */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/war-room-crest.png"
            alt="War Room Pick'Em"
            width={48}
            height={48}
            className="rounded-lg shrink-0 object-contain"
          />
      <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold mb-0.5">Account</h1>
      <p className="text-sm text-muted">
              {name ? `Signed in as ${name}` : "Manage profile, leagues, and sign out"}
            </p>
            {userId && (
              <Link
                href={`/profile/${userId}`}
                className="inline-flex items-center gap-1 mt-2 min-h-[40px] px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-sm font-bold text-primary hover:bg-primary/15 touch-manipulation"
              >
                View my profile →
              </Link>
            )}
          </div>
      </div>

        {message && (
          <div className="mb-4 text-sm text-primary border border-primary/40 rounded-lg px-3 py-2">
            {message}
          </div>
        )}

        {/* Top of Account — change name (buddy request; don't bury under titles) */}
        <section className="rounded-xl border-2 border-primary/50 bg-primary/10 p-5 mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
            Identity
          </p>
      <h2 className="font-semibold text-lg mb-1">Display name</h2>
      <p className="text-xs text-muted mb-3 leading-relaxed">
            What the room sees on standings, the board, and the Gazette. Change
            it anytime.
          </p>
      <label className="block text-xs text-muted mb-3">
            Your name
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="e.g. Mike V"
              disabled={nameBusy || isGuestMode()}
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-3 text-base text-foreground font-medium disabled:opacity-50"
            />
          </label>
      <button
            type="button"
            onClick={() => void onSaveName()}
            disabled={
              nameBusy ||
              isGuestMode() ||
              nameDraft.trim().replace(/\s+/g, " ") === name.trim() ||
              !nameDraft.trim()
            }
            className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-40 touch-manipulation"
          >
            {nameBusy ? "Saving…" : "Save name"}
          </button>
      <div className="mt-5 pt-4 border-t border-border/60">
            <p className="text-xs text-muted mb-2 leading-relaxed">
              Birthday (optional) — private. One quiet Gazette line if you open
              the app that day.{" "}
              <strong className="text-foreground/90">
                Hard lock after save
              </strong>
              : no self-serve edit or clear. Wrong date? Ticket the dev team —
              that&apos;s intentional so nobody rewrites it once they learn why
              it exists.
            </p>
            {birthdayLocked && birthdayDraft ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Locked · one-time save
                </p>
      <p className="text-lg font-mono font-bold tracking-wide text-foreground">
                  {birthdayDraft}
                </p>
      <p className="text-xs text-muted leading-relaxed">
                  Cloud remembers this after login. You can&apos;t change it
                  yourself.
                </p>
      <button
                  type="button"
                  onClick={() => {
                    const session = getSession();
                    const name = (session?.playerName || "Player").slice(0, 80);
                    const subject = `[War Room] Birthday correction — ${name}`;
                    const body = [
                      "Type: Birthday hard-lock correction",
                      `From: ${name}`,
                      session?.playerId
                        ? `User ID: ${session.playerId}`
                        : null,
                      `Current locked MM-DD: ${birthdayDraft}`,
                      "",
                      "Please change my birthday to: MM-DD (fill in)",
                      "Reason: typed wrong on first save",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    const gmail =
                      `https://mail.google.com/mail/?view=cm&fs=1&tf=1` +
                      `&to=${encodeURIComponent(FEEDBACK_TO_EMAIL)}` +
                      `&su=${encodeURIComponent(subject)}` +
                      `&body=${encodeURIComponent(body)}`;
                    window.open(gmail, "_blank", "noopener,noreferrer");
                    setMessage(
                      "Support draft opened — send it so the dev team can fix your date."
                    );
                  }}
                  className="w-full py-2.5 min-h-[44px] rounded-xl border border-amber-500/40 text-amber-100 text-sm font-semibold"
                >
                  Wrong date? Message support
                </button>
      </div>
            ) : (
              <>
                <label className="block text-xs text-muted mb-2">
                  Birthday
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="bday"
                    value={birthdayDraft}
                    onChange={(e) => {
                      // Digits only → auto MM-DD (0731 → 07-31)
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 4);
                      if (digits.length <= 2) {
                        setBirthdayDraft(digits);
                      } else {
                        setBirthdayDraft(
                          `${digits.slice(0, 2)}-${digits.slice(2)}`
                        );
                      }
                    }}
                    maxLength={5}
                    placeholder="MM-DD"
                    disabled={isGuestMode() || birthdayBusy}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-3 text-base text-foreground font-medium disabled:opacity-50 tracking-wide"
                  />
                </label>
      <button
                  type="button"
                  disabled={
                    isGuestMode() ||
                    !userId ||
                    birthdayBusy ||
                    !/^\d{2}-\d{2}$/.test(birthdayDraft.trim())
                  }
                  onClick={() => {
                    if (!userId) return;
                    setBirthdayBusy(true);
                    void lockMyBirthdayOnce(birthdayDraft.trim())
                      .then((res) => {
                        if (res.ok && res.birthdayMmdd) {
                          setBirthdayDraft(res.birthdayMmdd);
                          setBirthdayLocked(true);
                          setMessage(
                            "Birthday locked forever on your profile — private, zero points."
                          );
                          return;
                        }
                        if (res.locked && res.birthdayMmdd) {
                          setBirthdayDraft(res.birthdayMmdd);
                          setBirthdayLocked(true);
                        }
                        setMessage(res.error || "Could not lock birthday.");
                      })
                      .finally(() => setBirthdayBusy(false));
                  }}
                  className="w-full py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold disabled:opacity-40"
                >
                  {birthdayBusy ? "Locking…" : "Save & lock birthday"}
                </button>
              </>
            )}
          </div>
      </section>

        {/* Commish preview next */}
        {canPreviewPlayer && (
          <section className="rounded-xl border-2 border-warning bg-warning/15 p-5 mb-6 shadow-[0_0_24px_rgba(234,179,8,0.12)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-warning mb-1">
              Commish only
            </p>
      <h2 className="text-lg font-bold mb-1 text-warning">
              View as player
            </h2>
      <p className="text-sm text-foreground/90 mb-3 leading-relaxed">
              See the app like your 20 friends: no Commish button, no ops tools.
              Your real powers stay on — this only changes the UI.
            </p>
      <button
              type="button"
              onClick={() => {
                const next = !playerView;
                setViewAsPlayer(next);
                setPlayerView(next);
                if (next) {
                  setMessage(
                    "Player view ON — go to Home. Yellow bar exits anytime."
                  );
                  router.push("/");
                  router.refresh();
                } else {
                  // Match Nav: leave current page → Home as commissioner
                  window.location.href = "/";
                }
              }}
              className={`w-full sm:w-auto text-base px-5 py-3 rounded-xl font-bold ${
                playerView
                  ? "bg-warning text-black"
                  : "bg-warning text-black hover:opacity-90"
              }`}
            >
              {playerView ? "Exit → Home as Commish" : "Enter player view →"}
            </button>
      </section>
        )}

        <section className="rounded-xl border border-primary/35 bg-primary/10 p-5 mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
            First steps
          </p>
      <h2 className="font-semibold mb-1">Getting started</h2>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Small one-time tips appear when you need them (invite, first card,
            first picks). There is no full-screen walkthrough.
          </p>
          <button
            type="button"
            onClick={() => {
              if (isGuestMode()) {
                setMessage("Exit demo first.");
                return;
              }
              router.push("/picks");
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold"
          >
            Go to My Picks →
          </button>
        </section>
      <section className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-1">
            Nameplate
          </p>
      <h2 className="font-semibold mb-1">Equip a title</h2>
      <p className="text-xs text-muted mb-3 leading-relaxed">
            Only some achievements unlock a title.{" "}
            <span className="text-amber-200 font-semibold">Flex</span> ones flex.{" "}
            <span className="text-orange-300 font-semibold">Trash energy</span>{" "}
            ones roast you on purpose — e.g.{" "}
            <span className="text-amber-300 font-bold">Eater of Trash</span>{" "}
            <span className="text-primary font-semibold">
              {name || "Mike"}
            </span>
            . One title at a time.
          </p>
          {titleOptions.length === 0 ? (
            <p className="text-sm text-muted">
              No title unlocks yet. Championship, Toilet Bowl, streaks, dogs,
              props, and a few grind badges open the catalog.
            </p>
          ) : (
            <div className="space-y-3">
      <label className="block text-xs text-muted">
                Active title
                {chaosTitleLock && (
                  <p className="mt-1 text-xs text-orange-300 font-semibold">
                    🔥 Chaos Agent is forced this week — you can&apos;t change
                    titles until Chaos ends. You didn&apos;t pick it; the robots
                    did.
                  </p>
                )}
                <select
                  value={equippedBadgeId || ""}
                  disabled={titleBusy || chaosTitleLock}
                  onChange={async (e) => {
                    const v = e.target.value || null;
                    setTitleBusy(true);
                    setMessage(null);
                    const res = await setMyEquippedTitle(v);
                    setTitleBusy(false);
                    if (!res.ok) {
                      setMessage(res.error || "Could not save title");
                      return;
                    }
                    setEquippedBadgeId(v);
                    setMessage(
                      v
                        ? `Title equipped: ${res.label}. Shows on your name league-wide.`
                        : "Title cleared."
                    );
                  }}
                  className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground font-medium disabled:opacity-50"
                >
                  <option value="">No title (name only)</option>
                  {titleOptions.map((t) => (
                    <option key={t.badgeId} value={t.badgeId}>
                      {t.label} · {titleVibeLabel(t.vibe)}
                    </option>
                  ))}
                </select>
      </label>
              {equippedBadgeId && (
                <>
                  <p className="text-sm text-foreground">
                    Preview:{" "}
                    <span className="text-amber-300 font-black uppercase tracking-wide text-xs">
                      {titleOptions.find((t) => t.badgeId === equippedBadgeId)
                        ?.label || "Title"}
                    </span>{" "}
                    <span className="font-semibold text-primary">
                      {name || "You"}
                    </span>
      </p>
                  {titleOptions.find((t) => t.badgeId === equippedBadgeId)
                    ?.blurb && (
                    <p className="text-[11px] text-muted">
                      {
                        titleOptions.find((t) => t.badgeId === equippedBadgeId)
                          ?.blurb
                      }
                    </p>
                  )}
                </>
              )}
              <details className="text-[11px] text-muted">
      <summary className="cursor-pointer font-semibold text-foreground/80">
                  Titles you can wear ({titleOptions.length})
                </summary>
      <ul className="mt-2 space-y-1.5 border border-border rounded-lg bg-background/60 px-3 py-2 max-h-48 overflow-y-auto">
                  {titleOptions.map((t) => (
                    <li key={t.badgeId} className="flex flex-col gap-0.5">
      <span>
                        <span className="text-amber-200 font-bold">
                          {t.label}
                        </span>
      <span className="text-muted">
                          {" "}
                          · {titleVibeLabel(t.vibe)}
                        </span>
      </span>
                      <span className="text-[10px] text-muted">{t.blurb}</span>
      </li>
                  ))}
                </ul>
      </details>
            </div>
          )}
        </section>
      <section className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300 mb-1">
            Avatar ring
          </p>
      <h2 className="font-semibold mb-1">Profile border</h2>
      <p className="text-xs text-muted mb-3 leading-relaxed">
            Unlock rings with achievements. Seasonal rings sometimes show up
            when the room feels festive — nobody will announce them. They
            vanish when the theme does. Creator-only flame / forge / circuit
            stay Mike-only.
          </p>
      <div className="flex justify-center mb-4">
            <Avatar
              name={name || "You"}
              avatarUrl={avatarUrl}
              size="lg"
              userId={userId}
              borderId={equippedBorderId}
            />
      </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {PROFILE_BORDER_CATALOG.filter((b: ProfileBorderDef) => {
              void themeTick;
              // Holiday borders only appear while that theme is live — never greyed out
              if (b.unlock.kind === "holiday") {
                return isBorderUnlocked(b, {
                  userId: userId || "",
                  earnedBadgeIds,
                  seasonThemeId: getActiveSeasonThemeId(),
                });
              }
              return true;
            }).map((b: ProfileBorderDef) => {
              const seasonThemeId = getActiveSeasonThemeId();
              const unlocked =
                !!userId &&
                isBorderUnlocked(b, {
                  userId,
                  earnedBadgeIds,
                  seasonThemeId,
                });
              const active = equippedBorderId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!unlocked || borderBusy}
                  onClick={async () => {
                    if (!unlocked) return;
                    setBorderBusy(true);
                    setMessage(null);
                    const res = await setMyEquippedBorder(b.id);
                    setBorderBusy(false);
                    if (!res.ok) {
                      setMessage(res.error || "Could not equip border");
                      return;
                    }
                    setEquippedBorderId(b.id);
                    setMessage(`Border equipped: ${b.name}`);
                  }}
                  className={`text-left rounded-xl border px-2.5 py-2 transition ${
                    active
                      ? "border-primary bg-primary/15"
                      : unlocked
                        ? "border-border bg-background hover:border-primary/40"
                        : "border-border/50 bg-background/40 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
      <Avatar
                      name={name || "You"}
                      avatarUrl={avatarUrl}
                      size="sm"
                      borderId={b.id}
                      plain={false}
                    />
                    <span className="text-[11px] font-bold leading-tight">
                      {b.name}
                    </span>
      </div>
                  <p className="text-[10px] text-muted leading-snug">
                    {unlocked ? (
                      <>
                        <span className="text-primary font-semibold">
                          {b.tier}
                        </span>
                        {active ? " · equipped" : " · tap to equip"}
                      </>
                    ) : (
                      b.unlockLabel
                    )}
                  </p>
      </button>
              );
            })}
          </div>
      </section>

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <h2 className="font-semibold mb-3">Profile photo</h2>
      <div className="flex items-center gap-4">
            <Avatar
              name={name || "You"}
              avatarUrl={avatarUrl}
              size="lg"
              userId={userId}
              borderId={equippedBorderId}
            />
      <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium truncate">{name || "Player"}</p>
              {userId && (
                <Link
                  href={`/profile/${userId}`}
                  className="inline-block text-xs text-primary hover:underline font-medium"
                >
                  View your badges &amp; public profile →
                </Link>
              )}
              {userId && isAppCreator(userId) && (
                <div className="space-y-2">
      <p className="text-xs text-yellow-500 font-medium">
                    👑 The Creator legendary is active — gold on your profile, and
                    your nameplate defaults to{" "}
                    <span className="font-black uppercase">The Creator</span>{" "}
                    {name || "Mike V."}. Friends stay grey (that badge is only for
                    the person who built the app).
                  </p>
      <Link
                    href="/founder"
                    className="inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Founder Dashboard (cockpit) →
                  </Link>
      </div>
              )}
              <p className="text-xs text-muted">
                Any player can upload. JPG or PNG works best (max 2 MB after
                resize). On iPhone, avoid HEIC — use &quot;Most Compatible&quot;
                or a screenshot.
              </p>
      <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-medium disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={onRemovePhoto}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
      </div>
          </div>
      </section>

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <h2 className="font-semibold mb-1">Your leagues</h2>
      <p className="text-xs text-muted mb-3 leading-relaxed">
            Pick a sport desk first — you only see rooms for that sport. When
            baseball or soccer season hits, football stays off this list.
          </p>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && memberships.length === 0 && (
            <p className="text-sm text-muted mb-3">No leagues yet.</p>
          )}

          {sportBuckets.length >= 2 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {sportBuckets.map((b) => {
                const pack = getSportPack(b.sportId);
                const selected = b.sportId === leagueSportScope;
                return (
                  <button
                    key={b.sportId}
                    type="button"
                    onClick={() => {
                      setSportScope(b.sportId);
                      setLeagueSportScope(b.sportId);
                    }}
                    className={`inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border-2 text-sm font-bold touch-manipulation ${
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                    aria-pressed={selected}
                  >
                    <span aria-hidden>{pack.emoji}</span>
                    {pack.shortLabel}
                    <span className="text-[11px] font-semibold text-muted">
                      ({b.rooms.length})
                    </span>
      </button>
                );
              })}
            </div>
          )}

          {sportBuckets.length >= 2 && (
            <p className="text-[11px] text-muted mb-3">
              Showing{" "}
              <strong className="text-foreground">
                {getSportPack(leagueSportScope).shortLabel}
              </strong>{" "}
              rooms only.
            </p>
          )}

          <div className="space-y-3">
            {scopedMemberships.map((m) => {
              const active = m.leagueId === activeId;
              const isCommish =
                m.role === "commissioner" || m.commissionerId === userId;
              const busy = busyId === m.leagueId;
              return (
                <LeagueMembershipCard
                  key={m.leagueId}
                  membership={m}
                  userId={userId}
                  active={active}
                >
      <div className="flex flex-wrap gap-2 mt-1">
                    {!active && (
                      <button
                        type="button"
                        onClick={() => onSwitch(m.leagueId)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-medium disabled:opacity-50"
                      >
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void onLeave(m.leagueId, m.leagueName, m.sportId)
                      }
                      disabled={busy}
                      title="Leave mid-season forfeits cheevos earned in this league"
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
                    >
                      Leave
                    </button>
                    {isCommish && (
                      <button
                        type="button"
                        onClick={() => onDelete(m.leagueId, m.leagueName)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg border border-danger text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Delete league
                      </button>
                    )}
                  </div>
      </LeagueMembershipCard>
              );
            })}
          </div>
      <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/join"
              className="text-center text-sm py-2.5 rounded-lg bg-primary text-black font-medium"
            >
              Create or join another league
            </Link>
      <p className="text-xs text-muted text-center">
              Multi-sport? Use the sport chips above. Switch enters that room as
              your active desk.
            </p>
      </div>
        </section>
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Room surface</h2>
      <p className="text-xs text-muted leading-relaxed">
            New seasons start simple (Picks · Board · Locker). Depth opens as
            weeks roll. Turn this on if you already know the room and want
            everything visible now.
          </p>
      <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-border"
              checked={fullRoom}
              onChange={(e) => {
                const on = e.target.checked;
                setFullRoom(on);
                void import("@/lib/progressive-disclosure").then((pd) => {
                  pd.setWantsFullRoom(on, userId);
                });
              }}
            />
            <span className="text-sm text-foreground">
      <span className="font-semibold">Show full room</span>
      <span className="block text-xs text-muted mt-0.5">
                Gazette, News, trophies, stats — no progressive hide
              </span>
      </span>
          </label>
      </section>

        <FeedbackForm />
      <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-2">Account</h2>
      <p className="text-xs text-muted mb-3">
            Sign out on this device. Log in again with the same email and your
            remaining leagues will still be there.
          </p>
      <button
            onClick={onSignOut}
            className="w-full py-2.5 rounded-lg border border-danger text-danger text-sm hover:bg-danger/10"
          >
            Sign out / switch account
          </button>
      </section>

        <OwnershipNotice variant="full" className="mt-8 mb-4 px-2" />
      </main>

      {/* Leave league — forfeit warning popup */}
      {leaveModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="leave-league-title"
        >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-danger/50 bg-card shadow-2xl p-5 space-y-4">
            <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-danger mb-1">
                Warning · can&apos;t undo
              </p>
      <h2 id="leave-league-title" className="text-lg font-bold text-foreground">
                Leave {leaveModal.leagueName}?
              </h2>
      </div>

            {leaveModal.seasonFinished === true ? (
              <p className="text-sm text-muted leading-relaxed">
                This season looks finished. Your cheevos and hardware stay. You
                drop off the roster. Blue Falcon does not go up.
              </p>
            ) : leaveModal.penaltiesApply === false ? (
              <p className="text-sm text-muted leading-relaxed">
      <strong className="text-foreground">Opening week hasn&apos;t started yet</strong>
                {" — "}
                clean leave. No Blue Falcon. No forfeit. You can rejoin later
                with the code if a seat is open.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 space-y-2">
      <p className="text-sm font-bold text-danger">
                    Season is live (opening week has started). If you leave now:
                  </p>
      <ul className="text-sm text-foreground/90 leading-relaxed list-disc pl-5 space-y-1">
                    <li>
      <strong>Cheevos</strong> earned in this league
                    </li>
      <li>
                      <strong>Trophies / hardware</strong> from this room
                    </li>
      <li>
                      <strong>Titles</strong> unlocked here
                    </li>
      <li>
                      You leave the <strong>roster</strong>
      </li>
                  </ul>
      <p className="text-xs text-muted leading-relaxed pt-1">
                    Forfeited rewards do{" "}
                    <strong className="text-foreground">not</strong> come back
                    if you rejoin later.
                  </p>
      </div>

                <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                    Your Blue Falcon Count
                  </p>
      <p className="text-3xl font-black text-amber-200 tabular-nums">
                    {leaveModal.blueFalconCount}
                    <span className="text-base font-bold text-amber-200/80 ml-2">
                      → {leaveModal.blueFalconCount + 1}
                    </span>
      </p>
                  <p className="text-xs text-muted leading-relaxed">
      <strong className="text-foreground">Blue Falcon</strong> =
                    quitting after opening week has started — screwing the unit
                    mid-season. Public on your profile. Preseason leave does{" "}
                    <strong className="text-foreground">not</strong> count.
                  </p>
                  {leaveModal.blueFalconCount === 0 && (
                    <p className="text-xs text-amber-100/90 font-medium leading-relaxed">
                      First time after doors open? This leave makes your count{" "}
                      <strong>1</strong>.
                    </p>
                  )}
                </div>
      <p className="text-sm text-muted leading-relaxed">
                  Stay through the season to keep the fun stuff. Getting knocked
                  out of brackets is fine — walking out of the room is not.
                </p>
              </>
            )}

            <div className="flex flex-col gap-2">
      <button
                type="button"
                disabled={leaveModal.busy}
                onClick={() => void confirmLeave()}
                className="w-full min-h-[52px] rounded-xl border-2 border-danger bg-danger/15 text-danger font-bold text-sm hover:bg-danger/25 disabled:opacity-50"
              >
                {leaveModal.busy
                  ? "Leaving…"
                  : leaveModal.penaltiesApply
                    ? "I understand — leave and forfeit"
                    : "Yes, leave this league"}
              </button>
      <button
                type="button"
                disabled={leaveModal.busy}
                onClick={() => setLeaveModal(null)}
                className="w-full min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
              >
                Stay in the league
              </button>
      </div>
          </div>
      </div>
      )}

      {/* Mid-season delete blocked — keep team; voluntary pass only */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="delete-league-title"
        >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4">
            <h2 id="delete-league-title" className="text-lg font-bold">
              {deleteModal.eval?.canHardDelete
                ? `Delete ${deleteModal.leagueName}?`
                : "The league stays open"}
            </h2>

            {deleteModal.eval?.canHardDelete ? (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  This removes <strong className="text-foreground">{deleteModal.leagueName}</strong>{" "}
                  for everyone — standings, picks, the whole board. Only use this
                  Only empty solo rooms with no history. Real leagues belong to the community.
                </p>
      <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={deleteModal.busy}
                    onClick={() => void confirmHardDelete()}
                    className="w-full min-h-[48px] rounded-xl border border-danger text-danger font-bold text-sm hover:bg-danger/10 disabled:opacity-50"
                  >
                    {deleteModal.busy ? "Deleting…" : "Yes, delete empty room"}
                  </button>
      <button
                    type="button"
                    disabled={deleteModal.busy}
                    onClick={() => setDeleteModal(null)}
                    className="w-full min-h-[44px] rounded-xl border border-border text-sm font-semibold"
                  >
                    Cancel
                  </button>
      </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {deleteModal.eval?.reason}
                </p>
      <p className="text-sm text-muted leading-relaxed">
                  Getting crushed is not a delete button.{" "}
                  <strong className="text-foreground">
                    The league belongs to the community
                  </strong>
                  — not the commissioner. Nobody is forced to host. Pass the
                  keys when someone is ready. History, trophies, and Gazette stay
                  with the room. League retirement will be a community vote later
                  — never one click erase.
                </p>

                {(deleteModal.eval?.candidates?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Voluntary handoff · pick who is ready
                    </p>
      <label className="block text-xs text-muted">
                      Who jumps in?
                      <select
                        value={deleteModal.passToUserId}
                        onChange={(e) =>
                          setDeleteModal({
                            ...deleteModal,
                            passToUserId: e.target.value,
                          })
                        }
                        disabled={deleteModal.busy}
                        className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground font-medium"
                      >
                        <option value="">— Select a player —</option>
                        {deleteModal.eval!.candidates.map((c, i) => (
                          <option key={c.userId} value={c.userId}>
                            {c.name}
                            {i === 0 ? " · 1st place (suggested)" : ""} ·{" "}
                            {c.totalPoints} pts
                          </option>
                        ))}
                      </select>
      </label>
                    <p className="text-[11px] text-muted leading-relaxed">
                      1st place is only a suggestion — pick whoever agreed to
                      host. Or close this and ask the room first.
                    </p>
      </div>
                )}

                <div className="rounded-xl border border-border bg-background/60 px-4 py-3 space-y-2">
      <p className="text-xs font-bold text-foreground">
                    Tell the room someone can jump in
                  </p>
      <p className="text-xs text-muted leading-relaxed">
                    Drop a Locker Room note that the keys are available. When
                    someone says yes, pass them here or in Commissioner tools →{" "}
                    <strong className="text-foreground">Pass commissioner</strong>
                    .
                  </p>
      <Link
                    href="/commissioner"
                    onClick={async () => {
                      await switchToLeague(deleteModal.leagueId);
                      setDeleteModal(null);
                      router.push("/commissioner");
                    }}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-primary/50 bg-primary/10 px-3 text-xs font-bold text-primary"
                  >
                    Open Commissioner tools →
                  </Link>
      </div>

                <div className="flex flex-col gap-2">
                  {(deleteModal.eval?.candidates?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      disabled={deleteModal.busy || !deleteModal.passToUserId}
                      onClick={() => void passKeysVoluntarily()}
                      className="w-full min-h-[48px] rounded-xl bg-primary text-black font-bold text-sm disabled:opacity-50"
                    >
                      {deleteModal.busy
                        ? "Passing…"
                        : deleteModal.passToUserId
                          ? `Pass keys to ${
                              deleteModal.eval?.candidates.find(
                                (c) => c.userId === deleteModal.passToUserId
                              )?.name || "player"
                            }`
                          : "Select who jumps in"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={deleteModal.busy}
                    onClick={() => setDeleteModal(null)}
                    className="w-full min-h-[44px] rounded-xl border border-border text-sm font-semibold"
                  >
                    Keep my gavel · cancel
                  </button>
      </div>
              </>
            )}
          </div>
      </div>
      )}
    </div>
  );
}
