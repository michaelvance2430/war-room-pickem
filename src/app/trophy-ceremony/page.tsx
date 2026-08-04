"use client";

import dynamic from "next/dynamic";

const TrophyCeremonyClient = dynamic(
  () => import("./TrophyCeremonyClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-muted">…</p>
      </div>
    ),
  }
);

export default function TrophyCeremonyPage() {
  return <TrophyCeremonyClient />;
}
