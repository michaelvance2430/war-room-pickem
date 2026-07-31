"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  OPEN_ROOM_POLL_MS,
  OPEN_ROOM_WAIT_OFFER_MS,
  claimNextOpenSeat,
  listOpenRooms,
  type OpenRoomListing,
} from "@/lib/open-room";
import { MAX_LEAGUE_PLAYERS } from "@/lib/league-limits";
import OwnershipNotice from "@/components/OwnershipNotice";

type Phase =
  | "boot"
  | "searching"
  | "seating"
  | "seated"
  | "waiting"
  | "error";

/**
 * Open-room lobby — fill one public league at a time, then the next.
 * After OPEN_ROOM_WAIT_OFFER_MS, offer to try a different open league.
 */
export default function OpenRoomPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("boot");
  const [statusLine, setStatusLine] = useState("Checking your seatbelt…");
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Player");
  const [preview, setPreview] = useState<OpenRoomListing[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [showSwitchOffer, setShowSwitchOffer] = useState(false);
  const [seatedName, setSeatedName] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const busy = useRef(false);
  const offerShown = useRef(false);
  const seatedRef = useRef(false);

  // Auth gate
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setError("Supabase is not configured.");
      setPhase("error");
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace(
          `/login?next=${encodeURIComponent("/open-room")}`
        );
        return;
      }
      setUserId(user.id);
      const meta = user.user_metadata?.display_name as string | undefined;
      setDisplayName(meta || user.email?.split("@")[0] || "Player");
      setPhase("searching");
      startedAt.current = Date.now();
    });
  }, [router]);

  const refreshPreview = useCallback(async () => {
    const { rooms } = await listOpenRooms({ excludeIds });
    setPreview(rooms.slice(0, 5));
  }, [excludeIds]);

  const tryClaim = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    setPhase((p) => (p === "seated" ? p : "seating"));
    setStatusLine("Found a room — claiming your seat…");
    try {
      const res = await claimNextOpenSeat({
        userId,
        displayName,
        excludeIds,
      });
      if (res.status === "seated") {
        seatedRef.current = true;
        setSeatedName(res.leagueName);
        setPhase("seated");
        setStatusLine(`You’re in · ${res.leagueName}`);
        setShowSwitchOffer(false);
        window.setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 900);
        return;
      }
      if (res.status === "error") {
        setError(res.error);
        setPhase("error");
        return;
      }
      // waiting
      setPhase("waiting");
      setStatusLine(res.message);
      await refreshPreview();
    } finally {
      busy.current = false;
    }
  }, [userId, displayName, excludeIds, refreshPreview, router]);

  // Elapsed timer + offer popup
  useEffect(() => {
    if (phase === "boot" || phase === "seated" || phase === "error") return;
    const t = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsedSec(sec);
      if (
        !offerShown.current &&
        Date.now() - startedAt.current >= OPEN_ROOM_WAIT_OFFER_MS
      ) {
        offerShown.current = true;
        setShowSwitchOffer(true);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [phase]);

  // Poll matchmaking (stable — don't rebind when phase flips seating↔waiting)
  useEffect(() => {
    if (!userId) return;
    seatedRef.current = false;
    void tryClaim();
    const id = window.setInterval(() => {
      if (seatedRef.current) return;
      void tryClaim();
    }, OPEN_ROOM_POLL_MS);
    return () => window.clearInterval(id);
  }, [userId, excludeIds, tryClaim]);

  function tryDifferentRoom() {
    // Skip the top listed rooms so we land on the next dude waiting to fill
    const skip = preview.slice(0, 2).map((r) => r.id);
    setExcludeIds((prev) => [...new Set([...prev, ...skip])]);
    setShowSwitchOffer(false);
    offerShown.current = false;
    startedAt.current = Date.now();
    setElapsedSec(0);
    setPhase("searching");
    setStatusLine("Looking for a different open league…");
    setError(null);
  }

  function keepWaiting() {
    setShowSwitchOffer(false);
    // Reset timer so we can offer again later
    offerShown.current = false;
    startedAt.current = Date.now();
    setElapsedSec(0);
  }

  if (phase === "boot") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading open lobby…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary text-black font-bold text-xl flex items-center justify-center mx-auto mb-3">
            WR
          </div>
          <h1 className="text-2xl font-bold">Open room lobby</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            We fill one room at a time so teams form fast — then seat the next
            person waiting. Cap {MAX_LEAGUE_PLAYERS} per room.
          </p>
        </div>

        <div className="rounded-xl border-2 border-primary/40 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            {phase !== "seated" && phase !== "error" && (
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                {phase === "seated"
                  ? "Seated"
                  : phase === "error"
                    ? "Hold up"
                    : phase === "waiting"
                      ? "Waiting"
                      : "Matching"}
              </p>
              <p className="text-sm text-foreground mt-0.5 leading-snug">
                {statusLine}
              </p>
              {phase !== "seated" && phase !== "error" && (
                <p className="text-[11px] text-muted mt-1">
                  Looking · {elapsedSec}s
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
              <p className="text-sm text-foreground leading-relaxed">{error}</p>
            </div>
          )}

          {preview.length > 0 && phase !== "seated" && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted mb-2">
                Open rooms filling now
              </p>
              <ul className="space-y-2">
                {preview.map((r, i) => (
                  <li
                    key={r.id}
                    className={`rounded-lg border px-3 py-2 text-sm flex justify-between gap-2 ${
                      i === 0
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background/40"
                    }`}
                  >
                    <span className="font-medium text-foreground truncate">
                      {i === 0 ? "→ " : ""}
                      {r.name}
                    </span>
                    <span className="text-xs text-muted shrink-0 tabular-nums">
                      {r.memberCount}/{MAX_LEAGUE_PLAYERS}
                      <span className="text-primary ml-1">
                        · {r.seatsLeft} left
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                First in line is the fullest open room — we pack that one before
                starting the next.
              </p>
            </div>
          )}

          {phase === "seated" && seatedName && (
            <p className="text-sm text-primary font-semibold text-center">
              Welcome to {seatedName}. Taking you home…
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {phase !== "seated" && (
              <button
                type="button"
                onClick={() => void tryClaim()}
                className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold touch-manipulation"
              >
                Try seat again
              </button>
            )}
            <Link
              href="/join?mode=join"
              className="w-full py-3 min-h-[48px] rounded-xl border border-border text-center text-sm font-medium text-muted hover:text-foreground touch-manipulation flex items-center justify-center"
            >
              Join with a code instead
            </Link>
            <Link
              href="/join?mode=create&open=1"
              className="w-full py-3 min-h-[48px] rounded-xl border border-primary/30 text-center text-sm font-medium text-primary touch-manipulation flex items-center justify-center"
            >
              Host an open room
            </Link>
            <Link
              href="/login"
              className="text-center text-xs text-muted py-2"
            >
              Back
            </Link>
          </div>
        </div>

        <OwnershipNotice className="mt-8" />
      </div>

      {/* Timed offer: try a different open league */}
      {showSwitchOffer && phase !== "seated" && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-room-switch-title"
        >
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
              Still looking
            </p>
            <h2
              id="open-room-switch-title"
              className="text-lg font-bold text-foreground mb-2"
            >
              Want to join a different open league?
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              You’ve been waiting a bit. We can skip the current fill line and
              try the next open room — or keep holding this seat.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={tryDifferentRoom}
                className="flex-1 py-3.5 min-h-[52px] rounded-xl bg-primary text-black font-bold touch-manipulation"
              >
                Yes — different open league
              </button>
              <button
                type="button"
                onClick={keepWaiting}
                className="flex-1 py-3.5 min-h-[52px] rounded-xl border border-border text-sm font-medium touch-manipulation"
              >
                Keep waiting here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
