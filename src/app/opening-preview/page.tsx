"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import OpeningCinematicPreview from "@/components/OpeningCinematicPreview";

export default function OpeningPreviewPage() {
  const router = useRouter();

  return (
    <main className="fixed inset-0 z-[70] bg-black">
      <OpeningCinematicPreview onDone={() => router.push("/account")} showReplay />
      <Link href="/account" className="absolute z-[90] right-4 bottom-4 min-h-[44px] rounded-full border border-white/30 bg-black/55 px-4 flex items-center text-xs font-bold text-white">
        Back to Profile
      </Link>
    </main>
  );
}
