"use client";

import { useState, FormEvent, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { enterGuestDemo } from "@/lib/guest-mode";
import Link from "next/link";
import {
  peekPendingJoinCode,
  stashPendingJoinCode,
} from "@/lib/commish-onboarding";
import OwnershipNotice from "@/components/OwnershipNotice";
import BrandMark from "@/components/BrandMark";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [inviteHint, setInviteHint] = useState<string | null>(null);

  // Preserve deep-link invite through login/signup
  useEffect(() => {
    const next = searchParams.get("next") || "";
    const codeMatch = next.match(/[?&]code=([A-Za-z0-9]+)/i);
    const code =
      codeMatch?.[1]?.toUpperCase() ||
      searchParams.get("code")?.toUpperCase() ||
      peekPendingJoinCode();
    if (code) {
      stashPendingJoinCode(code);
      setInviteHint(code);
      // Real invite → default to signup (new friends) not guest demo
      setMode("signup");
    }
  }, [searchParams]);

  function afterAuthPath(): string {
    const next = searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    const code = peekPendingJoinCode();
    if (code) return `/join?code=${encodeURIComponent(code)}`;
    return "/";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (!hasSupabaseConfig()) {
        throw new Error("Supabase is not configured on this deployment.");
      }
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.split("@")[0] },
          },
        });
        if (signError) throw signError;
        if (data.session) {
          router.push(afterAuthPath());
          router.refresh();
        } else {
          setMessage("Check your email to confirm, then log in.");
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;

        if (rememberMe) {
          localStorage.setItem("warroom-remember", "1");
        } else {
          localStorage.removeItem("warroom-remember");
        }

        router.push(afterAuthPath());
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-background border border-border rounded-xl px-4 py-3.5 text-base min-h-[52px] touch-manipulation focus:outline-none focus:border-primary";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
      <div className="flex justify-center mb-3">
            <BrandMark size={96} variant="force" className="rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.2)]" />
      </div>
          <h1 className="text-2xl font-bold">War Room Pick&apos;Em</h1>
          {inviteHint ? (
            <div className="mt-3 rounded-xl border-2 border-primary/50 bg-primary/10 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                You&apos;re invited
              </p>
      <p className="text-sm text-foreground mt-1 leading-snug">
                Code{" "}
                <span className="font-mono font-bold tracking-[0.2em] text-primary text-lg">
                  {inviteHint}
                </span>
      </p>
              <p className="text-xs text-muted mt-1">
                Create an account (or log in) — you&apos;ll land in that league.
              </p>
      </div>
          ) : (
            <p className="text-sm text-muted mt-2">
              {mode === "login"
                ? "Log in to your league"
                : "Create an account to host or join"}
            </p>
          )}
        </div>

        {/* Four doors in — host, code, open lobby, demo */}
        {!inviteHint && (
          <div className="mb-5 grid grid-cols-1 gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary text-center mb-1">
              How do you want in?
            </p>
      <Link
              href="/join?mode=create"
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation flex items-center justify-center"
            >
              Commissioner — create league
            </Link>
      <Link
              href="/join?mode=join"
              className="w-full py-3.5 min-h-[52px] rounded-xl border border-border bg-card text-sm font-bold touch-manipulation flex items-center justify-center"
            >
              Join with code
            </Link>
      <Link
              href="/open-room"
              className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-primary/40 bg-primary/10 text-sm font-bold touch-manipulation flex items-center justify-center"
            >
              Join open room
            </Link>
      <button
              type="button"
              disabled={guestLoading || loading}
              onClick={() => {
                setError(null);
                setGuestLoading(true);
                const res = enterGuestDemo();
                setGuestLoading(false);
                if (!res.ok) {
                  setError(res.error || "Could not start guest demo");
                  return;
                }
                router.push("/");
                router.refresh();
              }}
              className="w-full py-3.5 min-h-[52px] rounded-xl border border-border text-sm font-medium text-muted touch-manipulation disabled:opacity-50"
            >
              {guestLoading ? "Loading demo…" : "Guest demo (bots, no account)"}
            </button>
      <p className="text-[11px] text-muted text-center leading-relaxed px-1">
              Open lobby fills one room at a time. Full rooms get a friendly
              “no seats” bounce — not a lecture. Log in below if you need an
              account first.
            </p>
      </div>
        )}

        {/* Auth form FIRST when invited; always big phone fields */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-5 space-y-4"
        >
          {mode === "signup" && (
            <div>
      <label className="text-xs text-muted block mb-1.5 font-medium">
                Your name in the league
              </label>
      <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="What friends call you"
                autoComplete="nickname"
              />
            </div>
          )}
          <div>
      <label className="text-xs text-muted block mb-1.5 font-medium">
              Email
            </label>
      <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              inputMode="email"
            />
          </div>
      <div>
            <label
              className="text-xs text-muted block mb-1.5 font-medium"
              htmlFor="warroom-password"
            >
              Password
            </label>
      <div className="relative">
              <input
                id="warroom-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
      </div>
            {mode === "signup" && (
              <p className="text-[11px] text-muted mt-1">At least 6 characters</p>
            )}
          </div>

          {mode === "login" && (
            <label className="flex items-center gap-3 text-sm text-muted cursor-pointer select-none min-h-[44px]">
      <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              Remember me on this phone
            </label>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold disabled:opacity-50 touch-manipulation"
          >
            {loading
              ? "…"
              : inviteHint
                ? mode === "login"
                  ? "Log in & join league"
                  : "Sign up & join league"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
          </button>
      <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
            }}
            className="w-full text-sm text-muted min-h-[44px] touch-manipulation"
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
      </form>

        {inviteHint && (
          <p className="text-center text-[11px] text-muted mt-4 leading-relaxed">
            Guest demo is off while you have an invite — we don&apos;t want you
            in the wrong room.
          </p>
        )}

        <p className="text-center text-xs text-muted mt-4">
      <Link href="/" className="hover:text-foreground min-h-[44px] inline-flex items-center">
            Back
          </Link>
      </p>

        <OwnershipNotice variant="full" className="mt-8 px-2" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
      </Suspense>
  );
}
