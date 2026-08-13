"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!isWarRoomNative()) return;
    let cancelled = false;
    let removeUrlListener: (() => Promise<void>) | undefined;

    void import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("appUrlOpen", ({ url }) => {
        const path = pathFromNativeUrl(url);
        if (path) router.push(path);
      });
      if (cancelled) await listener.remove();
      else removeUrlListener = () => listener.remove();
    });

    return () => {
      cancelled = true;
      void removeUrlListener?.();
    };
  }, [router]);

  return null;
}

export { pathFromNativeUrl };
