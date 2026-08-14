import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const bundleId = "com.warroompicks.app";
const teamId = "XWW458P3J7";
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
