"use client";

import { useMemo, useState } from "react";
import { getSession, getLeague } from "@/lib/league";

/** Primary War Room support and feedback inbox. */
export const FEEDBACK_TO_EMAIL = "mike@war-room-picks.com";

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

type Draft = {
  subject: string;
  body: string;
  mailto: string;
  gmail: string;
  outlook: string;
};

function buildDraft(opts: {
  kind: string;
  message: string;
  contactEmail: string;
}): Draft {
  const session = getSession();
  const league = getLeague();
  const name = (session?.playerName || "Player").trim().slice(0, 80);
  const reply = opts.contactEmail.trim().slice(0, 120);
  const leagueName = (league?.name || "").trim().slice(0, 120);
  const userId = (session?.playerId || "").trim().slice(0, 80);
  const label = kindLabel(opts.kind);

  const subject = `[War Room] ${label} from ${name}`;
  // Cap length — Gmail/Outlook URL compose has limits
  const body = [
    `Type: ${label}`,
    `From: ${name}`,
    reply ? `Reply-to: ${reply}` : null,
    leagueName ? `League: ${leagueName}` : null,
    userId ? `User ID: ${userId}` : null,
    "",
    opts.message.trim().slice(0, 900),
  ]
    .filter(Boolean)
    .join("\n");

  const to = FEEDBACK_TO_EMAIL;
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Works in the browser — no OS mail client required
  const gmail =
    `https://mail.google.com/mail/?view=cm&fs=1&tf=1` +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  const outlook =
    `https://outlook.live.com/mail/0/deeplink/compose` +
    `?to=${encodeURIComponent(to)}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return { subject, body, mailto, gmail, outlook };
}

function openInNewTab(url: string) {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    // Popup blocked — same-tab fallback
    window.location.href = url;
  }
}

/**
 * Account → Feedback for Mike.
 * Primary path = Gmail/Outlook *web* compose (always does something in browser).
 * mailto is optional extras for devices where it works.
 */
export default function FeedbackForm() {
  const [kind, setKind] = useState<string>("recommendation");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = message.trim().length >= 5;

  const draft = useMemo(
    () =>
      buildDraft({
        kind,
        message: canSend ? message : " ",
        contactEmail,
      }),
    [kind, message, contactEmail, canSend]
  );

  function sendVia(channel: "gmail" | "outlook" | "mailto") {
    setError(null);
    if (!canSend) {
      setError("Write a message first (at least a few words).");
      return;
    }
    const d = buildDraft({ kind, message, contactEmail });
    if (channel === "gmail") {
      openInNewTab(d.gmail);
      setStatus(
        "Gmail should open in a new tab with Mike as To and your note filled in. Hit Send there."
      );
      return;
    }
    if (channel === "outlook") {
      openInNewTab(d.outlook);
      setStatus(
        "Outlook on the web should open with a draft. Hit Send there."
      );
      return;
    }
    // mailto — OS app
    try {
      window.location.href = d.mailto;
      setStatus(
        "Tried to open your mail app. If nothing happened, use Gmail or Outlook buttons instead."
      );
    } catch {
      setError("Mail app blocked. Use Open in Gmail below.");
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_TO_EMAIL);
      setStatus("Copied: " + FEEDBACK_TO_EMAIL);
      setError(null);
    } catch {
      setError(`Type this: ${FEEDBACK_TO_EMAIL}`);
    }
  }

  async function copyDraft() {
    if (!canSend) {
      setError("Write a message first.");
      return;
    }
    const d = buildDraft({ kind, message, contactEmail });
    const full = `To: ${FEEDBACK_TO_EMAIL}\nSubject: ${d.subject}\n\n${d.body}`;
    try {
      await navigator.clipboard.writeText(full);
      setStatus("Draft copied. Paste into any email app and send.");
      setError(null);
    } catch {
      setError("Copy failed — select your message and copy manually.");
    }
  }

  return (
    <section
      id="feedback"
      className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-5 mb-6"
    >
      <h2 className="font-semibold mb-1 text-sky-200">Feedback for Mike</h2>
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Bug, idea, or take. Opens a draft <strong className="text-foreground">to{" "}
        {FEEDBACK_TO_EMAIL}</strong>. Gmail is the reliable path on phone and
        computer.
      </p>

      <div className="space-y-3">
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

        {/* Primary: Gmail web — always does something in the browser */}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => sendVia("gmail")}
          className="w-full py-3.5 min-h-[52px] rounded-xl bg-sky-400 text-black text-sm font-extrabold disabled:opacity-40 touch-manipulation active:scale-[0.99]"
        >
          Open in Gmail → send to Mike
        </button>

        <button
          type="button"
          disabled={!canSend}
          onClick={() => sendVia("outlook")}
          className="w-full py-3 min-h-[48px] rounded-xl border-2 border-sky-400/60 text-sky-100 text-sm font-bold disabled:opacity-40 touch-manipulation"
        >
          Open in Outlook on the web
        </button>

        <button
          type="button"
          disabled={!canSend}
          onClick={() => sendVia("mailto")}
          className="w-full py-2.5 rounded-lg border border-border text-sm text-muted hover:text-foreground disabled:opacity-40"
        >
          Try phone / desktop mail app
        </button>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => void copyEmail()}
            className="flex-1 text-xs py-2.5 rounded-lg border border-border text-muted hover:text-foreground"
          >
            Copy Mike&apos;s email
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void copyDraft()}
            className="flex-1 text-xs py-2.5 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-40"
          >
            Copy full draft
          </button>
        </div>

        <p className="text-[11px] text-muted text-center break-all">
          {FEEDBACK_TO_EMAIL}
        </p>

        {!canSend && (
          <p className="text-xs text-amber-200/90 text-center">
            Type a message above (5+ characters), then the buttons unlock.
          </p>
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
      </div>
    </section>
  );
}
