"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { getSession, getLeague } from "@/lib/league";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { markEngagement } from "@/lib/engagement";

type Announcement = {
  id: string;
  league_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  author_name?: string;
  is_unread?: boolean;
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [isCommish, setIsCommish] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function loadAll() {
    setError(null);

    if (!hasSupabaseConfig()) {
      setError("Supabase keys missing on this deployment.");
      setLoading(false);
      return;
    }

    const session = getSession();
    const league = getLeague();

    if (!session?.playerId || !league?.id) {
      router.replace("/");
      return;
    }

    setIsCommish(!!session.isCommissioner);
    setPlayerId(session.playerId);
    setLeagueId(league.id);

    const supabase = createClient();

    const { data: rows, error: listError } = await supabase
      .from("announcements")
      .select("id, league_id, author_id, title, body, created_at")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false });

    if (listError) {
      setError(
        listError.message.includes("does not exist") ||
          listError.message.includes("schema cache")
          ? "Announcements tables are not set up yet. Run supabase/announcements.sql in the Supabase SQL Editor."
          : listError.message
      );
      setItems([]);
      setLoading(false);
      return;
    }

    const list = (rows || []) as Announcement[];
    if (list.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(list.map((a) => a.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", authorIds);

    const nameById = new Map(
      (profiles || []).map((p: { id: string; display_name: string }) => [
        p.id,
        p.display_name,
      ])
    );

    const ids = list.map((a) => a.id);
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", session.playerId)
      .in("announcement_id", ids);

    const readIds = new Set((reads || []).map((r) => r.announcement_id));

    const enriched = list.map((a) => ({
      ...a,
      author_name: nameById.get(a.author_id) || "Commissioner",
      is_unread: !readIds.has(a.id),
    }));

    setItems(enriched);
    setLoading(false);

    // Mark all currently unread as read so the nav badge clears
    const unreadIds = enriched.filter((a) => a.is_unread).map((a) => a.id);
    if (unreadIds.length > 0) {
      const rowsToInsert = unreadIds.map((announcement_id) => ({
        announcement_id,
        user_id: session.playerId,
      }));
      await supabase
        .from("announcement_reads")
        .upsert(rowsToInsert, { onConflict: "announcement_id,user_id" });
    }
  }

  useEffect(() => {
    loadAll();
    const id = getSession()?.playerId;
    if (id) markEngagement(id, "opened_announcements");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!isCommish || !playerId || !leagueId) return;

    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setPostError("Title and message are required.");
      return;
    }

    setPosting(true);
    setPostError(null);
    setPosted(false);

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("announcements").insert({
        league_id: leagueId,
        author_id: playerId,
        title: t,
        body: b,
      });

      if (insertError) throw insertError;

      setTitle("");
      setBody("");
      setPosted(true);
      setTimeout(() => setPosted(false), 2000);
      setLoading(true);
      await loadAll();
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  function formatWhen(iso: string) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-muted">
            League news from the commissioner. Opening this page marks them as read.
          </p>
        </div>

        {isCommish && (
          <form
            onSubmit={handlePost}
            className="rounded-xl border border-border bg-card p-5 mb-6 space-y-3"
          >
            <h2 className="font-semibold">Post announcement</h2>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              maxLength={120}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message to the league…"
              rows={4}
              maxLength={4000}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-y"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={posting}
                className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dim disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post"}
              </button>
              {posted && <span className="text-sm text-primary">Posted</span>}
              {postError && (
                <span className="text-sm text-danger">{postError}</span>
              )}
            </div>
          </form>
        )}

        {loading && (
          <p className="text-sm text-muted py-8 text-center">Loading…</p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted">No announcements yet.</p>
            {isCommish && (
              <p className="text-xs text-muted mt-1">
                Use the form above to post the first one.
              </p>
            )}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border bg-card p-5 ${
                  a.is_unread
                    ? "border-primary/50"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.is_unread && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-primary" />
                    )}
                    <h2 className="font-semibold truncate">{a.title}</h2>
                  </div>
                  <time className="shrink-0 text-xs text-muted">
                    {formatWhen(a.created_at)}
                  </time>
                </div>
                <p className="text-sm text-muted mb-3">
                  {a.author_name}
                  {a.is_unread && (
                    <span className="ml-2 text-primary text-xs font-medium">
                      New
                    </span>
                  )}
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {a.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
