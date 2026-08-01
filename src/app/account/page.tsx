"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
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
  loadMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  updateMyDisplayName,
} from "@/lib/profile";
import { isAppCreator, withCreatorFlag } from "@/lib/creator";
import { isViewAsPlayer, setViewAsPlayer } from "@/lib/view-as-player";
import FeedbackForm from "@/components/FeedbackForm";
import OwnershipNotice from "@/components/OwnershipNotice";
import {
  startFullPlayerTutorial,
  startPicksOnlyTutorial,
} from "@/lib/player-tutorial";
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
import {
  getPlayerBirthday,
  setPlayerBirthday,
} from "@/lib/easter-eggs";

export default function AccountPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
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

    // Equipped name title + border (from earned badges)
    if (session?.playerId) {
      const bday = getPlayerBirthday(session.playerId);
      setBirthdayDraft(bday || "");
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
    reload();
  }, []);

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
    setActiveId(leagueId);
    setMessage("Switched league");
    router.push("/");
    router.refresh();
  }

  async function onLeave(leagueId: string, leagueName: string) {
    if (
      !confirm(
        `Leave "${leagueName}"? You can join again later with the code if someone still has it.`
      )
    )
      return;
    setBusyId(leagueId);
    setMessage(null);
    const result = await leaveLeague(leagueId);
    setBusyId(null);
    if (!result.ok) {
      setMessage(result.error || "Could not leave");
      return;
    }
    setMessage("Left league");
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

  async function onDelete(leagueId: string, leagueName: string) {
    if (
      !confirm(
        `DELETE "${leagueName}" forever? This removes the league for everyone. This cannot be undone.`
      )
    )
      return;
    if (!confirm("Type-level confirm: really delete this league?")) return;
    setBusyId(leagueId);
    setMessage(null);
    const result = await deleteLeague(leagueId);
    setBusyId(null);
    if (!result.ok) {
      setMessage(result.error || "Could not delete");
      return;
    }
    setMessage("League deleted");
    await reload();
    const list = await fetchMyMemberships();
    if (list.length === 1) {
      await switchToLeague(list[0].leagueId);
      router.push("/");
    } else if (list.length === 0) {
      router.push("/join");
    }
  }

  async function onSignOut() {
    await signOutFully();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Account</h1>
        <p className="text-sm text-muted mb-4">
          {name ? `Signed in as ${name}` : "Manage profile, leagues, and sign out"}
        </p>

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
              Birthday (optional, MM-DD) — private. One quiet Gazette line if
              you open the app that day. No points. Clear the field to remove.
            </p>
            <label className="block text-xs text-muted mb-2">
              Birthday
              <input
                type="text"
                value={birthdayDraft}
                onChange={(e) => setBirthdayDraft(e.target.value)}
                maxLength={5}
                placeholder="MM-DD"
                disabled={isGuestMode()}
                className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-3 text-base text-foreground font-medium disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              disabled={isGuestMode() || !userId}
              onClick={() => {
                if (!userId) return;
                const raw = birthdayDraft.trim();
                if (!raw) {
                  setPlayerBirthday(userId, null);
                  setBirthdayDraft("");
                  setMessage("Birthday cleared.");
                  return;
                }
                if (!/^\d{2}-\d{2}$/.test(raw)) {
                  setMessage("Use MM-DD (e.g. 07-31).");
                  return;
                }
                const [mm, dd] = raw.split("-").map(Number);
                if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
                  setMessage("That date looks off.");
                  return;
                }
                setPlayerBirthday(userId, raw);
                setMessage("Birthday saved — private, zero points.");
              }}
              className="w-full py-2.5 min-h-[44px] rounded-xl border border-border text-sm font-semibold disabled:opacity-40"
            >
              Save birthday
            </button>
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
          <h2 className="font-semibold mb-1">Player tutorial</h2>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Default path is My Picks only (the weekly job). Crystal Ball is
            optional power — full walkthrough includes it.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                if (isGuestMode()) {
                  setMessage(
                    "Guest demo uses the onboarding popup — Exit demo first for the real walkthrough."
                  );
                  return;
                }
                startPicksOnlyTutorial(userId || undefined);
                setMessage(
                  "Picks tutorial restarted — follow the coach bar at the bottom."
                );
                router.push("/picks");
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold"
            >
              Run picks tutorial →
            </button>
            <button
              type="button"
              onClick={() => {
                if (isGuestMode()) {
                  setMessage(
                    "Guest demo uses the onboarding popup — Exit demo first for the full Crystal Ball walkthrough."
                  );
                  return;
                }
                startFullPlayerTutorial(userId || undefined);
                setMessage(
                  "Full tutorial (Crystal Ball + picks) — follow the coach bar."
                );
                router.push("/crystal-ball");
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-card-hover"
            >
              Full walkthrough (+ Crystal Ball)
            </button>
          </div>
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
            Unlock rings with achievements. Easy badges = simple borders.
            Legendary hardware = loud rings. Pick one to equip.
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
            {PROFILE_BORDER_CATALOG.map((b: ProfileBorderDef) => {
              const unlocked =
                !!userId &&
                isBorderUnlocked(b, {
                  userId,
                  earnedBadgeIds,
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
          <h2 className="font-semibold mb-3">Your leagues</h2>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && memberships.length === 0 && (
            <p className="text-sm text-muted mb-3">No leagues yet.</p>
          )}
          <div className="space-y-3">
            {memberships.map((m) => {
              const active = m.leagueId === activeId;
              const isCommish =
                m.role === "commissioner" || m.commissionerId === userId;
              const busy = busyId === m.leagueId;
              return (
                <div
                  key={m.leagueId}
                  className={`rounded-lg border px-3 py-3 ${
                    active ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium text-sm">{m.leagueName}</div>
                      <div className="text-xs text-muted">
                        {m.code}
                        {isCommish ? " · Commissioner" : ""}
                        {active ? " · Active" : ""}
                      </div>
                    </div>
                    {!active && (
                      <button
                        onClick={() => onSwitch(m.leagueId)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-medium disabled:opacity-50"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onLeave(m.leagueId, m.leagueName)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-50"
                    >
                      Leave
                    </button>
                    {isCommish && (
                      <button
                        onClick={() => onDelete(m.leagueId, m.leagueName)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg border border-danger text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Delete league
                      </button>
                    )}
                  </div>
                </div>
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
              You can be in more than one league. Use Switch to change the active
              one.
            </p>
          </div>
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
    </div>
  );
}
