import Link from "next/link";

export default function PublicPolicyLinks({ className = "" }: { className?: string }) {
  return <nav aria-label="Policies and support" className={`flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted ${className}`}>
    <Link href="/privacy" className="hover:text-primary">Privacy</Link>
    <Link href="/terms" className="hover:text-primary">Terms</Link>
    <Link href="/community" className="hover:text-primary">Community Standards</Link>
    <Link href="/support" className="hover:text-primary">Support</Link>
  </nav>;
}
