/**
 * Stable identity and link contract shared by the web app and future native
 * containers. This file intentionally imports no Capacitor package, so adding
 * the iOS project cannot change today's web bundle or runtime behavior.
 */

export const WAR_ROOM_NATIVE = Object.freeze({
  appName: "War Room Pick'Em",
  bundleId: "com.warroompicks.app",
  customScheme: "warroom",
  canonicalOrigin: "https://www.war-room-picks.com",
  universalLinkHost: "www.war-room-picks.com",
});

export type WarRoomRuntime = "web" | "ios" | "android";

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

export function warRoomRuntime(): WarRoomRuntime {
  if (typeof window === "undefined") return "web";
  const platform = (window as CapacitorWindow).Capacitor?.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : "web";
}

export function isWarRoomNative(): boolean {
  if (typeof window === "undefined") return false;
  return (window as CapacitorWindow).Capacitor?.isNativePlatform?.() === true;
}

/** Allow only same-app paths. This protects auth/invite return routing. */
export function safeWarRoomPath(path: string | null | undefined, fallback = "/"): string {
  const candidate = String(path || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
}

/** Canonical HTTPS links work on web today and become iOS Universal Links. */
export function warRoomWebUrl(path: string): string {
  return new URL(safeWarRoomPath(path), `${WAR_ROOM_NATIVE.canonicalOrigin}/`).toString();
}

/** Reserved for native callback registration; never use as a web redirect. */
export function warRoomNativeUrl(path: string): string {
  return `${WAR_ROOM_NATIVE.customScheme}://${safeWarRoomPath(path).replace(/^\//, "")}`;
}

/**
 * Auth email links stay HTTPS so they work before the app exists, become
 * Universal Links after iOS association, and always have a browser fallback.
 */
export function warRoomAuthReturnUrl(path: string): string {
  const safePath = safeWarRoomPath(path);
  if (typeof window !== "undefined" && !isWarRoomNative()) {
    return new URL(safePath, `${window.location.origin}/`).toString();
  }
  return warRoomWebUrl(safePath);
}

export const WAR_ROOM_DEEP_LINKS = Object.freeze({
  home: "/",
  join: "/join",
  resetPassword: "/reset-password",
  account: "/account",
  picks: "/picks",
  standings: "/standings",
  lockerRoom: "/locker-room",
});
