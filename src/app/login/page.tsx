"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          router.push("/");
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
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary text-black font-bold text-lg flex items-center justify-center mx-auto mb-3">
            WR
          </div>
          <h1 className="text-2xl font-bold">War Room Pick&apos;Em</h1>
          <p className="text-sm text-muted mt-1">
            {mode === "login" ? "Log in to continue" : "Create an account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs text-muted block mb-1">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="Your name in the league"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-muted block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
          >
            {loading ? "…" : mode === "login" ? "Log in" : "Sign up"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
            }}
            className="w-full text-sm text-muted"
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          <Link href="/" className="hover:text-foreground">Back</Link>
        </p>
      </div>
    </div>
  );
}