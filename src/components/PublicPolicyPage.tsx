import Link from "next/link";
import OwnershipNotice from "@/components/OwnershipNotice";

export default function PublicPolicyPage({ title, updated = "August 13, 2026", children }: { title: string; updated?: string; children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
    <Link href="/" className="text-sm text-primary">← War Room</Link>
    <h1 className="mt-5 text-3xl font-black">{title}</h1>
    <p className="mt-1 text-xs text-muted">Effective {updated}</p>
    <article className="mt-7 space-y-6 text-sm leading-7 text-foreground/90 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</article>
    <OwnershipNotice variant="full" className="mt-10" />
  </main>;
}
