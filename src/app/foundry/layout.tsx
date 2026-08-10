import type { ReactNode } from "react";

/**
 * War Room auth intentionally persists in browser local storage, not SSR
 * cookies. A server auth check here therefore sees every signed-in user as
 * anonymous and redirects the real owner home. The client page performs the
 * UUID gate before rendering; privileged APIs independently validate the
 * bearer token on the server.
 */
export default function PrivateWorkshopLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
