"use client";

import { useState, type FormEvent } from "react";
import { getSession, getLeague } from "@/lib/league";

const KINDS = [
  { id: "issue", label: "Issue / bug", hint: "Something broken or confusing" },
  {
    id: "recommendation",
    label: "Recommendation",
    hint: "Feature idea or improvement",
  },
  {
    id: "discussion",
    label: "Discussion",
    hint: "Take, question, or general thoughts",
  },
] as const;

/**
 * Account → Feedback. Sends to Mike’s inbox via /api/feedback
 * (Resend, Web3Forms, or mailto fallback).
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<string>("recommendation");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setError(null);

    const session = getSession();
    const league = getLeague();

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          name: session?.playerName || "Player",
          contactEmail: contactEmail.trim() || undefined,
          leagueName: league?.name,
          userId: session?.playerId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        via?: string;
        mailto?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error || "Could not send. Try again.");
        setBusy(false);
        return;
      }

      if (data.via === "mailto" && data.mailto) {
        window.location.href = data.mailto;
        setStatus(
          "Opening your email app — hit send to deliver the note to Mike."
        );
      } else {
        setStatus("Sent. Thanks — Mike will see it.");
        setMessage("");
      }
    } catch {
      setError("Network error. Check connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="feedback"
      className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-5 mb-6"
    >
      <h2 className="font-semibold mb-1 text-sky-200">Feedback for Mike</h2>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Bug, idea, or general take — it goes to the app creator. Be honest.
        Optional email if you want a reply.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                kind === k.id
                  ? "border-sky-400 bg-sky-400/20 text-sky-100 font-semibold"
                  : "border-border text-muted hover:text-foreground"
              }`}
              title={k.hint}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className="block text-xs text-muted">
          Your message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={5}
            maxLength={4000}
            rows={4}
            placeholder="What’s working, what’s broken, what you want next…"
            className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y min-h-[100px]"
          />
        </label>

        <label className="block text-xs text-muted">
          Email for reply (optional)
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@email.com"
            className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </label>

        <button
          type="submit"
          disabled={busy || message.trim().length < 5}
          className="w-full py-2.5 rounded-lg bg-sky-400 text-black text-sm font-bold disabled:opacity-50 hover:opacity-90 transition"
        >
          {busy ? "Sending…" : "Send feedback"}
        </button>

        {status && (
          <p className="text-xs text-primary border border-primary/30 rounded-lg px-3 py-2">
            {status}
          </p>
        )}
        {error && (
          <p className="text-xs text-danger border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
