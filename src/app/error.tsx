"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-danger/45 bg-card p-6 text-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-danger">Connection interrupted</p>
        <h1 className="mt-2 text-2xl font-black">The room lost the signal.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your submitted picks are not replaced by this screen. Reconnect and try the page again before creating or changing anything.
        </p>
        <button type="button" onClick={reset} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">
          Try this page again
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl border border-border text-xs font-bold">Return Home</Link>
          <Link href="/login" className="flex min-h-11 items-center justify-center rounded-xl border border-border text-xs font-bold">Check Login</Link>
        </div>
      </section>
    </main>
  );
}
