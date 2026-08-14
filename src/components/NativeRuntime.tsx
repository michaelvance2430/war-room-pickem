"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isWarRoomNative, safeWarRoomPath, WAR_ROOM_NATIVE } from "@/lib/native-contract";

function pathFromNativeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === `${WAR_ROOM_NATIVE.customScheme}:`) {
      const customPath = `/${url.host}${url.pathname}`;
      return `${safeWarRoomPath(customPath)}${url.search}${url.hash}`;
    }
    if (
      url.protocol === "https:" &&
      (url.host === WAR_ROOM_NATIVE.universalLinkHost || url.host === "war-room-picks.com")
    ) {
      return `${safeWarRoomPath(url.pathname)}${url.search}${url.hash}`;
    }
  } catch {
    return null;
  }
  return null;
}

export default function NativeRuntime() {
  const router = useRouter();
  const backgroundedAt = useRef<number | null>(null);
  const lastResumeRefreshAt = useRef(0);

  useEffect(() => {
    if (!isWarRoomNative()) return;
    let cancelled = false;
    const removers: Array<() => Promise<void>> = [];

    // Give the shared UI an explicit native boundary. This keeps iOS-only
    // interaction polish out of the website without maintaining two UIs.
    document.documentElement.dataset.warRoomRuntime = "native";

    void import("@capacitor/app").then(async ({ App }) => {
      const openUrl = ({ url }: { url: string }) => {
        const path = pathFromNativeUrl(url);
        if (path) router.push(path);
      };
      const urlListener = await App.addListener("appUrlOpen", openUrl);
      const stateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgroundedAt.current = Date.now();
          return;
        }
        window.dispatchEvent(new CustomEvent("warroom:native-resume"));

        // A quick Messages/Xcode/app-switch round trip should not rebuild the
        // entire React route. Refresh after a meaningful absence, and never
        // more than once per minute, to keep WKWebView memory flat.
        const now = Date.now();
        const awayFor = backgroundedAt.current == null ? 0 : now - backgroundedAt.current;
        backgroundedAt.current = null;
        if (awayFor >= 30_000 && now - lastResumeRefreshAt.current >= 60_000) {
          lastResumeRefreshAt.current = now;
          router.refresh();
        }
      });
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) openUrl(launchUrl);

      const newRemovers = [() => urlListener.remove(), () => stateListener.remove()];
      if (cancelled) await Promise.all(newRemovers.map((remove) => remove()));
      else removers.push(...newRemovers);
    });

    return () => {
      cancelled = true;
      delete document.documentElement.dataset.warRoomRuntime;
      void Promise.all(removers.map((remove) => remove()));
    };
  }, [router]);

  return null;
}

export { pathFromNativeUrl };
