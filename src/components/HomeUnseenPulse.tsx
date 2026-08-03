"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EVENT_LOCKER_SEEN,
  EVENT_ANNOUNCEMENTS_SEEN,
  loadRoomUnseen,
} from "@/lib/room-unseen";

/**
 * Home: how many unseen announcements + locker posts.
 * Each count is a link to that page. Locker clears on walk-in (no extra taps).
 * News clears when /announcements is opened and reads are stamped.
 */
export default function HomeUnseenPulse() {
  const [announcements, setAnnouncements] = useState<number | null>(null);
  const [locker, setLocker] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const u = await loadRoomUnseen();
        if (cancelled) return;
        setAnnouncements(u.announcements);
        setLocker(u.locker);
      } catch {
        if (!cancelled) {
          setAnnouncements(0);
          setLocker(0);
        }
      }
    }
    void load();
    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    function onLockerSeen() {
      setLocker(0);
    }
    function onAnnouncementsSeen() {
      setAnnouncements(0);
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
    window.addEventListener(EVENT_ANNOUNCEMENTS_SEEN, onAnnouncementsSeen);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT_LOCKER_SEEN, onLockerSeen);
      window.removeEventListener(EVENT_ANNOUNCEMENTS_SEEN, onAnnouncementsSeen);
    };
  }, []);

  const loading = announcements === null || locker === null;
  const a = announcements ?? 0;
  const l = locker ?? 0;
  const total = a + l;

  return (
    <section
      className="mb-6 rounded-2xl border border-border/80 bg-black/45 backdrop-blur-sm overflow-hidden"
      aria-label="Unseen activity"
    >
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          While you were out
        </p>
        {!loading && total === 0 && (
          <p className="text-[11px] text-muted">All caught up</p>
        )}
        {!loading && total > 0 && (
          <p className="text-[11px] text-primary font-semibold">
            {total} new
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-border/60">
        <Link
          href="/announcements"
          className={`px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 transition hover:bg-primary/10 ${
            a > 0 ? "bg-primary/5" : ""
          }`}
        >
          <div>
            <p className="text-xs uppercase tracking-wider text-muted mb-0.5">
              News
            </p>
            <p className="text-sm font-semibold text-foreground">
              Announcements
            </p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-black tabular-nums leading-none ${
                a > 0 ? "text-primary" : "text-muted/50"
              }`}
            >
              {loading ? "–" : a > 99 ? "99+" : a}
            </span>
            <span className="text-[11px] text-muted">unseen</span>
          </div>
        </Link>

        <Link
          href="/locker-room"
          className={`px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 transition hover:bg-orange-500/10 ${
            l > 0 ? "bg-orange-500/5" : ""
          }`}
        >
          <div>
            <p className="text-xs uppercase tracking-wider text-orange-300/70 mb-0.5">
              Noise
            </p>
            <p className="text-sm font-semibold text-orange-200">
              Locker Room
            </p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-black tabular-nums leading-none ${
                l > 0 ? "text-orange-300" : "text-muted/50"
              }`}
            >
              {loading ? "–" : l > 99 ? "99+" : l}
            </span>
            <span className="text-[11px] text-muted">
              {l === 1 ? "new take" : "new takes"}
            </span>
          </div>
        </Link>
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted leading-relaxed">
        Open the board to catch up — counts clear when you walk in. No extra
        taps.
      </p>
    </section>
  );
}
