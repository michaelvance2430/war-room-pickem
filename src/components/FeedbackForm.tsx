"use client";

import { useState, type FormEvent } from "react";
import { getSession, getLeague } from "@/lib/league";

/** Personal inbox until a business address exists. */
export const FEEDBACK_TO_EMAIL = "michaelvance2430@gmail.com";

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
 * Account → Feedback.
 * Opens Apple Mail / Gmail / Android mail with a draft to Mike.
 * (No Vercel email keys required.)
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<string>("recommendation");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setError(null);

    const text = message.trim();
    if (text.length < 5) {
      setError("Message needs at least a few words.");
      setBusy(false);
      return;
    }

    const session = getSession();
    const league = getLeague();
    const name = (session?.playerName || "Player").trim().slice(0, 80);
    const reply = contactEmail.trim().slice(0, 120);
    const leagueName = (league?.name || "").trim().slice(0, 120);
    const userId = (session?.playerId || "").trim().slice(0, 80);

    const kindLabel =
      kind === "issue"
        ? "Issue / bug"
        : kind === "recommendation"
          ? "Recommendation"
          : kind === "discussion"
            ? "Discussion / idea"
            : "Feedback";

    const subject = `[War Room] ${kindLabel} from ${name}`;
    const body = [
      `Type: ${kindLabel}`,
      `From: ${name}`,
      reply ? `Reply-to: ${reply}` : "Reply-to: (not provided)",
      leagueName ? `League: ${leagueName}` : null,
      userId ? `User ID: ${userId}` : null,
      "",
      text,
    ]
      .filter(Boolean)
      .join("\n");

    // mailto: opens Apple Mail, Gmail app, or Android default mail
    const mailto = `mailto:${FEEDBACK_TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      // location.href is most reliable on iOS Safari for opening Mail
      window.location.href = mailto;
      setStatus(
        "Opening your mail app… address is already set to Mike. Hit Send when it opens."
      );
      setMessage("");
    } catch {
      setError(
        `Could not open mail. Email Mike directly: ${FEEDBACK_TO_EMAIL}`
      );
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
        Bug, idea, or general take. Opens your phone&apos;s mail app with a
        draft to Mike — just hit Send. Optional email if you want a reply.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
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
          {busy ? "Opening mail…" : "Open mail to send"}
        </button>

        <p className="text-[11px] text-muted text-center">
          Goes to{" "}
          <a
            href={`mailto:${FEEDBACK_TO_EMAIL}`}
            className="text-sky-300 underline-offset-2 hover:underline"
          >
            {FEEDBACK_TO_EMAIL}
          </a>
        </p>

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
