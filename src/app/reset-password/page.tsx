"use client";

/**
 * Password recovery landing — email link from Supabase lands here.
 * The browser client does not auto-detect auth codes because league invites
 * also use ?code=. This page alone exchanges password-recovery credentials.
 */

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";

function ResetPasswordInner() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setError("Supabase is not configured on this deployment.");
      setChecking(false);
      return;
    }

    const supabase = createClient();
    let settled = false;

    function markReady() {
      if (settled) return;
      settled = true;
      setReady(true);
      setChecking(false);
      setError(null);
    }

    function markFailed(msg: string) {
      if (settled) return;
      settled = true;
      setReady(false);
      setChecking(false);
      setError(msg);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        markReady();
        return;
      }
      // PKCE / some clients fire SIGNED_IN after recovery exchange
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session &&
        typeof window !== "undefined"
      ) {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        const looksLikeRecovery =
          hash.includes("type=recovery") ||
          search.includes("type=recovery") ||
          sessionStorage.getItem("warroom-password-recovery") === "1";
        if (looksLikeRecovery || event === "PASSWORD_RECOVERY") {
          try {
            sessionStorage.setItem("warroom-password-recovery", "1");
          } catch {
            /* ignore */
          }
          markReady();
        }
      }
    });

    // Exchange recovery credentials only on this dedicated route. Never treat
    // an unrelated existing login session as proof of password recovery.
    void (async () => {
      try {
        const currentUrl = new URL(window.location.href);
        const recoveryCode = currentUrl.searchParams.get("code");
        const hash = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (recoveryCode) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(recoveryCode);
          if (exchangeError || !data.session) {
            markFailed(
              "This reset link is invalid or expired. Request a new one from Log in."
            );
            return;
          }
          sessionStorage.setItem("warroom-password-recovery", "1");
          window.history.replaceState({}, "", "/reset-password");
          markReady();
          return;
        }

        if (accessToken && refreshToken && hash.get("type") === "recovery") {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError || !data.session) {
            markFailed(
              "This reset link is invalid or expired. Request a new one from Log in."
            );
            return;
          }
          sessionStorage.setItem("warroom-password-recovery", "1");
          window.history.replaceState({}, "", "/reset-password");
          markReady();
          return;
        }

        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !data.session) {
          markFailed(
            "This reset link is invalid or expired. Request a new one from Log in."
          );
          return;
        }
        if (sessionStorage.getItem("warroom-password-recovery") === "1") {
          markReady();
          return;
        }
        markFailed(
          "This reset link is invalid or expired. Request a new one from Log in."
        );
      } catch {
        markFailed(
          "Could not open the reset link. Request a new one from Log in."
        );
      }
    })();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      try {
        sessionStorage.removeItem("warroom-password-recovery");
      } catch {
        /* ignore */
      }

      // Clean recovery session — they should log in with the new password
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }

      setDone(true);
      window.setTimeout(() => {
        try {
          window.location.assign("/login?mode=login&reset=ok");
        } catch {
          window.location.href = "/login?mode=login&reset=ok";
        }
      }, 900);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not update password"
      );
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
            <BrandMark
              size={80}
              variant="force"
              className="rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.2)]"
            />
          </div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Choose something you&apos;ll remember — at least 8 characters.
          </p>
        </div>

        {checking && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">Checking your reset link…</p>
          </div>
        )}

        {!checking && !ready && !done && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 text-center">
            <p className="text-sm text-danger leading-relaxed">
              {error ||
                "This reset link is invalid or expired. Request a new one from Log in."}
            </p>
            <Link
              href="/login?mode=login"
              className="inline-flex items-center justify-center w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-black text-sm font-extrabold touch-manipulation"
            >
              Back to Log in
            </Link>
          </div>
        )}

        {done && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-5 text-center space-y-2">
            <p className="text-sm font-bold text-foreground">Password updated</p>
            <p className="text-xs text-muted">Taking you to Log in…</p>
          </div>
        )}

        {ready && !done && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-xl border border-border bg-card p-5 space-y-4"
          >
            <div>
              <label
                className="text-xs text-muted block mb-1.5 font-medium"
                htmlFor="new-password"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label
                className="text-xs text-muted block mb-1.5 font-medium"
                htmlFor="confirm-password"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold disabled:opacity-50 touch-manipulation"
            >
              {loading ? "…" : "SAVE NEW PASSWORD"}
            </button>

            <Link
              href="/login?mode=login"
              className="block text-center text-sm text-muted hover:text-foreground min-h-[44px] leading-[44px]"
            >
              Cancel · Log in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
