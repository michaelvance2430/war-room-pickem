import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-muted">Missing page</p>
        <h1 className="mt-2 text-2xl font-black">That briefing does not exist.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The link may be old, or the page may belong to a league you cannot access.
        </p>
        <Link href="/" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">
          Return to War Room
        </Link>
      </section>
    </main>
  );
}
