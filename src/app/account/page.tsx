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
} from "@/lib/profile";
import { isAppCreator, withCreatorFlag } from "@/lib/creator";
import { isViewAsPlayer, setViewAsPlayer } from "@/lib/view-as-player";
import FeedbackForm from "@/components/FeedbackForm";
import { startPlayerTutorial } from "@/lib/player-tutorial";
import { isGuestMode } from "@/lib/guest-mode";
import { getPlayerBadges, withPermanentBadges } from "@/lib/badges";
import { listEquipableTitlesFromBadges } from "@/lib/equipable-titles";
import {
  getLocalEquippedBadgeId,
  setMyEquippedTitle,
  syncMyEquippedTitleFromCloud,
} from "@/lib/equipped-title-store";
import { loadLeaguePlayers } from "@/lib/cloud";
import type { Player } from "@/lib/types";
import type { BadgeTier } from "@/lib/types";

export default function AccountPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playerView, setPlayerView] = useState(false);
  const [canPreviewPlayer, setCanPreviewPlayer] = useState(false);
  const [titleOptions, setTitleOptions] = useState<
    { badgeId: string; label: string; tier: BadgeTier }[]
  >([]);
  const [equippedBadgeId, setEquippedBadgeId] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);

  async function reload() {
    const session = getSession();
    const league = getLeague();
    setUserId(session?.playerId || null);
    setPlayerView(isViewAsPlayer());
    setActiveId(league?.id || session?.leagueId || null);
    const profile = await loadMyProfile();
    if (profile) {
      setName(profile.displayName);
      setAvatarUrl(profile.avatarUrl);
    } else {
      setName(session?.playerName || "");
    }
    const list = await fetchMyMemberships();
    setMemberships(list);

    // Equipped name title options (earned rare+)
    if (session?.playerId) {
      await syncMyEquippedTitleFromCloud();
      setEquippedBadgeId(getLocalEquippedBadgeId(session.playerId));
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
      } catch {
        setTitleOptions([]);
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

        {/* Always first so it’s impossible to miss */}
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
            Walk the dog again: Crystal Ball → search a school → lock pick → My
            Picks → fill the card → Save. One step at a time.
          </p>
          <button
            type="button"
            onClick={() => {
              if (isGuestMode()) {
                setMessage(
                  "Guest demo uses the onboarding popup — Exit demo first for the full Crystal Ball walkthrough."
                );
                return;
              }
              startPlayerTutorial(userId || undefined);
              setMessage(
                "Tutorial restarted — follow the coach bar at the bottom."
              );
              router.push("/crystal-ball");
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold"
          >
            Run player tutorial again →
          </button>
        </section>

        <section className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-1">
            Nameplate
          </p>
          <h2 className="font-semibold mb-1">Equip a title</h2>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Earned rare / epic / legendary badges can sit in front of your name
            everywhere — e.g.{" "}
            <span className="text-amber-300 font-bold">War Room Legend</span>{" "}
            <span className="text-primary font-semibold">
              {name || "Kahmann"}
            </span>
            . One title at a time. Clear anytime.
          </p>
          {titleOptions.length === 0 ? (
            <p className="text-sm text-muted">
              No equipable titles yet. Win hardware, streaks, and rare badges —
              then they show up here.
            </p>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs text-muted">
                Active title
                <select
                  value={equippedBadgeId || ""}
                  disabled={titleBusy}
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
                      {t.label}
                      {t.tier === "legendary"
                        ? " · Legendary"
                        : t.tier === "epic"
                          ? " · Epic"
                          : " · Rare"}
                    </option>
                  ))}
                </select>
              </label>
              {equippedBadgeId && (
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
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">Profile photo</h2>
          <div className="flex items-center gap-4">
            <Avatar name={name || "You"} avatarUrl={avatarUrl} size="lg" />
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
                <p className="text-xs text-yellow-500 font-medium">
                  👑 The Creator legendary is active — gold on your profile, and
                  your nameplate defaults to{" "}
                  <span className="font-black uppercase">The Creator</span>{" "}
                  {name || "Mike V."}. Peasants stay grey.
                </p>
              )}
              {userId && !isAppCreator(userId) && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 space-y-2">
                  <p className="text-xs text-yellow-200 font-medium">
                    Your legendary creator badge is grey because live doesn&apos;t
                    know your User ID yet.
                  </p>
                  <p className="text-[11px] text-muted font-mono break-all">
                    {userId}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/15"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(userId);
                          setMessage("User ID copied — paste into Vercel env");
                        } catch {
                          setMessage("Copy failed — select the ID manually");
                        }
                      }}
                    >
                      Copy User ID
                    </button>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Vercel → Project → Settings → Environment Variables → add{" "}
                    <code className="text-foreground">
                      NEXT_PUBLIC_CREATOR_USER_IDS
                    </code>{" "}
                    = your User ID (above) → Redeploy. After that, 👑 lights gold
                    for you only; friends stay grey with the peasant roast.
                  </p>
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
      </main>
    </div>
  );
}
