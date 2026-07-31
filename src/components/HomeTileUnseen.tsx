"use client";

import { useEffect, useState } from "react";
import {
  countUnreadAnnouncements,
  countUnseenLockerPosts,
} from "@/lib/room-unseen";

/** Small count pill for Home tiles. */
export default function HomeTileUnseen({
  kind,
}: {
  kind: "announcements" | "locker";
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const count =
        kind === "announcements"
          ? await countUnreadAnnouncements()
          : await countUnseenLockerPosts();
      if (!cancelled) setN(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  if (n <= 0) return null;

  return (
    <span
      className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center tabular-nums ${
        kind === "locker"
          ? "bg-orange-400 text-black"
          : "bg-primary text-black"
      }`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
