"use client";

import { useMemo, useState, type FormEvent } from "react";
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

function kindLabel(kind: string) {
  if (kind === "issue") return "Issue / bug";
  if (kind === "recommendation") return "Recommendation";
  if (kind === "discussion") return "Discussion / idea";
  return "Feedback";
}

function buildMailto(opts: {
  kind: string;
  message: string;
  contactEmail: string;
}): { subject: string; body: string; href: string } {
  const session = getSession();
  const league = getLeague();
  const name = (session?.playerName || "Player").trim().slice(0, 80);
  const reply = opts.contactEmail.trim().slice(0, 120);
  const leagueName = (league?.name || "").trim().slice(0, 120);
  const userId = (session?.playerId || "").trim().slice(0, 80);
  const label = kindLabel(opts.kind);

  const subject = `[War Room] ${label} from ${name}`;
  // Keep body short — some mail clients silently ignore long mailto: URLs
  const body = [
    `Type: ${label}`,
    `From: ${name}`,
    reply ? `Reply-to: ${reply}` : null,
    leagueName ? `League: ${leagueName}` : null,
    userId ? `User ID: ${userId}` : null,
    "",
    opts.message.trim().slice(0, 1200),
  ]
    .filter(Boolean)
    .join("\n");

  const href = `mailto:${FEEDBACK_TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, href };
}

/**
 * Opens the OS mail client (Apple Mail, Gmail, Outlook, Android mail).
 * Anchor click is far more reliable than window.location in Next.js / phones.
 */
function openMailClient(href: string): boolean {
  if (typeof window === "undefined" || !href) return false;

  try {
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("aria-hidden", "true");
    // Don't use target=_blank — breaks mailto on some desktop Outlook setups
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    /* fall through */
  }

  try {
    window.location.assign(href);
    return true;
  } catch {
    return false;
  }
}

/**
 * Account → Feedback.
 * Opens Apple Mail / Gmail / Outlook / Android mail with a draft to Mike.
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<string>("recommendation");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = message.trim().length >= 5;

  const mailto = useMemo(
    () =>
      buildMailto({
        kind,
        message: message || "(write your note above)",
        contactEmail,
      }),
    [kind, message, contactEmail]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!canSend) {
      setError("Message needs at least a few words.");
      return;
    }

    const { href } = buildMailto({ kind, message, contactEmail });
    const ok = openMailClient(href);

    if (ok) {
      setStatus(
        "If your mail app opened, hit Send. If nothing opened, use the blue email link below — or copy the address."
      );
    } else {
      setError(
        `Could not open mail. Write to ${FEEDBACK_TO_EMAIL} and paste your note.`
      );
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_TO_EMAIL);
      setStatus("Email address copied.");
      setError(null);
    } catch {
      setError(`Copy failed — type this: ${FEEDBACK_TO_EMAIL}`);
    }
  }

  async function copyFullDraft() {
    const { subject, body } = buildMailto({ kind, message, contactEmail });
    const full = `To: ${FEEDBACK_TO_EMAIL}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      setStatus("Full draft copied — paste into Outlook, Gmail, or any mail app.");
      setError(null);
    } catch {
      setError("Could not copy. Select and copy manually from the fields above.");
    }
  }

  return (
    <section
      id="feedback"
      className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-5 mb-6"
    >
      <h2 className="font-semibold mb-1 text-sky-200">Feedback for Mike</h2>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Bug, idea, or general take. This opens your mail app (Outlook, Apple
        Mail, Gmail, etc.) with Mike already in the To field — then you hit
        Send.
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

        {/* Real <a href="mailto:"> — most reliable on phone + desktop */}
        {canSend ? (
          <a
            href={mailto.href}
            onClick={() => {
              setStatus(
                "Mail app should open with Mike as To. Hit Send when ready."
              );
              setError(null);
            }}
            className="flex items-center justify-center w-full py-3 min-h-[48px] rounded-lg bg-sky-400 text-black text-sm font-bold hover:opacity-90 transition touch-manipulation"
          >
            Open mail to Mike
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="w-full py-3 min-h-[48px] rounded-lg bg-sky-400/40 text-black/60 text-sm font-bold cursor-not-allowed"
          >
            Write a message first (5+ characters)
          </button>
        )}

        {/* Hidden submit still works for Enter key */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Submit
        </button>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={`mailto:${FEEDBACK_TO_EMAIL}`}
            className="flex-1 text-center text-xs py-2.5 rounded-lg border border-sky-400/50 text-sky-200 font-semibold hover:bg-sky-400/10"
          >
            {FEEDBACK_TO_EMAIL}
          </a>
          <button
            type="button"
            onClick={() => void copyEmail()}
            className="flex-1 text-xs py-2.5 rounded-lg border border-border text-muted hover:text-foreground"
          >
            Copy email address
          </button>
        </div>

        {canSend && (
          <button
            type="button"
            onClick={() => void copyFullDraft()}
            className="w-full text-xs py-2 rounded-lg border border-border text-muted hover:text-foreground"
          >
            Copy full draft (if mail app won’t open)
          </button>
        )}

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
