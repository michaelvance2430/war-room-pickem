import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/server-api-auth";

export const runtime = "nodejs";

type Body = {
  kind?: string;
  message?: string;
  name?: string;
  contactEmail?: string;
  leagueName?: string;
  userId?: string;
};

const KINDS = new Set(["issue", "recommendation", "discussion", "other"]);

/**
 * Player feedback → your inbox.
 *
 * Configure on Vercel (any one path works):
 *  1) RESEND_API_KEY                       (Resend.com free tier)
 *  2) WEB3FORMS_ACCESS_KEY                 (web3forms.com free — email only)
 *  3) No provider key                      → returns mailto: for the client
 */
export async function POST(req: Request) {
  const identity = await authenticateApiRequest(req);
  if (!identity.ok) {
    return NextResponse.json(
      { ok: false, error: identity.error },
      { status: identity.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const kind = (body.kind || "other").toLowerCase();
  const message = (body.message || "").trim();
  const name = (body.name || "Player").trim().slice(0, 80);
  const contactEmail = (body.contactEmail || "").trim().slice(0, 120);
  const leagueName = (body.leagueName || "").trim().slice(0, 120);
  const userId = identity.userId;

  if (!message || message.length < 5) {
    return NextResponse.json(
      { ok: false, error: "Message needs at least a few words." },
      { status: 400 }
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "Message too long (max 4000)." },
      { status: 400 }
    );
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }

  const kindLabel =
    kind === "issue"
      ? "Issue / bug"
      : kind === "recommendation"
        ? "Recommendation"
        : kind === "discussion"
          ? "Discussion / idea"
          : "Feedback";

  const subject = `[War Room] ${kindLabel} from ${name}`;
  const text = [
    `Type: ${kindLabel}`,
    `From: ${name}`,
    contactEmail ? `Reply-to: ${contactEmail}` : "Reply-to: (not provided)",
    leagueName ? `League: ${leagueName}` : null,
    userId ? `User ID: ${userId}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const to = "mike@war-room-picks.com";

  // 1) Resend (optional — only if keys configured)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.FEEDBACK_FROM_EMAIL || "War Room <onboarding@resend.dev>",
          to: [to],
          subject,
          text,
          reply_to: contactEmail || undefined,
        }),
      });
      if (res.ok) {
        return NextResponse.json({ ok: true, via: "resend" });
      }
      const errText = await res.text();
      console.error("Resend failed", errText);
    } catch (e) {
      console.error("Resend error", e);
    }
  }

  // 2) Web3Forms (free access key → your email)
  const w3 = process.env.WEB3FORMS_ACCESS_KEY;
  if (w3) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: w3,
          subject,
          name,
          email: contactEmail || "noreply@warroom.local",
          message: text,
        }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (res.ok && data.success !== false) {
        return NextResponse.json({ ok: true, via: "web3forms" });
      }
    } catch (e) {
      console.error("Web3Forms error", e);
    }
  }

  // 3) Mailto — client opens Apple Mail / Gmail / Android mail
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return NextResponse.json({ ok: true, via: "mailto", mailto });
}
