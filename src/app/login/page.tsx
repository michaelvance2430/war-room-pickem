"use client";

import { useState, FormEvent, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  peekPendingJoinCode,
  stashPendingJoinCode,
} from "@/lib/commish-onboarding";
import BrandMark from "@/components/BrandMark";
import { purgeRetiredGuestSession } from "@/lib/guest-mode";
import { safeWarRoomPath, warRoomAuthReturnUrl } from "@/lib/native-contract";

function LoginPageInner() {
  const searchParams = useSearchParams();
  /** Primary path: log in. Create account is secondary. */
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Invite codes stay in the background for post-auth routing only — never UI.
  // Purge leftover guest tour residue.
  useEffect(() => {
    try {
      const purged = purgeRetiredGuestSession();
      if (purged) {
        setMode("signup");
        setMessage("Create an account to get into a real room.");
      }
    } catch {
      /* ignore */
    }
    const modeParam = searchParams.get("mode");
    if (modeParam === "signup" || modeParam === "join") {
      setMode("signup");
    } else if (modeParam === "login") {
      setMode("login");
    }
    if (searchParams.get("reset") === "ok") {
      setMode("login");
      setMessage("Password updated. Log in with your new password.");
    }
    const next = searchParams.get("next") || "";
    const codeMatch = next.match(/[?&]code=([A-Za-z0-9]+)/i);
    const code =
      codeMatch?.[1]?.toUpperCase() ||
      searchParams.get("code")?.toUpperCase() ||
      peekPendingJoinCode();
    if (code) {
      stashPendingJoinCode(code);
    }
  }, [searchParams]);

  /**
   * Post-auth land. Sport-aware allegiance is required only after the product
   * knows the league sport (join restore / hub / league-build) — never force
   * CFB declare as a universal default on signup.
   */
  function afterAuthPath(_opts?: { isNewSignup?: boolean }): string {
    const nextRaw = searchParams.get("next");
    const next = nextRaw ? safeWarRoomPath(nextRaw, "") : null;
    const code = peekPendingJoinCode();
    // Invite/join destination first; no-league users go Home → join/start.
    // Allegiance (NFL or CFB) is gated when that sport becomes active.
    return (
      next ||
      (code ? `/join?code=${encodeURIComponent(code)}` : "/")
    );
  }

  async function handleForgotPassword() {
    setError(null);
    setMessage(null);
    const addr = email.trim();
    if (!addr) {
      setError("Enter your email above, then tap Forgot password.");
      return;
    }
    if (!hasSupabaseConfig()) {
      setError("Supabase is not configured on this deployment.");
      return;
    }
    setResetBusy(true);
    try {
      const supabase = createClient();
      // Must be allow-listed in Supabase Auth → URL configuration
      const redirectTo = warRoomAuthReturnUrl("/reset-password");
      try {
        sessionStorage.setItem("warroom-password-recovery", "1");
      } catch {
        /* ignore */
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        addr,
        { redirectTo }
      );
      if (resetError) throw resetError;
      setMessage(
        "Check your email for a reset link. It opens a page to set a new password."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setResetBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    /** Never leave the button spinning forever on flaky auth. */
    const AUTH_MS = 12_000;
    function withAuthTimeout<T>(p: PromiseLike<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        const t = window.setTimeout(() => {
          reject(
            new Error(
              "Login is taking too long. Check connection and try again."
            )
          );
        }, AUTH_MS);
        Promise.resolve(p).then(
          (v) => {
            window.clearTimeout(t);
            resolve(v);
          },
          (err) => {
            window.clearTimeout(t);
            reject(err);
          }
        );
      });
    }

    /** One hard open after auth so session storage is fully settled. */
    function landAfterAuth(opts?: { isNewSignup?: boolean }) {
      const path = afterAuthPath(opts);
      try {
        window.location.assign(path);
      } catch {
        window.location.href = path;
      }
    }

    let navigating = false;
    try {
      if (!hasSupabaseConfig()) {
        throw new Error("Supabase is not configured on this deployment.");
      }
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: signError } = await withAuthTimeout(
          supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: displayName.trim() || email.split("@")[0],
              },
            },
          })
        );
        if (signError) throw signError;
        if (data.session) {
          navigating = true;
          landAfterAuth({ isNewSignup: true });
          return;
        }
        setMessage("Check your email to confirm, then log in.");
      } else {
        const { error: loginError } = await withAuthTimeout(
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        );
        if (loginError) throw loginError;

        navigating = true;
        // Existing accounts: Home card handles missing allegiance
        landAfterAuth({ isNewSignup: false });
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-background border border-border rounded-xl px-4 py-3.5 text-base min-h-[52px] touch-manipulation focus:outline-none focus:border-primary";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <BrandMark
              size={80}
              variant="force"
              className="rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.2)]"
            />
          </div>
          <h1 className="text-2xl font-bold">War Room Pick&apos;Em</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Weekly pick&apos;em with friends. One card. Confidence. Trash talk
            optional.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-5 space-y-4"
        >
          {mode === "signup" && (
            <div>
              <label className="text-xs text-muted block mb-1.5 font-medium">
                Display name
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
                minLength={8}
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
              <p className="text-[11px] text-muted mt-1">
                At least 8 characters
              </p>
            )}
          </div>

          {mode === "login" && (
            <div className="flex items-center justify-end min-h-[44px]">
              <button
                type="button"
                disabled={resetBusy || loading}
                onClick={() => void handleForgotPassword()}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 touch-manipulation min-h-[44px] px-1"
              >
                {resetBusy ? "Sending…" : "Forgot password?"}
              </button>
            </div>
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
              : mode === "login"
                ? "LOG IN"
                : "CREATE ACCOUNT"}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setMessage(null);
              }}
              className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-primary/40 bg-primary/10 text-sm font-extrabold text-foreground touch-manipulation"
            >
              CREATE ACCOUNT
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setMessage(null);
              }}
              className="w-full text-sm font-semibold text-muted hover:text-foreground min-h-[44px] touch-manipulation"
            >
              Already have an account? Log in
            </button>
          )}
        </div>
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
