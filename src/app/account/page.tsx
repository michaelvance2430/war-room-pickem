"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import { getSession, getLeague } from "@/lib/league";
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

  async function reload() {
    const session = getSession();
    const league = getLeague();
    setUserId(session?.playerId || null);
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
        <p className="text-sm text-muted mb-6">
          {name ? `Signed in as ${name}` : "Manage profile, leagues, and sign out"}
        </p>

        {message && (
          <div className="mb-4 text-sm text-primary border border-primary/40 rounded-lg px-3 py-2">
            {message}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">Profile photo</h2>
          <div className="flex items-center gap-4">
            <Avatar name={name || "You"} avatarUrl={avatarUrl} size="lg" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium truncate">{name || "Player"}</p>
              <p className="text-xs text-muted">
                JPG, PNG, or WebP. We resize to a square-friendly size (max 2 MB).
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
