import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const bundleId = "com.warroompicks.app";
const supportedPaths = [
  "/join",
  "/join/*",
  "/reset-password",
  "/reset-password/*",
  "/login",
  "/login/*",
  "/account",
  "/account/*",
  "/picks",
  "/picks/*",
  "/standings",
  "/standings/*",
  "/locker-room",
  "/locker-room/*",
];

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim().toUpperCase();

  if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) {
    return NextResponse.json(
      { error: "Apple association is awaiting a valid APPLE_TEAM_ID." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [{ appID: `${teamId}.${bundleId}`, paths: supportedPaths }],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Content-Type": "application/json",
      },
    },
  );
}
